import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import Dashboard from "./DashboardNew";

const useAuth = vi.fn();

const {
  fetchApplicationStats,
  fetchApplyGateHistory,
  fetchEmailMetrics,
  fetchRankedActionQueue,
  fetchResume,
  fetchStrategyAlerts,
  fetchSuggestionOutcomeAnalytics,
  fetchSyncStatus,
  fetchWeeklyHighlights,
  startEmailSync,
} = vi.hoisted(() => ({
  fetchApplicationStats: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  fetchRankedActionQueue: vi.fn(),
  fetchResume: vi.fn(),
  fetchStrategyAlerts: vi.fn(),
  fetchSuggestionOutcomeAnalytics: vi.fn(),
  fetchSyncStatus: vi.fn(),
  fetchWeeklyHighlights: vi.fn(),
  startEmailSync: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({ uid: "user-1", email: "stacey@example.test" });
    return vi.fn();
  }),
}));

vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: { uid: "user-1", email: "stacey@example.test" },
  },
}));

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    fetchApplicationStats,
    fetchApplyGateHistory,
    fetchEmailMetrics,
    fetchRankedActionQueue,
    fetchResume,
    fetchStrategyAlerts,
    fetchSuggestionOutcomeAnalytics,
    fetchSyncStatus,
    fetchWeeklyHighlights,
    startEmailSync,
  };
});

/**
 * A ranked action with every field the mapper insists on. `mapRankedActionToQueueItem` throws on a
 * missing contract field rather than rendering a half-item, so tests that build their own queue
 * spread this and override only what they are actually asserting on.
 */
