import { describe, expect, test } from "vitest";
import { describeVerdictDecision, describeVerdictOutcome } from "./verdictPresentation";

describe("describeVerdictDecision", () => {
  // One decision per verdict. Cards used to say it twice: a "Risky" badge and a "Fix first before
  // applying" chip, or "Not Recommended" beside "Skip this role".
  test("the explanation's decision wins, the verdict fills in when it is missing", () => {
    expect(describeVerdictDecision({ verdict: "risky", explanation_payload: { decision: "fix_first" } as never }))
      .toEqual({ key: "fix_first", label: "Fix first", tone: "attention" });
    expect(describeVerdictDecision({ verdict: "strong_fit" })).toEqual({ key: "apply", label: "Apply", tone: "positive" });
    expect(describeVerdictDecision({ verdict: "potential_fit" }).label).toBe("Apply with care");
    expect(describeVerdictDecision({ verdict: "not_recommended" })).toEqual({ key: "skip", label: "Skip", tone: "risk" });
  });
});

describe("describeVerdictOutcome", () => {
  test("what Applendium saw happen beats what the user reported", () => {
    expect(describeVerdictOutcome({ derived_outcome_label: "rejected", user_action: "applied" }))
      .toEqual({ label: "You applied · Rejected", tone: "risk" });
    expect(describeVerdictOutcome({ derived_outcome_label: "interviewed" }))
      // Interviews are gold on every surface (statusTone.ts), matching the extension and landing page.
      .toEqual({ label: "You applied · Interview", tone: "attention" });
  });

  test("with no inbox evidence, the recorded decision is shown; with neither, nothing", () => {
    expect(describeVerdictOutcome({ user_action: "applied" })).toEqual({ label: "You applied", tone: "neutral" });
    expect(describeVerdictOutcome({ user_action: "skipped" })).toEqual({ label: "You skipped it", tone: "done" });
    expect(describeVerdictOutcome({})).toBeNull();
  });
});
