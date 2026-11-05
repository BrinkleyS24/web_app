import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FirstMoveCard } from "./FirstMoveCard";
const useAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/AuthContext.jsx", () => ({useAuth}));

const { fetchResume, fetchApplyGateHistory, fetchEmailMetrics, saveResume } = vi.hoisted(() => ({
  fetchResume: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  saveResume: vi.fn(),
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return { ...actual, fetchResume, fetchApplyGateHistory, fetchEmailMetrics, saveResume };
});

const RESUME = "Senior QA engineer with eight years of testing experience and SQL.";

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FirstMoveCard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, queryClient };
}

function metricsWith(applicationsSent: number) {
  return {
    success: true,
    timeframe: "last_30_days",
    metrics: {
      totalApplications: 0, totalInterviewed: 0, totalOffers: 0, totalRejected: 0,
      responseRate: 0, interviewRate: 0, offerRate: 0, rejectionRate: 0, totalEmails: 0,
    },
    cohortMetrics: {
      applicationsSent, reachedInterview: 0, reachedOffer: 0, rejectedCohorts: 0,
      interviewRate: 0, offerRate: 0, rejectionRate: 0,
      basis: "email_cohorts_all_time", ungroupableEmails: 0,
    },
  };
}

beforeEach(() => {
  useAuth.mockReturnValue({user: {uid: "fictional-first-move"}, loading: false});
  localStorage.clear();
  fetchResume.mockResolvedValue({ success: true, resumeText: null });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });
  fetchEmailMetrics.mockResolvedValue(metricsWith(0));
  saveResume.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FirstMoveCard", () => {
  test("unknown metric state cannot briefly present a new-user claim", async () => {
    fetchEmailMetrics.mockReturnValue(new Promise(() => {}));
    const {container} = renderCard();
    await waitFor(() => expect(fetchResume).toHaveBeenCalled());
    expect(container.querySelector("[data-testid='first-move-card']")).toBeNull();
  });
  test("signed-out cards make no account reads", () => {
    useAuth.mockReturnValue({user: null, loading: false});
    renderCard();
    expect(fetchResume).not.toHaveBeenCalled();
    expect(fetchEmailMetrics).not.toHaveBeenCalled();
  });
  test("no resume -> Step 1 with the resume input", async () => {
    renderCard();
    expect(await screen.findByText(/Get a verdict on the next role/)).toBeInTheDocument();
    expect(screen.getByLabelText("Resume text")).toBeInTheDocument();
  });

  test("resume saved, 0 runs -> Step 2 with the CTA to /apply-gate", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    renderCard();
    const cta = await screen.findByRole("link", { name: /Run your first Apply Gate/ });
    expect(cta).toHaveAttribute("href", "/apply-gate");
  });

  test("established account -> Step 2 headline names the tracked applications", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(42));
    renderCard();
    expect(
      await screen.findByText(/Apply Gate already knows your 42 tracked applications/),
    ).toBeInTheDocument();
  });

  test("thin account -> generic Step 2 headline (no count)", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(2));
    renderCard();
    expect(await screen.findByText("Run Apply Gate on a role you're weighing.")).toBeInTheDocument();
    expect(screen.queryByText(/already knows your/)).not.toBeInTheDocument();
  });

  test("boundary — established at exactly 5", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(5));
    renderCard();
    expect(
      await screen.findByText(/Apply Gate already knows your 5 tracked applications/),
    ).toBeInTheDocument();
  });

  test("boundary — thin at 4", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchEmailMetrics.mockResolvedValue(metricsWith(4));
    renderCard();
    expect(await screen.findByText("Run Apply Gate on a role you're weighing.")).toBeInTheDocument();
    expect(screen.queryByText(/already knows your/)).toBeNull();
  });

  test(">= 1 gate run -> card hidden", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [{ id: "v1" }] });
    const { container } = renderCard();
    await waitFor(() => expect(fetchApplyGateHistory).toHaveBeenCalled());
    await waitFor(() =>
      expect(container.querySelector("[data-testid='first-move-card']")).toBeNull(),
    );
  });

  test("owner's saved dismissal hides the card after signals load", async () => {
    localStorage.setItem("firstMove.dismissed:fictional-first-move", "true");
    const { container, queryClient } = renderCard();
    await waitFor(() => expect(queryClient.getQueryState(["email-metrics", "last_30_days", "fictional-first-move"])?.status).toBe("success"));
    expect(container.querySelector("[data-testid='first-move-card']")).toBeNull();
  });

  test("another owner's dismissal cannot hide onboarding for this account", async () => {
    localStorage.setItem("firstMove.dismissed:another-fictional-owner", "true");
    renderCard();
    expect(await screen.findByLabelText("Resume text")).toBeInTheDocument();
  });

  test("an unattributed legacy dismissal cannot be assigned to this owner", async () => {
    localStorage.setItem("firstMove.dismissed", "true");
    renderCard();
    expect(await screen.findByLabelText("Resume text")).toBeInTheDocument();
  });

  test("a dismissal survives remount only for the owner who made it", async () => {
    const user = userEvent.setup();
    const first = renderCard();
    await screen.findByLabelText("Resume text");
    await user.click(screen.getByRole("button", {name: "Dismiss", exact: true}));
    expect(localStorage.getItem("firstMove.dismissed:fictional-first-move")).toBe("true");
    expect(localStorage.getItem("firstMove.dismissed")).toBeNull();
    first.unmount();
    const sameOwner = renderCard();
    await waitFor(() => expect(sameOwner.queryClient.getQueryState(["email-metrics", "last_30_days", "fictional-first-move"])?.status).toBe("success"));
    expect(screen.queryByLabelText("Resume text")).toBeNull();
    sameOwner.unmount();
    useAuth.mockReturnValue({user: {uid: "another-fictional-owner"}, loading: false});
    renderCard();
    expect(await screen.findByLabelText("Resume text")).toBeInTheDocument();
  });

  test("storage denial still permits a session dismissal without losing the card's state", async () => {
    const user = userEvent.setup();
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    try {
      renderCard();
      await screen.findByLabelText("Resume text");
      await user.click(screen.getByRole("button", {name: "Dismiss", exact: true}));
      expect(screen.queryByLabelText("Resume text")).toBeNull();
    } finally { read.mockRestore(); write.mockRestore(); }
  });

  test("saving a resume advances to Step 2", async () => {
    const user = userEvent.setup();
    renderCard();
    const textarea = await screen.findByLabelText("Resume text");
    await user.type(textarea, RESUME);
    // The save invalidates ["user-resume"]; the refetch should now return it.
    fetchResume.mockResolvedValue({ success: true, resumeText: RESUME });
    await user.click(screen.getByRole("button", { name: /Save resume/ }));
    expect(
      await screen.findByRole("link", { name: /Run your first Apply Gate/ }),
    ).toBeInTheDocument();
  });

  test("save failure -> inline error, stays on Step 1, keeps the pasted text", async () => {
    const user = userEvent.setup();
    saveResume.mockRejectedValue(new Error("network"));
    renderCard();
    const textarea = await screen.findByLabelText("Resume text");
    await user.type(textarea, RESUME);
    await user.click(screen.getByRole("button", { name: /Save resume/ }));
    expect(await screen.findByText(/Couldn't save your resume/)).toBeInTheDocument();
    expect(screen.getByLabelText("Resume text")).toHaveValue(RESUME);
  });

  test("signal query error -> renders nothing", async () => {
    fetchResume.mockRejectedValue(new Error("boom"));
    const { container } = renderCard();
    await waitFor(() => expect(fetchResume).toHaveBeenCalled());
    await waitFor(() =>
      expect(container.querySelector("[data-testid='first-move-card']")).toBeNull(),
    );
  });
});
