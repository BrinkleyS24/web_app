import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildCombinedSuggestionQueue,
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
});
