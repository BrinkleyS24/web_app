import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import FixSuggestions from "./FixSuggestions";
import { resetCanonicalQueueImpressionSession } from "@/hooks/useCanonicalQueueImpressions";

const useAuth = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
let dateNowSpy: ReturnType<typeof vi.spyOn>;

const {
  closeApplication,
  completeQueueAction,
  fetchFollowupSuggestions,
  fetchRankedActionQueue,
  fetchStoredEmails,
  fetchSuggestionActionStates,
  dismissQueueAction,
  generateSuggestionDraft,
  recordQueueActionImpression,
  recordSuggestionDraftFeedback,
} = vi.hoisted(() => ({
  closeApplication: vi.fn(),
  completeQueueAction: vi.fn(),
  fetchFollowupSuggestions: vi.fn(),
  fetchRankedActionQueue: vi.fn(),
  fetchStoredEmails: vi.fn(),
  fetchSuggestionActionStates: vi.fn(),
  dismissQueueAction: vi.fn(),
  generateSuggestionDraft: vi.fn(),
  recordQueueActionImpression: vi.fn(),
  recordSuggestionDraftFeedback: vi.fn(),
}));

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/CleanupTaskInlinePanel", () => ({
  CleanupTaskInlinePanel: () => <div>Cleanup inline panel</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    closeApplication,
    completeQueueAction,
    fetchFollowupSuggestions,
    fetchRankedActionQueue,
    fetchStoredEmails,
    fetchSuggestionActionStates,
    dismissQueueAction,
    generateSuggestionDraft,
    recordQueueActionImpression,
    recordSuggestionDraftFeedback,
  };
});

