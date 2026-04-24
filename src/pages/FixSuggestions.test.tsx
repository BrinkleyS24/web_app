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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
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
    user: { email: "brinkleystacey12@gmail.com" },
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

describe("FixSuggestions", () => {
  test("renders the Daily Action Queue lanes, cards, and diagnostics from mocked data", async () => {
    renderPage();

    expect(await screen.findByText("Daily Action Queue")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Send thank-you note to Wells Fargo" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Move Associate Quality Engineer - Software (QA) out of active focus",
      }),
    ).toBeInTheDocument();

    const outreachLane = screen.getAllByText("Outreach")[0]?.closest("button");
    const ghostingLane = screen.getAllByText("Ghosting")[0]?.closest("button");
    const cleanupLane = screen.getByText("Cleanup").closest("button");

    expect(outreachLane).toBeTruthy();
    expect(ghostingLane).toBeTruthy();
    expect(cleanupLane).toBeTruthy();

    expect(within(outreachLane as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(outreachLane as HTMLElement).getByText("2 upcoming")).toBeInTheDocument();
    expect(within(ghostingLane as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(cleanupLane as HTMLElement).getByText("0")).toBeInTheDocument();

    expect(screen.getAllByText("First follow-up window for QA Analyst I").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Final check-in window for Software Development Engineer I").length).toBeGreaterThan(0);
    expect(screen.getByText("Queue details")).toBeInTheDocument();
    expect(screen.getAllByText("Why now").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(recordQueueActionImpression).toHaveBeenCalled();
    });
  });

  test("groups multiple low-urgency stale close-out cards into one batch card", async () => {
    fetchRankedActionQueue.mockResolvedValueOnce(
      buildQueueResponse({
        thisWeek: [
          {
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
            evidence: ["No tracked terminal outcome."],
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
          },
          {
            id: "queue-stale-2",
            logicalKey: "stale:ghost-thread-2",
            dedupeKey: "stale:ghost-thread-2:v1",
            primaryEntityId: "stale:ghost-thread-2",
            evidenceVersion: "v1",
            actionType: "close_stale_application",
            actionCategory: "communication",
            title: "Move Backend Engineer - AI Infrastructure out of active focus",
            whyNow: "This application has gone cold.",
            targetOutcome: "Clear stale roles.",
            effortMinutes: 4,
            urgencyLevel: "low",
            confidenceLevel: "moderate",
            source: "followup_engine",
            status: "open",
            effectiveStatus: "open",
            createdAt: "2026-03-09T12:00:00.000Z",
            evidence: ["No tracked terminal outcome."],
            threadId: "ghost-thread-2",
            emailId: "ghost-email-2",
            applicationId: "ghost-app-2",
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
            company: "Arbol",
          },
          {
            id: "queue-stale-3",
            logicalKey: "stale:ghost-thread-3",
            dedupeKey: "stale:ghost-thread-3:v1",
            primaryEntityId: "stale:ghost-thread-3",
            evidenceVersion: "v1",
            actionType: "close_stale_application",
            actionCategory: "communication",
            title: "Move SDET Quality Assurance Specialist with Automation out of active focus",
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
            threadId: "ghost-thread-3",
            emailId: "ghost-email-3",
            applicationId: "ghost-app-3",
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
            company: "Broadridge",
          },
        ],
      }),
    );

    renderPage();

    expect(await screen.findByText("Review 3 stale roles in one pass")).toBeInTheDocument();
    expect(screen.getByText("Batch close-out lane")).toBeInTheDocument();
    expect(screen.getByText("Move Associate Quality Engineer - Software (QA) out of active focus")).toBeInTheDocument();
    expect(screen.getByText("Move Backend Engineer - AI Infrastructure out of active focus")).toBeInTheDocument();
    expect(screen.getByText("Move SDET Quality Assurance Specialist with Automation out of active focus")).toBeInTheDocument();
  });

  test("allows closing a stale application directly from the ghosting card", async () => {
    const user = userEvent.setup();
    renderPage();

    const closeButton = await screen.findByRole("button", { name: "Close application" });
    await user.click(closeButton);

    await waitFor(() => {
      expect(closeApplication).toHaveBeenCalledWith({
        applicationId: "ghost-app",
        emailId: "ghost-email",
        reason:
          "Closed from Daily Action Queue ghosting signal: Move Associate Quality Engineer - Software (QA) out of active focus",
      });
    });

    expect(completeQueueAction).toHaveBeenCalledWith({
      logicalKey: "stale:ghost-thread",
      dedupeKey: "stale:ghost-thread:v1",
    });
  });

  test("opens Outreach Copilot with filtered presets for draftable actions", async () => {
    const user = userEvent.setup();
    renderPage();

    const [generateDraftButton] = await screen.findAllByRole("button", { name: "Generate draft" });
    await user.click(generateDraftButton);

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
    expect(screen.getByRole("button", { name: "Hide copilot" })).toBeInTheDocument();
    expect(screen.getByLabelText("Preset")).toBeInTheDocument();
    expect(screen.getAllByText("Reply to human contact").length).toBeGreaterThan(0);
    expect(screen.getByText("Before sending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy subject + body" })).toBeInTheDocument();
    expect(screen.getAllByText("Latest update: The Early Careers Engineering Assessment - Submission Confirmation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Latest activity: 4/9/2026").length).toBeGreaterThan(0);
    expect(screen.getByText(/Thanks for completing the Early Careers Engineering Assessment\./)).toBeInTheDocument();
    expect(screen.getByText("Suggested reply contact: Jordan Lee <jordan@example.test>")).toBeInTheDocument();
    expect(screen.getByText("Latest sender in reply thread: Wells Fargo Talent Acquisition <support@example.test>")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Referral / networking" })).not.toBeInTheDocument();
  });

  test("records copilot feedback with the draft snapshot", async () => {
    const user = userEvent.setup();
    renderPage();

    const [generateDraftButton] = await screen.findAllByRole("button", { name: "Generate draft" });
    await user.click(generateDraftButton);

    await user.click(await screen.findByText("Report draft issue"));
    const wrongGroundingButton = await screen.findByTestId("copilot-feedback-wrong_grounding");
    await user.click(wrongGroundingButton);

    await waitFor(() => {
      expect(recordSuggestionDraftFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "wf-thread",
          actionType: "thank_you",
          feedbackLabel: "wrong_grounding",
          tone: "post_interview",
          emailId: "wf-email",
          applicationId: "wf-app",
          suggestionSource: "email_followup",
          draft: expect.objectContaining({
            subject: "Re: Wells Fargo Careers: Thank you for applying",
            context: "warm",
            confidence: "medium",
            sendStrategy: "reply_in_thread",
            sendStrategyLabel: "Reply to human contact",
            recipient: "Jordan Lee <jordan@example.test>",
            latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
            threadPreview:
              "Hello, Thanks for completing the Early Careers Engineering Assessment. We have your submission to Wells Fargo.",
          }),
          feedback: {
            surface: "fix_suggestions",
          },
        }),
        expect.anything(),
      );
    });

    expect(await screen.findByText("Latest feedback saved: Wrong grounding")).toBeInTheDocument();
  });
});
