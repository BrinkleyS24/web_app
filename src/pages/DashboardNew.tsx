import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Brain,
  ChevronsUpDown,
  Clock3,
  Mail,
  RefreshCw,
  Shield,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardLayout } from "@/components/DashboardLayout";
import { FirstMoveCard } from "@/components/FirstMoveCard";
import { InterviewDebriefCards } from "@/components/InterviewDebriefCards";
import { StatusBadge } from "@/components/StatusBadge";
import { splitRoleAndCompany } from "@/lib/applyGateDisplay";
import { useAuth } from "@/lib/AuthContext.jsx";
import { buildDashboardAnswer } from "@/lib/dashboardAnswer";
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
  buildDashboardMoveQueue,
  buildQueueItemsFromRankedQueue,
  buildGmailThreadUrl,
  formatRelativeAge,
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
  cohortMetrics,
  appStats,
  suggestionAnalytics,
}: {
  cohortMetrics?: {
    applicationsSent: number;
    reachedInterview: number;
    reachedOffer: number;
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
    // Match the backend Strategy Alerts followupLiftThreshold (0.15): below this,
    // the lift is too weak to claim a correlation, so we stay neutral instead of
    // declaring "better outcomes" where the alert would stay silent.
    const FOLLOWUP_LIFT_THRESHOLD = 0.15;
    const improved = observedLift >= FOLLOWUP_LIFT_THRESHOLD;
    const lagging = observedLift <= -FOLLOWUP_LIFT_THRESHOLD;

    if (improved || lagging) {
      return {
        title: improved
          ? "Completed follow-ups are showing better outcomes"
          : "Follow-up quality needs a closer look",
        body: improved
          ? `Completed follow-up actions reached interviews or offers ${formatFractionPercent(completedRate)} of the time versus ${formatFractionPercent(ignoredRate)} when left untouched. Keep clearing the highest-signal outreach first.`
          : "Completed follow-up actions are not beating ignored suggestions yet. Review timing, message quality, and whether the right threads are getting attention.",
        stat: `${formatFractionPercent(completedRate)} vs ${formatFractionPercent(ignoredRate)}`,
        ctaLabel: "Review Outcome Memory",
      };
    }

    return {
      title: "Not enough follow-up results yet",
      body: `${followup?.summary.completedApplications || 0} of ${followup?.summary.shownApplications || 0} shown follow-up opportunities have been marked complete. Keep marking actions so the memory can separate useful habits from noise.`,
      stat: `${followup?.summary.completedApplications || 0} of ${followup?.summary.shownApplications || 0} marked done`,
      ctaLabel: "Review Outcome Memory",
    };
  }

  if ((nonFollowup?.summary.shownSuggestions || 0) >= 2) {
    const topSource = nonFollowup?.bySource?.[0]?.source?.replace(/_/g, " ") || "fix work";
    return {
      title: "Fix work is becoming part of the memory",
      body: `${nonFollowup?.summary.completedSuggestions || 0} of ${nonFollowup?.summary.shownSuggestions || 0} Apply Gate, resume gap, and cleanup tasks have been completed. ${topSource} is the biggest current source of fix work.`,
      stat: `${formatFractionPercent(nonFollowup?.summary.completionRate)} completion rate`,
      ctaLabel: "Open Outcome Memory",
    };
  }

  if (cohortMetrics && cohortMetrics.applicationsSent > 0) {
    const reached = cohortMetrics.reachedInterview;
    return {
      title: reached > 0 ? "Your applications are starting to reach interviews" : "Your search memory is still warming up",
      body:
        reached > 0
          ? `${reached} of ${cohortMetrics.applicationsSent} applications have reached an interview. Use Apply Gate before the next batch so the system can learn which roles are worth repeating.`
          : `${cohortMetrics.applicationsSent} applications are tracked, but none have reached an interview yet. Run Apply Gate and keep follow-up actions marked so the memory has better signal.`,
      stat: `Interview rate ${cohortMetrics.interviewRate.toFixed(1)}%`,
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
    stat: "Getting started",
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
              : "Run the full Apply Gate review to see how strong the fit is and what to do next.",
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
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent";
const dashboardButtonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary";
const dashboardEyebrow =
  "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground";

const Dashboard = () => {
  const { user } = useAuth();
  const [syncError, setSyncError] = useState<string | null>(null);
  const isAuthed = Boolean(user);

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

  const outcomeMemoryBrief = useMemo(
    () =>
      buildOutcomeMemoryBrief({
        cohortMetrics: metricsQuery.data?.cohortMetrics,
        appStats: applicationStatsQuery.data?.stats,
        suggestionAnalytics: suggestionAnalyticsQuery.data?.analytics,
      }),
    [applicationStatsQuery.data?.stats, metricsQuery.data?.cohortMetrics, suggestionAnalyticsQuery.data?.analytics],
  );
  // Headline tiles use the canonical all-time cohort metrics (one entry per distinct
  // application), so the numbers stay consistent across every premium page and the
  // interview rate is an honest cohort rate rather than a window-misaligned ratio.
  const cohortMetrics = metricsQuery.data?.cohortMetrics;
  const appliedCount = cohortMetrics?.applicationsSent;
  const interviewsCount = cohortMetrics?.reachedInterview;
  const offersCount = cohortMetrics?.reachedOffer;
  const interviewRate = cohortMetrics ? `${cohortMetrics.interviewRate.toFixed(1)}%` : "-";

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
  const strategyEmptyMessage = !isAuthed
    ? "Sign in to see strategy alerts."
    : strategyAlertsQuery.data?.error?.includes("Premium feature required")
      ? "Upgrade to Premium to see strategy alerts."
      : "No strategy alerts yet — keep applying and they'll surface here.";

  const rankedQueue = queueQuery.data?.queue || null;
  const activeQueue = useMemo(() => buildQueueItemsFromRankedQueue(rankedQueue), [rankedQueue]);
  const moveQueue = useMemo(() => buildDashboardMoveQueue(activeQueue), [activeQueue]);

  // The answer, and the single action that belongs to it.
  const answer = useMemo(
    () =>
      buildDashboardAnswer({
        alerts: strategyAlerts,
        cohortMetrics,
        alertsUnavailableMessage: strategyAlerts.length === 0 ? strategyEmptyMessage : null,
      }),
    [cohortMetrics, strategyAlerts, strategyEmptyMessage],
  );
  // Prefer the queue item generated FROM the answer's own alert (the generator ids those
  // `strategy:<alertId>`). Then the button under the claim is provably about that claim rather
  // than whatever happened to rank first — and when there is no such item we fall back to the
  // top of the queue and label it as such instead of implying a connection that isn't there.
  const answerMove = useMemo(
    () => (answer.alertId ? moveQueue.find((item) => item.id === `strategy:${answer.alertId}`) || null : null),
    [answer.alertId, moveQueue],
  );
  // When the answer is a question, the hero shows the debrief cards and consumes NO queue item.
  // Letting it claim one anyway would promote a move into a slot that never renders it and then
  // filter that same move out of "Next moves" below — the top of the user's queue would simply
  // vanish from the page on exactly the days we interrupt them with an ask.
  const asksInPlace = answer.debriefItems.length > 0;
  const heroMove = asksInPlace ? null : answerMove || moveQueue[0] || null;
  const nextMoves = useMemo(
    () => moveQueue.filter((item) => item.id !== heroMove?.id).slice(0, 3),
    [heroMove?.id, moveQueue],
  );
  // Alerts already spent on the hero must not appear again below it.
  const remainingAlerts = useMemo(
    () => strategyAlerts.filter((alert) => alert.id !== answer.alertId).slice(0, 2),
    [answer.alertId, strategyAlerts],
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

  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await startEmailSync();
      await queryClient.invalidateQueries();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Unable to sync Gmail.");
    } finally {
      setIsSyncing(false);
    }
  }

  const now = new Date();
  const greetingWord =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const rawName = String(user?.displayName || user?.email || "").split(/[@\s]/)[0];
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "";

  return (
    <DashboardLayout>
      <div className="space-y-3.5">
        {/* Greeting header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {dateLabel}
            </p>
            <h1 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-foreground">
              {greetingWord}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync Gmail"}
          </button>
        </div>

        <FirstMoveCard />

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

        {/* THE ANSWER. One claim, its evidence underneath, one action. Everything below this
            block is support for it, and everything that used to compete with it at equal weight
            is now either demoted to the stat strip or folded into "Everything else". */}
        <section className="glass-card overflow-hidden rounded-2xl">
          <div className="px-6 py-6 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={dashboardEyebrow}>What matters today</span>
              {answer.stat ? (
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
                  {answer.stat}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 max-w-[42ch] text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
              {answer.claim}
            </h2>
            {answer.evidence ? (
              <p className="mt-3 max-w-[72ch] text-[14px] leading-relaxed text-muted-foreground">
                {answer.evidence}
              </p>
            ) : null}

            {/* The advice, ALWAYS. This was an `else` branch behind heroMove, which meant the one
                sentence that answers "so what do I do about it" was dropped precisely when there
                was also an action to take. Founder's read: "it tells me the problem without giving
                me a solution." The claim is the diagnosis; this is the prescription; the button
                below is where you start. All three, or the screen is not coaching anybody. */}
            {answer.recommendation ? (
              <p className="mt-4 max-w-[72ch] rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
                {answer.recommendation}
              </p>
            ) : null}

            {/* When the answer is a QUESTION, the answering happens right here. Sending the user
                to another screen to supply the data this screen is blocked on is how the ask
                gets abandoned, and an unanswered ask leaves us advising from 17% visibility. */}
            {asksInPlace ? (
              <InterviewDebriefCards items={answer.debriefItems} total={answer.debriefTotal} />
            ) : heroMove ? (
              <div className="mt-5 space-y-2">
                <MoveLink move={heroMove} className={dashboardButtonPrimary}>
                  {heroMove.title}
                  <ArrowRight className="h-4 w-4" />
                </MoveLink>
                {/* Says which of the two it is. When the action came from the same alert as the
                    claim we can say so; when it is just the top of the queue, saying "start here"
                    would imply a connection to the claim that does not exist. */}
                <p className="text-[12px] leading-snug text-muted-foreground">
                  {answerMove
                    ? "This is the move for the read above."
                    : `Top of your queue right now · ${heroMove.sourceLabel}`}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* The numbers, demoted. They are evidence for the claim above, not the headline — a
            dashboard that opens with a count is asking the user to do the interpreting. */}
        <div className="glass-card flex flex-wrap items-baseline gap-x-7 gap-y-2 rounded-2xl px-5 py-3.5">
          {[
            { label: "Applications", value: appliedCount ?? "-" },
            // "Ever interviewed", not "Interviews": this counts applications that reached the
            // interview stage at any point, so an interview that later ended in a rejection
            // still counts here. The extension's Interviews tab shows CURRENT stage, which is
            // why the two legitimately differ — the labels now say which is which.
            { label: "Ever interviewed", value: interviewsCount ?? "-" },
            { label: "Offers", value: offersCount ?? "-" },
            { label: "Interview rate", value: interviewRate },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2">
              <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em] text-foreground">
                {stat.value}
              </span>
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Next moves. Drawn from the whole ranked queue in the backend's own priority order —
            see buildDashboardMoveQueue for why the inbox filter does not belong here. */}
        <section className="glass-card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">Next moves</h2>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-bold text-accent">
              {moveQueue.length} open
            </span>
          </div>
          {nextMoves.length === 0 ? (
            <div className="border-t border-border px-5 py-6 text-sm leading-6 text-muted-foreground">
              {heroMove
                ? "Nothing else is queued. The move above is the whole list right now."
                : "No queued moves right now. New ones appear as your inbox brings in replies and outcomes."}
            </div>
          ) : (
            nextMoves.map((move) => <QueueRow key={move.id} move={move} />)
          )}
          <Link
            to="/fix-suggestions"
            className="block border-t border-border px-5 py-3 text-[13px] font-semibold text-accent transition-colors hover:bg-muted/40"
          >
            View full queue &rarr;
          </Link>
        </section>

        {/* Everything else. One drawer, not three sections and two drawers. Nothing was deleted —
            the alerts, the verdict history, the decision brief and the memory brief all still
            render, they just no longer compete with the answer for the first read. */}
        <details className="group glass-card overflow-hidden rounded-2xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Everything else</span>
              <span className="text-[12px] text-muted-foreground">
                Alerts, recent verdicts, search memory
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>

          <div className="space-y-3.5 border-t border-border px-5 py-5">
            <div className="grid items-start gap-3.5 xl:grid-cols-2">
              {/* Strategy alerts the hero did not already use */}
              <div className="rounded-2xl bg-primary p-5">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#2FBE8F]">
                  Strategy alerts
                </span>
                {remainingAlerts.length === 0 ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                    {strategyAlerts.length > 0
                      ? "The read above is the only alert right now."
                      : strategyEmptyMessage}
                  </p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {remainingAlerts.map((alert) => (
                      <div key={alert.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[14.5px] font-semibold leading-snug text-white">{alert.title}</p>
                          {alert.supporting_stat ? (
                            <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] font-bold text-white/60">
                              {alert.supporting_stat}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  to="/strategy-alerts"
                  className="mt-3.5 inline-block text-[12.5px] font-semibold text-[#2FBE8F] hover:underline"
                >
                  Review alerts &rarr;
                </Link>
              </div>

              {/* Recent Apply Gate */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="px-5 py-3.5">
                  <h2 className="text-sm font-bold text-foreground">Recent Apply Gate</h2>
                </div>
                {recentItems.length === 0 ? (
                  <div className="border-t border-border px-5 py-3.5 text-sm text-muted-foreground">
                    {isAuthed ? "No recent Apply Gate results yet." : "Sign in to see recent results."}
                  </div>
                ) : (
                  recentItems.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 border-t border-border px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {job.title}
                          {job.company ? <span className="text-muted-foreground"> &middot; {job.company}</span> : null}
                        </div>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  ))
                )}
                <Link
                  to="/apply-gate"
                  className="block border-t border-border px-5 py-3 text-[12.5px] font-semibold text-accent transition-colors hover:bg-muted/40"
                >
                  Open Apply Gate &rarr;
                </Link>
              </div>
            </div>

            <section className="space-y-5 rounded-2xl border border-border bg-card px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={dashboardEyebrow}>Next decision</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Decide whether to apply now, fix first, or skip before another application eats time.
                  </p>
                </div>
                {decisionBrief?.status ? <StatusBadge status={decisionBrief.status} /> : null}
              </div>

              {!decisionBrief ? (
                <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-5">
                  <p className="text-sm text-muted-foreground">
                    Check one target role and get a clear apply, fix, or skip recommendation before you spend time on the application.
                  </p>
                  <Link to="/apply-gate" className={dashboardButtonPrimary}>
                    <Shield className="h-4 w-4" />
                    Open Apply Gate
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold tracking-[-0.02em] text-foreground">{decisionBrief.role}</h2>
                      <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        {decisionBrief.recommendation}
                      </span>
                      {decisionBrief.confidence ? (
                        <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {decisionBrief.confidence}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {decisionBrief.company ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-4 w-4" />
                          {decisionBrief.company}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" />
                        {decisionBrief.isUnresolved ? "Unresolved" : "Latest verdict"} - {decisionBrief.ageLabel}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        {decisionBrief.reasonHeadline}
                      </p>
                      <div className="space-y-2">
                        {decisionBrief.reasons.map((reason) => (
                          <div key={reason} className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <p className="text-sm text-muted-foreground">{reason}</p>
                          </div>
                        ))}
                      </div>
                      {decisionBrief.supportingSignals?.length ? (
                        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-3">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                            What still supports it
                          </p>
                          <div className="mt-2 space-y-2">
                            {decisionBrief.supportingSignals.map((signal: string) => (
                              <p key={signal} className="text-sm text-foreground/80">
                                &bull; {signal}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Do this next
                      </p>
                      <div className="space-y-2">
                        {decisionBrief.nextActions.map((action, index) => (
                          <div key={`${index}-${action}`} className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
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
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/fix-suggestions" className={dashboardButtonSecondary}>
                      Open action queue
                    </Link>
                  </div>
                </>
              )}
            </section>

            <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-accent" />
                  <span className={dashboardEyebrow}>Search memory</span>
                </div>
                <div className="mt-3 rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground">{outcomeMemoryBrief.title}</h3>
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
                      {outcomeMemoryBrief.stat}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{outcomeMemoryBrief.body}</p>
                </div>
                <Link
                  to="/outcome-memory"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                >
                  {outcomeMemoryBrief.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-accent" />
                  <span className={dashboardEyebrow}>Quick links</span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Next Actions", to: "/fix-suggestions" },
                    { label: "Outcome Memory", to: "/outcome-memory" },
                    { label: "Strategy Alerts", to: "/strategy-alerts" },
                    { label: "Weekly Summary", to: "/weekly-summary" },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/40 hover:bg-card"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
};

/**
 * Where a queue item actually goes.
 *
 * Shared by the hero button and the queue rows so the same item can never send the user to two
 * different places depending on which slot it rendered in. Only follow-up and stale items own a
 * Gmail thread worth opening directly; everything else is work done inside the app.
 */
function resolveMoveTarget(move: QueueItem) {
  const gmailUrl =
    move.source === "followup" || move.source === "stale" ? buildGmailThreadUrl(move.threadId) : null;
  const href = gmailUrl || move.routeHref || "/fix-suggestions";
  return { href, isExternal: href.startsWith("http"), isGmail: Boolean(gmailUrl) };
}

/** The hero's single action. Same destination logic as a queue row, styled as the primary button. */
function MoveLink({
  move,
  className,
  children,
}: {
  move: QueueItem;
  className?: string;
  children: React.ReactNode;
}) {
  const { href, isExternal } = resolveMoveTarget(move);

  return isExternal ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function QueueRow({ move }: { move: QueueItem }) {
  const { href, isExternal, isGmail } = resolveMoveTarget(move);
  const actionLabel = isGmail ? "Open in Gmail ↗" : "Open";

  const inner = (
    <>
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${urgencyClasses[move.urgency]}`}
      >
        {move.urgency}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-semibold text-foreground">{move.title}</h3>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{move.description}</p>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">
          {move.sourceLabel} &middot; {formatRelativeAge(move.daysAgo)}
        </p>
      </div>
      <span className="mt-0.5 shrink-0 whitespace-nowrap text-[12px] font-semibold text-accent">{actionLabel}</span>
    </>
  );

  const cls = "flex items-start gap-3 border-t border-border px-5 py-3.5 transition-colors hover:bg-muted/40";

  return isExternal ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={href} className={cls}>
      {inner}
    </Link>
  );
}

export default Dashboard;
