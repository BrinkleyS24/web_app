import type { ResumeGapInsightsResponse, StrategyAlertsResponse } from "./emails";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown) => typeof value === "string";
const optionalText = (value: unknown) => value == null || text(value);

/** Validate before query success: unavailable evidence must not look like no findings. */
export function requireStrategyAlerts(value: unknown): StrategyAlertsResponse {
  if (!record(value) || value.success !== true || !Array.isArray(value.alerts)
    || new Set(value.alerts.map(alert => record(alert) ? alert.id : undefined)).size !== value.alerts.length
    || !value.alerts.every(alert => record(alert) && text(alert.id) && Boolean(alert.id) && text(alert.title) && Boolean(alert.title) && text(alert.description)
      && ["performance", "fit", "focus", "execution", "commitment", "experiment"].includes(String(alert.kind))
      && ["high", "medium", "low", "positive"].includes(String(alert.severity))
      && [alert.recommendation, alert.supporting_stat, alert.timeframe_label].every(optionalText)
      && (alert.experiment == null || record(alert.experiment) && text(alert.experiment.key)
        && ["not_started", "started", "running", "measured"].includes(String(alert.experiment.status))
        && [alert.experiment.name, alert.experiment.ask, alert.experiment.howItWorks].every(optionalText))
      && (alert.debrief == null || record(alert.debrief) && Array.isArray(alert.debrief.items) && alert.debrief.items.every(record) && count(alert.debrief.total))
      && (alert.anchor == null || record(alert.anchor) && text(alert.anchor.threadId) && text(alert.anchor.kind)))) {
    throw new Error("Your strategy findings could not be verified. Try loading them again.");
  }
  return value as StrategyAlertsResponse;
}

export function requireResumePatterns(value: unknown): ResumeGapInsightsResponse {
  if (!record(value) || value.success !== true || value.basis !== "current_default_resume_checks"
    || !count(value.analyzedVerdicts) || !count(value.distinctRolesEvaluated) || !Array.isArray(value.gaps)
    || !(value.resume === null || record(value.resume) && text(value.resume.variantId) && Boolean(value.resume.variantId) && text(value.resume.name))
    || value.resume === null && (value.distinctRolesEvaluated !== 0 || value.gaps.length > 0)
    || ["outdatedVerdictsExcluded", "changedResumeVerdictsExcluded", "otherResumeVerdictsExcluded", "sampledChecks", "sampleLimit", "verdictsWithGapData"].some(key => value[key] !== undefined && !count(value[key]))
    || value.truncated !== undefined && typeof value.truncated !== "boolean"
    || value.truncated === true && !count(value.sampledChecks)
    || new Set(value.gaps.map(gap => record(gap) ? `${gap.category}:${gap.skill}` : undefined)).size !== value.gaps.length
    || !value.gaps.every(gap => record(gap) && text(gap.skill) && Boolean(gap.skill)
      && ["required", "evidence", "preferred"].includes(String(gap.category)) && optionalText(gap.label)
      && count(gap.occurrences) && Number(gap.occurrences) >= 2 && Number(gap.occurrences) <= Number(value.distinctRolesEvaluated)
      && Array.isArray(gap.examples) && gap.examples.every(example => record(example)
        && optionalText(example.company) && optionalText(example.position) && optionalText(example.requirementQuote) && optionalText(example.verdictId)))) {
    throw new Error("Patterns for your current resume could not be verified. Try loading them again.");
  }
  return value as unknown as ResumeGapInsightsResponse;
}

export function resumePatternSummary(data: ResumeGapInsightsResponse) {
  if (!data.resume) return { title: "Choose a default resume", body: "Patterns use the exact saved wording of your default resume. Choose that version first.", action: "Open Resumes", href: "/resumes" };
  if (data.distinctRolesEvaluated === 0) return { title: "No current role checks for this version", body: "Check a relevant posting with this resume in Apply Gate. Older checks and other versions do not establish its current patterns.", action: "Check a current posting", href: "/apply-gate" };
  if (data.distinctRolesEvaluated === 1) return { title: "Only one current role checked", body: "At least two distinct roles are needed to identify a repeated requirement. One check cannot establish a pattern.", action: "Check another role", href: "/apply-gate" };
  return { title: "No repeated requirements in these checks", body: `No unresolved requirement appeared in two or more of these ${data.distinctRolesEvaluated} current role checks. This does not establish qualification for another job.`, action: "Check another role", href: "/apply-gate" };
}
