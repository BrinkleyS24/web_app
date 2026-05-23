import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Brain, TrendingUp, Building2, Clock, Briefcase, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  fetchApplicationStats,
  fetchEmailMetrics,
  fetchRejectionInsights,
  fetchSuggestionOutcomeAnalytics,
} from "@/lib/emails";

const OutcomeMemory = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

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

  const rejectionInsightsQuery = useQuery({
    queryKey: ["outcome-memory", "rejection-insights"],
    queryFn: async () => {
      try {
        return await fetchRejectionInsights(100);
      } catch {
        return { success: false, analyzedRejections: 0, patterns: [] };
      }
    },
    enabled: isAuthed,
    staleTime: 5 * 60_000,
  });

  const metrics = metricsQuery.data?.metrics;
  const appStats = statsQuery.data?.stats;
  const suggestionAnalytics = suggestionAnalyticsQuery.data?.analytics;
  const rejectionInsights = rejectionInsightsQuery.data;

  // Top cards use application-level counts (one row per tracked application,
  // closed apps excluded) so they agree with the Chrome extension's pipeline
  // counts. Email-category counts (used below for rates) are different by
  // design — one application can produce several rejection/interview emails.
  const stats = useMemo(() => {
    const apps = appStats?.applications;
    return [
      { label: "Applications", value: apps?.applied ?? "-" },
      {
        label: "Callbacks",
        value: apps ? apps.interviewed + apps.offered : "-",
      },
      { label: "Interviews", value: apps?.interviewed ?? "-" },
      { label: "Rejected", value: apps?.rejected ?? "-" },
    ];
  }, [appStats]);

  const insights = useMemo(() => {
    if (!metrics) return {};

    const responseRate = metrics.responseRate.toFixed(1);
    const interviewRate = metrics.interviewRate.toFixed(1);
    const offerRate = metrics.offerRate.toFixed(1);
    const rejectionRate = metrics.rejectionRate.toFixed(1);

    const linked = appStats?.emails.linked ?? 0;
    const totalEmails = appStats?.emails.total ?? metrics.totalEmails ?? 0;
    const ungrouped = appStats?.emails.ungrouped ?? Math.max(0, totalEmails - linked);
    const linkedRatio = totalEmails > 0 ? ((linked / totalEmails) * 100).toFixed(1) : "0.0";

    return {
      "Response Signals": [
        { text: `Response rate is ${responseRate}%.`, icon: TrendingUp },
        { text: `Interview rate is ${interviewRate}% of applications.`, icon: TrendingUp },
        { text: `Offer rate is ${offerRate}% of applications.`, icon: TrendingUp },
      ],
      "Pipeline Health": [
        { text: `${ungrouped} emails are not linked to applications.`, icon: Building2 },
        { text: `${linkedRatio}% of emails are linked to applications.`, icon: Building2 },
        { text: `Rejection rate is ${rejectionRate}%.`, icon: Building2 },
      ],
      "Timing and Volume": [
        { text: `Total tracked emails: ${metrics.totalEmails}.`, icon: Clock },
        { text: `Applied: ${metrics.totalApplications} - Interviews: ${metrics.totalInterviewed} - Offers: ${metrics.totalOffers}.`, icon: Clock },
      ],
      "Key Signals": [
        { text: "Use interview rate to refine which roles convert best.", icon: Briefcase },
        { text: "Track unlinked emails to improve application grouping.", icon: Briefcase },
      ],
    };
  }, [appStats, metrics]);

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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent" />
            Outcome Memory
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Patterns and signals from all your applications.</p>
        </div>

        {!isAuthed ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            Sign in to see outcome insights.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Counts are per tracked application (closed applications excluded) — the same numbers shown in the Chrome extension. Email-level totals in rates and themes below can be higher because one application often produces several emails.
            </p>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Rejection themes from your inbox
                </h3>
                {rejectionInsights && rejectionInsights.analyzedRejections > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {rejectionInsights.analyzedRejections} rejection email
                    {rejectionInsights.analyzedRejections === 1 ? "" : "s"} analyzed
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Patterns mined from the actual text of your rejection emails. Surfaces only when the same gap appears in two or more rejections.
              </p>
              {!rejectionInsights || rejectionInsights.patterns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {rejectionInsights && rejectionInsights.analyzedRejections > 0
                    ? `Analyzed ${rejectionInsights.analyzedRejections} rejection email${rejectionInsights.analyzedRejections === 1 ? "" : "s"} but no theme appears in 2+ rejections yet. As more rejections accumulate, recurring gaps will show up here.`
                    : "No rejection emails detected yet. As they come in, recurring themes recruiters cite will appear here."}
                </p>
              ) : (
                <div className="space-y-3">
                  {rejectionInsights.patterns.map((pattern, index) => (
                    <div
                      key={`${pattern.category}-${pattern.phrase}-${index}`}
                      className="rounded-xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {pattern.label}
                          </p>
                          <p className="text-base font-semibold text-foreground mt-1 break-words">
                            "{pattern.phrase}"
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                          {pattern.occurrences}× in rejections
                        </span>
                      </div>
                      {pattern.examples.length > 0 ? (
                        <ul className="mt-3 space-y-1.5">
                          {pattern.examples.map((example, exIdx) => (
                            <li
                              key={`${pattern.phrase}-ex-${exIdx}`}
                              className="text-xs text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {example.company || "Unknown company"}
                              </span>
                              {example.position ? ` — ${example.position}` : ""}
                              {example.subject ? ` · "${example.subject}"` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-xl p-5">
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

            <div className="glass-card rounded-xl p-5">
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
                <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
                  Loading insights...
                </div>
              ) : (
                Object.entries(insights).map(([group, items], gi) => (
                  <div key={group} className="glass-card rounded-xl p-5 animate-fade-in" style={{ animationDelay: gi * 80 + "ms" }}>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OutcomeMemory;
