import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import OutcomeMemory from "./OutcomeMemory";

const fetchEmailMetrics = vi.hoisted(() => vi.fn());
const fetchApplicationStats = vi.hoisted(() => vi.fn());
const fetchResumeGaps = vi.hoisted(() => vi.fn());
const fetchSuggestionOutcomeAnalytics = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  currentUser: { uid: "test-user" } as { uid: string } | null,
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb(authState.currentUser);
    return () => {};
  },
}));

vi.mock("@/lib/firebase", () => ({ auth: authState }));

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => ({ user: authState.currentUser, loading: false }),
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    fetchEmailMetrics,
    fetchApplicationStats,
    fetchResumeGaps,
    fetchSuggestionOutcomeAnalytics,
  };
});

const COHORT_METRICS = {
  applicationsSent: 18,
  reachedInterview: 1,
  reachedOffer: 0,
  rejectedCohorts: 7,
  interviewRate: 5.6,
  offerRate: 0,
  rejectionRate: 38.9,
  basis: "email_cohorts_all_time",
  ungroupableEmails: 0,
};

const funnel = (overrides = {}) => ({
  applied: 18,
  settled: 18,
  pending: 0,
  silent: 17,
  rejected: 7,
  reachedInterview: 1,
  reachedOffer: 0,
  interviewRate: 0.056,
  settledInterviewRate: 0.056,
  offerRate: 0,
  focus: "reach",
  basis: "email_cohorts_all_time",
  ...overrides,
});

const velocity = (overrides = {}) => ({
  counts: { auto_screen: 6, recruiter_screen: 1, late_stage: 0, post_interview: 0 },
  classified: 7,
  unknown: 0,
  medianEligible: true,
  averageDays: 1.4,
  dominant: "auto_screen",
  ...overrides,
});

const mockMetrics = (searchSignals: unknown) => {
  fetchEmailMetrics.mockResolvedValue({
    success: true,
    timeframe: "all_time",
    metrics: {
      totalApplications: 18,
      totalInterviewed: 1,
      totalOffers: 0,
      totalRejected: 7,
      responseRate: 5.6,
      interviewRate: 5.6,
      offerRate: 0,
      rejectionRate: 38.9,
      totalEmails: 26,
    },
    cohortMetrics: COHORT_METRICS,
    searchSignals,
  });
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OutcomeMemory />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.currentUser = { uid: "test-user" };
  fetchApplicationStats.mockResolvedValue({ success: true, stats: { emails: { total: 26, linked: 26, ungrouped: 0 } } });
  fetchResumeGaps.mockResolvedValue({ success: true, gaps: [] });
  fetchSuggestionOutcomeAnalytics.mockResolvedValue({ success: false, analytics: undefined });
  mockMetrics({ funnel: funnel(), rejectionVelocity: velocity(), computedAt: "2026-08-05T00:00:00.000Z" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("OutcomeMemory read against the shared Signal Layer", () => {
  test("describes how the rejections it counts actually arrived", async () => {
    // The page has always counted 7 rejections. It has never been able to say that 6 of
    // them came back before a human could have read anything — which is the one thing an
    // inbox-based tracker knows and a spreadsheet does not.
    renderPage();

    expect(await screen.findByText(/6 of your 7 timed rejections/i)).toBeInTheDocument();
    expect(screen.getByText(/too fast for anyone to have read/i)).toBeInTheDocument();
  });

  test("the read replaces the generic filler rather than sitting beside it", async () => {
    renderPage();

    expect(await screen.findByText(/A referral moves this more than another cold application/i)).toBeInTheDocument();
    expect(screen.queryByText(/spot which kinds of roles respond best/i)).not.toBeInTheDocument();
  });

  test("an offer in play changes what the page says the work is", async () => {
    mockMetrics({
      funnel: funnel({ focus: "offer", reachedOffer: 1, reachedInterview: 3, offerRate: 0.333 }),
      rejectionVelocity: velocity({ dominant: null }),
      computedAt: "2026-08-05T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByText(/the live work is evaluating and negotiating it/i)).toBeInTheDocument();
  });

  test("applications still in flight are named so the rejection rate is not read as the whole story", async () => {
    mockMetrics({
      funnel: funnel({ pending: 5, settled: 13 }),
      rejectionVelocity: velocity(),
      computedAt: "2026-08-05T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByText(/5 of 18 applications are still inside the response window/i)).toBeInTheDocument();
  });

  test("without a dominant pattern or enough history the page says nothing extra", async () => {
    mockMetrics({
      funnel: funnel({ focus: "insufficient_data" }),
      rejectionVelocity: velocity({ dominant: null, classified: 2, medianEligible: false }),
      computedAt: "2026-08-05T00:00:00.000Z",
    });

    renderPage();

    // Falls back to the original copy rather than inventing a read from two rejections.
    expect(await screen.findByText(/spot which kinds of roles respond best/i)).toBeInTheDocument();
    expect(screen.queryByText(/timed rejections/i)).not.toBeInTheDocument();
  });

  test("an older backend that sends no signals still renders every existing number", async () => {
    mockMetrics(undefined);

    renderPage();

    expect(await screen.findByText(/1 of 18 applications reached an interview/i)).toBeInTheDocument();
    expect(screen.getByText(/spot which kinds of roles respond best/i)).toBeInTheDocument();
  });
});
