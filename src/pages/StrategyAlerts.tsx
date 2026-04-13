import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Compass,
  Gauge,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { fetchStrategyAlerts, type StrategyAlert } from "@/lib/emails";

const severityStyles: Record<StrategyAlert["severity"], string> = {
  high: "border-l-destructive bg-destructive/5 text-destructive",
  medium: "border-l-warning bg-warning/5 text-warning",
  low: "border-l-muted bg-muted/30 text-muted-foreground",
  positive: "border-l-success bg-success/5 text-success",
};

const severityLabels: Record<StrategyAlert["severity"], string> = {
  high: "Act now",
  medium: "Watch closely",
  low: "Needs more signal",
  positive: "Working",
};

const kindLabels: Record<StrategyAlert["kind"], string> = {
  performance: "Response trend",
  fit: "Targeting",
  focus: "Focus lane",
  execution: "Execution",
};

const kindDescriptions: Record<StrategyAlert["kind"], string> = {
  performance: "How response and interview rates are moving across recent application windows.",
  fit: "Whether Apply Gate decisions suggest you are applying into avoidable mismatch.",
  focus: "Where repeated company, role, or industry signals are starting to cluster.",
  execution: "Whether completed actions are building a measurable search habit.",
};

function alertIcon(alert: StrategyAlert) {
  if (alert.severity === "high") return AlertTriangle;
  if (alert.kind === "focus") return Compass;
  if (alert.kind === "execution") return Target;
  if (alert.severity === "positive") return CheckCircle2;
  return TrendingUp;
}

function getAlertCta(alert?: StrategyAlert | null) {
  if (!alert) return { to: "/fix-suggestions", label: "Open Next Actions" };
  if (alert.kind === "fit") return { to: "/apply-gate", label: "Review Apply Gate" };
  if (alert.kind === "execution") return { to: "/fix-suggestions", label: "Open Next Actions" };
  if (alert.kind === "focus") return { to: "/fix-suggestions", label: "Review focus actions" };
  return { to: "/fix-suggestions", label: "Review today's queue" };
}

function AlertCard({ alert }: { alert: StrategyAlert }) {
  const Icon = alertIcon(alert);
  const cta = getAlertCta(alert);

  return (
    <article className={`rounded-2xl border border-border/70 border-l-4 bg-card p-4 shadow-sm ${severityStyles[alert.severity]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-background/80 p-2">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {severityLabels[alert.severity]}
            </span>
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {kindLabels[alert.kind]}
            </span>
            {alert.timeframe_label ? (
              <span className="text-[11px] text-muted-foreground">{alert.timeframe_label}</span>
            ) : null}
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">{alert.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.description}</p>
          {alert.supporting_stat ? (
            <p className="mt-2 rounded-full bg-background/75 px-3 py-1 text-xs font-medium text-foreground/80">
              {alert.supporting_stat}
            </p>
          ) : null}
          {alert.recommendation ? (
            <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended move</p>
              <p className="mt-1 text-sm leading-6 text-foreground">{alert.recommendation}</p>
            </div>
          ) : null}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to={cta.to}>
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
      {message}
    </div>
  );
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

  const grouped = useMemo(() => {
    const actionable = alerts.filter((alert) => alert.severity === "high" || alert.severity === "medium");
    const positive = alerts.filter((alert) => alert.severity === "positive");
    const calibration = alerts.filter((alert) => alert.severity === "low");
    const byKind = {
      performance: alerts.filter((alert) => alert.kind === "performance").length,
      fit: alerts.filter((alert) => alert.kind === "fit").length,
      focus: alerts.filter((alert) => alert.kind === "focus").length,
      execution: alerts.filter((alert) => alert.kind === "execution").length,
    };
    const primary = actionable[0] || positive[0] || calibration[0] || null;

    return {
      actionable,
      positive,
      calibration,
      byKind,
      primary,
    };
  }, [alerts]);

  const summary = useMemo(() => {
    return {
      active: alerts.length,
      actionable: grouped.actionable.length,
      positive: grouped.positive.length,
      calibration: grouped.calibration.length,
    };
  }, [alerts.length, grouped.actionable.length, grouped.calibration.length, grouped.positive.length]);

  const emptyMessage = useMemo(() => {
    if (!isAuthed) return "Sign in to see strategy alerts.";
    if (alertsQuery.data?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock strategy alerts.";
    }
    if (alertsQuery.isLoading) return "Loading strategy alerts...";
    return "No strategy alerts yet. More signals appear once Applendium has enough tracked history.";
  }, [alertsQuery.data?.error, alertsQuery.isLoading, isAuthed]);

  const primaryCta = getAlertCta(grouped.primary);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.14),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-5 shadow-sm">
          <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                <Bell className="h-3.5 w-3.5" />
                Strategy radar
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Strategy Alerts</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Pattern checks for targeting, response trends, focus lanes, and whether completed premium actions are tied to better outcomes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ["Active", summary.active],
                ["Actionable", summary.actionable],
                ["Working", summary.positive],
                ["Calibrating", summary.calibration],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-background/75 px-3 py-2.5 shadow-sm">
                  <p className="text-xl font-bold leading-none text-foreground">{value}</p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!isAuthed || alerts.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-5">
              {grouped.primary ? (
                <section className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)))] p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next strategic move</p>
                      <h2 className="mt-2 text-xl font-semibold text-foreground">{grouped.primary.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {grouped.primary.recommendation || grouped.primary.description}
                      </p>
                    </div>
                    <Button asChild>
                      <Link to={primaryCta.to}>
                        {primaryCta.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Act or watch now</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These alerts have enough signal to deserve a decision, not just passive monitoring.
                  </p>
                </div>
                {grouped.actionable.length === 0 ? (
                  <EmptyState message="No high or medium strategy alerts right now." />
                ) : (
                  grouped.actionable.map((alert) => <AlertCard key={alert.id} alert={alert} />)
                )}
              </section>

              {grouped.positive.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Keep doing this</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Positive signals are not guarantees, but they are useful habits or focus lanes to preserve.
                    </p>
                  </div>
                  {grouped.positive.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
                </section>
              ) : null}

              {grouped.calibration.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Still gathering evidence</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      These are coverage gaps. They explain why Applendium is not making stronger claims yet.
                    </p>
                  </div>
                  {grouped.calibration.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
                </section>
              ) : null}
            </main>

            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Signal lanes</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {(["performance", "fit", "focus", "execution"] as StrategyAlert["kind"][]).map((kind) => (
                    <div key={kind} className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{kindLabels[kind]}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {grouped.byKind[kind]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{kindDescriptions[kind]}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Confidence contract</h2>
                </div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>Alerts use minimum-history gates before making stronger recommendations.</p>
                  <p>Low-priority alerts are not failures. They tell you what data is still missing.</p>
                  <p>Execution alerts are framed as observed correlation, not proof that one action caused an outcome.</p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StrategyAlerts;
