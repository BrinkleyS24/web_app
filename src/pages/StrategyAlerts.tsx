import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertTriangle, Bell, Compass, Target, TrendingUp } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchStrategyAlerts, type StrategyAlert } from "@/lib/emails";

const severityStyles: Record<StrategyAlert["severity"], string> = {
  high: "border-l-warning bg-warning/5",
  medium: "border-l-accent bg-accent/5",
  low: "border-l-muted bg-muted/30",
  positive: "border-l-success bg-success/5",
};

const kindLabels: Record<StrategyAlert["kind"], string> = {
  performance: "Performance",
  fit: "Job Fit",
  focus: "Focus",
  execution: "Execution",
};

function alertIcon(alert: StrategyAlert) {
  if (alert.severity === "high") return AlertTriangle;
  if (alert.kind === "focus") return Compass;
  if (alert.kind === "execution") return Target;
  return TrendingUp;
}

const StrategyAlerts = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "aggregates"],
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

  const alerts = alertsQuery.data?.alerts || [];

  const summary = useMemo(() => {
    const high = alerts.filter((alert) => alert.severity === "high").length;
    const positive = alerts.filter((alert) => alert.severity === "positive").length;
    return {
      total: alerts.length,
      high,
      positive,
    };
  }, [alerts]);

  const emptyMessage = useMemo(() => {
    if (!isAuthed) return "Sign in to see strategy alerts.";
    if (alertsQuery.data?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock strategy alerts.";
    }
    if (alertsQuery.isLoading) return "Loading strategy alerts...";
    return "No strategy alerts yet. More signals appear once the system has enough tracked history.";
  }, [alertsQuery.data?.error, alertsQuery.isLoading, isAuthed]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" />
              Strategy Alerts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Aggregate signals about fit quality, response trends, and whether completed actions are correlating with better outcomes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active alerts</p>
            <p className="text-2xl font-bold text-foreground mt-2">{summary.total}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">High priority</p>
            <p className="text-2xl font-bold text-warning mt-2">{summary.high}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Positive signals</p>
            <p className="text-2xl font-bold text-success mt-2">{summary.positive}</p>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            alerts.map((alert, index) => {
              const Icon = alertIcon(alert);
              return (
                <div
                  key={alert.id}
                  className={`glass-card rounded-xl p-5 border-l-4 animate-fade-in ${severityStyles[alert.severity]}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {kindLabels[alert.kind]}
                        </span>
                        {alert.timeframe_label ? (
                          <span className="text-[11px] text-muted-foreground">{alert.timeframe_label}</span>
                        ) : null}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                      </div>
                      {alert.supporting_stat ? (
                        <p className="text-xs font-medium text-foreground/80">{alert.supporting_stat}</p>
                      ) : null}
                      {alert.recommendation ? (
                        <p className="text-sm text-foreground">{alert.recommendation}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StrategyAlerts;
