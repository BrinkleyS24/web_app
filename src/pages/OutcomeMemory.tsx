import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { TrendingUp, Building2, Clock, Briefcase } from "lucide-react";
import { useAuth } from "@/lib/AuthContext.jsx";
import {
  fetchApplicationStats,
  fetchEmailMetrics,
  fetchResumeGaps,
  fetchSuggestionOutcomeAnalytics,
} from "@/lib/emails";

const OutcomeMemory = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  const metricsQuery = useQuery({
    queryKey: ["outcome-memory", "metrics"],
    queryFn: () => fetchEmailMetrics("all_time"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ["outcome-memory", "application-stats"],
    queryFn: () => fetchApplicationStats(),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const suggestionAnalyticsQuery = useQuery({
    queryKey: ["outcome-memory", "suggestion-analytics"],
    queryFn: async () => {
      try {
        return await fetchSuggestionOutcomeAnalytics();
      } catch (err) {
        return {
          success: false,
          analytics: undefined,
        };
      }
    },
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const resumeGapsQuery = useQuery({
    queryKey: ["outcome-memory", "resume-gaps"],
    queryFn: async () => {
      try {
        return await fetchResumeGaps();
      } catch {
        return {
          success: false,
          analyzedVerdicts: 0,
          distinctRolesEvaluated: 0,
          verdictsWithGapData: 0,
          gaps: [],
        };
      }
    },
    enabled: isAuthed,
    staleTime: 5 * 60_000,
  });

  const metrics = metricsQuery.data?.metrics;
  const cohortMetrics = metricsQuery.data?.cohortMetrics;
  const appStats = statsQuery.data?.stats;
  const suggestionAnalytics = suggestionAnalyticsQuery.data?.analytics;
  const resumeGaps = resumeGapsQuery.data;

  // Top cards use the canonical all-time cohort metrics (one entry per distinct
  // application, computed from the emails table) so they stay consistent with the
  // Dashboard AND with the rates shown below — no more "Rejected 0" next to a
  // non-zero rejection rate.
  const stats = useMemo(() => {
    return [
      { label: "Applications", value: cohortMetrics?.applicationsSent ?? "-" },
      { label: "Reached interview", value: cohortMetrics?.reachedInterview ?? "-" },
      { label: "Offers", value: cohortMetrics?.reachedOffer ?? "-" },
      { label: "Rejected", value: cohortMetrics?.rejectedCohorts ?? "-" },
    ];
  }, [cohortMetrics]);

  const insights = useMemo(() => {
    if (!cohortMetrics) return {};

    // All rates are canonical all-time cohort rates, so they agree with the top
    // tiles and across pages (one application = one cohort).
    const interviewRate = cohortMetrics.interviewRate.toFixed(1);
    const offerRate = cohortMetrics.offerRate.toFixed(1);
    const rejectionRate = cohortMetrics.rejectionRate.toFixed(1);

    const linked = appStats?.emails.linked ?? 0;
    const totalEmails = appStats?.emails.total ?? metrics?.totalEmails ?? 0;
    const ungrouped = appStats?.emails.ungrouped ?? Math.max(0, totalEmails - linked);
    const linkedRatio = totalEmails > 0 ? ((linked / totalEmails) * 100).toFixed(1) : "0.0";

    return {
      "Response Signals": [
        { text: `${cohortMetrics.reachedInterview} of ${cohortMetrics.applicationsSent} applications reached an interview.`, icon: TrendingUp },
        { text: `Interview rate is ${interviewRate}% of applications.`, icon: TrendingUp },
        { text: `Offer rate is ${offerRate}% of applications.`, icon: TrendingUp },
      ],
      "Pipeline Health": [
        { text: `${ungrouped} emails are not linked to applications.`, icon: Building2 },
        { text: `${linkedRatio}% of emails are linked to applications.`, icon: Building2 },
        { text: `Rejection rate is ${rejectionRate}% of applications.`, icon: Building2 },
      ],
      "Timing and Volume": [
        { text: `Total tracked emails: ${metrics?.totalEmails ?? totalEmails}.`, icon: Clock },
        { text: `Applications: ${cohortMetrics.applicationsSent} - Reached interview: ${cohortMetrics.reachedInterview} - Offers: ${cohortMetrics.reachedOffer}.`, icon: Clock },
      ],
      "Key Signals": [
        { text: "Use interview rate to refine which roles convert best.", icon: Briefcase },
        { text: "Track unlinked emails to improve application grouping.", icon: Briefcase },
      ],
    };
  }, [appStats, cohortMetrics, metrics]);

  const suggestionFunnelStats = useMemo(() => {
    if (!suggestionAnalytics) {
      return [
        { label: "Suggestions shown", value: "-" },
        { label: "Completed", value: "-" },
        { label: "Positive outcomes", value: "-" },
        { label: "Outcome gap", value: "-" },
      ];
    }

    return [
      { label: "Suggestions shown", value: suggestionAnalytics.followup.summary.shownApplications },
      { label: "Completed", value: `${(suggestionAnalytics.followup.summary.completedRate * 100).toFixed(1)}%` },
      { label: "Positive outcomes", value: `${(suggestionAnalytics.followup.summary.positiveOutcomeRate * 100).toFixed(1)}%` },
      { label: "Outcome gap", value: `${(suggestionAnalytics.followup.outcomes.observedLift * 100).toFixed(1)} pts` },
    ];
  }, [suggestionAnalytics]);

  const suggestionInsights = useMemo(() => {
    if (!suggestionAnalytics) {
      return [];
    }

    const completedSample = suggestionAnalytics.followup.outcomes.completed.applications;
    const ignoredSample = suggestionAnalytics.followup.outcomes.ignored.applications;
    const topActionTypes = suggestionAnalytics.followup.byActionType.slice(0, 3);

    return [
      `Completed suggestions: ${(
        suggestionAnalytics.followup.outcomes.completed.positiveRate * 100
      ).toFixed(1)}% positive outcomes (n=${completedSample}).`,
      `Ignored suggestions: ${(
        suggestionAnalytics.followup.outcomes.ignored.positiveRate * 100
      ).toFixed(1)}% positive outcomes (n=${ignoredSample}).`,
      ...topActionTypes.map(
        (item) =>
          `${item.actionType.replace(/_/g, " ")}: ${item.completed}/${item.shown} completed, ${(
            item.positiveOutcomeRate * 100
          ).toFixed(1)}% positive outcomes.`,
      ),
    ];
  }, [suggestionAnalytics]);

  const outcomeGapSampleWarning = useMemo(() => {
    if (!suggestionAnalytics) return null;
    const completedSample = suggestionAnalytics.followup.outcomes.completed.applications;
    const ignoredSample = suggestionAnalytics.followup.outcomes.ignored.applications;
    if (completedSample < 5 || ignoredSample < 5) {
      return `Sample is small (${completedSample} completed, ${ignoredSample} ignored). The gap is descriptive, not predictive yet.`;
    }
    return null;
  }, [suggestionAnalytics]);

  const nonFollowupCompletionStats = useMemo(() => {
    if (!suggestionAnalytics) {
      return [
        { label: "Fixes shown", value: "-" },
        { label: "Completed", value: "-" },
        { label: "Snoozed", value: "-" },
        { label: "Still active", value: "-" },
      ];
    }

    return [
      { label: "Fixes shown", value: suggestionAnalytics.nonFollowup.summary.shownSuggestions },
      { label: "Completed", value: `${(suggestionAnalytics.nonFollowup.summary.completionRate * 100).toFixed(1)}%` },
      { label: "Snoozed", value: suggestionAnalytics.nonFollowup.summary.snoozedSuggestions },
      { label: "Still active", value: suggestionAnalytics.nonFollowup.summary.activeSuggestions },
    ];
  }, [suggestionAnalytics]);

  const nonFollowupBreakdown = useMemo(() => {
    if (!suggestionAnalytics) return [];
    return suggestionAnalytics.nonFollowup.bySource.slice(0, 4).map((item) => {
      const sourceLabel = item.source.replace(/_/g, " ");
      return `${sourceLabel}: ${item.completed}/${item.shown} completed, ${item.snoozed} snoozed, ${item.active} still active.`;
    });
  }, [suggestionAnalytics]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            What keeps happening
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-foreground">Outcome Memory</h1>
          <p className="mt-2.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Patterns across your rejections and stalls — so the same gap stops costing you interviews.
          </p>
        </div>

        {!isAuthed ? (
          <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
            Sign in to see outcome insights.
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Recurring resume gaps
                </p>
                {resumeGaps && resumeGaps.distinctRolesEvaluated > 0 ? (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {resumeGaps.distinctRolesEvaluated} role
                    {resumeGaps.distinctRolesEvaluated === 1 ? "" : "s"} run through Apply Gate
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                Pulled from your Apply Gate runs — the requirements that came up in two or more different roles you evaluated, where your resume didn't show the proof. These are the gaps worth closing first.
              </p>

              {!resumeGaps || resumeGaps.gaps.length === 0 ? (
                <div className="mt-4">
                  {resumeGaps && resumeGaps.distinctRolesEvaluated >= 2 ? (
                    // Caught-up: they've evaluated roles, nothing recurring — reassure, don't push.
                    <PremiumEmptyState
                      title="Nothing systemic to flag yet"
                      body={`No single requirement has recurred across two or more of your ${resumeGaps.distinctRolesEvaluated} evaluated roles. Apply Gate still shows the per-role gaps when you run a specific posting.`}
                    />
                  ) : (
                    // Cold-start: too few evaluated roles to detect a pattern → give the next move.
                    <PremiumEmptyState
                      icon={TrendingUp}
                      title="Run a few roles through Apply Gate"
                      body="Once a requirement you're missing shows up across two or more roles, it'll surface here as a recurring resume gap worth closing first."
                      cta={{ label: "Run Apply Gate", to: "/apply-gate" }}
                    />
                  )}
                </div>
              ) : (
                <div className="mt-4 grid gap-3.5">
                  {resumeGaps.gaps.map((gap, index) => {
                    const severe = gap.occurrences >= 3;
                    return (
                      <div
                        key={`${gap.category}-${gap.skill}-${index}`}
                        className="glass-card rounded-2xl p-5 sm:p-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="text-base font-bold tracking-[-0.01em] text-foreground break-words">
                            "{gap.skill}"
                          </h2>
                          <span
                            className={`shrink-0 rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${
                              severe ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                            }`}
                          >
                            Seen {gap.occurrences}&times;
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {gap.label}
                        </p>
                        {gap.examples.length > 0 ? (
                          <div className="mt-3.5 flex flex-wrap gap-1.5">
                            {gap.examples.map((example, exIdx) => (
                              <span
                                key={`${gap.skill}-ex-${exIdx}`}
                                className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground"
                              >
                                {example.company || "Unknown company"}
                                {example.position ? ` · ${example.position}` : ""}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <details className="group">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  Detailed analytics &amp; loops
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">expand</span>
              </summary>
              <div className="mt-3.5 space-y-3.5">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-5">
                  <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.03em] text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Counts are per tracked application (closed applications excluded) — the same numbers shown in the Chrome extension. Email-level totals in rates and themes below can be higher because one application often produces several emails.
            </p>
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Suggestion Outcome Loop</h3>
              <p className="text-xs text-muted-foreground mb-4">
                The outcome gap is the difference in positive-outcome rate between applications where you completed a suggestion vs. ignored one. It's a correlation, not proof of causation — completers may differ in ways beyond the suggestion itself.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {suggestionFunnelStats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-background/40 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              {outcomeGapSampleWarning ? (
                <p className="mt-3 text-xs italic text-yellow-700 dark:text-yellow-300">
                  {outcomeGapSampleWarning}
                </p>
              ) : null}
              <div className="mt-4 space-y-2.5">
                {suggestionInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No suggestion outcome data yet. This section fills in after suggestions are shown and applications resolve to outcomes.
                  </p>
                ) : (
                  suggestionInsights.map((item, index) => (
                    <div key={`suggestion-insight-${index}`} className="flex items-start gap-3">
                      <TrendingUp className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Non-follow-up Fix Completion</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {nonFollowupCompletionStats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-background/40 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {nonFollowupBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Apply Gate, resume gap, or cleanup completion history yet.
                  </p>
                ) : (
                  nonFollowupBreakdown.map((item, index) => (
                    <div key={`non-followup-insight-${index}`} className="flex items-start gap-3">
                      <TrendingUp className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-5">
              {Object.keys(insights).length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
                  Loading insights...
                </div>
              ) : (
                Object.entries(insights).map(([group, items], gi) => (
                  <div key={group} className="glass-card rounded-2xl p-5 animate-fade-in" style={{ animationDelay: gi * 80 + "ms" }}>
                    <h3 className="text-sm font-semibold text-foreground mb-3">{group}</h3>
                    <div className="space-y-2.5">
                      {items.map((item, j) => (
                        <div key={`${group}-${j}`} className="flex items-start gap-3">
                          <item.icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
              </div>
            </details>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OutcomeMemory;
