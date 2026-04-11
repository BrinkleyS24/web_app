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

function rejectionRiskPercent(
  score: number | null | undefined,
  status: VerdictStatus,
  hasHardBlocker = false,
) {
  if (hasHardBlocker) return 85;
  if (typeof score === "number" && Number.isFinite(score)) {
    const base = Math.max(0, Math.min(100, 100 - Math.round(score)));
    return status === "strong" ? Math.min(base, 35) : base;
  }
  if (status === "strong") return 20;
  if (status === "potential") return 45;
  if (status === "risky") return 60;
  return 90;
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

function isGenericStrategicFitNote(note: string) {
  const text = String(note || "").trim().toLowerCase();
  if (!text) return false;
  return /looks like an? (aligned|adjacent|stretch) move .*responsibility overlap/.test(text);
}

function structuredWarningAndBullets(explanation: ApplyGateResult["explanation"] | null | undefined) {
  if (!explanation) {
    return { warning: null as string | null, bullets: [] as string[] };
  }

  const hardBlockers = (explanation.hard_blockers || []).map((s) => String(s || "").trim()).filter(Boolean);
  const primaryDrivers = (explanation.primary_rejection_drivers || []).map((s) => String(s || "").trim()).filter(Boolean);
  const roleCoreGaps = (explanation.role_core_gaps || []).map((s) => String(s || "").trim()).filter(Boolean);
  const missingRequired = (explanation.missing_required || []).map((s) => String(s || "").trim()).filter(Boolean);
  const missingPreferred = (explanation.missing_preferred || []).map((s) => String(s || "").trim()).filter(Boolean);
  const allFitNotes = (explanation.fit_notes || []).map((s) => String(s || "").trim()).filter(Boolean);
  const hasGapSignal = hardBlockers.length > 0 || roleCoreGaps.length > 0 || missingRequired.length > 0 || missingPreferred.length > 0;
  const fitNotes = hasGapSignal
    ? allFitNotes.filter((note) => !isGenericStrategicFitNote(note))
    : allFitNotes;

  const warning = hardBlockers[0]
    || primaryDrivers[0]
    || formatSkillGapSummary(roleCoreGaps, "Role-core domain gaps")
    || formatSkillGapSummary(missingRequired, "Missing required skills")
    || formatSkillGapSummary(missingPreferred, "Missing preferred skills")
    || null;

  const bullets: string[] = [];

  if (hardBlockers.length > 0 && missingRequired.length > 0) {
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
  const [jobUrl, setJobUrl] = useState("");
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
    () => buildHistoryDisplayItemFromResult(result, jobTitle, companyName, jobUrl),
    [companyName, jobTitle, jobUrl, result],
  );
  const history = useMemo<ApplyGateHistoryDisplayItem[]>(() => {
    const deduped = dedupeHistoryItems(rawHistory);
    if (!currentHistoryProjection) return deduped;
    return deduped.filter((item) => !sameHistoryPosting(item, currentHistoryProjection));
  }, [currentHistoryProjection, rawHistory]);

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeJobAlignment({ jobTitle, jobDescription, companyName, jobUrl }),
    onSuccess: (data) => {
      setResult(data);
      setIsCurrentWarningExpanded(false);
      const currentAsHistory = buildHistoryDisplayItemFromResult(data, jobTitle, companyName, jobUrl);
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

  const handleAnalyze = useCallback(() => {
    if (!jobTitle.trim() && !jobDescription.trim() && !jobUrl.trim()) return;
    analyzeMutation.mutate();
  }, [analyzeMutation, jobDescription, jobTitle, jobUrl]);

  const handleAction = useCallback(
    (action: "applied" | "fixed" | "skipped") => {
      const targetUrl = (result?.jobUrl || jobUrl || "").trim();
      if (result?.id) {
        updateApplyGateAction(result.id, action).catch(() => {});
      }
      if (action === "applied" && targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      setResult(null);
    },
    [jobUrl, result],
  );

  const handleHistoryAction = useCallback(
    (verdictId: string, action: "applied" | "fixed" | "skipped") => {
      updateApplyGateAction(verdictId, action).catch(() => {});
    },
    [],
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
    ? rejectionRiskPercent(
      result.scoringBreakdown?.totalScore,
      currentStatus || "risky",
      Boolean(result.scoringBreakdown?.hardBlocker),
    )
    : null;
  const currentRoleCompany = splitRoleAndCompany(
    result?.jobTitle || jobTitle || null,
    result?.companyName || companyName || null,
    result?.jobUrl || jobUrl || null,
  );
  const structuredCurrent = structuredWarningAndBullets(result?.explanation);
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
  const currentWarningFull = currentMostLikelyReason ? String(currentMostLikelyReason).trim() : null;
  const currentWarningCanExpand = Boolean(currentWarningFull && currentWarningFull.length > 150);
  const currentWarning = currentWarningFull
    ? (isCurrentWarningExpanded ? currentWarningFull : warningText(currentWarningFull, 150))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Apply Gate
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Verdict on each saved job before you apply.</p>
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
            <p className="text-xs text-muted-foreground">Useful when you paste a job description instead of starting from a posting URL.</p>
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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="job-url">Job URL (optional)</label>
            <input
              id="job-url"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://company.com/jobs/..."
            />
            <p className="text-xs text-muted-foreground">If description is empty, Apply Gate will fetch and analyze the posting from this URL.</p>
          </div>
          <Button onClick={handleAnalyze} disabled={analyzeMutation.isPending}>
            {analyzeMutation.isPending ? "Checking..." : "Check Alignment"}
          </Button>
          {analyzeMutation.isError && (
            <p className="text-xs text-destructive">
              {analyzeMutation.error instanceof Error
                ? analyzeMutation.error.message
                : "Apply Gate could not analyze this role. Paste the job description or try a direct job posting URL."}
            </p>
          )}
        </div>

        {result && (
          <div className="glass-card rounded-xl p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-foreground leading-tight">{currentRoleCompany.role}</p>
                {currentRoleCompany.company ? (
                  <p className="text-sm text-muted-foreground leading-tight mt-0.5">{currentRoleCompany.company}</p>
                ) : null}
              </div>
              <StatusBadge status={currentStatus || "risky"} />
            </div>

            <div className="flex items-center gap-3 text-xs pt-0.5">
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{reviewLabelForStatus(currentStatus || "risky")}</span>
              {currentRecommendation && (
                <span className="px-2 py-0.5 rounded border border-accent/20 bg-accent/10 text-accent">
                  Recommended: {currentRecommendation}
                </span>
              )}
              <span className="text-muted-foreground">Rejection risk: <span className={riskTone(currentRisk ?? 60)}>{currentRisk ?? 60}%</span></span>
            </div>

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

            {(currentAssessmentConfidence || currentUncertaintyNotes.length > 0) && (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 space-y-1">
                {currentAssessmentConfidence && (
                  <p className="text-xs text-muted-foreground">
                    Verdict confidence: <span className="text-foreground font-medium">{currentAssessmentConfidence}</span>
                  </p>
                )}
                {currentUncertaintyNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground leading-relaxed">{"\u2022"} {note}</p>
                ))}
              </div>
            )}

            {currentActionSections.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">How to improve your odds</p>
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

            <div className="flex items-center gap-2 pt-1">
              {currentStatus === "strong" ? (
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-8" onClick={() => handleAction("applied")}>
                  Apply Now
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => handleAction("applied")}
                  >
                    Apply Anyway
                  </Button>
                  {currentRisk !== null && currentRisk >= 40 && currentRisk <= 90 && (
                    <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-8" onClick={() => handleAction("fixed")}>
                      Fix First
                    </Button>
                  )}
                </>
              )}
              {currentStatus !== "strong" && currentRisk !== null && currentRisk > 90 && (
                <Button size="sm" variant="ghost" className="text-xs h-8 text-muted-foreground" onClick={() => handleAction("skipped")}>
                  Skip
                </Button>
              )}
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
                  const risk = rejectionRiskPercent(item.score, status, Boolean(item.hard_blocker));
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
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{reviewLabelForStatus(status)}</span>
                  <span className="text-muted-foreground">Rejection risk: <span className={riskTone(risk)}>{risk}%</span></span>
                </div>
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
                <div className="flex items-center gap-2 pt-1">
                  {status === "strong" ? (
                    <Button
                      size="sm"
                      className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-8"
                      onClick={() => handleHistoryAction(item.id, "applied")}
                    >
                      Apply Now
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => handleHistoryAction(item.id, "applied")}
                      >
                        Apply Anyway
                      </Button>
                      {risk >= 40 && risk <= 90 && (
                        <Button
                          size="sm"
                          className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-8"
                          onClick={() => handleHistoryAction(item.id, "fixed")}
                        >
                          Fix First
                        </Button>
                      )}
                    </>
                  )}
                  {status !== "strong" && risk > 90 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-muted-foreground"
                      onClick={() => handleHistoryAction(item.id, "skipped")}
                    >
                      Skip
                    </Button>
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
