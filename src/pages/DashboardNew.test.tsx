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
  fetchStrategyAlerts,
  fetchSuggestionOutcomeAnalytics,
  startEmailSync,
} = vi.hoisted(() => ({
  fetchApplicationStats: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  fetchRankedActionQueue: vi.fn(),
  fetchStrategyAlerts: vi.fn(),
  fetchSuggestionOutcomeAnalytics: vi.fn(),
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
    fetchStrategyAlerts,
    fetchSuggestionOutcomeAnalytics,
    startEmailSync,
  };
});

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
  startEmailSync.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardNew", () => {
  test("renders the MVP command center with decision, actions, and memory", async () => {
    renderDashboard();

    expect(await screen.findByText(/Good (morning|afternoon|evening), Stacey\./)).toBeInTheDocument();

    expect(await screen.findByText("Next decision")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QA Analyst" })).toBeInTheDocument();
    expect(screen.getByText("Fix first")).toBeInTheDocument();
    expect(screen.getAllByText("Resume does not show SQL proof").length).toBeGreaterThan(0);

    expect(screen.getByText("Daily Action Queue")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send follow-up to Acme Health" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tailor resume before applying to Datadog" })).not.toBeInTheDocument();

    expect(screen.getByText("Search memory")).toBeInTheDocument();
    expect(screen.getByText("Completed follow-ups are showing better outcomes")).toBeInTheDocument();
    expect(screen.getByText("Observed lift +40.0 pts")).toBeInTheDocument();

    expect(screen.getByText("Strategy alert")).toBeInTheDocument();
    expect(screen.getByText("You are applying mostly to low-match roles")).toBeInTheDocument();
  });
});
