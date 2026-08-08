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
  startEmailSync,
} = vi.hoisted(() => ({
  fetchApplicationStats: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  fetchEmailMetrics: vi.fn(),
  fetchRankedActionQueue: vi.fn(),
  fetchResume: vi.fn(),
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
    fetchResume,
    fetchStrategyAlerts,
    fetchSuggestionOutcomeAnalytics,
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
  startEmailSync.mockResolvedValue({ success: true });

  fetchResume.mockResolvedValue({
    success: true,
    resumeText: "A saved resume that is comfortably longer than twenty characters.",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardNew", () => {
  test("opens with one claim, its evidence, and a single action", async () => {
    renderDashboard();

    expect(await screen.findByText(/Good (morning|afternoon|evening), Stacey\./)).toBeInTheDocument();

    // The claim comes from the alert verbatim. The dashboard used to open with "Applications 344",
    // a number the user has to interpret before it means anything.
    expect(await screen.findByText("What matters today")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "You are applying mostly to low-match roles" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recent Apply Gate decisions show repeated fix-first signals.")).toBeInTheDocument();
    expect(screen.getByText("3 of 4 recent checks were risky")).toBeInTheDocument();

    // The counts still render, demoted to a strip under the claim rather than leading the page.
    expect(screen.getByText("Applications")).toBeInTheDocument();
    expect(screen.getByText("Ever interviewed")).toBeInTheDocument();
    expect(screen.getByText("Offers")).toBeInTheDocument();
    expect(screen.getByText("Interview rate")).toBeInTheDocument();
  });

  test("surfaces optimization work, not just follow-ups, as a move", async () => {
    renderDashboard();

    // This assertion is deliberately the inverse of what it used to be. The dashboard fed its
    // queue through `buildDaqV1InboxQueue`, whose filter requires `source === "followup"` — and
    // every Signal-Layer coaching action is generated as `resume` or `apply_gate`, never
    // `followup`. So the coaching layer reached the payload and was discarded before render, and
    // the old test pinned that bug in place. See buildDashboardMoveQueue.
    expect(await screen.findByText("Tailor resume before applying to Datadog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send follow-up to Acme Health" })).toBeInTheDocument();

    expect(screen.getByText("Next moves")).toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
  });

  test("labels the hero action honestly when it did not come from the claim's alert", async () => {
    renderDashboard();

    // `alert-1` produced no queue item, so the button is just the top of the queue. Saying
    // "start here" would imply a link to the claim above that does not exist.
    expect(await screen.findByText(/Top of your queue right now · Optimization task/)).toBeInTheDocument();
    expect(screen.queryByText("This is the move for the read above.")).not.toBeInTheDocument();
  });

  test("pairs the hero action with the alert that produced the claim", async () => {
    fetchRankedActionQueue.mockResolvedValue({
      success: true,
      queue: {
        now: "2026-04-13T12:00:00.000Z",
        doToday: [
          // Ranked BELOW the strategy action on purpose: if the hero simply took the top of the
          // queue, this is what it would show.
          {
            ...QUEUE_ITEM_TEMPLATE,
            id: "queue-followup-1",
            logicalKey: "followup:thread-1",
            dedupeKey: "followup:thread-1:v1",
            title: "Send follow-up to Acme Health",
          },
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
            routeHref: "/fix-suggestions",
            threadId: null,
          },
        ],
        thisWeek: [],
        later: [],
        blocked: [],
        dismissed: [],
        expired: [],
        done: [],
        emptyState: null,
        resolvedActions: [],
      },
    });

    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [
        {
          id: "performance-focus-interview",
          kind: "performance",
          severity: "high",
          title: "Getting interviews is working; converting them is the live problem",
          description: "23 of 344 applications reached an interview (6.7%), and none has become an offer yet.",
          recommendation: "Put the next hour into interview prep, not more applications.",
          supporting_stat: "23 interviews, 0 offers",
          timeframe_label: "All time",
        },
      ],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Getting interviews is working; converting them is the live problem",
      }),
    ).toBeInTheDocument();

    // The generator ids strategy-derived queue items `strategy:<alertId>`. When one exists we use
    // it, so the button under a claim is provably about that claim.
    expect(screen.getByText("Prep for the Verisk interview")).toBeInTheDocument();
    expect(screen.getByText("This is the move for the read above.")).toBeInTheDocument();
  });

  test("says what to do about the claim even when there is also a button", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" });

    // The regression this pins: the recommendation was an `else` branch behind the hero action,
    // so the one sentence answering "so what do I do about it" was dropped precisely when there
    // was also work queued. Founder's read: "it tells me the problem without giving me a
    // solution." Diagnosis, prescription, and a place to start — all three or it is not coaching.
    expect(screen.getByText("Review Apply Gate before sending more applications.")).toBeInTheDocument();
    expect(screen.getByText("Tailor resume before applying to Datadog")).toBeInTheDocument();
  });

  test("asks about the silent interviews in place rather than pointing at another screen", async () => {
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [
        {
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
            items: [
              {
                key: "verisk||sdet",
                emailId: 101,
                label: "Verisk · Software Engineer in Test",
                company: "Verisk",
                position: "Software Engineer in Test",
                interviewedAt: "2026-03-24T00:00:00.000Z",
                daysSilent: 20,
                silentLabel: "20 days ago",
              },
            ],
          },
        },
      ],
    });

    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "You have reached 23 interviews. I can only see how 4 of them ended.",
      }),
    ).toBeInTheDocument();

    // The cards replace the hero button. Sending someone to another screen to supply the data
    // this screen is blocked on is how the ask gets abandoned — and an unanswered ask leaves the
    // product advising from 17% visibility, which is what produced the claim it cannot support.
    expect(screen.getByText("Verisk · Software Engineer in Test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never heard back" })).toBeInTheDocument();
    expect(screen.getByText(/13 more/)).toBeInTheDocument();
    expect(screen.queryByText(/Top of your queue right now/)).not.toBeInTheDocument();

    // The queued work is still there, demoted below the ask rather than deleted.
    expect(screen.getByText("Tailor resume before applying to Datadog")).toBeInTheDocument();
  });

  test("demotes the rest of the dashboard into one drawer without dropping it", async () => {
    renderDashboard();

    // Wait on something the queries produce, not on static chrome — "Next decision" is a label
    // that renders before any data lands, so awaiting it proves nothing.
    expect(await screen.findByRole("heading", { name: "QA Analyst" })).toBeInTheDocument();

    // Present, so nothing was deleted. Not visible, so nothing competes with the claim on
    // first read. `toBeVisible` understands a closed <details>.
    const nextDecision = screen.getByText("Next decision");
    expect(nextDecision).toBeInTheDocument();
    expect(nextDecision).not.toBeVisible();

    expect(screen.getAllByText("Resume does not show SQL proof").length).toBeGreaterThan(0);

    expect(screen.getByText("Search memory")).not.toBeVisible();
    expect(screen.getByText("Completed follow-ups are showing better outcomes")).toBeInTheDocument();
    expect(screen.getByText("50.0% vs 10.0%")).toBeInTheDocument();

    expect(screen.getByText("Quick links")).toBeInTheDocument();
    expect(screen.getByText("Everything else")).toBeVisible();
  });

  test("does not repeat the hero's alert further down the page", async () => {
    renderDashboard();

    // `alert-1` is the claim. Rendering it again in the alerts card would make the drawer look
    // like new information.
    await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" });
    expect(screen.getAllByText("You are applying mostly to low-match roles")).toHaveLength(1);
    expect(screen.getByText("The read above is the only alert right now.")).toBeInTheDocument();
  });

  test("shows the First Move card for a cold-start account", async () => {
    fetchResume.mockResolvedValue({ success: true, resumeText: null });
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });

    renderDashboard();

    expect(await screen.findByTestId("first-move-card")).toBeInTheDocument();
    expect(screen.getByText(/Get a verdict on the next role/)).toBeInTheDocument();
  });
});
