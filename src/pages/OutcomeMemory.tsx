import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Brain, TrendingUp, Building2, Clock, Briefcase } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchApplicationStats, fetchEmailMetrics, fetchSuggestionOutcomeAnalytics } from "@/lib/emails";

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

  const metrics = metricsQuery.data?.metrics;
  const appStats = statsQuery.data?.stats;
  const suggestionAnalytics = suggestionAnalyticsQuery.data?.analytics;

  const stats = useMemo(() => {
    return [
      { label: "Total Applications", value: metrics?.totalApplications ?? "-" },
      { label: "Callbacks", value: metrics ? metrics.totalInterviewed + metrics.totalOffers : "-" },
      { label: "Interviews", value: metrics?.totalInterviewed ?? "-" },
      { label: "Rejected", value: metrics?.totalRejected ?? "-" },
    ];
  }, [metrics]);

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
        { label: "Observed lift", value: "-" },
      ];
    }

    return [
      { label: "Suggestions shown", value: suggestionAnalytics.summary.shownApplications },
      { label: "Completed", value: `${(suggestionAnalytics.summary.completedRate * 100).toFixed(1)}%` },
      { label: "Positive outcomes", value: `${(suggestionAnalytics.summary.positiveOutcomeRate * 100).toFixed(1)}%` },
      { label: "Observed lift", value: `${(suggestionAnalytics.outcomes.observedLift * 100).toFixed(1)} pts` },
    ];
  }, [suggestionAnalytics]);

  const suggestionInsights = useMemo(() => {
    if (!suggestionAnalytics) {
      return [];
    }

    const topActionTypes = suggestionAnalytics.byActionType.slice(0, 3);
    return [
      `Completed suggestions converted to interviews/offers ${(
        suggestionAnalytics.outcomes.completed.positiveRate * 100
      ).toFixed(1)}% of the time.`,
      `Ignored suggestions converted to interviews/offers ${(
        suggestionAnalytics.outcomes.ignored.positiveRate * 100
      ).toFixed(1)}% of the time.`,
      ...topActionTypes.map(
        (item) =>
          `${item.actionType.replace(/_/g, " ")}: ${item.completed}/${item.shown} completed, ${(
            item.positiveOutcomeRate * 100
          ).toFixed(1)}% positive outcomes.`,
      ),
    ];
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

            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Suggestion Outcome Loop</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {suggestionFunnelStats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-background/40 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
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