const QUEUE_ITEM_TEMPLATE = {
  id: "queue-1",
  logicalKey: "queue:1",
  dedupeKey: "queue:1:v1",
  primaryEntityId: "thread-1",
  evidenceVersion: "v1",
  actionType: "follow_up",
  actionCategory: "communication",
  title: "Send follow-up to Acme Health",
  whyNow: "Acme Health is inside the follow-up window.",
  targetOutcome: "Increase the chance of a recruiter response.",
  effortMinutes: 10,
  urgencyLevel: "high",
  confidenceLevel: "strong",
  source: "followup_engine",
  status: "open",
  effectiveStatus: "open",
  createdAt: "2026-04-02T12:00:00.000Z",
  evidence: ["No tracked terminal outcome."],
  threadId: "thread-1",
  emailId: "email-1",
  applicationId: "app-1",
  suggestionSource: "email_followup",
  queueSource: "followup",
  intent: "FOLLOW_UP_THREAD",
  intentLabel: "Follow-up",
  playbook: ["Ask for timing or next steps, not a decision."],
  sourceLabel: "Outreach task",
  draftEligible: true,
  routeHref: "/fix-suggestions",
  routeLabel: "Open queue",
  stageLabel: "Outreach",
  company: "Acme Health",
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-13T12:00:00.000Z").getTime());

  useAuth.mockReturnValue({
    user: { uid: "user-1", email: "stacey@example.test" },
    loading: false,
  });

  fetchEmailMetrics.mockResolvedValue({
    success: true,
    timeframe: "last_30_days",
    metrics: {
      totalApplications: 10,
      totalInterviewed: 2,
      totalOffers: 1,
      totalRejected: 4,
      responseRate: 30,
      interviewRate: 20,
      offerRate: 10,
      rejectionRate: 40,
      totalEmails: 17,
    },
    cohortMetrics: {
      applicationsSent: 8,
      reachedInterview: 2,
      reachedOffer: 1,
      rejectedCohorts: 3,
      interviewRate: 25,
      offerRate: 12.5,
      rejectionRate: 37.5,
      basis: "email_cohorts_all_time",
      ungroupableEmails: 2,
    },
  });

  fetchApplicationStats.mockResolvedValue({
    success: true,
    stats: {
      applications: {
        applied: 10,
        interviewed: 2,
        offered: 1,
        rejected: 4,
        total: 17,
      },
      emails: {
        linked: 14,
        total: 17,
        ungrouped: 3,
      },
    },
  });

  fetchSuggestionOutcomeAnalytics.mockResolvedValue({
    success: true,
    analytics: {
      followup: {
        summary: {
          shownApplications: 4,
          completedApplications: 3,
          completedRate: 0.75,
          positiveOutcomeApplications: 2,
          positiveOutcomeRate: 0.5,
          averageDisplaysPerApplication: 1.25,
        },
        outcomes: {
          completed: {
            applications: 3,
            positiveOutcomes: 2,
            positiveRate: 0.5,
          },
          ignored: {
            applications: 1,
            positiveOutcomes: 0,
            positiveRate: 0.1,
          },
          observedLift: 0.4,
        },
        byActionType: [],
      },
      nonFollowup: {
        summary: {
          shownSuggestions: 0,
          completedSuggestions: 0,
          snoozedSuggestions: 0,
          activeSuggestions: 0,
          completionRate: 0,
        },
        bySource: [],
      },
    },
  });

  fetchApplyGateHistory.mockResolvedValue({
    success: true,
    history: [
      {
        id: "verdict-1",
        job_title: "QA Analyst",
        company_name: "Acme Health",
        job_url: "https://example.test/jobs/qa-analyst",
        verdict: "risky",
        score: 52,
        hard_blocker: false,
        reasons: JSON.stringify(["Missing healthcare data proof"]),
        explanation_payload: {
          hard_blockers: [],
          role_core_gaps: ["Healthcare reporting"],
          missing_required: ["SQL"],
          missing_preferred: [],
          evidence_gaps: ["Dashboard ownership"],
          capability_gaps: [],
          primary_rejection_drivers: ["Resume does not show SQL proof"],
          decision: "fix_first",
          assessment_confidence: "high",
          action_plan: {
            quick_fixes: ["Add a bullet proving SQL reporting work."],
            resume_proof_improvements: ["Add dashboard ownership evidence."],
            long_term_gaps: [],
          },
          fit_notes: ["The QA background overlaps with testing workflow expectations."],
        },
        fix_suggestion: "Add SQL proof before applying.",
        user_action: null,
        created_at: "2026-04-12T12:00:00.000Z",
      },
    ],
  });

  fetchRankedActionQueue.mockResolvedValue({
    success: true,
    queue: {
      now: "2026-04-13T12:00:00.000Z",
      doToday: [
        {
          id: "queue-applygate-1",
          logicalKey: "applygate:job-1",
          dedupeKey: "applygate:job-1:v1",
          primaryEntityId: "job-1",
          evidenceVersion: "v1",
          actionType: "tailor_resume",
          actionCategory: "optimization",
          title: "Tailor resume before applying to Datadog",
          whyNow: "Apply Gate found a proof gap.",
          targetOutcome: "Raise fit before applying.",
          effortMinutes: 15,
          urgencyLevel: "high",
          confidenceLevel: "moderate",
          source: "apply_gate",
          status: "open",
          effectiveStatus: "open",
          createdAt: "2026-04-13T10:00:00.000Z",
          evidence: ["Missing platform proof."],
          threadId: "job-1",
          applicationId: "verdict-2",
          suggestionSource: "apply_gate_action_plan",
          queueSource: "resume",
          intent: "TAILOR_RESUME",
          intentLabel: "Tailor resume",
          playbook: ["Add missing platform proof."],
          sourceLabel: "Optimization task",
          draftEligible: false,
          routeHref: "/apply-gate",
          routeLabel: "Review in Apply Gate",
          stageLabel: "Optimization",
          company: "Datadog",
        },
        {
          id: "queue-followup-1",
          logicalKey: "followup:thread-1",
          dedupeKey: "followup:thread-1:v1",
          primaryEntityId: "thread-1",
          evidenceVersion: "v1",
          actionType: "follow_up",
          actionCategory: "communication",
          title: "Send follow-up to Acme Health",
          whyNow: "Acme Health is inside the follow-up window.",
          targetOutcome: "Increase the chance of a recruiter response.",
          effortMinutes: 10,
          urgencyLevel: "high",
          confidenceLevel: "strong",
          source: "followup_engine",
          status: "open",
          effectiveStatus: "open",
          createdAt: "2026-04-02T12:00:00.000Z",
          evidence: ["No tracked terminal outcome."],
          threadId: "thread-1",
          emailId: "email-1",
          applicationId: "app-1",
          suggestionSource: "email_followup",
          queueSource: "followup",
          intent: "FOLLOW_UP_THREAD",
          intentLabel: "Follow-up",
          playbook: [
            "No tracked terminal outcome.",
            "Keep the message concise and specific to the current thread.",
            "Ask for timing or next steps, not a decision.",
          ],
          sourceLabel: "Outreach task",
          draftEligible: true,
          routeHref: "/fix-suggestions",
          routeLabel: "Open queue",
          stageLabel: "Outreach",
          company: "Acme Health",
        },
      ],
      thisWeek: [],
      later: [],
      blocked: [],
      dismissed: [],
      expired: [],
      done: [],
      emptyState: null,
      resolvedActions: [
        {
          id: "queue-followup-1",
          logicalKey: "followup:thread-1",
          dedupeKey: "followup:thread-1:v1",
          primaryEntityId: "thread-1",
          evidenceVersion: "v1",
          actionType: "follow_up",
          actionCategory: "communication",
          title: "Send follow-up to Acme Health",
          whyNow: "Acme Health is inside the follow-up window.",
          targetOutcome: "Increase the chance of a recruiter response.",
          effortMinutes: 10,
          urgencyLevel: "high",
          confidenceLevel: "strong",
          source: "followup_engine",
          status: "open",
          effectiveStatus: "open",
          createdAt: "2026-04-02T12:00:00.000Z",
          evidence: ["No tracked terminal outcome."],
          threadId: "thread-1",
          emailId: "email-1",
          applicationId: "app-1",
          suggestionSource: "email_followup",
          queueSource: "followup",
          intent: "FOLLOW_UP_THREAD",
          intentLabel: "Follow-up",
          playbook: [
            "No tracked terminal outcome.",
            "Keep the message concise and specific to the current thread.",
            "Ask for timing or next steps, not a decision.",
          ],
          sourceLabel: "Outreach task",
          draftEligible: true,
          routeHref: "/fix-suggestions",
          routeLabel: "Open queue",
          stageLabel: "Outreach",
          company: "Acme Health",
        },
      ],
    },
  });

  fetchStrategyAlerts.mockResolvedValue({
    success: true,
    alerts: [
      {
        id: "alert-1",
        kind: "fit",
        severity: "medium",
        title: "You are applying mostly to low-match roles",
        description: "Recent Apply Gate decisions show repeated fix-first signals.",
        recommendation: "Review Apply Gate before sending more applications.",
        supporting_stat: "3 of 4 recent checks were risky",
        timeframe_label: "Last 30 days",
      },
    ],
  });
  startEmailSync.mockResolvedValue({ success: true, newEmailsCount: 0 });
  fetchSyncStatus.mockResolvedValue({
    success: true,
    sync: { inProgress: false, lastRunAt: "2026-04-13T11:55:00.000Z" },
    gmailAuth: { requiresReconnect: false },
  });
  fetchWeeklyHighlights.mockResolvedValue({
    success: true,
    timeframe: "last_7_days",
    windowStart: null,
    windowEnd: null,
    counts: { applications: 7, callbacks: 1, interviews: 1, offers: 0, rejections: 5 },
    priorCounts: { applications: 12, callbacks: 2, interviews: 2, offers: 0, rejections: 3 },
    readout: {
      confidence: "normal",
      headline: "1 interview move this week, alongside 7 new applications.",
      sections: { whatChanged: [], whatWorked: [], whatDidnt: [], emergingPattern: null, nextWeek: [] },
    },
    highlights: {
      newApplications: [],
      newCallbacks: [{ id: 1, company: null, position: null, subject: "Stacey Brinkley: 30 min meeting", date: "2026-04-12T12:00:00.000Z" }],
      newOffers: [],
      newRejections: [{ id: 2, company: "Counsel Health", position: "Software Engineer", subject: "Thank you", date: "2026-04-13T09:00:00.000Z" }],
      silentThreads: [],
      topRejectionTheme: null,
    },
  });

  fetchResume.mockResolvedValue({
    success: true,
    resumeText: "A saved resume that is comfortably longer than twenty characters.",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardNew", () => {
  test("opens with one claim, its evidence, and what to do about it", async () => {
    renderDashboard();

    expect(await screen.findByText(/Good (morning|afternoon|evening), Stacey\./)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" })).toBeInTheDocument();
    expect(screen.getByText("What Applendium noticed")).toBeInTheDocument();
    expect(screen.getByText("Recent Apply Gate decisions show repeated fix-first signals.")).toBeInTheDocument();
    expect(screen.getByText("3 of 4 recent checks were risky")).toBeInTheDocument();
    // Diagnosis, prescription and a place to start — all three, or it is not coaching.
    expect(screen.getByText("Review Apply Gate before sending more applications.")).toBeInTheDocument();
  });

  test("never shows an empty list or an unavailable read while data is still loading", async () => {
    // 2026-09-25: for ~3 seconds every visit said "0 in queue — No queued moves right now" and
    // "Your search read is not available right now", then filled in.
    let resolveQueue: (value: unknown) => void = () => {};
    let resolveAlerts: (value: unknown) => void = () => {};
    fetchRankedActionQueue.mockReturnValue(new Promise((resolve) => { resolveQueue = resolve; }));
    fetchStrategyAlerts.mockReturnValue(new Promise((resolve) => { resolveAlerts = resolve; }));

    renderDashboard();
    await screen.findByText(/Good (morning|afternoon|evening), Stacey\./);

    expect(screen.queryByText(/not available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/caught up|0 in queue|No queued moves/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Loading/).length).toBeGreaterThan(0);

    resolveAlerts({ success: true, alerts: [] });
    resolveQueue({
      success: true,
      queue: { now: "2026-04-13T12:00:00.000Z", doToday: [], thisWeek: [], later: [], blocked: [], dismissed: [], expired: [], done: [], emptyState: null, resolvedActions: [] },
    });
    expect(await screen.findByText(/caught up/)).toBeInTheDocument();
  });

  test("puts optimization work and follow-ups in Next Actions with a button that fits each", async () => {
    renderDashboard();

    expect(await screen.findByText(/Tailor resume before applying to Datadog/)).toBeInTheDocument();
    expect(screen.getByText("Send follow-up to Acme Health")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Draft follow-up" })).toHaveAttribute("href", "/next-actions#queue-followup-1");
    expect(screen.getByRole("link", { name: "Tailor in Apply Gate" })).toHaveAttribute("href", "/apply-gate");
  });

  test("says honestly when the lead action is just the top of the list", async () => {
    renderDashboard();
    expect(await screen.findByText(/Top of your list right now/)).toBeInTheDocument();
    expect(screen.queryByText(/What to do about it/)).not.toBeInTheDocument();
  });

  test("pairs the lead action with the alert that produced the claim", async () => {
    fetchRankedActionQueue.mockResolvedValue({
      success: true,
      queue: {
        now: "2026-04-13T12:00:00.000Z",
        doToday: [
          { ...QUEUE_ITEM_TEMPLATE, id: "queue-followup-1", logicalKey: "followup:thread-1", dedupeKey: "followup:thread-1:v1", title: "Send follow-up to Acme Health" },
          {
            ...QUEUE_ITEM_TEMPLATE,
            id: "strategy:performance-focus-interview",
            logicalKey: "strategy:performance-focus-interview",
            dedupeKey: "strategy:performance-focus-interview:v1",
            actionType: "prep_interview",
            title: "Prep for the Verisk interview",
            source: "strategy",
            queueSource: "apply_gate",
            intent: "PREP_INTERVIEW",
            intentLabel: "Interview prep",
            sourceLabel: "Optimization task",
            routeHref: "/next-actions",
            threadId: null,
          },
        ],
        thisWeek: [], later: [], blocked: [], dismissed: [], expired: [], done: [], emptyState: null, resolvedActions: [],
      },
    });
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [{
        id: "performance-focus-interview",
        kind: "performance",
        severity: "high",
        title: "Getting interviews is working; converting them is the live problem",
        description: "23 of 344 applications reached an interview (6.7%), and none has become an offer yet.",
        recommendation: "Put the next hour into interview prep, not more applications.",
        supporting_stat: "23 interviews, 0 offers",
        timeframe_label: "All time",
      }],
    });

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Getting interviews is working; converting them is the live problem" })).toBeInTheDocument();
    expect(screen.getByText(/What to do about it/)).toBeInTheDocument();
    expect(screen.getByText("Prep for the Verisk interview")).toBeInTheDocument();
  });

  test("asks about silent interviews in place, and keeps the actions below", async () => {
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [{
        id: "performance-interview-debrief",
        kind: "performance",
        severity: "medium",
        title: "You have reached 23 interviews. I can only see how 4 of them ended.",
        description: "14 went quiet after the interview and never came back — the oldest 7 months ago.",
        recommendation: "Tell me how the ones you remember ended — one tap each, no typing.",
        supporting_stat: "4 of 23 endings visible",
        timeframe_label: "Across your whole tracked search",
        debrief: {
          kind: "interview_outcome",
          total: 14,
          items: [{
            key: "verisk||sdet", emailId: 101, label: "Verisk · Software Engineer in Test", company: "Verisk",
            position: "Software Engineer in Test", interviewedAt: "2026-03-24T00:00:00.000Z", daysSilent: 20, silentLabel: "20 days ago",
          }],
        },
      }],
    });

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "You have reached 23 interviews. I can only see how 4 of them ended." })).toBeInTheDocument();
    expect(screen.getByText("Needs your input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never heard back" })).toBeInTheDocument();
    expect(screen.queryByText(/Top of your list right now/)).not.toBeInTheDocument();
    expect(screen.getByText("Tailor resume before applying to Datadog")).toBeInTheDocument();
  });

  test("shows this week against last week, and names an outcome by its subject when no company is known", async () => {
    renderDashboard();
    expect(await screen.findByText("1 interview move this week, alongside 7 new applications.")).toBeInTheDocument();
    expect(screen.getByText("down from 12")).toBeInTheDocument();
    expect(screen.getByText("up from 3")).toBeInTheDocument();
    // Never "Unknown company": the email's own subject says which one it was.
    expect(screen.getByText("“Stacey Brinkley: 30 min meeting”")).toBeInTheDocument();
    expect(screen.queryByText(/Unknown company/)).not.toBeInTheDocument();
  });

  test("does not repeat the lead alert further down the page", async () => {
    renderDashboard();
    await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" });
    expect(screen.getAllByText("You are applying mostly to low-match roles")).toHaveLength(1);
  });

  test("does not sync Gmail when the inbox was checked in the last 15 minutes", async () => {
    // The "Inbox checked …" line moved to the top bar (AppTopBar); the automatic check stays here.
    renderDashboard();
    await waitFor(() => expect(fetchSyncStatus).toHaveBeenCalled());
    await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" });
    expect(startEmailSync).not.toHaveBeenCalled();
  });

  test("syncs once when the last check is older than 15 minutes", async () => {
    fetchSyncStatus.mockResolvedValue({
      success: true,
      sync: { inProgress: false, lastRunAt: "2026-04-13T10:00:00.000Z" },
      gmailAuth: { requiresReconnect: false },
    });
    renderDashboard();
    await waitFor(() => expect(startEmailSync).toHaveBeenCalledTimes(1));
  });

  test("draws where every application stands as one bar when the backend sends exclusive stages", async () => {
    // Review 2026-09-26: the rows needed a footnote ("an application can count twice"). Stages are
    // one bucket per application, so they can be one bar with no caveat.
    fetchEmailMetrics.mockResolvedValue({
      success: true,
      cohortMetrics: { applicationsSent: 20, reachedInterview: 3, reachedOffer: 1, rejectedCohorts: 6, interviewRate: 15 },
      searchSignals: {
        funnel: {
          applied: 20, settled: 16, pending: 4, silent: 7, rejected: 6, reachedInterview: 3, reachedOffer: 1,
          stages: { waiting: 4, quiet: 7, interviewing: 1, offer: 1, rejected: 6, closed: 1 },
          interviewRate: 0.15, settledInterviewRate: 0.19, offerRate: 0.33, focus: "offer", basis: "email_cohorts_all_time",
        },
        rejectionVelocity: { counts: {}, classified: 0, unknown: 6, medianEligible: false, averageDays: null },
      },
    });

    renderDashboard();

    expect(await screen.findByText("Where your 20 applications stand")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Interviewing: 1.*Rejected: 6/ })).toBeInTheDocument();
    expect(screen.getByText("Closed by you")).toBeInTheDocument();
    expect(screen.queryByText(/can count twice/)).not.toBeInTheDocument();
  });

  test("keeps the separate rows when an older backend sends no stages", async () => {
    renderDashboard();
    expect(await screen.findByText("Where your applications stand")).toBeInTheDocument();
    expect(screen.getByText(/can count twice/)).toBeInTheDocument();
  });

  test("shows the First Move card for a cold-start account", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: null });
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });

    renderDashboard();

    expect(await screen.findByTestId("first-move-card")).toBeInTheDocument();
    expect(screen.getByText(/Get a verdict on the next role/)).toBeInTheDocument();
  });
});
