import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { useAuth, fetchPremiumPrice, formatPremiumPrice, startPremiumCheckout, getApiBaseUrl } =
  vi.hoisted(() => ({
    useAuth: vi.fn(),
    fetchPremiumPrice: vi.fn(),
    formatPremiumPrice: vi.fn(),
    startPremiumCheckout: vi.fn(),
    getApiBaseUrl: vi.fn(),
  }));

vi.mock("../lib/AuthContext.jsx", () => ({ useAuth }));
vi.mock("../lib/api.js", () => ({ getApiBaseUrl }));
vi.mock("../lib/premiumCheckout.js", () => ({
  fetchPremiumPrice,
  formatPremiumPrice,
  startPremiumCheckout,
}));
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
