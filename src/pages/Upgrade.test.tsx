import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { useAuth, fetchPremiumPrice, formatPremiumPrice, startPremiumCheckout, getApiBaseUrl, readUpgradeSource, trackFunnel } =
  vi.hoisted(() => ({
    useAuth: vi.fn(),
    fetchPremiumPrice: vi.fn(),
    formatPremiumPrice: vi.fn(),
    startPremiumCheckout: vi.fn(),
    getApiBaseUrl: vi.fn(),
    readUpgradeSource: vi.fn(),
    trackFunnel: vi.fn(),
  }));

vi.mock("../lib/AuthContext.jsx", () => ({ useAuth }));
vi.mock("../lib/api.js", () => ({ getApiBaseUrl }));
vi.mock("../lib/premiumCheckout.js", () => ({
  fetchPremiumPrice,
  formatPremiumPrice,
  startPremiumCheckout,
  readUpgradeSource,
}));
vi.mock("../lib/funnel.js", () => ({ trackFunnel }));
vi.mock("../lib/usePageMetadata.js", () => ({ default: () => {} }));
vi.mock("../components/AuthButton.jsx", () => ({
  default: () => <div data-testid="auth-button" />,
}));

const LIVE_LINK = "https://buy.stripe.com/test-founding-link";

/**
 * FOUNDING_CHECKOUT_URL is read at module scope by BOTH Upgrade and LandingFounding,
 * so the campaign on/off state can only be varied by re-importing the graph.
 */
async function renderUpgrade({
  founding = LIVE_LINK,
  plan = null,
}: { founding?: string; plan?: string | null } = {}) {
  vi.resetModules();
  vi.doMock("../lib/publicSiteConfig.js", () => ({
    FOUNDING_CHECKOUT_URL: founding,
    CHROME_WEB_STORE_URL: "https://chrome.example/store",
  }));

  useAuth.mockReturnValue({
    user: plan ? { uid: "u1", email: "someone@example.com" } : null,
    loading: false,
    plan,
    planLoading: false,
    planError: null,
    accountStatus: null,
    logout: vi.fn(),
  });

  const { default: Upgrade } = await import("./Upgrade.jsx");
  render(
    <MemoryRouter>
      <Upgrade />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchPremiumPrice.mockResolvedValue({ unitAmount: 1499, currency: "usd" });
  formatPremiumPrice.mockReturnValue({ amount: "$14.99", suffix: "/mo" });
  getApiBaseUrl.mockReturnValue("https://api.example.com");
  readUpgradeSource.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Upgrade — founding offer", () => {
  test("a signed-out visitor sees the offer AND its anchor target actually exists", async () => {
    await renderUpgrade();

    // The banner is the part that catches pricing-intent traffic above the fold.
    const banner = await screen.findByTestId("founding-banner");
    expect(banner).toHaveAttribute("href", "#founding");
    expect(banner).toHaveTextContent("$79 once, premium for life.");

    // The regression that motivated this: a link to #founding on a page that has
    // no #founding. Assert the target element, not just the link.
    expect(document.getElementById("founding")).not.toBeNull();

    const checkout = await screen.findByTestId("founding-checkout-link");
    expect(checkout).toHaveAttribute("href", LIVE_LINK);
  });

  test("an existing premium subscriber is not sold a second entitlement", async () => {
    await renderUpgrade({ plan: "premium" });

    expect(await screen.findByText("Open dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("founding-banner")).toBeNull();
    expect(screen.queryByTestId("founding-checkout-link")).toBeNull();
    expect(document.getElementById("founding")).toBeNull();
  });

  test("with the campaign switched off, nothing founding-related is left behind", async () => {
    await renderUpgrade({ founding: "" });

    // Monthly pricing still renders, so the page is not merely blank.
    expect(await screen.findByText("$14.99")).toBeInTheDocument();
    expect(screen.queryByTestId("founding-banner")).toBeNull();
    expect(screen.queryByTestId("founding-checkout-link")).toBeNull();
    expect(document.getElementById("founding")).toBeNull();
  });
});

describe("Upgrade — quarterly plan and funnel events", () => {
  const QUARTERLY = { unitAmount: 5900, currency: "usd", interval: "month", intervalCount: 3 };

  beforeEach(() => {
    fetchPremiumPrice.mockResolvedValue({ unitAmount: 2499, currency: "usd", interval: "month", intervalCount: 1, quarterly: QUARTERLY });
    formatPremiumPrice.mockImplementation((price) => (price
      ? { amount: `$${(price.unitAmount / 100).toFixed(2)}`, suffix: price.intervalCount === 3 ? "/3 mo" : "/mo" }
      : null));
    readUpgradeSource.mockReturnValue("ext_search_read");
  });

  test("a free user can pick quarterly and checks out on that plan, with each step recorded", async () => {
    await renderUpgrade({ founding: "", plan: "free" });

    expect(await screen.findByText("$24.99")).toBeInTheDocument();
    expect(trackFunnel).toHaveBeenCalledWith("upgrade_view", { source: "ext_search_read", signedIn: true, premium: false });

    fireEvent.click(await screen.findByTestId("billing-plan-quarterly"));
    expect(await screen.findByText("$59.00")).toBeInTheDocument();
    expect(screen.getByTestId("billing-plan-quarterly")).toHaveTextContent("save 21%");
    expect(screen.getByTestId("billing-plan-note")).toHaveTextContent("about $19.67/mo · billed every 3 months");
    expect(screen.getByTestId("quarterly-promo-note")).toHaveTextContent("founder code");
    expect(trackFunnel).toHaveBeenCalledWith("upgrade_plan", { plan: "quarterly", source: "ext_search_read" });

    fireEvent.click(screen.getByText("Start Premium"));
    expect(trackFunnel).toHaveBeenCalledWith("upgrade_click", { source: "ext_search_read", plan: "quarterly" });
    expect(startPremiumCheckout).toHaveBeenCalledWith({ plan: "quarterly" });
  });

  test("monthly stays the default", async () => {
    await renderUpgrade({ founding: "", plan: "free" });
    fireEvent.click(await screen.findByText("Start Premium"));
    expect(startPremiumCheckout).toHaveBeenCalledWith({ plan: "monthly" });
  });

  test("without a quarterly price the page offers monthly only", async () => {
    fetchPremiumPrice.mockResolvedValue({ unitAmount: 2499, currency: "usd", interval: "month", intervalCount: 1, quarterly: null });
    await renderUpgrade({ founding: "", plan: "free" });
    expect(await screen.findByText("$24.99")).toBeInTheDocument();
    expect(screen.queryByTestId("billing-plan-toggle")).toBeNull();
  });

  test("a premium member is not shown the plan switch", async () => {
    await renderUpgrade({ founding: "", plan: "premium" });
    expect(await screen.findByText("Open dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("billing-plan-toggle")).toBeNull();
  });
});
