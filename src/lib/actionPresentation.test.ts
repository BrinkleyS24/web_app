import { describe, expect, test } from "vitest";
import { describeActionIdentity, describeActionKind, resolveActionCta } from "./actionPresentation";
import type { QueueItem } from "./premiumTaskQueue";

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: "a1",
    logicalKey: "k1",
    dedupeKey: "d1",
    source: "followup",
    urgency: "medium",
    title: "Title",
    description: "Why now",
    estimatedTime: "10 min",
    playbook: [],
    sourceLabel: "Inbox",
    sourceDescription: "",
    threadId: "t1",
    actionType: "follow_up",
    hasDraft: true,
    ...overrides,
  } as QueueItem;
}

const GMAIL = "https://mail.google.com/mail/u/0/#all/t1";

describe("resolveActionCta", () => {
  // 2026-09-25: every card on Next Actions offered "Generate draft", research ones included.
  test("a follow-up drafts the email", () => {
    expect(resolveActionCta(item(), GMAIL)).toEqual({ kind: "draft", label: "Draft follow-up" });
    expect(resolveActionCta(item({ actionType: "thank_you" }), GMAIL).label).toBe("Draft thank-you note");
    expect(resolveActionCta(item({ actionType: "reply" }), GMAIL).label).toBe("Draft reply");
  });

  test("research opens a search for the company, never a draft", () => {
    const cta = resolveActionCta(item({ actionType: "research", company: "Prometheum", roleTitle: "QA Engineer" }), GMAIL);
    expect(cta.kind).toBe("external");
    expect(cta.label).toBe("Research Prometheum");
    expect(cta.href).toBe("https://www.google.com/search?q=Prometheum%20QA%20Engineer");
  });

  test("networking finds people at the company", () => {
    const cta = resolveActionCta(item({ actionType: "networking", company: "Kira" }), GMAIL);
    expect(cta).toEqual({
      kind: "external",
      label: "Find people at Kira",
      href: "https://www.linkedin.com/search/results/people/?keywords=Kira",
    });
  });

  test("interview prep opens the prep plan, an assessment opens its email", () => {
    expect(resolveActionCta(item({ actionType: "prepare_interview", intent: "PREP_INTERVIEW" }), GMAIL))
      .toEqual({ kind: "prep", label: "See prep plan" });
    expect(resolveActionCta(item({ actionType: "complete_assessment", intent: "COMPLETE_ASSESSMENT" }), GMAIL))
      .toEqual({ kind: "gmail", label: "Open assessment email", href: GMAIL });
  });

  test("résumé and role work go to the tool that does it", () => {
    expect(resolveActionCta(item({ source: "resume", actionType: "resume_proof_gap", hasDraft: false }), null))
      .toEqual({ kind: "route", label: "Update your résumé", href: "/resumes" });
    // The label follows where the button goes.
    expect(resolveActionCta(item({ source: "resume", actionType: "tailor_resume", hasDraft: false, routeHref: "/apply-gate" }), null))
      .toEqual({ kind: "route", label: "Tailor in Apply Gate", href: "/apply-gate" });
    expect(resolveActionCta(item({ source: "apply_gate", actionType: "apply_gate_fix", hasDraft: false, routeHref: "/apply-gate?verdict=9" }), null))
      .toEqual({ kind: "route", label: "Open in Apply Gate", href: "/apply-gate?verdict=9" });
  });

  test("a stale role closes out and a data gap opens the repair panel", () => {
    expect(resolveActionCta(item({ source: "stale", intent: "CLOSE_STALE_ROLE", actionType: "close_stale_application" }), GMAIL))
      .toEqual({ kind: "close", label: "Close it out" });
    expect(resolveActionCta(item({ source: "cleanup", intent: "LINK_APPLICATIONS", actionType: "cleanup_application_links" }), null))
      .toEqual({ kind: "cleanup", label: "Link applications" });
  });

  test("research with nothing to search for falls back to the thread", () => {
    expect(resolveActionCta(item({ actionType: "research", company: null, roleTitle: null }), GMAIL))
      .toEqual({ kind: "gmail", label: "Open in Gmail", href: GMAIL });
  });
});

describe("describeActionIdentity", () => {
  test("names the company and role", () => {
    expect(describeActionIdentity(item({ company: "Portra", roleTitle: "QA Engineer" }))).toBe("Portra · QA Engineer");
    expect(describeActionIdentity(item({ company: "Portra" }))).toBe("Portra");
    expect(describeActionIdentity(item({ roleTitle: "IT Operations Technician" }))).toBe("IT Operations Technician");
  });

  test("with no company or role, the email subject identifies the application", () => {
    // "Follow up on your application" — which one? The subject is the one thing always known.
    expect(describeActionIdentity(item({ evidence: ["Subject: Your application to Acme Labs", "No reply in 14 days"] })))
      .toBe("“Your application to Acme Labs”");
    expect(describeActionIdentity(item({ evidence: [] }))).toBeNull();
  });
});

describe("describeActionKind", () => {
  test("gives each task type a plain name", () => {
    expect(describeActionKind(item())).toBe("Follow-up");
    expect(describeActionKind(item({ actionType: "research" }))).toBe("Research");
    expect(describeActionKind(item({ intent: "PREP_INTERVIEW", actionType: "prepare_interview" }))).toBe("Interview prep");
    expect(describeActionKind(item({ intent: "CLOSE_STALE_ROLE", actionType: "close_stale_application" }))).toBe("Close-out");
  });
});
