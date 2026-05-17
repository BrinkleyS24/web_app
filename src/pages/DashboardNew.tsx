import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Brain,
  CheckSquare,
  Clock3,
  Mail,
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { splitRoleAndCompany } from "@/lib/applyGateDisplay";
import { auth } from "@/lib/firebase";
import {
  fetchApplicationStats,
  fetchApplyGateHistory,
  fetchEmailMetrics,
  fetchRankedActionQueue,
  fetchSuggestionOutcomeAnalytics,
  fetchStrategyAlerts,
  startEmailSync,
  type ApplyGateHistoryItem,
  type ApplyGateResult,
} from "@/lib/emails";
import {
  buildDaqV1InboxQueue,
  buildQueueItemsFromRankedQueue,
  buildRankedQueueStats,
  buildGmailThreadUrl,
  formatRelativeAge,
  sourceClasses,
  urgencyClasses,
  type QueueItem,
} from "@/lib/premiumTaskQueue";

type VerdictStatus = "strong" | "potential" | "risky" | "not-recommended";

function verdictToStatus(verdict: ApplyGateResult["verdict"]): VerdictStatus {
  if (verdict === "not_recommended") return "not-recommended";
  if (verdict === "risky") return "risky";
  if (verdict === "potential_fit") return "potential";
  return "strong";
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
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

function recommendationLabelForDecision(
  decision:
    | "apply_now"
    | "apply_with_caveats"
    | "fix_first"
    | "skip"
    | null
    | undefined,
  status: VerdictStatus,
) {
  if (decision === "apply_now") return "Apply now";
  if (decision === "apply_with_caveats") return "Apply with caveats";
  if (decision === "fix_first") return "Fix first";
  if (decision === "skip") return "Skip";
  if (status === "strong") return "Apply now";
  if (status === "potential") return "Apply with caveats";
  if (status === "risky") return "Fix first";
  return "Skip";
}

function confidenceLabel(value: "high" | "medium" | "low" | null | undefined) {
  if (value === "high") return "High confidence";
  if (value === "medium") return "Medium confidence";
  if (value === "low") return "Low confidence";
  return null;
}

function formatFractionPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatPointDelta(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pts`;
}

function buildOutcomeMemoryBrief({
  metrics,
  appStats,
  suggestionAnalytics,
}: {
  metrics?: {
    totalApplications: number;
    totalInterviewed: number;
    totalOffers: number;
    responseRate: number;
    interviewRate: number;
  };
  appStats?: {
    emails: {
      linked: number;
      total: number;
      ungrouped: number;
    };
  };
  suggestionAnalytics?: {
    followup: {
      summary: {
        shownApplications: number;
        completedApplications: number;
      };
      outcomes: {
        completed: {
          positiveRate: number;
        };
        ignored: {
          positiveRate: number;
        };
        observedLift: number;
      };
    };
    nonFollowup: {
      summary: {
        shownSuggestions: number;
        completedSuggestions: number;
        completionRate: number;
      };
      bySource: Array<{
        source: string;
        shown: number;
      }>;
    };
  };
}) {
  const followup = suggestionAnalytics?.followup;
  const nonFollowup = suggestionAnalytics?.nonFollowup;

  if ((followup?.summary.shownApplications || 0) >= 2) {
    const completedRate = followup?.outcomes.completed.positiveRate || 0;
    const ignoredRate = followup?.outcomes.ignored.positiveRate || 0;
    const observedLift = followup?.outcomes.observedLift || 0;
    const improved = observedLift >= 0.05;
    const lagging = observedLift <= -0.05;

    if (improved || lagging) {
      return {
        title: improved
          ? "Completed follow-ups are showing better outcomes"
          : "Follow-up quality needs a closer look",
        body: improved
          ? `Completed follow-up actions reached interviews or offers ${formatFractionPercent(completedRate)} of the time versus ${formatFractionPercent(ignoredRate)} when left untouched. Keep clearing the highest-signal outreach first.`
          : "Completed follow-up actions are not beating ignored suggestions yet. Review timing, message quality, and whether the right threads are getting attention.",
        stat: `Observed lift ${formatPointDelta(observedLift)}`,
        ctaLabel: "Review Outcome Memory",
      };
    }

    return {
      title: "Follow-up outcomes are still calibrating",
      body: `${followup?.summary.completedApplications || 0} of ${followup?.summary.shownApplications || 0} shown follow-up opportunities have been marked complete. Keep marking actions so the memory can separate useful habits from noise.`,
      stat: `Completed vs ignored ${formatPointDelta(observedLift)}`,
      ctaLabel: "Review Outcome Memory",
    };
  }

  if ((nonFollowup?.summary.shownSuggestions || 0) >= 2) {
    const topSource = nonFollowup?.bySource?.[0]?.source?.replace(/_/g, " ") || "fix work";
    return {
      title: "Fix work is becoming part of the memory",
      body: `${nonFollowup?.summary.completedSuggestions || 0} of ${nonFollowup?.summary.shownSuggestions || 0} Apply Gate, resume-proof, and cleanup tasks have been completed. ${topSource} is the biggest current source of fix work.`,
      stat: `${formatFractionPercent(nonFollowup?.summary.completionRate)} completion rate`,
      ctaLabel: "Open Outcome Memory",
    };
  }

  if (metrics && metrics.totalApplications > 0) {
    const callbacks = metrics.totalInterviewed + metrics.totalOffers;
    return {
      title: callbacks > 0 ? "Your search has early conversion signal" : "Your search memory is still warming up",
      body:
        callbacks > 0
          ? `${callbacks} callbacks are tracked from ${metrics.totalApplications} applications in this window. Use Apply Gate before the next batch so the system can learn which roles are worth repeating.`
          : `${metrics.totalApplications} applications are tracked in this window, but no callbacks are visible yet. Run Apply Gate and keep follow-up actions marked so the memory has better signal.`,
      stat: `Interview rate ${metrics.interviewRate.toFixed(1)}%`,
      ctaLabel: "Open Outcome Memory",
    };
  }

  if ((appStats?.emails.ungrouped || 0) > 0) {
    return {
      title: "Clean data will make the advisor sharper",
      body: `${appStats?.emails.ungrouped || 0} tracked emails are not linked to applications yet. Cleaning them up improves follow-up timing, outcome memory, and strategy alerts.`,
      stat: `${appStats?.emails.linked || 0} linked emails`,
      ctaLabel: "Open Outcome Memory",
    };
  }

  return {
    title: "Search memory starts with the next action",
    body: "Connect more application history, run Apply Gate before applying, and mark queue actions complete so Applendium can learn what is actually working.",
    stat: "Calibrating",
    ctaLabel: "Open Outcome Memory",
  };
}

function formatDecisionBrief(item: ApplyGateHistoryItem | null) {
  if (!item) return null;

  const status = verdictToStatus(item.verdict);
  const explanation = item.explanation_payload;
  const { role, company } = splitRoleAndCompany(item.job_title, item.company_name, item.job_url || null);
  const hardBlockers = (explanation?.hard_blockers || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const primaryDrivers = (explanation?.primary_rejection_drivers || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const roleCoreGaps = (explanation?.role_core_gaps || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const missingRequired = (explanation?.missing_required || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const missingPreferred = (explanation?.missing_preferred || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const evidenceGaps = (explanation?.evidence_gaps || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const capabilityGaps = (explanation?.capability_gaps || []).map((entry) => String(entry || "").trim()).filter(Boolean);
  const fitNotes = (explanation?.fit_notes || [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((note) => !isGenericStrategicFitNote(note));

  const blockingReasons = uniqueStrings(
    [
      ...hardBlockers,
      ...primaryDrivers,
      formatSkillGapSummary(roleCoreGaps, "Role-core gaps"),
      formatSkillGapSummary(missingRequired, "Missing required skills"),
      formatSkillGapSummary(missingPreferred, "Missing preferred skills"),
      formatSkillGapSummary(evidenceGaps, "Missing evidence"),
      formatSkillGapSummary(capabilityGaps, "Capability gaps"),
    ],
    3,
  );
  const supportingSignals = uniqueStrings(fitNotes, 2);
  const nextActions = uniqueStrings(
    [
      ...(explanation?.action_plan?.quick_fixes || []),
      ...(explanation?.action_plan?.resume_proof_improvements || []),
      ...(explanation?.action_plan?.long_term_gaps || []),
    ],
    3,
  );

  const showingRiskReasons = status === "risky" || status === "not-recommended";
  const reasonHeadline = showingRiskReasons ? "What is holding this back" : "Why this could be worth it";
  const reasons = showingRiskReasons
    ? blockingReasons
    : uniqueStrings([...supportingSignals, ...blockingReasons], 3);

  return {
    id: item.id,
    role,
    company,
    status,
    recommendation: recommendationLabelForDecision(explanation?.decision, status),
    confidence: confidenceLabel(explanation?.assessment_confidence),
    reasonHeadline,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            showingRiskReasons
              ? "Apply Gate flagged this role as risky, but the detailed blocker breakdown needs a fuller review."
              : "Run the full Apply Gate review to inspect the strongest fit signal and next action.",
          ],
    supportingSignals: showingRiskReasons ? supportingSignals : [],
    nextActions:
      nextActions.length > 0
        ? nextActions
        : ["Open Apply Gate and review the full recommendation before you decide."],
    ageLabel: formatRelativeAge(
      item.created_at ? Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86_400_000)) : null,
    ),
    isUnresolved: !item.user_action,
  };
}

const dashboardButtonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors";
const dashboardButtonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors";

const Dashboard = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    setSyncError(null);
    startEmailSync().catch((error) => {
      setSyncError(error instanceof Error ? error.message : "Unable to start email sync.");
    });
  }, [isAuthed]);

  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const applicationStatsQuery = useQuery({
    queryKey: ["dashboard", "application-stats"],
    queryFn: async () => {
      try {
        return await fetchApplicationStats();
      } catch (err) {
        return {
          success: false,
          stats: undefined,
          error: err instanceof Error ? err.message : "Unable to load application stats",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const suggestionAnalyticsQuery = useQuery({
    queryKey: ["dashboard", "suggestion-outcome-analytics"],
    queryFn: async () => {
      try {
        return await fetchSuggestionOutcomeAnalytics();
      } catch (err) {
        return {
          success: false,
          analytics: undefined,
          error: err instanceof Error ? err.message : "Unable to load outcome analytics",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const applyGateHistoryQuery = useQuery({
    queryKey: ["dashboard", "apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const strategyAlertsQuery = useQuery({
    queryKey: ["strategy-alerts", "dashboard"],
    queryFn: async () => {
      try {
        return await fetchStrategyAlerts();
      } catch (err) {
        return {
          success: false,
          alerts: [],
          error: err instanceof Error ? err.message : "Unable to load strategy alerts",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const queueQuery = useQuery({
    queryKey: ["dashboard", "queue"],
    queryFn: async () => {
      try {
        return await fetchRankedActionQueue();
      } catch (err) {
        return {
          success: false,
          queue: {
            now: new Date().toISOString(),
            doToday: [],
            thisWeek: [],
            later: [],
            blocked: [],
            dismissed: [],
            expired: [],
            done: [],
            emptyState: null,
            resolvedActions: [],
          },
          error: err instanceof Error ? err.message : "Unable to load the action queue",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 30_000,
  });

  const metrics = metricsQuery.data?.metrics;
  const outcomeMemoryBrief = useMemo(
    () =>
      buildOutcomeMemoryBrief({
        metrics,
        appStats: applicationStatsQuery.data?.stats,
        suggestionAnalytics: suggestionAnalyticsQuery.data?.analytics,
      }),
    [applicationStatsQuery.data?.stats, metrics, suggestionAnalyticsQuery.data?.analytics],
  );
  const appliedCount = metrics?.totalApplications;
  const callbacksCount = metrics ? metrics.totalInterviewed + metrics.totalOffers : undefined;
  const interviewsCount = metrics?.totalInterviewed;
  const responseRate = metrics ? `${metrics.responseRate.toFixed(1)}%` : "-";

  const applyGateHistory = useMemo(
    () => applyGateHistoryQuery.data?.history || [],
    [applyGateHistoryQuery.data],
  );
  const decisionSource = useMemo(() => {
    const unresolved = applyGateHistory.find((item) => !item.user_action);
    return unresolved || applyGateHistory[0] || null;
  }, [applyGateHistory]);
  const decisionBrief = useMemo(() => formatDecisionBrief(decisionSource), [decisionSource]);

  const recentItems = useMemo(
    () =>
      applyGateHistory.slice(0, 3).map((item) => {
        const { role, company } = splitRoleAndCompany(item.job_title, item.company_name, item.job_url);
        return {
          id: item.id,
          title: role,
          company,
          status: verdictToStatus(item.verdict),
        };
      }),
    [applyGateHistory],
  );

  const strategyAlerts = useMemo(
    () => strategyAlertsQuery.data?.alerts || [],
    [strategyAlertsQuery.data],
  );
  const strategyHighlights = useMemo(() => strategyAlerts.slice(0, 2), [strategyAlerts]);

  const rankedQueue = queueQuery.data?.queue || null;
  const activeQueue = useMemo(() => buildQueueItemsFromRankedQueue(rankedQueue), [rankedQueue]);
  const queueStats = useMemo(() => buildRankedQueueStats(rankedQueue), [rankedQueue]);
  const daqInboxQueue = useMemo(
    () => buildDaqV1InboxQueue(activeQueue),
    [activeQueue],
  );
  const daqStats = useMemo(
    () => ({
      active: daqInboxQueue.length,
      highPriority: daqInboxQueue.filter((item) => item.urgency === "high").length,
      totalMinutes: daqInboxQueue.reduce((sum, item) => {
        const match = item.estimatedTime.match(/(\d+)/);
        return sum + (match ? Number(match[1]) : 0);
      }, 0),
    }),
    [daqInboxQueue],
  );
  const todaysMoves = useMemo(
    () => daqInboxQueue.slice(0, 3),
    [daqInboxQueue],
  );
  const dataLoadErrors = [
    metricsQuery.isError ? `Metrics: ${metricsQuery.error instanceof Error ? metricsQuery.error.message : "Unable to load metrics"}` : null,
    applicationStatsQuery.data?.error ? `Applications: ${applicationStatsQuery.data.error}` : null,
    suggestionAnalyticsQuery.data?.error ? `Outcome analytics: ${suggestionAnalyticsQuery.data.error}` : null,
    applyGateHistoryQuery.isError ? `Apply Gate history: ${applyGateHistoryQuery.error instanceof Error ? applyGateHistoryQuery.error.message : "Unable to load Apply Gate history"}` : null,
    strategyAlertsQuery.data?.error ? `Strategy alerts: ${strategyAlertsQuery.data.error}` : null,
    queueQuery.data?.error ? `Action queue: ${queueQuery.data.error}` : null,
  ].filter(Boolean) as string[];
  const dataLoadWarnings = [
    syncError ? `Email sync: ${syncError}` : null,
  ].filter(Boolean) as string[];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Today's search brief</p>
          <h1 className="text-3xl font-bold text-foreground">Know what your inbox says needs attention today.</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Applendium uses read-only Gmail context to surface interview prep, recruiter replies, and follow-up windows before they get buried.
          </p>
        </div>

        {dataLoadErrors.length > 0 ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold text-destructive">Your dashboard data did not load.</p>
            <p className="mt-1 text-destructive/85">
              Premium access is active, but the backend could not read the job-search data for this session.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-destructive/85">
              {dataLoadErrors.slice(0, 4).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {dataLoadErrors.length === 0 && dataLoadWarnings.length > 0 ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <p className="font-semibold text-warning">Inbox refresh needs attention.</p>
            <p className="mt-1 text-warning/85">
              Existing dashboard data loaded, but the latest Gmail sync did not finish for this session.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-warning/85">
              {dataLoadWarnings.slice(0, 3).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Send} label="Applied" value={appliedCount ?? "-"} />
          <MetricCard icon={MessageSquare} label="Callbacks" value={callbacksCount ?? "-"} />
          <MetricCard icon={UserCheck} label="Interviews" value={interviewsCount ?? "-"} />
          <MetricCard
            icon={TrendingUp}
            label="Response Rate"
            value={responseRate}
            change={
              daqStats.active > 0
                ? `${daqStats.active} inbox action${daqStats.active === 1 ? "" : "s"} waiting`
                : queueStats.active > 0
                  ? `${queueStats.active} broader queue item${queueStats.active === 1 ? "" : "s"} waiting`
                  : "No active move queue right now"
            }
            changeType={daqStats.active > 0 || queueStats.active > 0 ? "neutral" : "positive"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="glass-card rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <Shield className="w-4 h-4" />
                  Next decision
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Decide whether to apply now, fix first, or skip before another application eats time.
                </p>
              </div>
              {decisionBrief?.status ? <StatusBadge status={decisionBrief.status} /> : null}
            </div>

            {!decisionBrief ? (
              <div className="rounded-xl border border-dashed border-border bg-background/40 p-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Check one target role and get a clear apply, fix, or skip recommendation before you spend time on the application.
                </p>
                <Link to="/apply-gate" className={dashboardButtonPrimary}>
                  <Shield className="w-4 h-4" />
                  Open Apply Gate
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-foreground">{decisionBrief.role}</h2>
                    <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      {decisionBrief.recommendation}
                    </span>
                    {decisionBrief.confidence ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {decisionBrief.confidence}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {decisionBrief.company ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-4 h-4" />
                        {decisionBrief.company}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="w-4 h-4" />
                      {decisionBrief.isUnresolved ? "Unresolved" : "Latest verdict"} - {decisionBrief.ageLabel}
                    </span>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{decisionBrief.reasonHeadline}</p>
                    <div className="space-y-2">
                      {decisionBrief.reasons.map((reason) => (
                        <div key={reason} className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          <p className="text-sm text-muted-foreground">{reason}</p>
                        </div>
                      ))}
                    </div>
                    {decisionBrief.supportingSignals?.length ? (
                      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          What still supports it
                        </p>
                        <div className="mt-2 space-y-2">
                          {decisionBrief.supportingSignals.map((signal: string) => (
                            <p key={signal} className="text-sm text-emerald-800">
                              • {signal}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Do this next</p>
                    <div className="space-y-2">
                      {decisionBrief.nextActions.map((action, index) => (
                        <div key={`${index}-${action}`} className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                            {index + 1}
                          </span>
                          <p className="text-sm text-muted-foreground">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to="/apply-gate" className={dashboardButtonPrimary}>
                    Review in Apply Gate
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/fix-suggestions" className={dashboardButtonSecondary}>
                    Open action queue
                  </Link>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <CheckSquare className="w-4 h-4" />
                    Daily Action Queue
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The premium inbox layer starts with the urgent moves that are easiest to trust: interviews, recruiter replies, and follow-ups.
                  </p>
                </div>
                <Link to="/fix-suggestions" className="text-sm text-accent hover:underline">
                  Full queue
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{daqStats.active}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">High priority</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{daqStats.highPriority}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clear time</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{daqStats.totalMinutes}m</p>
                </div>
              </div>

              <div className="space-y-3">
                {todaysMoves.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
                    No urgent inbox actions right now. The broader queue may still have Apply Gate, cleanup, or strategy work, but DAQ v1 stays focused on time-sensitive Gmail context.
                  </div>
                ) : (
                  todaysMoves.map((move) => <TodayMoveCard key={move.id} move={move} />)
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-accent">
                <Brain className="w-4 h-4" />
                Search memory
              </div>
              <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{outcomeMemoryBrief.title}</h3>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {outcomeMemoryBrief.stat}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{outcomeMemoryBrief.body}</p>
              </div>
              <Link to="/outcome-memory" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                {outcomeMemoryBrief.ctaLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-accent">
                <Bell className="w-4 h-4" />
                Strategy signal check
              </div>
              {strategyHighlights.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {!isAuthed
                    ? "Sign in to see strategy alerts."
                    : strategyAlertsQuery.data?.error?.includes("Premium feature required")
                      ? "Upgrade to Premium to see strategy alerts."
                      : "No strategy alerts yet."}
                </p>
              ) : (
                <div className="space-y-3">
                  {strategyHighlights.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-border/70 bg-background/50 p-3">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                      {alert.supporting_stat ? (
                        <p className="mt-2 text-xs font-medium text-foreground/80">{alert.supporting_stat}</p>
                      ) : null}
                    </div>
                  ))}
                  <Link to="/strategy-alerts" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                    Review all strategy alerts
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <Sparkles className="w-4 h-4" />
                  Recent screening history
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep the latest role checks nearby while the main brief stays focused on today's decision and next actions.
                </p>
              </div>
              <Link to="/apply-gate" className="text-sm text-accent hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {recentItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
                  {isAuthed ? "No recent Apply Gate results yet." : "Sign in to see recent Apply Gate results."}
                </div>
              ) : (
                recentItems.map((job) => (
                  <div key={job.id} className="rounded-xl border border-border/70 bg-background/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{job.title}</p>
                        {job.company ? (
                          <p className="text-xs text-muted-foreground mt-1">{job.company}</p>
                        ) : null}
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <Wrench className="w-4 h-4" />
              Quick links
            </div>
            <div className="space-y-2">
              {[
                { label: "Next Actions", to: "/fix-suggestions" },
                { label: "Outcome Memory", to: "/outcome-memory" },
                { label: "Strategy Alerts", to: "/strategy-alerts" },
                { label: "Weekly Summary", to: "/weekly-summary" },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm font-medium text-foreground hover:border-accent/30 hover:bg-background transition-colors"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

function TodayMoveCard({ move }: { move: QueueItem }) {
  const gmailUrl = move.source === "followup" || move.source === "stale" ? buildGmailThreadUrl(move.threadId) : null;
  const primaryHref = gmailUrl || move.routeHref || "/fix-suggestions";
  const primaryLabel = gmailUrl ? "Open in Gmail" : move.routeLabel || "Open queue";

  return (
    <article className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${urgencyClasses[move.urgency]}`}>
          {move.urgency.toUpperCase()}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${sourceClasses[move.source]}`}>
          {move.sourceLabel}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">{move.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{move.description}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {move.company ? (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            {move.company}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5" />
          {move.estimatedTime} - {formatRelativeAge(move.daysAgo)}
        </span>
      </div>

      {move.playbook[0] ? (
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First move</p>
          <p className="mt-1 text-sm text-muted-foreground">{move.playbook[0]}</p>
        </div>
      ) : null}

      {move.source === "followup" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Check the company and role in Gmail before sending; inbox details can lag behind your latest conversation.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {primaryHref.startsWith("http") ? (
          <a className={dashboardButtonPrimary} href={primaryHref} target="_blank" rel="noreferrer">
            {primaryLabel}
            <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <Link className={dashboardButtonPrimary} to={primaryHref}>
            {primaryLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        <Link className={dashboardButtonSecondary} to="/fix-suggestions">
          Full queue
        </Link>
      </div>
    </article>
  );
}

export default Dashboard;
