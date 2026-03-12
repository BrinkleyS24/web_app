import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  AlertTriangle,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Lightbulb,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import {
  analyzePrejection,
  fetchPrejectionHistory,
  fetchResume,
  type PrejectionResult,
  type PrejectionHistoryItem,
  type PrejectionRisk,
} from "@/lib/emails";
import { Link } from "react-router-dom";

// ── Severity display config ─────────────────────────────────────────

const OVERALL_CONFIG = {
  clear: {
    label: "Clear",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: ShieldCheck,
    desc: "No significant screening risks detected.",
  },
  low: {
    label: "Low Risk",
    color: "text-sky-500",
    bg: "bg-sky-500/10 border-sky-500/30",
    icon: ShieldQuestion,
    desc: "Minor filters may apply, but unlikely to block you.",
  },
  medium: {
    label: "Medium Risk",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: AlertTriangle,
    desc: "At least one HR filter could flag your application.",
  },
  high: {
    label: "High Risk",
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/30",
    icon: ShieldAlert,
    desc: "A hard screening filter is likely to block this application.",
  },
  very_high: {
    label: "Very High Risk",
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/30",
    icon: ShieldAlert,
    desc: "Rejection is very likely without significant repositioning.",
  },
  moderate: {
    label: "Moderate Risk",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: AlertTriangle,
    desc: "One or more filters may block this application.",
  },
} as const;

