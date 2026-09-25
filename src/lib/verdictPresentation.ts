import type { Tone } from "@/components/premium/tone";
import type { ApplyGateVerdict } from "@/lib/emails";

export type VerdictDecisionKey = "apply" | "apply_with_care" | "fix_first" | "skip";

type VerdictLike = {
  verdict?: ApplyGateVerdict | string | null;
  explanation_payload?: { decision?: string | null } | null;
};

const DECISIONS: Record<VerdictDecisionKey, { label: string; tone: Tone }> = {
  apply: { label: "Apply", tone: "positive" },
  apply_with_care: { label: "Apply with care", tone: "brand" },
  fix_first: { label: "Fix first", tone: "attention" },
  skip: { label: "Skip", tone: "risk" },
};

/** The one decision a verdict stands for, in plain words. */
export function describeVerdictDecision(item: VerdictLike): { key: VerdictDecisionKey; label: string; tone: Tone } {
  const decision = String(item?.explanation_payload?.decision || "").toLowerCase();
  let key: VerdictDecisionKey;
  if (decision === "apply_now") key = "apply";
  else if (decision === "apply_with_caveats") key = "apply_with_care";
  else if (decision === "fix_first") key = "fix_first";
  else if (decision === "skip") key = "skip";
  else if (item?.verdict === "not_recommended") key = "skip";
  else if (item?.verdict === "risky") key = "fix_first";
  else if (item?.verdict === "potential_fit") key = "apply_with_care";
  else key = "apply";
  return { key, ...DECISIONS[key] };
}

type OutcomeLike = {
  derived_outcome_label?: string | null;
  outcome_label?: string | null;
  user_action?: string | null;
};

const OUTCOMES: Record<string, { label: string; tone: Tone }> = {
  offered: { label: "Offer", tone: "positive" },
  interviewed: { label: "Interview", tone: "positive" },
  rejected: { label: "Rejected", tone: "risk" },
  no_response: { label: "No reply yet", tone: "neutral" },
  withdrawn: { label: "Withdrew", tone: "done" },
};

/**
 * What happened after the check. What Applendium saw in the inbox comes first — the user should not
 * have to report an application the tracker already found — then what the user recorded.
 */
export function describeVerdictOutcome(item: OutcomeLike): { label: string; tone: Tone } | null {
  const seen = String(item?.derived_outcome_label || item?.outcome_label || "").toLowerCase();
  if (OUTCOMES[seen]) {
    const outcome = OUTCOMES[seen];
    return seen === "withdrawn" ? outcome : { label: `You applied · ${outcome.label}`, tone: outcome.tone };
  }
  const action = String(item?.user_action || "").toLowerCase();
  if (action === "applied") return { label: "You applied", tone: "neutral" };
  if (action === "skipped") return { label: "You skipped it", tone: "done" };
  if (action === "fixed") return { label: "Fixing first", tone: "attention" };
  return null;
}
