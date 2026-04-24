import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle } from "lucide-react";
import {
  normalizeCompanyName,
  splitRoleAndCompany as splitApplyGateRoleAndCompany,
} from "@/lib/applyGateDisplay";
import { auth } from "@/lib/firebase";
import {
  analyzeJobAlignment,
  fetchApplyGateHistory,
  updateApplyGateAction,
  fetchResume,
  type ApplyGateResult,
  type ApplyGateHistoryItem,
} from "@/lib/emails";

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
  discipline_mismatch: "Core discipline/environment mismatch is high-risk",
};

type VerdictStatus = "strong" | "potential" | "risky" | "not-recommended";

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

function riskTone(risk: number) {
  if (risk <= 30) return "text-emerald-500";
  if (risk <= 65) return "text-amber-500";
  return "text-red-500";
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
  const hasUniversalHardGate = universalBlockers.length > 0;
  const hasGapSignal = hasUniversalHardGate || hardBlockers.length > 0 || roleCoreGaps.length > 0 || missingRequired.length > 0 || missingPreferred.length > 0;
  const fitNotes = hasGapSignal
    ? allFitNotes.filter((note) => !isGenericStrategicFitNote(note))
    : allFitNotes;

  const warning = (hasUniversalHardGate
    ? `This posting has hard eligibility requirements not shown in your resume: ${universalBlockers.slice(0, 4).join(", ")}.`
    : null)
    || hardBlockers[0]
    || primaryDrivers[0]
    || formatSkillGapSummary(roleCoreGaps, "Role-core domain gaps")
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

  const roleCoreSummary = formatSkillGapSummary(roleCoreGaps, "Role-core domain gaps");
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
  if (decision === "apply_now") return "Apply now";
  if (decision === "apply_with_caveats") return "Apply with caveats";
  if (decision === "fix_first") return "Fix before applying";
  if (decision === "skip") return "Skip this posting";
  if (status === "strong") return "Apply now";
  if (status === "potential") return "Apply with caveats";
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
  if (!explanation?.action_plan) return [] as Array<{ title: string; items: string[] }>;

  const normalize = (items: string[] | null | undefined) => (items || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const quickFixes = normalize(explanation.action_plan.quick_fixes);
  const resumeProof = normalize(explanation.action_plan.resume_proof_improvements);
  const longTerm = normalize(explanation.action_plan.long_term_gaps);
  const notFixable = normalize(explanation.action_plan.not_fixable_for_this_posting);

  const sections = [
    { title: "Quick fixes (today)", items: quickFixes },
    { title: "Resume proof improvements", items: resumeProof },
    { title: "Long-term gaps", items: longTerm },
    { title: "Not fixable for this posting", items: notFixable },
  ].filter((section) => section.items.length > 0);

  return sections.slice(0, 4);
}

type ApplyGateHistoryQueryData = {
  success: boolean;
  history: ApplyGateHistoryItem[];
};

type ApplyGateHistoryDisplayItem = ApplyGateHistoryItem & {
  _unsaved?: boolean;
};

type ApplyGateAction = "applied" | "fixed" | "skipped";

type DecisionAction = {
  action: ApplyGateAction;
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
};

function decisionCopyForStatus(status: VerdictStatus, recommendation: string | null, risk: number | null, hardBlocker = false) {
  const recommendsSkip = recommendation?.toLowerCase().includes("skip") === true;

  if (status === "strong") {
    return {
      title: "Apply now",
      body: "This role has the strongest fit signal. Keep the application tight and send it while the posting is still fresh.",
      toneClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    };
  }

  if (status === "potential") {
    return {
      title: "Apply with caveats",
      body: "This can be worth applying to, but only after you review the gaps and avoid sending a generic version.",
      toneClass: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }

  if (status === "risky") {
    if (recommendsSkip) {
      return {
        title: "Skip this role",
        body: hardBlocker
          ? "This is not a quick resume tailoring issue unless you already have the required credentials and forgot to list them."
          : "The fit signal is weak enough that this is likely to be a low-probability application.",
        toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
      };
    }

    return {
      title: "Fix first before applying",
      body: hardBlocker
        ? "A hard blocker or major proof gap is visible. Fix the strongest issue before this becomes another low-probability application."
        : "The fit signal is weak enough that applying without edits is likely to waste time.",
      toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
    };
  }

  return {
    title: recommendation || "Skip this posting",
    body: risk && risk >= 90
      ? "The blocker stack is high enough that this is probably not worth the application time."
      : "This role is outside the current high-probability lane. Save the time for a better match.",
    toneClass: "border-red-500/30 bg-red-500/10 text-red-700",
  };
}

function decisionActionsForStatus(status: VerdictStatus, recommendation: string | null = null, hardBlocker = false): DecisionAction[] {
  const recommendsSkip = recommendation?.toLowerCase().includes("skip") === true;

  if (status === "strong") {
    return [
      { action: "applied", label: "Apply now", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "skipped", label: "Skip anyway", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  if (status === "potential") {
    return [
      { action: "applied", label: "Apply with caveats", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
      { action: "fixed", label: "Fix first", variant: "outline" },
      { action: "skipped", label: "Skip role", variant: "ghost", className: "text-muted-foreground" },
    ];
  }

  if (status === "risky") {
    if (recommendsSkip && hardBlocker) {
      return [
        { action: "skipped", label: "Skip this role", variant: "destructive" },
        { action: "applied", label: "Apply anyway", variant: "outline" },
      ];
    }

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
}) {
  return {
    surface: params.surface,
    action_label: params.action,
    status: params.status,
    recommendation: params.recommendation || null,
    risk_percent: typeof params.risk === "number" ? params.risk : null,
    role: params.role || null,
    company: params.company || null,
    verdict: params.verdict || null,
    score: typeof params.score === "number" && Number.isFinite(params.score) ? params.score : null,
    decision: params.decision || null,
    hard_blocker: Boolean(params.hardBlocker),
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

const ApplyGate = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ApplyGateResult | null>(null);
  const [isCurrentWarningExpanded, setIsCurrentWarningExpanded] = useState(false);
  const [expandedHistoryWarnings, setExpandedHistoryWarnings] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
    enabled: Boolean(user),
  });

  const hasResume = Boolean(resumeQuery.data?.resumeText && resumeQuery.data.resumeText.trim().length > 20);

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
    mutationFn: () => analyzeJobAlignment({ jobTitle, jobDescription, companyName }),
    onSuccess: (data) => {
      setResult(data);
      setIsCurrentWarningExpanded(false);
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

  const canAnalyze = jobDescription.trim().length > 0;

  const handleAnalyze = useCallback(() => {
    if (!jobDescription.trim()) return;
    analyzeMutation.mutate();
  }, [analyzeMutation, jobDescription]);

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
    (action: ApplyGateAction) => {
      const targetUrl = (result?.jobUrl || "").trim();
      if (result?.id) {
        const status = verdictToStatus(result.verdict);
        const risk = resultApplicationRiskPercent(result, status);
        const roleCompany = splitRoleAndCompany(
          result.jobTitle || jobTitle || null,
          result.companyName || companyName || null,
          result.jobUrl || null,
        );
        const recommendation = recommendationLabelForDecision(result.explanation?.decision, status);
        const feedback = buildApplyGateActionFeedback({
          surface: "current_result",
          action,
          status,
          recommendation,
          risk,
          role: roleCompany.role,
          company: roleCompany.company,
          verdict: result.verdict,
          score: result.scoringBreakdown?.totalScore,
          decision: result.explanation?.decision || null,
          hardBlocker: result.scoringBreakdown?.hardBlocker,
        });

        markVerdictActionInCache(result.id, action);
        updateApplyGateAction(result.id, action, { feedback })
          .then(() => queryClient.invalidateQueries({ queryKey: ["apply-gate-history"] }))
          .catch(() => {});
      }
      if (action === "applied" && targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      setResult(null);
    },
    [companyName, jobTitle, markVerdictActionInCache, queryClient, result],
  );

  const handleHistoryAction = useCallback(
    (item: ApplyGateHistoryDisplayItem, action: ApplyGateAction) => {
      const status = verdictToStatus(item.verdict);
      const risk = historyApplicationRiskPercent(item, status);
      const roleCompany = splitRoleAndCompany(item.job_title, item.company_name, item.job_url || null);
      const recommendation = recommendationLabelForDecision(item.explanation_payload?.decision, status);
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
        decision: item.explanation_payload?.decision || null,
        hardBlocker: item.hard_blocker,
      });

      markVerdictActionInCache(item.id, action);
      updateApplyGateAction(item.id, action, { feedback })
        .then(() => queryClient.invalidateQueries({ queryKey: ["apply-gate-history"] }))
        .catch(() => {});
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

  const currentStatus = result ? verdictToStatus(result.verdict) : null;
  const currentRisk = result
    ? resultApplicationRiskPercent(result, currentStatus || "risky")
    : null;
  const currentRiskBreakdown = riskBreakdownFromResult(result);
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
  const currentVisibleReasons = structuredCurrent.bullets.length > 0
    ? structuredCurrent.bullets.map((entry) => truncateReason(entry, 160))
    : (fallbackCurrentBulletReasons.length > 0
      ? fallbackCurrentBulletReasons
      : (result?.reasons?.slice(0, 1).map((entry) => truncateReason(entry, 160)) || []));
  const currentRecommendation = result
    ? recommendationLabelForDecision(result.explanation?.decision, currentStatus || "risky")
    : null;
  const currentAssessmentConfidence = confidenceLabel(result?.explanation?.assessment_confidence);
  const currentUncertaintyNotes = (result?.explanation?.uncertainty_notes || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 2);
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
  const currentDecisionCopy = currentStatus
    ? decisionCopyForStatus(
      currentStatus,
      currentRecommendation,
      currentRisk,
      Boolean(result?.scoringBreakdown?.hardBlocker),
    )
    : null;
  const currentDecisionActions = currentStatus
    ? decisionActionsForStatus(currentStatus, currentRecommendation, Boolean(result?.scoringBreakdown?.hardBlocker))
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Apply Gate
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decide whether to apply, fix first, or skip before you spend time on a posting.
          </p>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-3">
          <p className="text-xs text-muted-foreground">Resume signal: {hasResume ? "Saved" : "Not found"}</p>
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
            <label className="text-sm font-medium text-foreground" htmlFor="job-description">Job Description</label>
            <textarea
              id="job-description"
              className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description"
            />
            <p className="text-xs text-muted-foreground">Paste the full job description. URL import is temporarily disabled while we harden extraction.</p>
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

        {result && (
          <div className="glass-card rounded-xl p-6 space-y-3">
            {currentDecisionCopy && (
              <div className={`rounded-xl border px-4 py-3 ${currentDecisionCopy.toneClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide">Decision</p>
                  <StatusBadge status={currentStatus || "risky"} />
                </div>
                <h2 className="mt-2 text-xl font-semibold">{currentDecisionCopy.title}</h2>
                <p className="mt-1 text-sm leading-relaxed">{currentDecisionCopy.body}</p>
              </div>
            )}

            <div>
              <p className="font-semibold text-foreground leading-tight">{currentRoleCompany.role}</p>
              {currentRoleCompany.company ? (
                <p className="text-sm text-muted-foreground leading-tight mt-0.5">{currentRoleCompany.company}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Fit label: {reviewLabelForStatus(currentStatus || "risky")}
              </span>
              {currentRecommendation && (
                <span className="px-2 py-0.5 rounded border border-accent/20 bg-accent/10 text-accent">
                  Recommended move: {currentRecommendation}
                </span>
              )}
              <span className="text-muted-foreground">
                Application risk: <span className={riskTone(currentRisk ?? 60)}>{currentRisk ?? 60}%</span>
              </span>
            </div>

            {currentRiskBreakdown?.components?.length ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">Risk breakdown</p>
                  <span className="text-xs text-muted-foreground">{currentRiskBreakdown.summary}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentRiskBreakdown.components.slice(0, 4).map((component) => (
                    <div key={component.key} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{component.label}</p>
                        <span className={`text-xs font-semibold ${riskTone(component.score)}`}>{component.score}%</span>
                      </div>
                      {component.evidence ? (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{component.evidence}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {currentOccupationGrounding?.job || currentOccupationGrounding?.candidate ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">Occupation grounding</p>
                  <span className={`text-xs font-semibold ${riskTone(100 - Math.round(currentOccupationGrounding.alignmentScore ?? 50))}`}>
                    {Math.round(currentOccupationGrounding.alignmentScore ?? 50)}/100
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Posting</p>
                    <p className="text-xs font-medium text-foreground">{currentOccupationGrounding.job?.title || "Unknown occupation"}</p>
                    {currentOccupationGrounding.job?.onetSoc ? (
                      <p className="text-xs text-muted-foreground">O*NET-SOC {currentOccupationGrounding.job.onetSoc}</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Profile</p>
                    <p className="text-xs font-medium text-foreground">{currentOccupationGrounding.candidate?.title || "Unknown occupation"}</p>
                    {currentOccupationGrounding.candidate?.onetSoc ? (
                      <p className="text-xs text-muted-foreground">O*NET-SOC {currentOccupationGrounding.candidate.onetSoc}</p>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {occupationAlignmentLabel(currentOccupationGrounding.alignmentLabel)}
                  {Number.isFinite(Number(currentOccupationGrounding.confidence))
                    ? ` - Confidence ${Math.round(Number(currentOccupationGrounding.confidence) * 100)}%`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              {currentVisibleReasons.map((reason, idx) => (
                <p key={idx} className="text-sm text-muted-foreground leading-relaxed">• {reason}</p>
              ))}
            </div>

            {(currentStatus !== "strong" && currentWarning) && (
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

            {currentRequirementLedgerItems.length > 0 && (
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

            {(currentAssessmentConfidence || currentUncertaintyNotes.length > 0) && (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 space-y-1">
                {currentAssessmentConfidence && (
                  <p className="text-xs text-muted-foreground">
                    Decision confidence: <span className="text-foreground font-medium">{currentAssessmentConfidence}</span>
                  </p>
                )}
                {currentUncertaintyNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {note}</p>
                ))}
              </div>
            )}

            {currentActionSections.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
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

            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {currentDecisionActions.map((item) => (
                  <Button
                    key={`${item.action}-${item.label}`}
                    size="sm"
                    variant={item.variant || "default"}
                    className={`${item.className || ""} text-xs h-8`.trim()}
                    onClick={() => handleAction(item.action)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentHasUniversalHardGate
                  ? "Apply anyway only if you already meet these requirements and your resume is missing the proof."
                  : "Your choice is saved to improve future targeting, action queues, and outcome memory."}
              </p>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Recent verdicts</p>
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="glass-card rounded-xl p-5 space-y-3">
                {(() => {
                  const status = verdictToStatus(item.verdict);
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
                  const recommendation = recommendationLabelForDecision(item.explanation_payload?.decision, status);
                  const decisionCopy = decisionCopyForStatus(status, recommendation, risk, Boolean(item.hard_blocker));
                  const decisionActions = decisionActionsForStatus(status, recommendation, Boolean(item.hard_blocker));
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
                <div className="flex items-center gap-3 text-xs pt-0.5">
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{decisionCopy.title}</span>
                  <span className="text-muted-foreground">Application risk: <span className={riskTone(risk)}>{risk}%</span></span>
                </div>
                {riskBreakdown?.summary ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">Risk driver: {riskBreakdown.summary}</p>
                ) : null}
                {visibleReasons.map((reason, index) => (
                  <p key={index} className="text-sm text-muted-foreground leading-relaxed">• {reason}</p>
                ))}
                {status !== "strong" && warning && (
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
                        onClick={() => handleHistoryAction(item, actionItem.action)}
                      >
                        {actionItem.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saving this choice keeps Strategy Alerts and Outcome Memory grounded in what you actually did.
                  </p>
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
