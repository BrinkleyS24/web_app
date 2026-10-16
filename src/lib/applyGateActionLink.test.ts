import { describe, expect, test } from "vitest";
import { alignApplyGateActions, applyGateHrefForCheck, latestCheckForTask } from "./applyGateActionLink";
import { resolveActionCta } from "./actionPresentation";
import type { ApplyGateHistoryItem, ResumeVariant } from "./emails";
import type { QueueItem } from "./premiumTaskQueue";

// Teacher review, 2026-10-15: the tailor task opened an empty Apply Gate with the default resume, and
// "Apply to Clinical Operations Coordinator" was offered after Apply Gate rated it Fix first.
const MARIA_ID = "6f1c2d3e-4a5b-4c6d-8e7f-001122334455";
const K12_ID = "0a1b2c3d-4e5f-4a6b-8c7d-998877665544";
const variants: ResumeVariant[] = [
  { id: K12_ID, name: "Teacher — K-12", isDefault: true, createdAt: "2026-09-01", charCount: 3000 },
  { id: MARIA_ID, name: "Maria test", isDefault: false, createdAt: "2026-10-01", charCount: 3000 },
];

function check(overrides: Partial<ApplyGateHistoryItem>): ApplyGateHistoryItem {
  return {
    id: "v1", job_title: "Associate Instructional Designer", company_name: "Lumenfield", job_url: null,
    verdict: "good_fit", score: 70, reasons: "", fix_suggestion: null, user_action: null,
    created_at: "2026-10-15T14:00:00", resume_variant_id: MARIA_ID,
    explanation_payload: { decision: "apply_now" } as ApplyGateHistoryItem["explanation_payload"],
    ...overrides,
  };
}

function task(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: "apply-gate:tailor:v1", logicalKey: "0123456789abcdef", dedupeKey: "fedcba9876543210",
    source: "resume", suggestionSource: "apply_gate_action_plan", urgency: "medium", title: "Tailor resume before applying to Associate Instructional Designer",
    description: "Missing: writing", estimatedTime: "15 mins", playbook: [], sourceLabel: "Apply Gate", sourceDescription: "",
    actionType: "tailor_resume", intent: "TAILOR_RESUME", applicationId: "v1", routeHref: "/apply-gate",
    ...overrides,
  };
}

describe("Apply Gate tasks follow the posting's latest check", () => {
  test("the tailor link carries the check and the resume version it used", () => {
    const [aligned] = alignApplyGateActions([task({})], [check({ explanation_payload: { decision: "fix_first" } as never })], variants);
    expect(aligned.routeHref).toBe(`/apply-gate?verdict=v1&resume=${MARIA_ID}`);
    const cta = resolveActionCta(aligned, null);
    expect(cta).toMatchObject({ kind: "route", href: `/apply-gate?verdict=v1&resume=${MARIA_ID}` });
    // A Fix first check keeps the tailoring words.
    expect(aligned.title).toBe("Tailor resume before applying to Associate Instructional Designer");
    expect(cta.label).toBe("Tailor in Apply Gate");
  });

  test("a resume version that no longer exists is left out, so Apply Gate does not select a missing one", () => {
    const href = applyGateHrefForCheck(check({ resume_variant_id: "11111111-2222-4333-8444-555555555555" }), variants);
    expect(href).toBe("/apply-gate?verdict=v1");
    expect(applyGateHrefForCheck(check({}), null)).toBe("/apply-gate?verdict=v1");
  });

  test("after an Apply now check, tailoring is offered as optional, not as a gate", () => {
    const [aligned] = alignApplyGateActions([task({})], [check({})], variants);
    expect(aligned.title).toBe("Optional: strengthen your resume for Associate Instructional Designer at Lumenfield");
    expect(aligned.whyNow).toMatch(/^Apply Gate's latest check said Apply\. /);
    expect(resolveActionCta(aligned, null).label).toBe("Review in Apply Gate");
  });

  test("'Apply to' is never offered for a role whose latest check said Fix first", () => {
    const apply = task({ id: "apply-gate:apply:v1", actionType: "apply", intent: "APPLY_TO_ROLE", title: "Apply to Clinical Operations Coordinator at Harborview" });
    const history = [check({ id: "v1", job_title: "Clinical Operations Coordinator", company_name: "Harborview", verdict: "risky", explanation_payload: { decision: "fix_first" } as never })];
    const [aligned] = alignApplyGateActions([apply], history, variants);
    expect(aligned.title).toBe("Recheck Clinical Operations Coordinator at Harborview before you apply");
    expect(aligned.title).not.toMatch(/^Apply to/);
    expect(resolveActionCta(aligned, null).label).toBe("Recheck in Apply Gate");
  });

  test("a newer check of the same posting wins over the one the task was raised from", () => {
    const history = [
      check({ id: "v1", created_at: "2026-10-14T14:00:00", explanation_payload: { decision: "fix_first" } as never, resume_variant_id: K12_ID }),
      check({ id: "v2", created_at: "2026-10-15T15:00:00", explanation_payload: { decision: "apply_now" } as never, resume_variant_id: MARIA_ID, user_action: "applied" }),
      check({ id: "v3", job_title: "Other role", created_at: "2026-10-16T15:00:00" }),
    ];
    expect(latestCheckForTask(task({}), history)?.id).toBe("v2");
    const [aligned] = alignApplyGateActions([task({})], history, variants);
    expect(aligned.routeHref).toBe(`/apply-gate?verdict=v2&resume=${MARIA_ID}`);
    expect(aligned.title).toMatch(/^Optional:/);
  });

  test("tasks from other sources, or with no history, are untouched", () => {
    const followup = task({ source: "followup", suggestionSource: "email_followup", actionType: "follow_up", id: "f1" });
    expect(alignApplyGateActions([followup], [check({})], variants)[0]).toBe(followup);
    const tailor = task({});
    expect(alignApplyGateActions([tailor], [], variants)[0]).toBe(tailor);
    expect(alignApplyGateActions([tailor], [check({ id: "other" })], variants)[0]).toBe(tailor);
  });
});
