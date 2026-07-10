import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  normalizeCompanyName,
  splitRoleAndCompany as splitApplyGateRoleAndCompany,
} from "@/lib/applyGateDisplay";
import { useAuth } from "@/lib/AuthContext.jsx";
import {
  analyzeJobAlignment,
  fetchApplyGateHistory,
  updateApplyGateAction,
  fetchResume,
  fetchResumeVariants,
  fetchVariantScoreboard,
  type ApplyGateResult,
  type ApplyGateHistoryItem,
  type ApplyGateDisplayDecision,
  type ApplyGateRiskTolerance,
  type ApplyGateCalibrationBucket,
} from "@/lib/emails";
import { VariantStrategyCard, type VariantDraftDecisions } from "@/components/VariantStrategyCard";
import { ReferralNudge } from "@/components/ReferralNudge";

const APPLY_GATE_STAGES = [
  "Reading the job description",
  "Matching against your résumé",
  "Scoring fit & rejection risk",
  "Writing your decision brief",
];

// The premium verdict is a single ~30s backend call (no streaming), so this
// shows staged, time-estimated progress instead of a 30s blank spinner — the
// difference between "is this broken?" and "it's working through my résumé".
function ApplyGateProgress() {
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [pct, setPct] = useState(reduceMotion ? 50 : 8);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setInterval(() => {
      // Ease asymptotically toward 92% so the bar never claims "done" early.
      setPct((p) => (p >= 92 ? 92 : p + Math.max(0.7, (92 - p) * 0.05)));
    }, 600);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const stageIndex = Math.min(
    APPLY_GATE_STAGES.length - 1,
    Math.floor((pct / 92) * APPLY_GATE_STAGES.length),
  );

  return (
    <div className="glass-card rounded-2xl p-8" role="status" aria-live="polite" aria-busy="true">
      <p className="text-sm font-semibold">Checking this role…</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        The full premium read takes about half a minute — your résumé, the posting, and your past
        outcomes are all in play.
      </p>
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-5 space-y-2.5">
        {APPLY_GATE_STAGES.map((label, i) => {
          const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              {state === "done" ? (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : state === "active" ? (
                <Loader2
                  className={`h-4 w-4 shrink-0 text-primary ${reduceMotion ? "" : "animate-spin"}`}
                  aria-hidden="true"
                />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" aria-hidden="true" />
              )}
              <span className={state === "pending" ? "text-muted-foreground" : "font-medium"}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const HARD_BLOCKER_LABELS: Record<string, string> = {
  experience_gap: "Years of experience are below the stated minimum",
  education_gap: "Required education level is missing",
  recent_program_completion_gap: "Recent program completion window may not be met",
  critical_skill_gap: "A required critical skill is missing",
  universal_hard_constraint_gap: "A non-negotiable job requirement is missing",
  license_credential_gap: "A required license or credential is missing",
  clearance_gap: "A required clearance is missing",
  required_prior_role_gap: "A required prior-role background is missing",
  required_program_completion_gap: "A required program or training completion is missing",
  language_requirement_gap: "A required language capability is missing",
  discipline_mismatch: "This role's core field or work setting doesn't match your background",
};

const RISK_TOLERANCE_COPY: Record<ApplyGateRiskTolerance, { label: string; helper: string }> = {
  conservative: {
    label: "Conservative",
    helper: "Stricter filter. Best when you only want high-fit applications.",
  },
  balanced: {
    label: "Balanced",
    helper: "Default. Separates clear skips from realistic strategy plays.",
  },
  aggressive: {
    label: "Aggressive",
    helper: "More open to stretch roles, but still blocks hard mismatches.",
  },
};

type VerdictStatus = "strong" | "potential" | "risky" | "not-recommended";

function applyGateDisplayDecisionV1Enabled() {
  return String(import.meta.env.VITE_APPLY_GATE_DISPLAY_DECISION_V1 || "false").trim().toLowerCase() === "true";
}

function verdictToStatus(verdict: ApplyGateResult["verdict"]): VerdictStatus {
  if (verdict === "not_recommended") return "not-recommended";
  if (verdict === "risky") return "risky";
  if (verdict === "potential_fit") return "potential";
  return "strong";
}

function reviewLabelForStatus(status: VerdictStatus) {
  if (status === "strong") return "Worth applying";
  if (status === "potential") return "Apply with caveats";
  if (status === "risky") return "High-risk application";
  return "Likely not worth applying";
}

function reviewLabelForDecisionLabel(decisionLabel: string | null | undefined, status: VerdictStatus) {
  const label = String(decisionLabel || "").trim().toUpperCase();
  if (label === "CLEAR_MISMATCH") return "Clear mismatch";
  if (label === "WEAK_FIT") return "Weak fit";
  if (label === "STRETCH") return "Stretch aligned";
  if (label === "GOOD_FIT") return "Good fit";
  return reviewLabelForStatus(status);
}

function fallbackRiskPercent(
  score: number | null | undefined,
  status: VerdictStatus,
  hasHardBlocker = false,
) {
  if (typeof score === "number" && Number.isFinite(score)) {
    const base = Math.max(0, Math.min(100, 100 - Math.round(score)));
    if (hasHardBlocker) return Math.max(base, 75);
    return status === "strong" ? Math.min(base, 35) : base;
  }
  if (status === "strong") return 20;
  if (status === "potential") return 45;
  if (status === "risky") return hasHardBlocker ? 80 : 60;
  return 90;
}

function validRiskPercent(value: unknown) {
  const risk = Number(value);
  return Number.isFinite(risk) ? Math.max(0, Math.min(99, Math.round(risk))) : null;
}

function resultApplicationRiskPercent(result: ApplyGateResult | null | undefined, status: VerdictStatus) {
  return validRiskPercent(result?.scoringBreakdown?.applicationRiskScore)
    ?? validRiskPercent(result?.explanation?.application_risk_score)
    ?? fallbackRiskPercent(
      result?.scoringBreakdown?.totalScore,
      status,
      Boolean(result?.scoringBreakdown?.hardBlocker),
    );
}

function historyApplicationRiskPercent(item: ApplyGateHistoryDisplayItem, status: VerdictStatus) {
  return validRiskPercent(item.explanation_payload?.application_risk_score)
    ?? fallbackRiskPercent(item.score, status, Boolean(item.hard_blocker));
}

// The risk percentage is only a probability if the backend calibrated it against real
// outcomes. Until then it is a deterministic fit transform — show it as a qualitative
// band, never as a precise %. Honest default: treat unknown as not-calibrated.
const APPLY_GATE_RISK_CALIBRATED = "outcome_calibrated";

function riskCalibrationFromResult(result: ApplyGateResult | null | undefined) {
  return String(
    result?.scoringBreakdown?.applicationRiskCalibration
    ?? result?.scoringBreakdown?.riskBreakdown?.calibration
    ?? result?.explanation?.application_risk_calibration
    ?? result?.explanation?.risk_breakdown?.calibration
    ?? "not_outcome_calibrated",
  );
}

function riskBandLabelFromResult(result: ApplyGateResult | null | undefined) {
  const label = String(
    result?.scoringBreakdown?.applicationRiskLabel
    ?? result?.scoringBreakdown?.riskBreakdown?.label
    ?? result?.explanation?.risk_breakdown?.label
    ?? "",
  ).trim();
  return label ? label[0].toUpperCase() + label.slice(1) : null;
}

function riskBandToneClass(label: string | null) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "low" || normalized === "moderate") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (normalized === "elevated") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-red-500/30 bg-red-500/10 text-red-700";
}

function riskBreakdownFromResult(result: ApplyGateResult | null | undefined) {
  return result?.scoringBreakdown?.riskBreakdown || result?.explanation?.risk_breakdown || null;
}

function occupationAlignmentLabel(value: string | null | undefined) {
  const label = String(value || "").replace(/_/g, " ").trim();
  if (!label) return "Unknown";
  return label[0].toUpperCase() + label.slice(1);
}

function riskBreakdownFromHistory(item: ApplyGateHistoryDisplayItem) {
  return item.explanation_payload?.risk_breakdown || null;
}

function normalizeOutcomeBand(value: unknown, fallback: "Low" | "Medium" | "High" = "Medium") {
  const text = String(value || "").trim().toLowerCase();
  if (text === "high") return "High";
  if (text === "medium") return "Medium";
  if (text === "low") return "Low";
  return fallback;
}

function fallbackAtsBand(status: VerdictStatus, hasHardBlocker = false) {
  if (hasHardBlocker || status === "not-recommended") return "Low";
  if (status === "strong") return "High";
  if (status === "potential") return "Medium";
  return "Low";
}

function fallbackHumanBand(status: VerdictStatus, hasHardBlocker = false) {
  if (hasHardBlocker || status === "not-recommended") return "Low";
  if (status === "strong") return "High";
  if (status === "potential") return "Medium";
  return "Medium";
}

function bandTone(band: string) {
  if (band === "High") return "text-emerald-500";
  if (band === "Medium") return "text-amber-500";
  return "text-red-500";
}

function resultOutcomeBands(result: ApplyGateResult | null | undefined, status: VerdictStatus) {
  const hardBlocker = Boolean(result?.scoringBreakdown?.hardBlocker);
  return {
    atsPass: normalizeOutcomeBand(
      result?.scoringBreakdown?.atsPass || result?.explanation?.ats_pass,
      fallbackAtsBand(status, hardBlocker),
    ),
    humanWin: normalizeOutcomeBand(
      result?.scoringBreakdown?.humanWin || result?.explanation?.human_win,
      fallbackHumanBand(status, hardBlocker),
    ),
  };
}

function historyOutcomeBands(item: ApplyGateHistoryDisplayItem, status: VerdictStatus) {
  const hardBlocker = Boolean(item.hard_blocker);
  return {
    atsPass: normalizeOutcomeBand(item.explanation_payload?.ats_pass, fallbackAtsBand(status, hardBlocker)),
    humanWin: normalizeOutcomeBand(item.explanation_payload?.human_win, fallbackHumanBand(status, hardBlocker)),
  };
}

function parseHistoryReasons(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
  }
  return [String(raw)];
}

function warningPrefixForStatus(status: VerdictStatus) {
  if (status === "potential") return "Key gap to review";
  if (status === "risky") return "Likely rejection driver";
  if (status === "not-recommended") return "Primary blocker";
  return "Risk note";
}


function splitRoleAndCompany(
  rawTitle: string | null | undefined,
  explicitCompany?: string | null,
  fallbackUrl?: string | null,
) {
  return splitApplyGateRoleAndCompany(rawTitle, explicitCompany, fallbackUrl);
}

function legacySplitRoleAndCompanyPlaceholder() { return splitApplyGateRoleAndCompany(null, null, null); }
/* legacy placeholder removed
  if (!title) {
    return {
      role: "Current Job Analysis",
      company: companyFromUrl(fallbackUrl) || "Company unavailable",
    };
  }

  const separators = [" at ", " @ ", " - ", " | ", " — ", " – "];
  for (const separator of separators) {
    if (!title.includes(separator)) continue;
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { role: parts[0], company: parts.slice(1).join(" ") };
    }
  }

  return {
    role: title,
    company: companyFromUrl(fallbackUrl) || "Company unavailable",
  };
*/

function truncateReason(reason: string, maxLength = 110) {
  const safe = String(reason || "").trim();
  if (!safe) return "";
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, maxLength - 1).trim()}…`;
}

function pickWarningReason(reasons: string[]) {
  const items = (reasons || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  if (items.length === 0) return null;
  const riskLike = items.find((entry) => /\b(missing|lack|gap|risk|weak|below|limited|mismatch|not shown|insufficient)\b/i.test(entry));
  return riskLike || items[0];
}

function warningText(reason: string | null | undefined, maxLength = 140) {
  if (!reason) return null;
  return truncateReason(reason, maxLength);
}

function formatSkillGapSummary(items: string[] | null | undefined, prefix: string, maxItems = 4) {
  const clean = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return `${prefix}: ${clean.slice(0, maxItems).join(", ")}${clean.length > maxItems ? ", ..." : ""}.`;
}

function formatRequirementSummary(items: string[] | null | undefined, prefix = "Missing non-negotiable requirements", maxItems = 4) {
  return formatSkillGapSummary(items, prefix, maxItems);
}

function isGenericStrategicFitNote(note: string) {
  const text = String(note || "").trim().toLowerCase();
  if (!text) return false;
  return /looks like an? (aligned|adjacent|stretch) move .*responsibility overlap/.test(text);
}

function universalBlockingLabelsFromResult(result: ApplyGateResult | null | undefined) {
  const constraints = result?.scoringBreakdown?.universalConstraintFit?.blockingConstraints || [];
  return constraints
    .map((constraint) => String(constraint?.label || "").trim())
    .filter(Boolean);
}

function structuredWarningAndBullets(
  explanation: ApplyGateResult["explanation"] | null | undefined,
  universalBlockingLabels: string[] = [],
) {
  if (!explanation) {
    return { warning: null as string | null, bullets: [] as string[] };
  }

  const hardBlockers = (explanation.hard_blockers || []).map((s) => String(s || "").trim()).filter(Boolean);
  const primaryDrivers = (explanation.primary_rejection_drivers || []).map((s) => String(s || "").trim()).filter(Boolean);
  const roleCoreGaps = (explanation.role_core_gaps || []).map((s) => String(s || "").trim()).filter(Boolean);
  const missingRequired = (explanation.missing_required || []).map((s) => String(s || "").trim()).filter(Boolean);
  const missingPreferred = (explanation.missing_preferred || []).map((s) => String(s || "").trim()).filter(Boolean);
  const allFitNotes = (explanation.fit_notes || []).map((s) => String(s || "").trim()).filter(Boolean);
  const universalBlockers = [...new Set(universalBlockingLabels.map((s) => String(s || "").trim()).filter(Boolean))];
  const primaryNarrativeDriver = String(explanation.primary_driver || "").trim().toUpperCase();
  const primaryNarrativeReason = String(explanation.primary_reason || "").trim();
  const authorityWarning = (
    ["HARD_GATE", "LICENSED_TRACK"].includes(primaryNarrativeDriver)
    && primaryNarrativeReason
  )
    ? primaryNarrativeReason
    : null;
  const hasUniversalHardGate = universalBlockers.length > 0;
  const hasGapSignal = hasUniversalHardGate || hardBlockers.length > 0 || roleCoreGaps.length > 0 || missingRequired.length > 0 || missingPreferred.length > 0;
  const fitNotes = hasGapSignal
    ? allFitNotes.filter((note) => !isGenericStrategicFitNote(note))
    : allFitNotes;

  const warning = authorityWarning
    || (hasUniversalHardGate
    ? `This posting has hard eligibility requirements not shown in your resume: ${universalBlockers.slice(0, 4).join(", ")}.`
    : null)
    || hardBlockers[0]
    || primaryDrivers[0]
    || formatSkillGapSummary(roleCoreGaps, "Missing core skills for this role")
    || formatSkillGapSummary(missingRequired, "Missing required skills")
    || formatSkillGapSummary(missingPreferred, "Missing preferred skills")
    || null;

  const bullets: string[] = [];

  if (hasUniversalHardGate) {
    const missingGateSummary = formatRequirementSummary(universalBlockers);
    if (missingGateSummary) bullets.push(missingGateSummary);
  } else if (hardBlockers.length > 0 && missingRequired.length > 0) {
    const missingRequiredSummary = formatSkillGapSummary(missingRequired, "Missing required skills");
    if (missingRequiredSummary) bullets.push(missingRequiredSummary);
  } else if (hardBlockers.length === 0) {
    const missingRequiredSummary = formatSkillGapSummary(missingRequired, "Missing required skills");
    if (missingRequiredSummary && missingRequiredSummary !== warning) bullets.push(missingRequiredSummary);
  }

  const roleCoreSummary = formatSkillGapSummary(roleCoreGaps, "Missing core skills for this role");
  if (roleCoreSummary && roleCoreSummary !== warning) bullets.push(roleCoreSummary);

  const missingPreferredSummary = formatSkillGapSummary(missingPreferred, "Missing preferred skills");
  if (missingPreferredSummary && missingPreferredSummary !== warning) bullets.push(missingPreferredSummary);

  const maxFitNotes = hasGapSignal ? 2 : 4;
  for (const note of fitNotes) {
    if (!note) continue;
    if (bullets.includes(note)) continue;
    bullets.push(note);
    const fitNotesShown = bullets.filter((entry) => fitNotes.includes(entry)).length;
    if (fitNotesShown >= maxFitNotes) break;
  }

  return {
    warning,
    bullets: bullets.slice(0, 4),
  };
}

function recommendationLabelForDecision(
  decision: ApplyGateResult["explanation"] extends infer E
    ? E extends { decision?: infer D }
      ? D
      : never
    : never,
  status: VerdictStatus,
) {
  if (status === "potential" && (decision === "apply_now" || decision === "apply_with_caveats")) {
    return "Apply, but tailor first";
  }
  if (decision === "apply_now") return "Apply now";
  if (decision === "apply_with_caveats") return "Apply with caveats";
  if (decision === "fix_first") return "Fix before applying";
  if (decision === "skip") return "Skip this posting";
  if (status === "strong") return "Apply now";
  if (status === "potential") return "Apply, but tailor first";
  if (status === "risky") return "Fix before applying";
  return "Skip this posting";
}

function confidenceLabel(value: ApplyGateResult["explanation"] extends infer E
  ? E extends { assessment_confidence?: infer C }
    ? C
    : never
  : never) {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return null;
}

function decisionConfidenceLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return null;
}

function requirementStatusLabel(status: string | null | undefined) {
  if (status === "missing") return "Missing";
  if (status === "unclear") return "Confirm";
  if (status === "satisfied") return "Shown";
  return "Review";
}

function requirementStatusClass(status: string | null | undefined) {
  if (status === "missing") return "border-destructive/20 bg-destructive/5 text-destructive";
  if (status === "unclear") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "satisfied") return "border-accent/20 bg-accent/10 text-accent";
  return "border-border bg-muted text-muted-foreground";
}

function explanationActionSections(explanation: ApplyGateResult["explanation"] | null | undefined) {
  const normalize = (items: string[] | null | undefined) => (items || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!explanation) return [] as Array<{ title: string; items: string[] }>;

  const pathToWin = normalize(explanation.path_to_win?.strategy);
  const quickFixes = normalize(explanation.action_plan?.quick_fixes);
  const resumeProof = normalize(explanation.action_plan?.resume_proof_improvements);
  const longTerm = normalize(explanation.action_plan?.long_term_gaps);
  const notFixable = normalize(explanation.action_plan?.not_fixable_for_this_posting);

  const sections = [
    { title: "Path to win", items: pathToWin },
    { title: "Quick fixes (today)", items: quickFixes },
    { title: "Resume proof improvements", items: resumeProof },
    { title: "Long-term gaps", items: longTerm },
    { title: "Not fixable for this posting", items: notFixable },
  ].filter((section) => section.items.length > 0);

  return sections.slice(0, 4);
}

function memoryConfidenceLabel(value: string | null | undefined) {
  if (value === "meaningful") return "Meaningful pattern";
  if (value === "weak") return "Weak pattern";
  return "Context only";
}

function memoryOutcomeLabel(value: string | null | undefined, noResponse?: boolean) {
  if (noResponse) return "No response";
  if (value === "offered") return "Offer";
  if (value === "interviewed") return "Interview";
  if (value === "rejected") return "Rejected";
  if (value === "applied") return "Applied";
  return "Tracked";
}

function hasMemoryNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function memoryBadgeText(memory: ApplyGateResult["searchMemory"] | null | undefined) {
  const summary = memory?.outcomeSummary;
  if (!summary || summary.similarRoleCount <= 0) return null;

  const count = summary.similarRoleCount;
  const noResponse = Number(summary.noResponse || 0);
  const interviews = Number(summary.interviewed || 0);
  const offers = Number(summary.offered || 0);
  const positive = interviews + offers;

  if (positive > 0) {
    return `${pluralize(count, "similar role")} - ${pluralize(positive, "positive outcome")}`;
  }
  if (noResponse > 0) {
    return `${pluralize(count, "similar role")} - ${pluralize(noResponse, "no response", "no responses")}`;
  }
  return `${pluralize(count, "similar role")} tracked`;
}

function behavioralNudgeForResult(params: {
  status: VerdictStatus;
  recommendation: string | null;
  memory: ApplyGateResult["searchMemory"] | null | undefined;
  opportunityCost: ApplyGateResult["opportunityCost"] | null | undefined;
  warning: string | null;
  hardBlocker: boolean;
}) {
  const recommendation = String(params.recommendation || "").toLowerCase();
  const recommendsSkip = recommendation.includes("skip") || params.status === "not-recommended";
  const recommendsFix = recommendation.includes("fix") || params.status === "risky";
  const summary = params.memory?.outcomeSummary || null;
  const similarCount = Number(summary?.similarRoleCount || 0);
  const noResponse = Number(summary?.noResponse || 0);
  const rejected = Number(summary?.rejected || 0);
  const positive = Number(summary?.interviewed || 0) + Number(summary?.offered || 0);

  if (recommendsSkip) {
    if (similarCount > 0 && noResponse >= Math.max(1, Math.ceil(similarCount * 0.5))) {
      return `Skip this. You've tried ${pluralize(similarCount, "similar role")} and ${pluralize(noResponse, "got no response", "got no response")}.`;
    }
    if (similarCount > 0 && rejected + noResponse > positive) {
      return `Skip this. Similar roles have mostly ended in rejection or no response.`;
    }
    if (params.opportunityCost?.message) {
      return `Skip this. ${params.opportunityCost.message}`;
    }
    if (params.hardBlocker && params.warning) {
      return `Skip this. ${params.warning}`;
    }
    return "Skip this. Similar effort is better spent on roles with clearer proof and domain match.";
  }

  if (recommendsFix) {
    if (params.warning) return `Fix this first. ${params.warning}`;
    return "Fix this first. Applying now risks turning a salvageable role into another generic submission.";
  }

  if (params.status === "potential") {
    if (positive > 0) {
      return `Apply with strategy. Similar roles have produced ${pluralize(positive, "positive outcome")}, but this still needs targeted proof.`;
    }
    return "Apply with strategy. This is not a spray-and-pray role; tailor the proof before sending.";
  }

  return "Apply now. This is the kind of role worth spending application energy on.";
}

