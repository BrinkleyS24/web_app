import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildDaqV1InboxQueue,
  buildCombinedSuggestionQueue,
  buildQueueItemsFromRankedQueue,
  buildOutreachDiagnostics,
  buildUpcomingFollowupWindows,
} from "./premiumTaskQueue";
import type { StoredEmail } from "./emails";

const baseAppliedEmail: StoredEmail = {
  id: "email-1",
  thread_id: "thread-1",
  subject: "Thanks for applying to Acme",
  from: "jobs@acme.com",
  date: "2026-04-09T12:00:00.000Z",
  category: "applied",
  company_name: "Acme",
  position: "Software Engineer",
  applicationId: "app-1",
};

describe("premiumTaskQueue outreach timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("shows upcoming application follow-up windows before day 10", () => {
    const windows = buildUpcomingFollowupWindows({
      storedEmails: [baseAppliedEmail],
      followupSuggestions: [],
      actionStates: [],
    });

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      threadId: "thread-1",
      category: "applied",
      opensInDays: 8,
      windowStartDay: 10,
      windowEndDay: 14,
    });
  });

  test("does not show an upcoming window when the active follow-up is already due", () => {
    const windows = buildUpcomingFollowupWindows({
      storedEmails: [
        {
          ...baseAppliedEmail,
          date: "2026-03-30T12:00:00.000Z",
        },
      ],
      followupSuggestions: [
        {
          threadId: "thread-1",
          actionType: "follow_up",
          daysAgo: 12,
        },
      ],
      actionStates: [],
    });

    expect(windows).toEqual([]);
  });

  test("does not show upcoming outreach when an active backend card exists for the same company", () => {
    const windows = buildUpcomingFollowupWindows({
      storedEmails: [
        {
          ...baseAppliedEmail,
          date: "2026-04-01T12:00:00.000Z",
        },
      ],
      followupSuggestions: [
        {
          threadId: "different-thread",
          actionType: "follow_up",
          daysAgo: 10,
          company: "Acme",
        },
      ],
      actionStates: [],
    });

    expect(windows).toEqual([]);
  });

  test("does not show upcoming outreach for a company with a terminal outcome", () => {
    const windows = buildUpcomingFollowupWindows({
      storedEmails: [
        {
          ...baseAppliedEmail,
          date: "2026-04-01T12:00:00.000Z",
        },
        {
          ...baseAppliedEmail,
          id: "email-rejected",
          thread_id: "thread-rejected",
          date: "2026-04-10T12:00:00.000Z",
          category: "rejected",
          company_name: "Acme",
          position: "QA Engineer",
          applicationId: "app-2",
        },
      ],
      followupSuggestions: [],
      actionStates: [],
    });

    expect(windows).toEqual([]);
  });

  test("deduplicates upcoming windows for multiple threads on the same application", () => {
    const windows = buildUpcomingFollowupWindows({
      storedEmails: [
        {
          ...baseAppliedEmail,
          id: "email-applied-1",
          thread_id: "thread-applied-1",
          date: "2026-04-09T12:00:00.000Z",
          category: "applied",
          company_name: "Acme",
          position: "Software Engineer",
          applicationId: "app-1",
        },
        {
          ...baseAppliedEmail,
          id: "email-applied-2",
          thread_id: "thread-applied-2",
          date: "2026-04-09T13:00:00.000Z",
          category: "applied",
          company_name: "Acme",
          position: "Software Engineer",
          applicationId: "app-1",
        },
      ],
      followupSuggestions: [],
      actionStates: [],
    });

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      category: "applied",
      applicationId: "app-1",
      title: "First follow-up window for Software Engineer",
    });
  });

  test("does not create stale application actions before day 21", () => {
    const queue = buildCombinedSuggestionQueue({
      followupSuggestions: [],
      applyGateHistory: [],
      storedEmails: [
        {
          ...baseAppliedEmail,
          date: "2026-03-27T12:00:00.000Z",
        },
      ],
      actionStates: [],
    });

    expect(queue.some((item) => item.actionType === "stale_application_status_check")).toBe(false);
  });

  test("suppresses legacy ambiguous cleanup backlog from the visible queue", () => {
    const queue = buildCombinedSuggestionQueue({
      followupSuggestions: [],
      applyGateHistory: [],
      storedEmails: [
        {
          ...baseAppliedEmail,
          date: "2026-03-01T12:00:00.000Z",
          company_name: "Acme",
          position: null,
          applicationId: null,
        },
      ],
      actionStates: [],
    });

    expect(queue.some((item) => item.actionType === "cleanup_structured_fields")).toBe(false);
    expect(queue.some((item) => item.source === "stale")).toBe(false);
  });

  test("keeps recent active cleanup work visible when the identity is resolvable", () => {
    const queue = buildCombinedSuggestionQueue({
      followupSuggestions: [],
      applyGateHistory: [],
      storedEmails: [
        {
          ...baseAppliedEmail,
          id: "email-unlinked-recent",
          thread_id: "thread-unlinked-recent",
          date: "2026-04-08T12:00:00.000Z",
          applicationId: null,
        },
      ],
      actionStates: [],
    });

    expect(queue.some((item) => item.actionType === "cleanup_application_links")).toBe(true);
  });

  test("uses same-thread identity inheritance before surfacing cleanup", () => {
    const queue = buildCombinedSuggestionQueue({
      followupSuggestions: [],
      applyGateHistory: [],
      storedEmails: [
        {
          ...baseAppliedEmail,
          id: "email-thread-source",
          thread_id: "thread-inherited",
          date: "2026-04-09T12:00:00.000Z",
        },
        {
          ...baseAppliedEmail,
          id: "email-thread-latest",
          thread_id: "thread-inherited",
          date: "2026-04-10T12:00:00.000Z",
          company_name: null,
          position: null,
          applicationId: "app-1",
        },
      ],
      actionStates: [],
    });

    const windows = buildUpcomingFollowupWindows({
      storedEmails: [
        {
          ...baseAppliedEmail,
          id: "email-thread-source",
          thread_id: "thread-inherited",
          date: "2026-04-09T12:00:00.000Z",
        },
        {
          ...baseAppliedEmail,
          id: "email-thread-latest",
          thread_id: "thread-inherited",
          date: "2026-04-10T12:00:00.000Z",
          company_name: null,
          position: null,
          applicationId: "app-1",
        },
      ],
      followupSuggestions: [],
      actionStates: [],
    });

    expect(queue.some((item) => item.actionType === "cleanup_structured_fields")).toBe(false);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.title).toBe("First follow-up window for Software Engineer");
  });

  test("explains active, hidden, closed, and ghosting-managed outreach buckets", () => {
    const diagnostics = buildOutreachDiagnostics({
      storedEmails: [
        baseAppliedEmail,
        {
          ...baseAppliedEmail,
          id: "email-closed",
          thread_id: "thread-closed",
          category: "rejected",
          company_name: "ClosedCo",
          position: "QA Engineer",
        },
        {
          ...baseAppliedEmail,
          id: "email-ghosting",
          thread_id: "thread-ghosting",
          date: "2026-03-16T12:00:00.000Z",
          company_name: "GhostCo",
          position: "Data Analyst",
        },
      ],
      followupSuggestions: [
        {
          threadId: "thread-active",
          actionType: "follow_up",
          title: "Follow up with ActiveCo",
        },
      ],
      actionStates: [
        {
          thread_id: "thread-hidden",
          action_type: "follow_up",
          state: "completed",
        },
      ],
    });

    expect(diagnostics.find((item) => item.id === "active")?.count).toBe(1);
    expect(diagnostics.find((item) => item.id === "hidden")?.count).toBe(1);
    expect(diagnostics.find((item) => item.id === "closed")?.count).toBe(1);
    expect(diagnostics.find((item) => item.id === "ghosting")?.count).toBe(1);
    expect(diagnostics.find((item) => item.id === "upcoming")?.count).toBe(1);
  });

  test("keeps ambiguous legacy backlog out of ghosting diagnostics", () => {
    const diagnostics = buildOutreachDiagnostics({
      storedEmails: [
        {
          ...baseAppliedEmail,
          id: "email-legacy-ambiguous",
          thread_id: "thread-legacy-ambiguous",
          date: "2026-03-01T12:00:00.000Z",
          company_name: "Acme",
          position: null,
          applicationId: null,
        },
      ],
      followupSuggestions: [],
      actionStates: [],
    });

    expect(diagnostics.find((item) => item.id === "ghosting")?.count).toBe(0);
  });

  test("sanitizes raw subject playbooks and deduplicates DAQ inbox actions by source subject", () => {
    const sharedEvidence = ["Subject: On-site interview at Amazon for the Delivery Associate position."];
    const baseRankedAction = {
      logicalKey: "base",
      dedupeKey: "base:v1",
      primaryEntityId: "base",
      evidenceVersion: "v1",
      actionCategory: "communication",
      targetOutcome: "Increase chance of recruiter reply",
      effortMinutes: 5,
      urgencyLevel: "high",
      confidenceLevel: "strong",
      source: "followup_engine",
      status: "open",
      effectiveStatus: "open",
      createdAt: "2026-04-10T12:00:00.000Z",
      evidence: sharedEvidence,
      queueSource: "followup",
      sourceLabel: "Outreach task",
      routeHref: "/fix-suggestions",
      routeLabel: "Open queue",
      stageLabel: "Outreach",
      company: "Nova Routes",
      threadId: null,
      applicationId: null,
    };
    const items = buildQueueItemsFromRankedQueue({
      now: "2026-04-11T12:00:00.000Z",
      doToday: [
        {
          ...baseRankedAction,
          id: "thank-you",
          logicalKey: "followup:thank-you",
          dedupeKey: "followup:thank-you:v1",
          actionType: "follow_up",
          legacyActionType: "thank_you",
          title: "Send thank-you note to Nova Routes",
          whyNow: "Interview thank-you notes are most useful while the conversation is still fresh.",
          intent: "SEND_THANK_YOU",
          intentLabel: "Thank-you",
          draftEligible: true,
          playbook: sharedEvidence,
        },
        {
          ...baseRankedAction,
          id: "interview-prep",
          logicalKey: "interview:prep",
          dedupeKey: "interview:prep:v1",
          actionType: "prep_interview",
          legacyActionType: "prepare_interview",
          title: "Prepare for Delivery Associate interview",
          whyNow: "Nova Routes has an active interview signal.",
          intent: "PREP_INTERVIEW",
          intentLabel: "Prepare interview",
          sourceLabel: "Interview task",
          draftEligible: false,
          playbook: ["Re-read the role and write three proof points that match the team needs."],
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
    } as any);

    expect(items[0].playbook[0]).toMatch(/company, role, and interview context/);
    expect(items[0].playbook).not.toContain(sharedEvidence[0]);

    const daqItems = buildDaqV1InboxQueue(items);
    expect(daqItems).toHaveLength(1);
    expect(daqItems[0].actionType).toBe("thank_you");
  });

  test("drops JSON punctuation noise from ranked action display fields", () => {
    const items = buildQueueItemsFromRankedQueue({
      now: "2026-04-11T12:00:00.000Z",
      doToday: [
        {
          id: "cleanup-noise",
          logicalKey: "cleanup-noise",
          dedupeKey: "cleanup-noise:v1",
          primaryEntityId: "cleanup-noise",
          evidenceVersion: "v1",
          actionCategory: "cleanup",
          actionType: "cleanup",
          legacyActionType: "cleanup_structured_fields",
          targetOutcome: "Fix extracted company and role fields so recommendations stop drifting.",
          effortMinutes: 10,
          urgencyLevel: "medium",
          confidenceLevel: "medium",
          source: "cleanup_engine",
          status: "open",
          effectiveStatus: "open",
          createdAt: "2026-04-10T12:00:00.000Z",
          evidence: ["[", "Thank you for applying to Assembled"],
          queueSource: "cleanup",
          sourceLabel: "Cleanup task",
          routeHref: "/fix-suggestions",
          routeLabel: "Resolve missing data",
          stageLabel: "Cleanup",
          company: "Assembled",
          threadId: "thread-cleanup",
          applicationId: null,
          title: "Fix 3 tracked emails with missing company or role data",
          whyNow: "[",
          intent: "CLEANUP_DATA",
          intentLabel: "Resolve missing data",
          draftEligible: false,
          playbook: ["[", "Subject: Thank you for applying to Assembled", "Open the source thread and correct the missing fields."],
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
    } as any);

    expect(items[0].description).toBe("Fix extracted company and role fields so recommendations stop drifting.");
    expect(items[0].whyNow).toBeNull();
    expect(items[0].evidence).not.toContain("[");
    expect(items[0].playbook).toEqual(["Open the source thread and correct the missing fields."]);
  });

  test("coerces ranked queue string and JSON-ish array fields without splitting characters", () => {
    const items = buildQueueItemsFromRankedQueue({
      now: "2026-04-11T12:00:00.000Z",
      doToday: [
        {
          id: "resume-proof-ranked",
          logicalKey: "resume-proof-ranked",
          dedupeKey: "resume-proof-ranked:v1",
          primaryEntityId: "resume-proof-ranked",
          evidenceVersion: "v1",
          actionCategory: "optimization",
          actionType: "resume_proof_gap",
          targetOutcome: "Add stronger resume proof.",
          effortMinutes: 20,
          urgencyLevel: "medium",
          confidenceLevel: "moderate",
          source: "apply_gate",
          status: "open",
          effectiveStatus: "open",
          createdAt: "2026-04-10T12:00:00.000Z",
          evidence: "[\"The resume lacks quantified automation evidence.\", \"Add production proof.\"]",
          queueSource: "resume",
          sourceLabel: "Resume-proof gap",
          routeHref: "/apply-gate",
          routeLabel: "Review Apply Gate",
          stageLabel: "Resume proof",
          company: "Resume proof",
          threadId: "resume-proof:aggregate",
          applicationId: null,
          title: "Add stronger proof to your resume",
          whyNow: "Recent screenings found resume-proof issues.",
          intent: "TAILOR_RESUME",
          intentLabel: "Tailor resume",
          draftEligible: false,
          playbook: "The resume proof row should stay intact.",
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
    } as any);

    expect(items[0].playbook).toEqual(["The resume proof row should stay intact."]);
    expect(items[0].evidence).toEqual([
      "The resume lacks quantified automation evidence.",
      "Add production proof.",
    ]);
    expect(items[0].evidence).not.toContain("T");
  });

  test("coerces Apply Gate and resume proof history fields without splitting strings into characters", () => {
    const queue = buildCombinedSuggestionQueue({
      followupSuggestions: [],
      storedEmails: [],
      actionStates: [],
      applyGateHistory: [
        {
          id: "gate-1",
          job_title: "QA Engineer",
          company_name: "Acme",
          job_url: null,
          verdict: "risky",
          score: 45,
          hard_blocker: false,
          reasons: "Needs stronger proof",
          fix_suggestion: null,
          user_action: null,
          created_at: "2026-04-10T12:00:00.000Z",
          explanation_payload: {
            decision: "fix_first",
            assessment_confidence: "medium",
            primary_rejection_drivers: "The posting asks for test automation ownership.",
            evidence_gaps: "automation ownership",
            action_plan: {
              quick_fixes: "The Apply Gate quick fix should stay one row.",
              resume_proof_improvements: "The resume proof improvement should stay one row.",
              long_term_gaps: "[\"Build more API testing depth.\"]",
            },
          },
        },
        {
          id: "gate-2",
          job_title: "SDET",
          company_name: "Beta",
          job_url: null,
          verdict: "risky",
          score: 48,
          hard_blocker: false,
          reasons: "Needs stronger proof",
          fix_suggestion: null,
          user_action: null,
          created_at: "2026-04-10T12:00:00.000Z",
          explanation_payload: {
            decision: "apply_with_caveats",
            assessment_confidence: "medium",
            primary_rejection_drivers: ["The role emphasizes automation ownership."],
            evidence_gaps: "automation ownership",
            action_plan: {
              quick_fixes: ["Add one Selenium result bullet."],
              resume_proof_improvements: "The resume proof improvement should stay one row.",
              long_term_gaps: [],
            },
          },
        },
      ] as any,
    });

    const applyGateItem = queue.find((item) => item.source === "apply_gate");
    const resumeItem = queue.find((item) => item.source === "resume");

    expect(applyGateItem?.evidence).toContain("The posting asks for test automation ownership.");
    expect(applyGateItem?.playbook).toContain("The Apply Gate quick fix should stay one row.");
    expect(applyGateItem?.evidence).not.toContain("T");
    expect(resumeItem?.playbook).toContain("The resume proof improvement should stay one row.");
    expect(resumeItem?.title).toContain("automation ownership");
    expect(resumeItem?.playbook).not.toContain("T");
  });
});

describe("premiumTaskQueue coach response override", () => {
  test("uses coach headline + body as title + description when coachResponse is present", () => {
    const queue = buildCombinedSuggestionQueue({
      storedEmails: [],
      applyGateHistory: [],
      followupSuggestions: [
        {
          threadId: "thread-acme",
          subject: "Application received",
          title: "TEMPLATED TITLE that should be overridden",
          description: "TEMPLATED DESCRIPTION that should be overridden",
          actionType: "follow_up",
          urgency: "high",
          category: "applied",
          daysAgo: 11,
          coachResponse: {
            signal_type: "evidence_grounded_followup",
            evidence_hash: "h1",
            model: "gpt-4o-mini",
            generated_at: "2026-04-11T11:00:00.000Z",
            content: {
              headline: "Follow up with Acme today",
              body: "Your application has been sitting for 11 days with no rejection signal.",
              suggested_action: { label: "Send follow-up", intent: "FOLLOW_UP_THREAD" },
              draft_followup: "Hi! Quick check-in.",
              cited_evidence_keys: ["company_name"],
            },
          },
        },
      ],
    });

    const item = queue.find((q) => q.threadId === "thread-acme");
    expect(item).toBeDefined();
    expect(item?.title).toBe("Follow up with Acme today");
    expect(item?.description).toBe(
      "Your application has been sitting for 11 days with no rejection signal."
    );
    // Coach payload preserved on item so downstream consumers (drafts, debug)
    // can read structured fields.
    expect(item?.coachResponse?.content?.draft_followup).toBe("Hi! Quick check-in.");
  });

  test("falls back to templated title/description when coachResponse is absent", () => {
    const queue = buildCombinedSuggestionQueue({
      storedEmails: [],
      applyGateHistory: [],
      followupSuggestions: [
        {
          threadId: "thread-beta",
          subject: "Application received",
          title: "Templated headline",
          description: "Templated description",
          actionType: "follow_up",
          urgency: "medium",
          category: "applied",
          daysAgo: 12,
          // no coachResponse field
        },
      ],
    });

    const item = queue.find((q) => q.threadId === "thread-beta");
    expect(item).toBeDefined();
    expect(item?.title).toBe("Templated headline");
    expect(item?.description).toBe("Templated description");
    expect(item?.coachResponse ?? null).toBeNull();
  });

  test("empty coach headline/body falls back to templated fields (defensive)", () => {
    // Validation should prevent this in the backend, but the renderer must
    // still degrade gracefully if a malformed row somehow lands.
    const queue = buildCombinedSuggestionQueue({
      storedEmails: [],
      applyGateHistory: [],
      followupSuggestions: [
        {
          threadId: "thread-gamma",
          subject: "Application received",
          title: "Templated title",
          description: "Templated description",
          actionType: "follow_up",
          urgency: "medium",
          category: "applied",
          daysAgo: 11,
          coachResponse: {
            signal_type: "evidence_grounded_followup",
            evidence_hash: "h1",
            model: "gpt-4o-mini",
            generated_at: "2026-04-11T11:00:00.000Z",
            content: {
              headline: "   ", // whitespace-only
              body: "",
              suggested_action: { label: "Send", intent: "FOLLOW_UP_THREAD" },
              draft_followup: null,
              cited_evidence_keys: [],
            },
          },
        },
      ],
    });

    const item = queue.find((q) => q.threadId === "thread-gamma");
    expect(item?.title).toBe("Templated title");
    expect(item?.description).toBe("Templated description");
  });
});