const SEVERITY_BADGE: Record<string, string> = {
  very_high: "bg-red-500/10 text-red-600 border-red-500/20",
  high: "bg-red-500/10 text-red-500 border-red-500/20",
  moderate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  low: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

const CATEGORY_LABEL: Record<string, string> = {
  hard_requirement: "Hard Requirement",
  skill_emphasis: "Skill Emphasis",
  industry_context: "Industry Context",
  title_perception: "Title / Seniority",
  competition: "Competition",
  screening: "Screening Risk",
};

function normalizeOverall(result: PrejectionResult | null): keyof typeof OVERALL_CONFIG {
  if (!result) return "medium";

  if (result.riskLevel) {
    if (result.riskLevel === "moderate") return "moderate";
    if (result.riskLevel === "very_high") return "very_high";
    return result.riskLevel;
  }

  if (result.overall === "medium") return "moderate";
  if (result.overall === "clear") return "clear";
  if (result.overall === "high") return "high";
  if (result.overall === "low") return "low";

  return "moderate";
}

function normalizeRisks(result: PrejectionResult | null): PrejectionRisk[] {
  if (!result) return [];

  if (Array.isArray(result.risks)) return result.risks;

  const severity: PrejectionRisk["severity"] =
    result.riskLevel === "very_high" ? "very_high"
      : result.riskLevel === "high" ? "high"
        : result.riskLevel === "moderate" ? "moderate"
          : "low";

  return (result.primaryRejectionReasons || []).map((reason) => ({
    category: "screening",
    risk: reason,
    severity,
  }));
}

function normalizeSuggestion(result: PrejectionResult | null): string {
  if (!result) return "";
  return result.mitigationPlan || result.suggestedMove || "No mitigation guidance available.";
}

function normalizeStageLabel(stage: string | undefined): "ATS" | "Recruiter Screen" | "Hiring Manager Screen" | null {
  if (!stage) return null;
  if (stage === "ATS") return "ATS";
  if (stage === "Recruiter Screen") return "Recruiter Screen";
  if (stage === "Hiring Manager Screen") return "Hiring Manager Screen";
  return null;
}

// ── Risk card ───────────────────────────────────────────────────────

function RiskCard({ risk }: { risk: PrejectionRisk }) {
  const badge = SEVERITY_BADGE[risk.severity] ?? SEVERITY_BADGE.medium;
  const catLabel = CATEGORY_LABEL[risk.category] ?? risk.category;

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge}`}
        >
          {risk.severity}
        </span>
        <span className="text-xs text-muted-foreground">{catLabel}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{risk.risk}</p>
    </div>
  );
}

// ── Resume indicator (links to Settings) ────────────────────────────

function ResumeIndicator() {
  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
  });

  const hasResume = Boolean(
    resumeQuery.data?.resumeText && resumeQuery.data.resumeText.trim().length > 20,
  );

  if (resumeQuery.isLoading) return null;

  return (
    <Link
      to="/settings"
      className="glass-card rounded-xl px-5 py-3 flex items-center justify-between hover:bg-accent/5 transition-colors group"
    >
      <div className="flex items-center gap-2 text-sm">
        <FileText className={`w-4 h-4 ${hasResume ? "text-emerald-500" : "text-muted-foreground"}`} />
        <span className={hasResume ? "text-foreground font-medium" : "text-muted-foreground"}>
          {hasResume ? "Resume saved" : "Add your resume for better results"}
        </span>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
    </Link>
  );
}

// ── Main page ───────────────────────────────────────────────────────

const Prejection = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  // ── Form state ──────────────────────────────────────────────────
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<PrejectionResult | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // ── Analyze mutation ────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: () => analyzePrejection({ jobTitle, jobDescription }),
    onSuccess: (data) => {
      setResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["prejection-history"] });
    },
  });

  const handleAnalyze = useCallback(() => {
    if (!jobTitle.trim()) return;
    analyzeMutation.mutate();
  }, [analyzeMutation, jobTitle]);

  // ── History query ───────────────────────────────────────────────
  const historyQuery = useQuery({
    queryKey: ["prejection-history"],
    queryFn: fetchPrejectionHistory,
    enabled: isAuthed,
    staleTime: 30_000,
  });
  const history: PrejectionHistoryItem[] = historyQuery.data?.history ?? [];

  // ── Reset handler ───────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setResult(null);
    setJobTitle("");
    setJobDescription("");
    setShowProfile(false);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────
  const normalizedOverall = normalizeOverall(result);
  const normalizedRisks = normalizeRisks(result);
  const suggestion = normalizeSuggestion(result);
  const stageLabel = normalizeStageLabel(result?.stageMostLikelyToReject);
  const cfg = result ? OVERALL_CONFIG[normalizedOverall] : null;
  const OverallIcon = cfg?.icon ?? AlertTriangle;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-accent" />
            Pre-jection Simulator
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            See potential HR screening risks before you apply. Think of it as a system insight, not a verdict.
          </p>
        </div>

        {!isAuthed ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            Sign in to use the Pre-jection Simulator.
          </div>
        ) : (
          <>            {/* ── Resume indicator ───────────────────────── */}
            <ResumeIndicator />
            {/* ── Input form ─────────────────────────────────── */}
            {!result && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">
                  Simulate Screening
                </h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Paste a job you're considering. We'll check it against common HR filters.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="pj-title" className="text-sm font-medium text-foreground">
                    Job Title
                  </label>
                  <input
                    id="pj-title"
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder='e.g. "Senior Data Engineer"'
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pj-desc" className="text-sm font-medium text-foreground">
                    Job Description <span className="text-muted-foreground font-normal">(optional but recommended)</span>
                  </label>
                  <textarea
                    id="pj-desc"
                    rows={7}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
                    placeholder="Paste the full job description…"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>

                <Button
                  className="gap-2"
                  disabled={!jobTitle.trim() || analyzeMutation.isPending}
                  onClick={handleAnalyze}
                >
                  <Search className="w-4 h-4" />
                  {analyzeMutation.isPending ? "Simulating…" : "Run Screening Simulation"}
                </Button>

                {analyzeMutation.isError && (
                  <p className="text-sm text-red-500">
                    {(analyzeMutation.error as Error)?.message ?? "Analysis failed."}
                  </p>
                )}
              </div>
            )}

            {/* ── Results ────────────────────────────────────── */}
            {result && cfg && (
              <div className="space-y-4">
                {/* Overall risk card */}
                <div className={`rounded-xl border p-5 ${cfg.bg}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <OverallIcon className={`w-7 h-7 ${cfg.color}`} />
                    <div>
                      <h2 className={`text-lg font-bold ${cfg.color}`}>
                        {cfg.label}
                      </h2>
                      <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                    </div>
                  </div>
                </div>

                {/* Screening risks */}
                {normalizedRisks.length > 0 && (
                  <div className="glass-card rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Potential Screening Risks
                    </h3>
                    {normalizedRisks.map((risk, idx) => (
                      <RiskCard key={idx} risk={risk} />
                    ))}
                  </div>
                )}

                {/* Suggested Move */}
                <div className="glass-card rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Suggested Move
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {suggestion}
                  </p>
                </div>

                {result.breakdown && (
                  <div className="glass-card rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Stage Risk Breakdown</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border border-border px-3 py-2">ATS: {result.breakdown.atsRisk}%</div>
                      <div className="rounded-md border border-border px-3 py-2">Recruiter: {result.breakdown.recruiterRisk}%</div>
                      <div className="rounded-md border border-border px-3 py-2">Hiring Manager: {result.breakdown.hiringManagerRisk}%</div>
                    </div>
                    {stageLabel && (
                      <p className="text-xs text-muted-foreground">
                        Most likely rejection stage: <span className="text-foreground font-medium">{stageLabel}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Profile insight (collapsible) */}
                {result.profile && (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between glass-card rounded-xl px-5 py-3 text-sm text-muted-foreground hover:bg-muted/20 transition-colors"
                    onClick={() => setShowProfile((p) => !p)}
                  >
                    <span>Your Profile Snapshot</span>
                    {showProfile ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
                {showProfile && result.profile && (
                  <div className="glass-card rounded-xl p-5 space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Detected seniority:</span>
                      <span className="text-foreground font-medium">
                        {result.profile.seniority?.label ?? "unknown"}
                      </span>
                    </div>
                    {(result.profile.topSkills || []).length > 0 && (
                      <div>
                        <span className="text-muted-foreground block mb-1">Your top skills:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(result.profile.topSkills || []).map((s) => (
                            <span
                              key={s}
                              className="inline-block text-xs px-2 py-0.5 rounded-full border bg-accent/10 text-accent border-accent/20"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(result.profile.industries || []).length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Industry exposure:</span>
                        <span className="text-foreground">
                          {(result.profile.industries || []).join(", ")}
                        </span>
                      </div>
                    )}
                    {result.profile.hasEnoughData === false && (
                      <p className="text-xs text-amber-500">
                        Limited application history — results will improve as more data is synced.
                      </p>
                    )}
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    Check Another Role
                  </Button>
                </div>
              </div>
            )}

            {/* ── Past analyses ───────────────────────────────── */}
            {history.length > 0 && !result && (
              <div className="glass-card rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Past Screening Simulations
                </h3>

                <div className="space-y-2">
                  {history.slice(0, 10).map((item) => {
                    const historyOverall =
                      item.risk_level === "very_high" ? "very_high"
                        : item.risk_level === "moderate" ? "moderate"
                          : item.risk_level || (item.overall_risk === "medium" ? "moderate" : item.overall_risk) || "moderate";
                    const itemCfg = OVERALL_CONFIG[historyOverall] ?? OVERALL_CONFIG.moderate;
                    const ItemIcon = itemCfg.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemIcon className={`w-4 h-4 shrink-0 ${itemCfg.color}`} />
                          <span className="truncate text-foreground">
                            {item.job_title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-medium ${itemCfg.color}`}>
                            {itemCfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Prejection;
