import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
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
  fetchApplyGateHistory,
  fetchEmailMetrics,
  fetchFollowupSuggestions,
  fetchStoredEmails,
  fetchStrategyAlerts,
  fetchSuggestionActionStates,
  recordSuggestionImpressions,
  startEmailSync,
  type ApplyGateHistoryItem,
  type ApplyGateResult,
} from "@/lib/emails";
import {
  buildCombinedSuggestionQueue,
  buildGmailThreadUrl,
  buildSuggestionImpressionPayload,
  buildSuggestionQueueStats,
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
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    startEmailSync().catch(() => undefined);
  }, [isAuthed]);

  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    enabled: isAuthed,
    staleTime: 60_000,
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

  const followupQuery = useQuery({
    queryKey: ["dashboard", "followup-suggestions"],
    queryFn: async () => {
      try {
        return await fetchFollowupSuggestions();
      } catch (err) {
        return {
          success: false,
          suggestions: [],
          error: err instanceof Error ? err.message : "Unable to load follow-up suggestions",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const statesQuery = useQuery({
    queryKey: ["dashboard", "suggestion-states"],
    queryFn: async () => {
      try {
        return await fetchSuggestionActionStates();
      } catch (err) {
        return {
          success: false,
          actions: [],
          error: err instanceof Error ? err.message : "Unable to load suggestion states",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const storedEmailsQuery = useQuery({
    queryKey: ["dashboard", "stored-emails"],
    queryFn: async () => {
      try {
        return await fetchStoredEmails({ limit: 200, offset: 0 });
      } catch (err) {
        return {
          success: false,
          emails: [],
          error: err instanceof Error ? err.message : "Unable to load tracked emails",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const metrics = metricsQuery.data?.metrics;
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

  const activeQueue = useMemo(
    () =>
      buildCombinedSuggestionQueue({
        followupSuggestions: followupQuery.data?.suggestions || [],
        applyGateHistory,
        storedEmails: storedEmailsQuery.data?.emails || [],
        actionStates: statesQuery.data?.actions || [],
      }),
    [applyGateHistory, followupQuery.data, statesQuery.data, storedEmailsQuery.data],
  );
  const queueStats = useMemo(
    () => buildSuggestionQueueStats(activeQueue, statesQuery.data?.actions || []),
    [activeQueue, statesQuery.data],
  );
  const todaysMoves = useMemo(() => activeQueue.slice(0, 3), [activeQueue]);

  useEffect(() => {
    if (!isAuthed || todaysMoves.length === 0) return;
    const suggestions = buildSuggestionImpressionPayload(todaysMoves);
    if (suggestions.length === 0) return;
    recordSuggestionImpressions({ suggestions }).catch(() => undefined);
  }, [isAuthed, todaysMoves]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Premium workspace</p>
          <h1 className="text-3xl font-bold text-foreground">One better decision, then the next three moves.</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Premium should tell you whether to push forward, what to fix first, and what deserves attention today across follow-ups, job-fit gaps, resume proof, and cleanup work.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Send} label="Applied" value={appliedCount ?? "-"} />
          <MetricCard icon={MessageSquare} label="Callbacks" value={callbacksCount ?? "-"} />
          <MetricCard icon={UserCheck} label="Interviews" value={interviewsCount ?? "-"} />
          <MetricCard
            icon={TrendingUp}
            label="Response Rate"
            value={responseRate}
            change={
              queueStats.active > 0
                ? `${queueStats.active} active moves waiting`
                : "No active move queue right now"
            }
            changeType={queueStats.active > 0 ? "neutral" : "positive"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="glass-card rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <Shield className="w-4 h-4" />
                  Decision Brief
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your next premium decision should be explicit: apply now, apply with caveats, fix first, or skip.
                </p>
              </div>
              {decisionBrief?.status ? <StatusBadge status={decisionBrief.status} /> : null}
            </div>

            {!decisionBrief ? (
              <div className="rounded-xl border border-dashed border-border bg-background/40 p-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Run Apply Gate on one target role and this card will turn that analysis into a single recommendation with the top reasons and next steps.
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
                    Open fix queue
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
                    Today's 3 moves
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The queue is already telling you what matters. This surfaces the top three moves instead of making you sift through five separate pages first.
                  </p>
                </div>
                <Link to="/fix-suggestions" className="text-sm text-accent hover:underline">
                  Full queue
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{queueStats.active}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">High priority</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{queueStats.highPriority}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clear time</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{queueStats.totalMinutes}m</p>
                </div>
              </div>

              <div className="space-y-3">
                {todaysMoves.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
                    No active moves right now. Premium gets stronger once Apply Gate, follow-up timing, and cleanup work have more history to rank.
                  </div>
                ) : (
                  todaysMoves.map((move) => <TodayMoveCard key={move.id} move={move} />)
                )}
              </div>
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
                  The last few Apply Gate verdicts should still be one click away while the premium dashboard stays focused on decisions and actions.
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
                { label: "Fix Suggestions", to: "/fix-suggestions" },
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
  const gmailUrl = move.source === "followup" ? buildGmailThreadUrl(move.threadId) : null;
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