type ApplyGateHistoryQueryData = {
  success: boolean;
  history: ApplyGateHistoryItem[];
};

type ApplyGateHistoryDisplayItem = ApplyGateHistoryItem & {
  _unsaved?: boolean;
};

type ApplyGateAction = "applied" | "fixed" | "skipped";

type ApplyGateActionSaveState = {
  verdictId: string;
  action: ApplyGateAction;
  surface: "current_result" | "history";
} | null;

type DecisionAction = {
  action: ApplyGateAction;
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
};

function expectedActionForRecommendation(decision: string | null | undefined, recommendation: string | null | undefined): ApplyGateAction | null {
  const normalizedDecision = String(decision || "").toLowerCase();
  const normalizedRecommendation = String(recommendation || "").toLowerCase();

  if (normalizedDecision === "skip" || normalizedRecommendation.includes("skip")) return "skipped";
  if (normalizedDecision === "fix_first" || normalizedRecommendation.includes("fix")) return "fixed";
  if (
    normalizedDecision === "apply_now"
    || normalizedDecision === "apply_with_caveats"
    || normalizedRecommendation.includes("apply")
  ) {
    return "applied";
  }
  return null;
}

function decisionCopyForStatus(status: VerdictStatus, recommendation: string | null, risk: number | null, hardBlocker = false) {
  const recommendsSkip = recommendation?.toLowerCase().includes("skip") === true;
  const recommendsFix = recommendation?.toLowerCase().includes("fix") === true;

  if (recommendsSkip) {
    return {
      title: "Skip this role",
      body: hardBlocker
        ? "This is not a quick resume tailoring issue unless you already have the required credentials and forgot to list them."
        : "Similar effort is likely better spent on roles with stronger alignment, unless you have outside context this analysis cannot see.",
      toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
    };
  }

  if (recommendsFix && status !== "strong") {
    return {
      title: "Fix first before applying",
      body: hardBlocker
        ? "A hard blocker or major proof gap is visible. Fix the strongest issue before this becomes another low-probability application."
        : "The fit isn't strong enough yet — make a targeted resume fix before applying.",
      toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
    };
  }

  if (status === "strong") {
    return {
      title: "Apply now",
      body: "This role is a strong fit. Keep the application tight and send it while the posting is still fresh.",
      toneClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    };
  }

  if (status === "potential") {
    return {
      title: "Apply, but tailor first",
      body: "This is aligned enough to pursue, but the resume needs to lead with the strongest proof before you send it.",
      toneClass: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }

  if (status === "risky") {
    return {
      title: "Fix first before applying",
      body: hardBlocker
        ? "A hard blocker or major proof gap is visible. Fix the strongest issue before this becomes another low-probability application."
        : "The fit is weak enough that applying without edits is likely to waste time.",
      toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
    };
  }

  return {
    title: recommendation || "Skip this posting",
    body: risk && risk >= 90
      ? "The blocker stack is high enough that similar effort is probably better spent on a stronger match."
      : "This role is outside the current high-probability lane. Use the time where the alignment is clearer.",
    toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
  };
}

function decisionActionsForStatus(status: VerdictStatus, recommendation: string | null = null, _hardBlocker = false): DecisionAction[] {
  const recommendsSkip = recommendation?.toLowerCase().includes("skip") === true;
  const recommendsFix = recommendation?.toLowerCase().includes("fix") === true;

  if (recommendsSkip) {
    return [
      { action: "skipped", label: "Skip this role", variant: "destructive" },
      { action: "applied", label: "Apply anyway", variant: "outline" },
    ];
  }

  if (recommendsFix && status !== "strong") {
    return [
      { action: "fixed", label: "I'll fix first", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "applied", label: "Apply anyway", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  if (status === "strong") {
    return [
      { action: "applied", label: "Apply now", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "skipped", label: "Skip anyway", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  if (status === "potential") {
    return [
      { action: "applied", label: "Apply, tailored", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "fixed", label: "Fix first", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  if (status === "risky") {
    return [
      { action: "fixed", label: "I'll fix first", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "applied", label: "Apply anyway", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  return [
    { action: "skipped", label: "Skip this role", variant: "destructive" },
    { action: "applied", label: "Apply anyway", variant: "outline" },
  ];
}

function isVerdictStatus(value: string | null | undefined): value is VerdictStatus {
  return value === "strong" || value === "potential" || value === "risky" || value === "not-recommended";
}

function displayDecisionFromResult(result: ApplyGateResult | null | undefined): ApplyGateDisplayDecision | null {
  return result?.displayDecision
    || result?.explanation?.display_decision
    || result?.explanation?.decision_system?.displayDecision
    || null;
}

function displayDecisionFromHistory(item: ApplyGateHistoryDisplayItem | null | undefined): ApplyGateDisplayDecision | null {
  return item?.explanation_payload?.display_decision
    || item?.explanation_payload?.decision_system?.displayDecision
    || null;
}

function statusFromDisplayDecision(displayDecision: ApplyGateDisplayDecision | null | undefined): VerdictStatus {
  if (isVerdictStatus(displayDecision?.status)) return displayDecision.status;
  if (displayDecision?.action === "APPLY") return "strong";
  if (displayDecision?.action === "APPLY_WITH_STRATEGY") return "potential";
  if (displayDecision?.action === "FIX_THEN_APPLY") return "risky";
  return "not-recommended";
}

function legacyDecisionFromDisplayDecision(displayDecision: ApplyGateDisplayDecision | null | undefined) {
  if (displayDecision?.legacyDecision) return displayDecision.legacyDecision;
  if (displayDecision?.action === "APPLY") return "apply_now";
  if (displayDecision?.action === "APPLY_WITH_STRATEGY") return "apply_with_caveats";
  if (displayDecision?.action === "FIX_THEN_APPLY") return "fix_first";
  if (displayDecision?.action === "SKIP") return "skip";
  return null;
}

function decisionCopyForDisplayDecision(displayDecision: ApplyGateDisplayDecision) {
  const status = statusFromDisplayDecision(displayDecision);
  const fallback = decisionCopyForStatus(status, displayDecision.label, null, displayDecision.diagnostics?.hardBlocker === true);
  return {
    title: displayDecision.headline || fallback.title,
    body: displayDecision.subtext || fallback.body,
    toneClass: fallback.toneClass,
  };
}

function decisionActionsForDisplayDecision(displayDecision: ApplyGateDisplayDecision): DecisionAction[] {
  if (displayDecision.action === "APPLY") {
    return [
      { action: "applied", label: "Apply now", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "skipped", label: "Skip anyway", variant: "ghost", className: "text-muted-foreground" },
    ];
  }
  if (displayDecision.action === "APPLY_WITH_STRATEGY") {
    return [
      { action: "applied", label: "Apply, tailored", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "fixed", label: "Fix first", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }
  if (displayDecision.action === "FIX_THEN_APPLY") {
    return [
      { action: "fixed", label: "I'll fix first", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "applied", label: "Apply anyway", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }
  return [
    { action: "skipped", label: "Skip this role", variant: "destructive" },
    { action: "applied", label: "Apply anyway", variant: "outline" },
  ];
}

function safeDegradedDecisionCopy() {
  return {
    title: "Decision unavailable",
    body: "Apply Gate could not produce a consistent decision for this role. Review it manually before acting.",
    toneClass: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  };
}

function buildApplyGateActionFeedback(params: {
  surface: "current_result" | "history";
  action: ApplyGateAction;
  status: VerdictStatus;
  recommendation: string | null;
  risk: number | null;
  role: string | null;
  company: string | null;
  verdict?: string | null;
  score?: number | null;
  decision?: string | null;
  hardBlocker?: boolean | null;
  calibrationBucket?: ApplyGateCalibrationBucket | null;
}) {
  const recommendedAction = expectedActionForRecommendation(params.decision, params.recommendation);
  const recommendationOverride = Boolean(recommendedAction && params.action !== recommendedAction);
  return {
    surface: params.surface,
    action_label: params.action,
    recommended_action: recommendedAction,
    recommendation_override: recommendationOverride,
    override_type: recommendationOverride ? `expected_${recommendedAction}_user_${params.action}` : null,
    status: params.status,
    recommendation: params.recommendation || null,
    risk_percent: typeof params.risk === "number" ? params.risk : null,
    role: params.role || null,
    company: params.company || null,
    verdict: params.verdict || null,
    score: typeof params.score === "number" && Number.isFinite(params.score) ? params.score : null,
    decision: params.decision || null,
    hard_blocker: Boolean(params.hardBlocker),
    calibration_bucket: params.calibrationBucket || null,
  };
}

function normalizeHistoryTitle(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHistoryCompany(value: string | null | undefined) {
  return String(normalizeCompanyName(value) || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHistoryUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key)) parsed.searchParams.delete(key);
    }
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const search = parsed.searchParams.toString();
    return `${parsed.origin.toLowerCase()}${pathname.toLowerCase()}${search ? `?${search}` : ""}`;
  } catch {
    return raw.toLowerCase();
  }
}

function historyIdentityFor(
  jobTitle: string | null | undefined,
  jobUrl: string | null | undefined,
  companyName?: string | null,
) {
  const normalizedUrl = normalizeHistoryUrl(jobUrl);
  if (normalizedUrl) return `url:${normalizedUrl}`;

  const normalizedCompany = normalizeHistoryCompany(companyName);
  const normalizedTitle = normalizeHistoryTitle(jobTitle);
  if (normalizedTitle && normalizedCompany) return `title-company:${normalizedTitle}:${normalizedCompany}`;
  if (normalizedTitle) return `title:${normalizedTitle}`;
  return null;
}

function sameHistoryPosting(
  a: { job_title?: string | null; job_url?: string | null; company_name?: string | null },
  b: { job_title?: string | null; job_url?: string | null; company_name?: string | null },
) {
  const aUrl = normalizeHistoryUrl(a.job_url);
  const bUrl = normalizeHistoryUrl(b.job_url);
  if (aUrl && bUrl && aUrl === bUrl) return true;

  const aTitle = normalizeHistoryTitle(a.job_title);
  const bTitle = normalizeHistoryTitle(b.job_title);
  if (!aTitle || !bTitle || aTitle !== bTitle) return false;

  const aCompany = normalizeHistoryCompany(a.company_name);
  const bCompany = normalizeHistoryCompany(b.company_name);
  if (aCompany || bCompany) {
    return Boolean(aCompany && bCompany && aCompany === bCompany);
  }

  return true;
}

function dedupeHistoryItems<T extends { job_title: string; job_url?: string | null; company_name?: string | null; id: string }>(items: T[]) {
  const deduped: T[] = [];
  for (const item of items) {
    if (deduped.some((existing) => sameHistoryPosting(existing, item))) continue;
    deduped.push(item);
  }
  return deduped;
}

function buildHistoryDisplayItemFromResult(
  result: ApplyGateResult | null,
  fallbackJobTitle: string,
  fallbackCompanyName: string,
  fallbackJobUrl: string,
): ApplyGateHistoryDisplayItem | null {
  if (!result) return null;

  const resolvedJobTitle = String(result.jobTitle || fallbackJobTitle || "").trim() || "Current Job Analysis";
  const resolvedCompanyName = normalizeCompanyName(result.companyName || fallbackCompanyName || null);
  const resolvedJobUrl = String(result.jobUrl || fallbackJobUrl || "").trim() || null;
  const identity = historyIdentityFor(resolvedJobTitle, resolvedJobUrl, resolvedCompanyName);
  const scoreValue = Number(result.scoringBreakdown?.totalScore);
  const score = Number.isFinite(scoreValue) ? scoreValue : 0;
  const persistedId = String(result.id || "").trim();

  return {
    id: persistedId || `unsaved:${identity || "current"}`,
    job_title: resolvedJobTitle,
    company_name: resolvedCompanyName,
    job_url: resolvedJobUrl,
    verdict: result.verdict,
    score,
    hard_blocker: result.scoringBreakdown?.hardBlocker ?? null,
    reasons: JSON.stringify(result.reasons || []),
    explanation_payload: result.explanation || null,
    fix_suggestion: result.fixSuggestion || null,
    user_action: null,
    created_at: new Date().toISOString(),
    _unsaved: !persistedId,
  };
}

function actionConfirmationCopy(action: ApplyGateAction): { title: string; body: string } {
  if (action === "applied") {
    return {
      title: "Marked as applied — good luck.",
      body: "Logged against your outcome history, so your next verdicts get sharper as results come in.",
    };
  }
  if (action === "fixed") {
    return {
      title: "Saved — tailor before you send.",
      body: "Logged that you're fixing first. Start with the concrete fixes in this verdict.",
    };
  }
  return {
    title: "Skipped — on to the next one.",
    body: "Logged so similar low-fit roles get flagged faster next time.",
  };
}

const ApplyGate = () => {
  const { user } = useAuth();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [variantId, setVariantId] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<ApplyGateRiskTolerance>("balanced");
  const [result, setResult] = useState<ApplyGateResult | null>(null);
  const [isCurrentWarningExpanded, setIsCurrentWarningExpanded] = useState(false);
  // Collapsed-by-default analytical breakdown (keeps the default verdict skimmable).
  const [showBreakdown, setShowBreakdown] = useState(false);
  // After the user records what they did, show a confirmation + next step instead of
  // silently clearing the card (which read as "the button did nothing").
  const [actionConfirmation, setActionConfirmation] = useState<{ action: ApplyGateAction } | null>(null);
  const actionPlanRef = useRef<HTMLDivElement | null>(null);
  const [expandedHistoryWarnings, setExpandedHistoryWarnings] = useState<Record<string, boolean>>({});
  const [savingAction, setSavingAction] = useState<ApplyGateActionSaveState>(null);
  const [actionSaveError, setActionSaveError] = useState<{ verdictId: string; message: string } | null>(null);
  const [variantDraftDecisions, setVariantDraftDecisions] = useState<VariantDraftDecisions>({ accepted: [], dismissed: [] });
  const queryClient = useQueryClient();

  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
    enabled: Boolean(user),
  });

  const hasResume = Boolean(resumeQuery.data?.resumeText && resumeQuery.data.resumeText.trim().length > 20);

  // Résumé variants: pick which one to run the gate against; the choice rides
  // analyze → verdict → apply so the outcome attributes back to that variant.
  const variantsQuery = useQuery({
    queryKey: ["resume-variants"],
    queryFn: fetchResumeVariants,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const variants = variantsQuery.data?.variants ?? [];
  useEffect(() => {
    if (!variantId && variants.length > 0) {
      setVariantId((variants.find((v) => v.isDefault) ?? variants[0]).id);
    }
  }, [variants, variantId]);

  // Apply-time guidance: once a verdict exists, surface which saved variant has the
  // best track record for roles like this one. Honest — null below the sample floor.
  const guidanceTitle = result?.jobTitle || jobTitle;
  const guidanceQuery = useQuery({
    queryKey: ["variant-scoreboard", guidanceTitle],
    queryFn: () => fetchVariantScoreboard(guidanceTitle),
    enabled: Boolean(result) && !result?.insufficientProfile && variants.length > 1,
    staleTime: 30_000,
  });
  const variantRecommendation = guidanceQuery.data?.recommendation ?? null;

  const historyQuery = useQuery<ApplyGateHistoryQueryData>({
    queryKey: ["apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const rawHistory: ApplyGateHistoryItem[] = historyQuery.data?.history ?? [];
  const currentHistoryProjection = useMemo(
    () => buildHistoryDisplayItemFromResult(result, jobTitle, companyName, null),
    [companyName, jobTitle, result],
  );
  const history = useMemo<ApplyGateHistoryDisplayItem[]>(() => {
    const deduped = dedupeHistoryItems(rawHistory);
    if (!currentHistoryProjection) return deduped;
    return deduped.filter((item) => !sameHistoryPosting(item, currentHistoryProjection));
  }, [currentHistoryProjection, rawHistory]);

  const analyzeMutation = useMutation({
    mutationFn: () =>
      analyzeJobAlignment({
        jobTitle,
        jobDescription,
        companyName,
        riskTolerance,
        ...(jobUrl.trim() ? { jobUrl: jobUrl.trim() } : {}),
        ...(variantId ? { variantId } : {}),
      }),
    onSuccess: (data) => {
      setResult(data);
      setIsCurrentWarningExpanded(false);
      setShowBreakdown(false);
      setActionConfirmation(null);
      setSavingAction(null);
      setActionSaveError(null);
      setVariantDraftDecisions({ accepted: [], dismissed: [] });
      // An insufficient-profile result is not a verdict — don't fold it into history.
      if (data.insufficientProfile) {
        return;
      }
      const currentAsHistory = buildHistoryDisplayItemFromResult(data, jobTitle, companyName, null);
      if (currentAsHistory && !currentAsHistory._unsaved) {
        const persistedHistoryItem = currentAsHistory as ApplyGateHistoryItem;
        queryClient.setQueryData<ApplyGateHistoryQueryData>(["apply-gate-history"], (previous) => {
          const prior = previous?.history ?? [];
          const merged = dedupeHistoryItems([
            persistedHistoryItem,
            ...prior.filter((item) => item.id !== persistedHistoryItem.id),
          ]);
          return {
            success: previous?.success ?? true,
            history: merged,
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["apply-gate-history"] });
    },
    onError: () => {
      setResult(null);
      setIsCurrentWarningExpanded(false);
    },
  });

  // URL-only analysis is allowed again: the backend fetches the posting with
  // hardened extraction (SSRF-guarded, redirect-validated, size-capped) and
  // returns an honest 400 when it can't extract a usable description.
  const jobUrlLooksFetchable = /^https?:\/\/\S+\.\S+/i.test(jobUrl.trim());
  const canAnalyze = jobDescription.trim().length > 0 || jobUrlLooksFetchable;

  const handleAnalyze = useCallback(() => {
    if (!jobDescription.trim() && !jobUrlLooksFetchable) return;
    analyzeMutation.mutate();
  }, [analyzeMutation, jobDescription, jobUrlLooksFetchable]);

  const markVerdictActionInCache = useCallback(
    (verdictId: string, action: ApplyGateAction) => {
      queryClient.setQueryData<ApplyGateHistoryQueryData>(["apply-gate-history"], (previous) => {
        if (!previous?.history) return previous;
        return {
          ...previous,
          history: previous.history.map((item) =>
            item.id === verdictId
              ? { ...item, user_action: action, user_action_at: new Date().toISOString() }
              : item,
          ),
        };
      });
    },
    [queryClient],
  );

  const handleAction = useCallback(
    async (action: ApplyGateAction) => {
      const targetUrl = (result?.jobUrl || "").trim();
      if (result?.id) {
        const displayDecision = displayDecisionFromResult(result);
        const useDisplayDecision = applyGateDisplayDecisionV1Enabled() && Boolean(displayDecision);
        const status = useDisplayDecision ? statusFromDisplayDecision(displayDecision) : verdictToStatus(result.verdict);
        const risk = resultApplicationRiskPercent(result, status);
        const roleCompany = splitRoleAndCompany(
          result.jobTitle || jobTitle || null,
          result.companyName || companyName || null,
          result.jobUrl || null,
        );
        const recommendation = useDisplayDecision
          ? displayDecision?.label || null
          : recommendationLabelForDecision(result.explanation?.decision, status);
        const decision = useDisplayDecision
          ? legacyDecisionFromDisplayDecision(displayDecision)
          : result.explanation?.decision || null;
        const baseFeedback = buildApplyGateActionFeedback({
          surface: "current_result",
          action,
          status,
          recommendation,
          risk,
          role: roleCompany.role,
          company: roleCompany.company,
          verdict: result.verdict,
          score: result.scoringBreakdown?.totalScore,
          decision,
          hardBlocker: result.scoringBreakdown?.hardBlocker,
          calibrationBucket: result.explanation?.calibration_bucket || null,
        });
        const feedback = {
          ...baseFeedback,
          ...(result.variantStrategy ? {
            variant_strategy: {
              recommendedVariantId: result.variantStrategy.recommended.variantId,
              basis: result.variantStrategy.recommended.basis,
              sampleSize: result.variantStrategy.recommended.sampleSize,
              gapsShown: result.variantStrategy.gaps.map((g) => ({
                type: g.type,
                requirement: g.requirement,
                severity: g.severity,
                hadDraft: g.draft != null,
              })),
              draftsAccepted: variantDraftDecisions.accepted,
              draftsDismissed: variantDraftDecisions.dismissed,
            },
          } : {}),
        };

        let pendingApplyWindow: Window | null = null;
        if (action === "applied" && targetUrl) {
          try {
            pendingApplyWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
          } catch {
            pendingApplyWindow = null;
          }
        }

        setSavingAction({ verdictId: result.id, action, surface: "current_result" });
        setActionSaveError((current) => (current?.verdictId === result.id ? null : current));

        try {
          await updateApplyGateAction(result.id, action, { feedback });
          markVerdictActionInCache(result.id, action);
          await queryClient.invalidateQueries({ queryKey: ["apply-gate-history"] });
          if (action === "applied" && targetUrl) {
            if (pendingApplyWindow) {
              pendingApplyWindow.location.href = targetUrl;
            } else {
              window.open(targetUrl, "_blank", "noopener,noreferrer");
            }
          }
          setActionConfirmation({ action });
        } catch {
          pendingApplyWindow?.close();
          setActionSaveError({
            verdictId: result.id,
            message: "Choice not saved. Try again.",
          });
        } finally {
          setSavingAction((current) => (current?.verdictId === result.id ? null : current));
        }
        return;
      }
      if (action === "applied" && targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      setActionConfirmation({ action });
    },
    [companyName, jobTitle, markVerdictActionInCache, queryClient, result, variantDraftDecisions],
  );

  const handleHistoryAction = useCallback(
    async (item: ApplyGateHistoryDisplayItem, action: ApplyGateAction) => {
      const displayDecision = displayDecisionFromHistory(item);
      const useDisplayDecision = applyGateDisplayDecisionV1Enabled() && Boolean(displayDecision);
      const status = useDisplayDecision ? statusFromDisplayDecision(displayDecision) : verdictToStatus(item.verdict);
      const risk = historyApplicationRiskPercent(item, status);
      const roleCompany = splitRoleAndCompany(item.job_title, item.company_name, item.job_url || null);
      const recommendation = useDisplayDecision
        ? displayDecision?.label || null
        : recommendationLabelForDecision(item.explanation_payload?.decision, status);
      const decision = useDisplayDecision
        ? legacyDecisionFromDisplayDecision(displayDecision)
        : item.explanation_payload?.decision || null;
      const feedback = buildApplyGateActionFeedback({
        surface: "history",
        action,
        status,
        recommendation,
        risk,
        role: roleCompany.role,
        company: roleCompany.company,
        verdict: item.verdict,
        score: item.score,
        decision,
        hardBlocker: item.hard_blocker,
        calibrationBucket: item.explanation_payload?.calibration_bucket || null,
      });

      setSavingAction({ verdictId: item.id, action, surface: "history" });
      setActionSaveError((current) => (current?.verdictId === item.id ? null : current));

      try {
        await updateApplyGateAction(item.id, action, { feedback });
        markVerdictActionInCache(item.id, action);
        await queryClient.invalidateQueries({ queryKey: ["apply-gate-history"] });
      } catch {
        setActionSaveError({
          verdictId: item.id,
          message: "Choice not saved. Try again.",
        });
      } finally {
        setSavingAction((current) => (current?.verdictId === item.id ? null : current));
      }
    },
    [markVerdictActionInCache, queryClient],
  );

  const hardBlockers = useMemo(() => {
    if (!result?.scoringBreakdown?.hardBlocker) return [] as string[];
    const flags = result.scoringBreakdown.riskFlags || [];
    return flags
      .filter((flag) => HARD_BLOCKER_LABELS[flag])
      .map((flag) => HARD_BLOCKER_LABELS[flag]);
  }, [result]);

  const currentDisplayDecision = displayDecisionFromResult(result);
  const currentDisplayDecisionMissing = Boolean(
    applyGateDisplayDecisionV1Enabled() && result && !currentDisplayDecision,
  );
  const currentUsesDisplayDecision = Boolean(
    applyGateDisplayDecisionV1Enabled() && currentDisplayDecision,
  );
  const currentStatus = result
    ? (currentDisplayDecisionMissing ? "risky" : (currentUsesDisplayDecision ? statusFromDisplayDecision(currentDisplayDecision) : verdictToStatus(result.verdict)))
    : null;
  const currentRisk = result
    ? resultApplicationRiskPercent(result, currentStatus || "risky")
    : null;
  const currentRiskCalibration = riskCalibrationFromResult(result);
  const currentRiskLabel = riskBandLabelFromResult(result);
  const currentRiskBreakdown = riskBreakdownFromResult(result);
  const currentOutcomeBands = result && currentStatus
    ? resultOutcomeBands(result, currentStatus)
    : null;
  const currentOccupationGrounding = result?.scoringBreakdown?.occupationGrounding || null;
  const currentRoleCompany = splitRoleAndCompany(
    result?.jobTitle || jobTitle || null,
    result?.companyName || companyName || null,
    result?.jobUrl || null,
  );
  const currentUniversalBlockingLabels = universalBlockingLabelsFromResult(result);
  const currentHasUniversalHardGate = currentUniversalBlockingLabels.length > 0;
  const structuredCurrent = structuredWarningAndBullets(result?.explanation, currentUniversalBlockingLabels);
  const fallbackCurrentMostLikelyReason = pickWarningReason(hardBlockers.length > 0 ? hardBlockers : (result?.reasons || []));
  const currentMostLikelyReason = structuredCurrent.warning || fallbackCurrentMostLikelyReason;
  const fallbackCurrentBulletReasons = (result?.reasons || [])
    .filter((entry) => entry && entry !== fallbackCurrentMostLikelyReason)
    .slice(0, 2)
    .map((entry) => truncateReason(entry, 160));
  const currentVisibleReasonsBase = structuredCurrent.bullets.length > 0
    ? structuredCurrent.bullets.map((entry) => truncateReason(entry, 160))
    : (fallbackCurrentBulletReasons.length > 0
      ? fallbackCurrentBulletReasons
      : (result?.reasons?.slice(0, 1).map((entry) => truncateReason(entry, 160)) || []));
  const currentRecommendation = result
    ? (currentDisplayDecisionMissing
      ? null
      : (currentUsesDisplayDecision
      ? currentDisplayDecision?.label || null
      : recommendationLabelForDecision(result.explanation?.decision, currentStatus || "risky")))
    : null;
  const currentAssessmentConfidence = confidenceLabel(result?.explanation?.assessment_confidence);
  const currentDecisionConfidence = decisionConfidenceLabel(
    result?.explanation?.decision_confidence || result?.decisionConfidence || null,
  );
  const currentDecisionLabel = currentUsesDisplayDecision
    ? String(currentDisplayDecision?.label || "").trim()
    : currentDisplayDecisionMissing
      ? "Decision unavailable"
    : String(
      result?.explanation?.decision_label
      || result?.explanation?.decision_system?.decisionLabel
      || result?.scoringBreakdown?.decisionLabel
      || "",
    ).trim();
  const currentIsCompressedClearMismatch = (
    currentDecisionLabel === "CLEAR_MISMATCH"
    && currentDecisionConfidence === "High"
  );
  const currentIsCompressedAlignedStretch = (
    currentDecisionLabel === "STRETCH"
    && currentStatus === "potential"
  );
  const currentIsCompressedDecision = currentUsesDisplayDecision
    ? currentDisplayDecision?.renderMode === "COMPRESSED"
    : currentDisplayDecisionMissing
      ? true
    : (currentIsCompressedClearMismatch || currentIsCompressedAlignedStretch);
  const currentVisibleReasons = currentIsCompressedDecision ? [] : currentVisibleReasonsBase;
  const currentDecisionConfidenceDetails = result?.explanation?.decision_confidence_details || null;
  const currentDecisionConfidenceDriverLines = [
    currentDecisionConfidenceDetails?.drivers?.primaryDriver,
    currentDecisionConfidenceDetails?.drivers?.secondaryDriver,
    currentDecisionConfidenceDetails?.drivers?.conflictDriver,
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const currentDecisionConfidenceFactors = (
    currentDecisionConfidenceDriverLines.length > 0
      ? currentDecisionConfidenceDriverLines
      : (currentDecisionConfidenceDetails?.factors || [])
  )
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const currentConfidenceType = result?.explanation?.confidence_type || result?.confidenceType || null;
  const currentOpportunityCost = result?.explanation?.opportunity_cost || result?.opportunityCost || null;
  const currentUncertaintyNotes = (result?.explanation?.uncertainty_notes || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  const currentSearchMemory = result?.explanation?.search_memory || result?.searchMemory || null;
  const currentActionSections = explanationActionSections(result?.explanation);
  const currentRequirementLedgerItems = (
    result?.explanation?.requirement_ledger?.items
    || result?.scoringBreakdown?.requirementLedger?.items
    || []
  )
    .filter((item) => (
      item?.priority !== "preferred"
      && (item?.candidate_status === "missing" || item?.candidate_status === "unclear")
    ))
    .slice(0, 6);
  const currentWarningFull = currentMostLikelyReason ? String(currentMostLikelyReason).trim() : null;
  const currentWarningCanExpand = Boolean(currentWarningFull && currentWarningFull.length > 150);
  const currentWarning = currentWarningFull
    ? (isCurrentWarningExpanded ? currentWarningFull : warningText(currentWarningFull, 150))
    : null;
  const currentDecisionCopy = currentDisplayDecisionMissing
    ? safeDegradedDecisionCopy()
    : (currentUsesDisplayDecision && currentDisplayDecision
      ? decisionCopyForDisplayDecision(currentDisplayDecision)
      : (currentStatus
        ? decisionCopyForStatus(
          currentStatus,
          currentRecommendation,
          currentRisk,
          Boolean(result?.scoringBreakdown?.hardBlocker),
        )
        : null));
  const currentCompressedPrimaryReason = currentIsCompressedDecision
    ? String(
      (currentDisplayDecisionMissing ? safeDegradedDecisionCopy().body : null)
      || (currentUsesDisplayDecision ? currentDisplayDecision?.subtext : null)
      || result?.explanation?.primary_driver_detail?.reason
      || result?.explanation?.primary_reason
      || currentMostLikelyReason
      || currentOpportunityCost?.message
      || "",
    ).trim()
    : "";
  const currentBehavioralNudge = currentDisplayDecisionMissing
    ? null
    : (currentUsesDisplayDecision
      ? currentDisplayDecision?.subtext || null
      : (currentStatus
        ? behavioralNudgeForResult({
          status: currentStatus,
          recommendation: currentRecommendation,
          memory: currentSearchMemory,
          opportunityCost: currentOpportunityCost,
          warning: currentWarning,
          hardBlocker: Boolean(result?.scoringBreakdown?.hardBlocker),
        })
        : null));
  const currentDecisionNudge = currentIsCompressedDecision
    ? (currentCompressedPrimaryReason || currentBehavioralNudge)
    : currentBehavioralNudge;
  const currentMemoryBadge = memoryBadgeText(currentSearchMemory);
  const currentDecisionActions = currentDisplayDecisionMissing
    ? []
    : (currentUsesDisplayDecision && currentDisplayDecision
      ? decisionActionsForDisplayDecision(currentDisplayDecision)
      : (currentStatus
        ? decisionActionsForStatus(currentStatus, currentRecommendation, Boolean(result?.scoringBreakdown?.hardBlocker))
        : []));
  const currentSavePending = Boolean(result?.id && savingAction?.verdictId === result.id);
  const currentSaveError = result?.id && actionSaveError?.verdictId === result.id
    ? actionSaveError.message
    : null;
  const currentFitLabel = currentDisplayDecisionMissing
    ? "Decision unavailable"
    : reviewLabelForDecisionLabel(currentDecisionLabel, currentStatus || "risky");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Pre-apply decision brief
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-foreground">Apply Gate</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decide whether to apply, fix first, or skip before you spend time on a posting.
          </p>
        </div>

        <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          <div className="glass-card space-y-3 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">Job to review</h2>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Resume: {hasResume ? "saved" : "not found"}
            </span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="job-title">Job Title</label>
            <input
              id="job-title"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., QA Analyst"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="company-name">Company Name (optional)</label>
            <input
              id="company-name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corp"
            />
            <p className="text-xs text-muted-foreground">Useful when the pasted job description does not clearly name the employer.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="job-url">Job posting link (optional)</label>
            <input
              id="job-url"
              type="url"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://…"
            />
            <p className="text-xs text-muted-foreground">If you leave the description empty, we read the posting from this URL (public job pages only). It also lets "Apply" open the posting in a new tab.</p>
          </div>
          {variants.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="resume-variant">Résumé</label>
              <select
                id="resume-variant"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Which saved résumé to evaluate — and record as sent if you apply.</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="risk-tolerance">Apply style</label>
            <select
              id="risk-tolerance"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value as ApplyGateRiskTolerance)}
            >
              {(["balanced", "conservative", "aggressive"] as ApplyGateRiskTolerance[]).map((mode) => (
                <option key={mode} value={mode}>
                  {RISK_TOLERANCE_COPY[mode].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{RISK_TOLERANCE_COPY[riskTolerance].helper}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="job-description">Job Description</label>
            <textarea
              id="job-description"
              className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description"
            />
            <p className="text-xs text-muted-foreground">Paste the full job description, or leave it empty and we will read the posting from the URL above.</p>
          </div>
          <Button onClick={handleAnalyze} disabled={analyzeMutation.isPending || !canAnalyze}>
            {analyzeMutation.isPending ? "Checking..." : "Get decision"}
          </Button>
          {analyzeMutation.isError && (
            <p className="text-xs text-destructive">
              {analyzeMutation.error instanceof Error
                ? analyzeMutation.error.message
                : "Apply Gate could not analyze this role. Paste the full job description and try again."}
            </p>
          )}
          </div>

          <div className="min-w-0">
            {analyzeMutation.isPending ? (
              <ApplyGateProgress />
            ) : result?.insufficientProfile ? (
              <div className="glass-card space-y-3 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                  <div>
                    <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
                      Add your résumé to get a verdict
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {result.insufficientProfileMessage
                        || "We couldn't read your résumé or application history, so there's nothing to evaluate this role against. Add your résumé and run it again."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Paste your résumé in the panel above, then re-run the analysis.
                    </p>
                  </div>
                </div>
              </div>
            ) : result ? (
              <>
              <div className="glass-card space-y-3 rounded-2xl p-6">
            {currentDecisionCopy && (
              <div
                className="-mx-6 -mt-6 mb-1 rounded-t-2xl border-b border-border px-6 py-5"
                style={{ background: "linear-gradient(180deg, #F2FAF6 0%, var(--card) 100%)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Decision</p>
                      <StatusBadge status={currentStatus || "risky"} />
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.01em] text-foreground">{currentDecisionCopy.title}</h2>
                    {currentDecisionNudge ? (
                      <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{currentDecisionNudge}</p>
                    ) : null}
                    {(!currentIsCompressedDecision && (!currentDecisionNudge || currentDecisionNudge !== currentDecisionCopy.body)) ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{currentDecisionCopy.body}</p>
                    ) : null}
                  </div>
                  {currentRiskCalibration === APPLY_GATE_RISK_CALIBRATED && typeof currentRisk === "number" ? (
                    // Outcome-calibrated → the % is a real probability; show the ring.
                    <div className="shrink-0 text-center">
                      <div
                        className="grid h-[78px] w-[78px] place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(${
                            currentRisk < 34 ? "#0E8C63" : currentRisk < 67 ? "#B45309" : "#B3261E"
                          } 0% ${currentRisk}%, var(--border) ${currentRisk}% 100%)`,
                        }}
                      >
                        <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-card">
                          <span className="text-[19px] font-bold tracking-[-0.02em] text-foreground">{currentRisk}%</span>
                        </div>
                      </div>
                      <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Rejection risk
                      </p>
                    </div>
                  ) : currentRiskLabel ? (
                    // Not outcome-calibrated → never fake a probability. Show the honest
                    // qualitative fit-based band instead of a precise % (Phase A honesty fix).
                    <div className="shrink-0 text-center" data-testid="risk-band">
                      <div
                        className={`grid h-[78px] min-w-[78px] place-items-center rounded-full border px-3 ${riskBandToneClass(currentRiskLabel)}`}
                      >
                        <span className="text-base font-bold tracking-[-0.01em]">{currentRiskLabel}</span>
                      </div>
                      <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Rejection risk · fit-based estimate
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {result.priorHistory ? (
              <div
                className={`rounded-xl border px-4 py-3 ${
                  result.priorHistory.recommendation === "skip"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : result.priorHistory.recommendation === "fix_first"
                      ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300"
                      : "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Prior inbox history
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed">
                      {result.priorHistory.headline}
                    </p>
                    {result.priorHistory.examples.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {result.priorHistory.examples.map((ex, idx) => (
                          <li key={`prior-ex-${idx}`} className="text-xs opacity-90">
                            <span className="font-medium">
                              {ex.company || "Unknown"}
                            </span>
                            {ex.position ? ` — ${ex.position}` : ""}
                            {ex.subject ? ` · "${ex.subject}"` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {variantRecommendation ? (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{variantRecommendation.name}</span> has your best
                track record on roles like this — {variantRecommendation.interviewRate}% reach an interview. Consider
                sending that one.
              </div>
            ) : null}

            <div>
              <p className="font-semibold text-foreground leading-tight">{currentRoleCompany.role}</p>
              {currentRoleCompany.company ? (
                <p className="text-sm text-muted-foreground leading-tight mt-0.5">{currentRoleCompany.company}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Fit label: {currentFitLabel}
              </span>
              {currentRecommendation && (
                <span className="px-2 py-0.5 rounded border border-accent/20 bg-accent/10 text-accent">
                  Recommended move: {currentRecommendation}
                </span>
              )}
              {currentMemoryBadge ? (
                <span className="px-2 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                  Search memory: {currentMemoryBadge}
                </span>
              ) : null}
            </div>

            {!currentIsCompressedDecision && (currentRiskBreakdown?.components?.length || currentOccupationGrounding?.job || currentOccupationGrounding?.candidate) ? (
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={showBreakdown}
              >
                {showBreakdown ? "Hide the full breakdown" : "Show the full breakdown"}
                {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : null}

            {!currentIsCompressedDecision && showBreakdown && currentRiskBreakdown?.components?.length ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">Why this recommendation</p>
                  <span className="text-xs text-muted-foreground">{currentRiskBreakdown.summary}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentRiskBreakdown.components.slice(0, 4).map((component) => (
                    <div key={component.key} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{component.label}</p>
                      </div>
                      {component.evidence ? (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{component.evidence}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!currentIsCompressedDecision && showBreakdown && (currentOccupationGrounding?.job || currentOccupationGrounding?.candidate) ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Career-field match</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">This role</p>
                    <p className="text-xs font-medium text-foreground">{currentOccupationGrounding.job?.title || "Unclear"}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your background</p>
                    <p className="text-xs font-medium text-foreground">{currentOccupationGrounding.candidate?.title || "Unclear"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {occupationAlignmentLabel(currentOccupationGrounding.alignmentLabel)}
                </p>
              </div>
            ) : null}

            {!currentIsCompressedDecision && currentSearchMemory ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Search memory</p>
                    <p className="text-xs text-muted-foreground">
                      {currentSearchMemory.outcomeSummary.similarRoleCount > 0
                        ? `You've seen ${currentSearchMemory.outcomeSummary.similarRoleCount} similar tracked role${currentSearchMemory.outcomeSummary.similarRoleCount === 1 ? "" : "s"}.`
                        : "No similar tracked roles found yet."}
                    </p>
                  </div>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {memoryConfidenceLabel(currentSearchMemory.confidence)}
                  </span>
                </div>

                {currentSearchMemory.outcomeSummary.similarRoleCount > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Interviews</p>
                      <p className="text-sm font-semibold text-foreground">{currentSearchMemory.outcomeSummary.interviewed}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Offers</p>
                      <p className="text-sm font-semibold text-foreground">{currentSearchMemory.outcomeSummary.offered}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rejected</p>
                      <p className="text-sm font-semibold text-foreground">{currentSearchMemory.outcomeSummary.rejected}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">No response</p>
                      <p className="text-sm font-semibold text-foreground">{currentSearchMemory.outcomeSummary.noResponse}</p>
                    </div>
                  </div>
                ) : null}

                {hasMemoryNumber(currentSearchMemory.outcomeSummary.medianDaysToResponse) ? (
                  <p className="text-xs text-muted-foreground">
                    Median response time: {currentSearchMemory.outcomeSummary.medianDaysToResponse} days.
                  </p>
                ) : null}

                {currentSearchMemory.patternSignals.length > 0 ? (
                  <div className="space-y-1">
                    {currentSearchMemory.patternSignals.slice(0, 3).map((signal, idx) => (
                      <p key={`memory-signal-${idx}`} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {signal}</p>
                    ))}
                  </div>
                ) : null}

                {currentSearchMemory.similarRoles.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Closest tracked roles</p>
                    {currentSearchMemory.similarRoles.slice(0, 3).map((role) => (
                      <div key={`${role.id || role.role}-${role.company || ""}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-xs text-foreground">
                          {role.role}{role.company ? ` at ${role.company}` : ""}
                        </p>
                        <span className="rounded border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                          {memoryOutcomeLabel(role.responseOutcome || role.outcome, role.noResponse)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              {currentVisibleReasons.map((reason, idx) => (
                <p key={idx} className="text-sm text-muted-foreground leading-relaxed">• {reason}</p>
              ))}
            </div>

            {(!currentIsCompressedDecision && currentStatus !== "strong" && currentWarning) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive leading-snug">
                  <span>{warningPrefixForStatus(currentStatus || "risky")}: {currentWarning}</span>
                  {currentWarningCanExpand && (
                    <button
                      type="button"
                      className="ml-1 underline underline-offset-2"
                      onClick={() => setIsCurrentWarningExpanded((prev) => !prev)}
                    >
                      {isCurrentWarningExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!currentIsCompressedDecision && currentRequirementLedgerItems.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Requirement check</p>
                <div className="space-y-2">
                  {currentRequirementLedgerItems.map((item) => (
                    <div key={item.id || `${item.type}-${item.label}`} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${requirementStatusClass(item.candidate_status)}`}>
                          {requirementStatusLabel(item.candidate_status)}
                        </span>
                        <span className="text-xs font-medium text-foreground">{item.label}</span>
                      </div>
                      {item.source_sentence && item.source_sentence !== item.label ? (
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.source_sentence}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!currentIsCompressedDecision && (currentDecisionConfidence || currentAssessmentConfidence || currentDecisionConfidenceFactors.length > 0 || currentUncertaintyNotes.length > 0 || currentOpportunityCost?.message) && (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 space-y-1">
                {currentOutcomeBands ? (
                  <p className="text-xs text-muted-foreground">
                    Screening check: résumé screen <span className={bandTone(currentOutcomeBands.atsPass)}>{currentOutcomeBands.atsPass}</span>
                    <span className="px-1">-</span>
                    human review <span className={bandTone(currentOutcomeBands.humanWin)}>{currentOutcomeBands.humanWin}</span>
                  </p>
                ) : null}
                {currentDecisionConfidence && (
                  <p className="text-xs text-muted-foreground">
                    Decision confidence: <span className="text-foreground font-medium">{currentDecisionConfidence}</span>
                    {currentConfidenceType ? (
                      <span className="text-muted-foreground"> ({currentConfidenceType.replace(/_/g, " ").toLowerCase()})</span>
                    ) : null}
                  </p>
                )}
                {currentAssessmentConfidence && (
                  <p className="text-xs text-muted-foreground">
                    Assessment quality: <span className="text-foreground font-medium">{currentAssessmentConfidence}</span>
                  </p>
                )}
                {currentDecisionConfidenceFactors.map((note, idx) => (
                  <p key={`decision-confidence-${idx}`} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {note}</p>
                ))}
                {currentUncertaintyNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {note}</p>
                ))}
                {currentOpportunityCost?.message ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {currentOpportunityCost.message}</p>
                ) : null}
              </div>
            )}

            {!currentIsCompressedDecision && currentActionSections.length > 0 && (
              <div ref={actionPlanRef} className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2 scroll-mt-4">
                <p className="text-xs font-semibold text-foreground">{currentHasUniversalHardGate ? "What this means" : "How to improve your odds"}</p>
                <div className="space-y-2">
                  {currentActionSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <p className="text-xs font-medium text-foreground">{section.title}</p>
                      {section.items.map((item, idx) => (
                        <p key={`${section.title}-${idx}`} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {item}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(currentStatus === "strong" || currentStatus === "potential") && (
              <ReferralNudge company={result.companyName} />
            )}

            {actionConfirmation ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" />
                  {actionConfirmationCopy(actionConfirmation.action).title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {actionConfirmationCopy(actionConfirmation.action).body}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {actionConfirmation.action === "applied" && (result?.jobUrl || jobUrl).trim() ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => window.open((result?.jobUrl || jobUrl).trim(), "_blank", "noopener,noreferrer")}
                    >
                      Open the posting
                    </Button>
                  ) : null}
                  {actionConfirmation.action === "fixed" && currentActionSections.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => actionPlanRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    >
                      See the fixes
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8 text-muted-foreground"
                    onClick={() => {
                      setActionConfirmation(null);
                      setResult(null);
                    }}
                  >
                    Review another role
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {currentDecisionActions.map((item) => (
                    <Button
                      key={`${item.action}-${item.label}`}
                      size="sm"
                      variant={item.variant || "default"}
                      className={`${item.className || ""} text-xs h-8`.trim()}
                      onClick={() => void handleAction(item.action)}
                      disabled={currentSavePending}
                      aria-busy={currentSavePending && savingAction?.action === item.action ? "true" : undefined}
                    >
                      {currentSavePending && savingAction?.action === item.action ? "Saving..." : item.label}
                    </Button>
                  ))}
                </div>
                {currentSaveError ? (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {currentSaveError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {currentSavePending
                      ? "Saving your choice..."
                      : currentDisplayDecisionMissing
                      ? "Choose what you did only after the decision reloads cleanly."
                      : currentHasUniversalHardGate
                      ? "Apply anyway only if you already meet these requirements and your resume is missing the proof."
                      : "Choose what you did. This keeps future recommendations grounded."}
                  </p>
                )}
              </div>
            )}
              </div>
              {result.variantStrategy ? (
                <VariantStrategyCard
                  strategy={result.variantStrategy}
                  onDraftDecisionsChange={setVariantDraftDecisions}
                />
              ) : null}
              </>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center text-sm leading-6 text-muted-foreground">
                Paste a job on the left to see whether to apply, the rejection risk, and what to fix first.
              </div>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Recent verdicts</p>
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="glass-card rounded-xl p-5 space-y-3">
                {(() => {
                  const displayDecision = displayDecisionFromHistory(item);
                  const displayDecisionMissing = Boolean(
                    applyGateDisplayDecisionV1Enabled() && !displayDecision,
                  );
                  const usesDisplayDecision = Boolean(
                    applyGateDisplayDecisionV1Enabled() && displayDecision,
                  );
                  const status = displayDecisionMissing
                    ? "risky"
                    : (usesDisplayDecision ? statusFromDisplayDecision(displayDecision) : verdictToStatus(item.verdict));
                  const risk = historyApplicationRiskPercent(item, status);
                  const riskBreakdown = riskBreakdownFromHistory(item);
                  const reasons = parseHistoryReasons(item.reasons);
                  const structuredHistory = structuredWarningAndBullets(item.explanation_payload);
                  const fallbackMostLikelyReason = pickWarningReason(reasons);
                  const mostLikelyReason = structuredHistory.warning || fallbackMostLikelyReason;
                  const warningFull = mostLikelyReason ? String(mostLikelyReason).trim() : null;
                  const isHistoryWarningExpanded = Boolean(expandedHistoryWarnings[item.id]);
                  const warningCanExpand = Boolean(warningFull && warningFull.length > 150);
                  const warning = warningFull
                    ? (isHistoryWarningExpanded ? warningFull : warningText(warningFull, 150))
                    : null;
                  const bulletReasons = reasons
                    .filter((entry) => entry && entry !== fallbackMostLikelyReason)
                    .slice(0, 2)
                    .map((entry) => truncateReason(entry, 160));
                  const visibleReasons = structuredHistory.bullets.length > 0
                    ? structuredHistory.bullets.map((entry) => truncateReason(entry, 160))
                    : (bulletReasons.length > 0
                      ? bulletReasons
                      : reasons.slice(0, 1).map((entry) => truncateReason(entry, 160)));
                  const roleCompany = splitRoleAndCompany(item.job_title, item.company_name, item.job_url || null);
                  const recommendation = displayDecisionMissing
                    ? null
                    : (usesDisplayDecision
                      ? displayDecision?.label || null
                      : recommendationLabelForDecision(item.explanation_payload?.decision, status));
                  const decisionCopy = displayDecisionMissing
                    ? safeDegradedDecisionCopy()
                    : (usesDisplayDecision && displayDecision
                      ? decisionCopyForDisplayDecision(displayDecision)
                      : decisionCopyForStatus(status, recommendation, risk, Boolean(item.hard_blocker)));
                  const decisionActions = displayDecisionMissing
                    ? []
                    : (usesDisplayDecision && displayDecision
                      ? decisionActionsForDisplayDecision(displayDecision)
                      : decisionActionsForStatus(status, recommendation, Boolean(item.hard_blocker)));
                  const outcomeBands = historyOutcomeBands(item, status);
                  const decisionConfidence = decisionConfidenceLabel(item.explanation_payload?.decision_confidence || null);
                  const historyVisibleReasons = displayDecisionMissing ? [] : visibleReasons;
                  const historySavePending = savingAction?.verdictId === item.id;
                  const historySaveError = actionSaveError?.verdictId === item.id
                    ? actionSaveError.message
                    : null;
                  return (
                    <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">{roleCompany.role}</p>
                    {roleCompany.company ? (
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{roleCompany.company}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{decisionCopy.title}</span>
                  <span className="text-muted-foreground">Résumé screen: <span className={bandTone(outcomeBands.atsPass)}>{outcomeBands.atsPass}</span></span>
                  <span className="text-muted-foreground">Human review: <span className={bandTone(outcomeBands.humanWin)}>{outcomeBands.humanWin}</span></span>
                  {decisionConfidence ? (
                    <span className="text-muted-foreground">Decision confidence: <span className={bandTone(decisionConfidence)}>{decisionConfidence}</span></span>
                  ) : null}
                </div>
                {!displayDecisionMissing && riskBreakdown?.summary ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">Main factor: {riskBreakdown.summary}</p>
                ) : null}
                {historyVisibleReasons.map((reason, index) => (
                  <p key={index} className="text-sm text-muted-foreground leading-relaxed">• {reason}</p>
                ))}
                {!displayDecisionMissing && status !== "strong" && warning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm text-destructive leading-snug">
                      <span>{warningPrefixForStatus(status)}: {warning}</span>
                      {warningCanExpand && (
                        <button
                          type="button"
                          className="ml-1 underline underline-offset-2"
                          onClick={() => setExpandedHistoryWarnings((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        >
                          {isHistoryWarningExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {decisionActions.map((actionItem) => (
                      <Button
                        key={`${item.id}-${actionItem.action}-${actionItem.label}`}
                        size="sm"
                        variant={actionItem.variant || "default"}
                        className={`${actionItem.className || ""} text-xs h-8`.trim()}
                        onClick={() => void handleHistoryAction(item, actionItem.action)}
                        disabled={historySavePending}
                        aria-busy={historySavePending && savingAction?.action === actionItem.action ? "true" : undefined}
                      >
                        {historySavePending && savingAction?.action === actionItem.action ? "Saving..." : actionItem.label}
                      </Button>
                    ))}
                  </div>
                  {historySaveError ? (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {historySaveError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {historySavePending
                        ? "Saving your choice..."
                        : "Choose what you did. This keeps future recommendations grounded."}
                    </p>
                  )}
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ApplyGate;