function renderPage(initialEntries: string[] = ["/next-actions"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <FixSuggestions />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const storedEmails = [
  {
    id: "wf-email",
    thread_id: "wf-thread",
    subject: "We would like to invite you to come back",
    from: "WellsFargoHR <wellsfargoworkday@example.test>",
    date: "2026-04-10T12:00:00.000Z",
    category: "interviewed",
    company_name: "Wells Fargo",
    position: "Software Engineer",
    applicationId: "wf-app",
  },
  {
    id: "ghost-email",
    thread_id: "ghost-thread",
    subject: "Standard Bots - Application Received",
    from: "Standard Bots Hiring Team <hiring@standardbots.example.test>",
    date: "2026-03-10T12:00:00.000Z",
    category: "applied",
    company_name: "Standard Bots",
    position: "Associate Quality Engineer - Software (QA)",
    applicationId: "ghost-app",
  },
  {
    id: "upcoming-email-1",
    thread_id: "upcoming-thread-1",
    subject: "Thank you for applying",
    from: "Filevine <jobs@filevine.example.test>",
    date: "2026-04-02T12:00:00.000Z",
    category: "applied",
    company_name: "Filevine",
    position: "QA Analyst I",
    applicationId: "upcoming-app-1",
  },
  {
    id: "upcoming-email-2",
    thread_id: "upcoming-thread-2",
    subject: "Application received",
    from: "Optimum <jobs@optimum.example.test>",
    date: "2026-03-25T12:00:00.000Z",
    category: "applied",
    company_name: "Optimum",
    position: "Software Development Engineer I",
    applicationId: "upcoming-app-2",
  },
  {
    id: "closed-email",
    thread_id: "closed-thread",
    subject: "Thank you for your interest",
    from: "Fora <jobs@fora.example.test>",
    date: "2026-04-01T12:00:00.000Z",
    category: "rejected",
    company_name: "Fora",
    position: "Junior Quality Assurance Automation Engineer",
    applicationId: "closed-app",
    isClosed: true,
  },
  {
    id: "legacy-ambiguous-email",
    thread_id: "legacy-ambiguous-thread",
    subject: "Thank you for applying to Legacy ATS",
    from: "Legacy ATS <noreply@legacyats.example.test>",
    date: "2026-02-20T12:00:00.000Z",
    category: "applied",
    company_name: "Legacy ATS",
    position: null,
    applicationId: null,
  },
];

function buildQueueResponse(overrides: Partial<Record<"doToday" | "thisWeek" | "later" | "blocked" | "dismissed" | "done" | "expired", unknown[]>> = {}) {
  const followupAction = {
    id: "queue-followup-1",
    logicalKey: "followup:wf-thread",
    dedupeKey: "followup:wf-thread:v1",
    primaryEntityId: "wf-thread",
    evidenceVersion: "v1",
    actionType: "thank_you",
    actionCategory: "communication",
    title: "Send thank-you note to Wells Fargo",
    whyNow: "Interview thank-you notes are most useful while the conversation is still fresh.",
    targetOutcome: "Increase the odds of a recruiter response.",
    effortMinutes: 5,
    urgencyLevel: "high",
    confidenceLevel: "strong",
    source: "followup_engine",
    status: "open",
    effectiveStatus: "open",
    createdAt: "2026-04-10T12:00:00.000Z",
    evidence: [
      "Latest update: The Early Careers Engineering Assessment - Submission Confirmation",
      "Latest activity: 4/9/2026",
    ],
    threadId: "wf-thread",
    emailId: "wf-email",
    applicationId: "wf-app",
    suggestionSource: "email_followup",
    queueSource: "followup",
    intent: "SEND_THANK_YOU",
    intentLabel: "Thank-you",
    playbook: [
      "Latest update: The Early Careers Engineering Assessment - Submission Confirmation",
      "Keep the message concise and specific to the current thread.",
      "Ask for timing or next steps, not a decision.",
    ],
    sourceLabel: "Outreach task",
    draftEligible: true,
    routeHref: "/fix-suggestions",
    routeLabel: "Open queue",
    stageLabel: "Outreach",
    company: "Wells Fargo",
  };

  const staleAction = {
    id: "queue-stale-1",
    logicalKey: "stale:ghost-thread",
    dedupeKey: "stale:ghost-thread:v1",
    primaryEntityId: "stale:ghost-thread",
    evidenceVersion: "v1",
    actionType: "close_stale_application",
    actionCategory: "communication",
    title: "Move Associate Quality Engineer - Software (QA) out of active focus",
    whyNow: "The tracked thread has gone cold and is now in close-out territory.",
    targetOutcome: "Stop stale roles from taking space in the active search.",
    effortMinutes: 4,
    urgencyLevel: "low",
    confidenceLevel: "moderate",
    source: "followup_engine",
    status: "open",
    effectiveStatus: "open",
    createdAt: "2026-03-10T12:00:00.000Z",
    evidence: [
      "No tracked terminal outcome.",
      "Last activity: 32 days ago",
    ],
    threadId: "ghost-thread",
    emailId: "ghost-email",
    applicationId: "ghost-app",
    suggestionSource: "stale_role_signal",
    queueSource: "stale",
    intent: "CLOSE_STALE_ROLE",
    intentLabel: "Close stale role",
    playbook: [
      "No tracked terminal outcome.",
      "Resolve the blocker before relying on the rest of the queue.",
      "Clear the smallest high-signal task first.",
    ],
    sourceLabel: "Ghosting signal",
    draftEligible: true,
    routeHref: "/fix-suggestions",
    routeLabel: "Open queue",
    stageLabel: "Ghosting",
    company: "Standard Bots",
  };

  const base = {
    success: true,
    queue: {
      now: "2026-04-11T12:00:00.000Z",
      doToday: [followupAction],
      thisWeek: [staleAction],
      later: [],
      blocked: [],
      dismissed: [],
      expired: [],
      done: [],
      emptyState: null,
      resolvedActions: [followupAction, staleAction],
    },
  };

  return {
    ...base,
    queue: {
      ...base.queue,
      ...overrides,
      resolvedActions: [
        ...((overrides.doToday as typeof base.queue.doToday | undefined) || base.queue.doToday),
        ...((overrides.thisWeek as typeof base.queue.thisWeek | undefined) || base.queue.thisWeek),
        ...((overrides.blocked as typeof base.queue.blocked | undefined) || base.queue.blocked),
        ...((overrides.later as typeof base.queue.later | undefined) || base.queue.later),
        ...((overrides.dismissed as typeof base.queue.dismissed | undefined) || base.queue.dismissed),
      ],
    },
  };
}

beforeEach(() => {
  resetCanonicalQueueImpressionSession();
  dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-11T12:00:00.000Z").getTime());

  useAuth.mockReturnValue({
    user: { email: "candidate@example.test" },
    loading: false,
  });

  fetchFollowupSuggestions.mockResolvedValue({
    success: true,
    suggestions: [
      {
        threadId: "wf-thread",
        emailId: "wf-email",
        applicationId: "wf-app",
        title: "Send thank-you note to Wells Fargo",
        description:
          "Send a personalized thank-you note within 24 hours of your interview with Wells Fargo.",
        company: "Wells Fargo",
        actionType: "thank_you",
        suggestionSource: "email_followup",
        urgency: "high",
        daysAgo: 1,
        estimatedTime: "5 mins",
        category: "interviewed",
        whyNow: "Interview thank-you notes are most useful while the conversation is still fresh.",
        evidence: [
          "Subject: We would like to invite you to come back",
          "Sender: WellsFargoHR <wellsfargoworkday@example.test>",
        ],
        actionConfidence: "high",
        draftAvailable: true,
      },
    ],
    meta: {},
  });

  fetchSuggestionActionStates.mockResolvedValue({
    success: true,
    actions: [],
  });

  fetchRankedActionQueue.mockResolvedValue(buildQueueResponse());

  fetchStoredEmails.mockResolvedValue({
    success: true,
    emails: storedEmails,
  });

  recordQueueActionImpression.mockResolvedValue({
    success: true,
    state: "active",
    logicalKey: "followup:wf-thread",
    dedupeKey: "followup:wf-thread:v1",
    wasStale: false,
    displayCount: 1,
  });
  recordSuggestionDraftFeedback.mockResolvedValue({ success: true });
  generateSuggestionDraft.mockResolvedValue({
    success: true,
    draft: {
      subject: "Re: Wells Fargo Careers: Thank you for applying",
      body:
        "Hello,\n\nI wanted to follow up after submitting the assessment for the Engineering Associate - DevOps Automation role and ask whether there have been any updates on timing or next steps.\n\nThank you again for your time and consideration.\n\nBest,\n[Your Name]",
      context: "warm",
      contextLabel: "Warm follow-up",
      contextDescription: "Polite check-in that restates interest and asks about timing.",
      actionType: "follow_up",
      confidence: "medium",
      coachingPoints: [
        "Keep it under five sentences and ask for timing, not a decision.",
        "Re-state one concrete reason you fit the role before you close.",
      ],
      recipient: "Jordan Lee <jordan@example.test>",
      latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
      sendStrategy: "reply_in_thread",
      sendStrategyLabel: "Reply to human contact",
      sendStrategyDescription:
        "Latest tracked email is from a shared mailbox. Reply in-thread and address Jordan to keep the original context.",
      evidence: [
        "Thread: Wells Fargo Careers: Thank you for applying",
        "Latest update: The Early Careers Engineering Assessment - Submission Confirmation",
        "Latest activity: 4/9/2026",
      ],
      threadPreview:
        "Hello, Thanks for completing the Early Careers Engineering Assessment. We have your submission to Wells Fargo.",
    },
  });
  completeQueueAction.mockResolvedValue({
    success: true,
    state: "completed",
    logicalKey: "stale:ghost-thread",
    dedupeKey: "stale:ghost-thread:v1",
    wasStale: false,
  });
  closeApplication.mockResolvedValue({ success: true });
  dismissQueueAction.mockResolvedValue({
    success: true,
    state: "snoozed",
    logicalKey: "stale:ghost-thread",
    dedupeKey: "stale:ghost-thread:v1",
    wasStale: false,
    snoozedUntil: "2026-04-12T12:00:00.000Z",
  });
});

afterEach(() => {
  dateNowSpy?.mockRestore();
  vi.clearAllMocks();
});

function staleActionFixture(n: number, company: string, title: string) {
  return {
    id: `queue-stale-${n}`,
    logicalKey: `stale:ghost-thread-${n}`,
    dedupeKey: `stale:ghost-thread-${n}:v1`,
    primaryEntityId: `stale:ghost-thread-${n}`,
    evidenceVersion: "v1",
    actionType: "close_stale_application",
    actionCategory: "communication",
    title,
    whyNow: "This application has gone cold.",
    targetOutcome: "Clear stale roles.",
    effortMinutes: 4,
    urgencyLevel: "low",
    confidenceLevel: "moderate",
    source: "followup_engine",
    status: "open",
    effectiveStatus: "open",
    createdAt: "2026-03-08T12:00:00.000Z",
    evidence: ["No tracked terminal outcome."],
    threadId: `ghost-thread-${n}`,
    emailId: `ghost-email-${n}`,
    applicationId: `ghost-app-${n}`,
    suggestionSource: "stale_role_signal",
    queueSource: "stale",
    intent: "CLOSE_STALE_ROLE",
    intentLabel: "Close stale role",
    playbook: ["Send a final note only if the role still matters."],
    sourceLabel: "Ghosting signal",
    draftEligible: true,
    routeHref: "/next-actions",
    routeLabel: "Open",
    stageLabel: "Ghosting",
    company,
  };
}

function researchActionFixture() {
  return {
    ...staleActionFixture(9, "Prometheum", "Research Prometheum and role"),
    id: "queue-research-1",
    logicalKey: "research:prometheum",
    dedupeKey: "research:prometheum:v1",
    actionType: "research",
    urgencyLevel: "medium",
    intent: "NETWORKING_OUTREACH",
    queueSource: "followup",
    roleTitle: "QA Engineer",
    applicationId: null,
    emailId: null,
  };
}

describe("Next Actions", () => {
  test("shows today's actions with the application named and a button that fits each", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Next Actions" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Send thank-you note to Wells Fargo" })).toBeInTheDocument();
    // Both actions fit in Today, and each carries its own kind of button.
    expect(screen.getByRole("heading", { name: "Move Associate Quality Engineer - Software (QA) out of active focus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft thank-you note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close it out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate draft" })).not.toBeInTheDocument();
    // Follow-up windows that open soon.
    expect(screen.getAllByText("First follow-up window for QA Analyst I").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(recordQueueActionImpression).toHaveBeenCalledWith({ logicalKey: "followup:wf-thread", dedupeKey: "followup:wf-thread:v1" });
      expect(recordQueueActionImpression).toHaveBeenCalledWith({ logicalKey: "stale:ghost-thread", dedupeKey: "stale:ghost-thread:v1" });
    });
  });

  test("research opens a search for the company instead of offering a draft", async () => {
    fetchRankedActionQueue.mockResolvedValue(buildQueueResponse({ doToday: [researchActionFixture()], thisWeek: [] }));
    renderPage();

    const link = await screen.findByRole("link", { name: /Research Prometheum/ });
    expect(link).toHaveAttribute("href", "https://www.google.com/search?q=Prometheum%20QA%20Engineer");
    expect(screen.getByText((_, el) => el?.tagName === "P" && /^Research · Prometheum · QA Engineer/.test(el.textContent || ""))).toBeInTheDocument();
  });

  test("lets users clear Gmail work they already handled outside the product", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Already handled/ }));

    await waitFor(() => {
      expect(completeQueueAction).toHaveBeenCalledWith({ logicalKey: "followup:wf-thread", dedupeKey: "followup:wf-thread:v1" });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Removed from today's list.");
  });

  test("hides Gmail actions when the latest tracked thread message is from the user", async () => {
    fetchStoredEmails.mockResolvedValueOnce({
      success: true,
      emails: [
        ...storedEmails,
        {
          id: "wf-user-reply",
          thread_id: "wf-thread",
          subject: "Re: We would like to invite you to come back",
          from: "candidate@example.test",
          date: "2026-04-11T10:00:00.000Z",
          category: "interviewed",
          company_name: "Wells Fargo",
          position: "Software Engineer",
          applicationId: "wf-app",
        },
      ],
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Move Associate Quality Engineer - Software (QA) out of active focus" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Send thank-you note to Wells Fargo" })).not.toBeInTheDocument();
    });
  });

  test("does not show malformed serialized evidence on Apply Gate cards", async () => {
    const user = userEvent.setup();
    fetchRankedActionQueue.mockResolvedValue(
      buildQueueResponse({
        doToday: [
          {
            id: "queue-apply-1",
            logicalKey: "apply-gate:qa-engineer",
            dedupeKey: "apply-gate:qa-engineer:v1",
            primaryEntityId: "qa-engineer",
            evidenceVersion: "v1",
            actionType: "apply_gate_fix",
            actionCategory: "fit",
            title: "Apply to QA Engineer",
            whyNow: "This role is worth applying to after you close the strongest proof gap.",
            targetOutcome: "Submit a stronger application.",
            effortMinutes: 12,
            urgencyLevel: "medium",
            confidenceLevel: "moderate",
            source: "apply_gate",
            status: "open",
            effectiveStatus: "open",
            createdAt: "2026-04-10T12:00:00.000Z",
            evidence: ['["The'],
            threadId: "apply-gate:qa-engineer",
            suggestionSource: "apply_gate_action_plan",
            queueSource: "apply_gate",
            intent: "FIX_BEFORE_APPLYING",
            intentLabel: "Apply",
            playbook: ["Add one stronger automation proof point before applying."],
            sourceLabel: "Apply Gate",
            draftEligible: false,
            routeHref: "/apply-gate",
            routeLabel: "Review Apply Gate",
            stageLabel: "Job fit",
            company: "Acme",
            blockingReason: "Tailor resume first",
          },
        ],
        thisWeek: [],
      }),
    );

    renderPage();
    expect(await screen.findByRole("heading", { name: "Apply to QA Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Apply Gate" })).toHaveAttribute("href", "/apply-gate");

    await user.click(screen.getByRole("button", { name: "More options" }));
    await user.click(screen.getByRole("button", { name: "Why this, and how" }));

    expect(screen.getByText("Apply Gate context")).toBeInTheDocument();
    expect(screen.getAllByText("Tailor resume first").length).toBeGreaterThan(0);
    expect(screen.queryByText('["The')).not.toBeInTheDocument();
  });

  test("tells the user how many repeat actions are being held back, and why", async () => {
    // A short list with no explanation reads as "the product didn't find my other applications".
    fetchRankedActionQueue.mockResolvedValue({
      ...buildQueueResponse(),
      queue: {
        ...buildQueueResponse().queue,
        heldBackSimilarCount: 9,
        heldBackSimilarActions: [
          { intent: "FOLLOW_UP_THREAD", intentLabel: "Follow-up", count: 5 },
          { intent: "NETWORKING_OUTREACH", intentLabel: "Networking", count: 4 },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText(/9 similar actions are held back/)).toBeInTheDocument();
    expect(screen.getByText(/5 follow-up, 4 networking/)).toBeInTheDocument();
    expect(screen.getByText(/As you clear one, the next takes its place/)).toBeInTheDocument();
  });

  test("a step waiting on another action is not listed as its own row", async () => {
    // Founder's queue, 2026-09-25: 7 blocked "Apply to X" rows sat under their own "Tailor résumé
    // for X" rows, one role twice, and this page counted 22 where the Dashboard counted 14.
    const base = buildQueueResponse().queue.doToday[0] as Record<string, unknown>;
    fetchRankedActionQueue.mockResolvedValue(buildQueueResponse({
      blocked: [{
        ...base,
        id: "queue-apply-blocked",
        logicalKey: "apply:monument",
        dedupeKey: "apply:monument:v1",
        actionType: "apply",
        title: "Apply to QA Automation Engineer at Monument",
        status: "open",
        effectiveStatus: "blocked",
        blockingReason: "Tailor resume first",
      }],
    }));

    renderPage();

    expect(await screen.findByText("Send thank-you note to Wells Fargo")).toBeInTheDocument();
    expect(screen.queryByText("Apply to QA Automation Engineer at Monument")).not.toBeInTheDocument();
  });

  test("keeps Today to three and groups quiet close-outs under More", async () => {
    const user = userEvent.setup();
    const followup = buildQueueResponse().queue.doToday[0];
    fetchRankedActionQueue.mockResolvedValueOnce(
      buildQueueResponse({
        doToday: [followup, researchActionFixture(), staleActionFixture(1, "Standard Bots", "Move Associate Quality Engineer - Software (QA) out of active focus")],
        thisWeek: [
          staleActionFixture(2, "Arbol", "Move Backend Engineer - AI Infrastructure out of active focus"),
          staleActionFixture(3, "Broadridge", "Move SDET Quality Assurance Specialist with Automation out of active focus"),
          staleActionFixture(4, "Cboe", "Move QA Analyst out of active focus"),
        ],
      }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Send thank-you note to Wells Fargo" })).toBeInTheDocument();
    expect(screen.getByText("3 for today · 3 more")).toBeInTheDocument();
    expect(screen.getByText("Close out 3 quiet applications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close-outs\s*3/ })).toBeInTheDocument();

    await user.click(screen.getByText("Close out 3 quiet applications"));
    expect(screen.getByText("Move Backend Engineer - AI Infrastructure out of active focus")).toBeVisible();
  });

  test("closes a stale application straight from its card, as a no-response close", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Close it out" }));

    await waitFor(() => {
      expect(closeApplication).toHaveBeenCalledWith({
        applicationId: "ghost-app",
        emailId: "ghost-email",
        // "No response" leads so the close is a neutral ghosting close-out, not a rejection.
        reason: "No response - ghosted, closed from Next Actions: Move Associate Quality Engineer - Software (QA) out of active focus",
      });
    });
    expect(completeQueueAction).toHaveBeenCalledWith({ logicalKey: "stale:ghost-thread", dedupeKey: "stale:ghost-thread:v1" });
  });

  test("drafts the thank-you note in place, with presets and the thread context", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Draft thank-you note" }));

    await waitFor(() => {
      expect(generateSuggestionDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "wf-thread",
          actionType: "thank_you",
          tone: "post_interview",
          emailId: "wf-email",
          applicationId: "wf-app",
          suggestionSource: "email_followup",
        }),
        expect.anything(),
      );
    });

    expect(await screen.findByText("Outreach Copilot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide draft" })).toBeInTheDocument();
    expect(screen.getByLabelText("Preset")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy subject + body" })).toBeInTheDocument();
    expect(screen.getByText("Suggested reply contact: Jordan Lee <jordan@example.test>")).toBeInTheDocument();
  });

  test("records draft feedback with the draft snapshot", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Draft thank-you note" }));
    await user.click(await screen.findByText("Report draft issue"));
    await user.click(await screen.findByTestId("copilot-feedback-wrong_grounding"));

    await waitFor(() => {
      expect(recordSuggestionDraftFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "wf-thread",
          actionType: "thank_you",
          feedbackLabel: "wrong_grounding",
          draft: expect.objectContaining({ subject: "Re: Wells Fargo Careers: Thank you for applying", sendStrategy: "reply_in_thread" }),
          feedback: { surface: "fix_suggestions" },
        }),
        expect.anything(),
      );
    });
    expect(await screen.findByText("Latest feedback saved: Wrong grounding")).toBeInTheDocument();
  });

  test("a link from the Dashboard opens the draft it promised", async () => {
    renderPage(["/next-actions#queue-followup-1"]);
    await waitFor(() => {
      expect(generateSuggestionDraft).toHaveBeenCalledWith(expect.objectContaining({ threadId: "wf-thread", actionType: "thank_you" }), expect.anything());
    });
  });
});
