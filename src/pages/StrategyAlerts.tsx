import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  FlaskConical,
  MessageCircleQuestion,
  Radar,
  TrendingUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SectionLabel, ToneChip } from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { useAuth } from "@/lib/AuthContext.jsx";
import { fetchResumeGaps, fetchStrategyAlerts, type StrategyAlert } from "@/lib/emails";
import { findDebriefAlert, isPlaceholderAlert as isPlaceholder, visibleStrategyAlerts } from "@/lib/strategyAlertVisibility";
import { cn } from "@/lib/utils";
import { ResumePatternsPanel } from "@/components/premium/ResumePatternsPanel";
import { requireResumePatterns, requireStrategyAlerts } from "@/lib/strategyPresentation";

function alertLook(alert: StrategyAlert): { tone: Tone; label: string; icon: LucideIcon } {
  if (alert.kind === "experiment") {
    return { tone: "brand", label: alert.experiment?.status === "measured" ? "Experiment result" : ["running", "started"].includes(alert.experiment?.status || "") ? "Experiment running" : alert.experiment?.status === "not_started" ? "Experiment not started" : "Experiment", icon: FlaskConical };
  }
  if (alert.kind === "commitment") return { tone: "upcoming", label: "Coming up", icon: CalendarClock };
  if (alert.severity === "positive") return { tone: "positive", label: "Keep doing this", icon: CheckCircle2 };
  if (alert.severity === "high") return { tone: "risk", label: "Act on this", icon: AlertTriangle };
  if (alert.kind === "focus") return { tone: "attention", label: "Worth a look", icon: Compass };
  return { tone: "attention", label: "Worth a look", icon: TrendingUp };
}

function alertCta(alert: StrategyAlert): { to: string; label: string } {
  if (alert.kind !== "experiment" && alert.experiment?.status === "not_started") return { to: "/next-actions", label: "Start in Next Actions" };
  if (alert.id === "performance-focus-interview") return { to: "/interview-prep", label: "Open interview preparation" };
  if (alert.id === "performance-rejection-velocity-post_interview") return { to: "/interview-prep", label: "Open interview preparation" };
  if (alert.id === "performance-focus-reach" || alert.id === "focus-industry-conversion") return { to: "/apply-gate", label: "Check your next role" };
  // You run an experiment by applying, so the next step is the next role.
  if (alert.kind === "experiment") return { to: "/apply-gate", label: "Check your next role" };
  if (alert.kind === "fit") return { to: "/apply-gate", label: "Check your next role" };
  if (alert.kind === "commitment") return { to: "/next-actions", label: alert.anchor?.kind === "assessment" ? "Open assessment tasks" : alert.anchor?.kind === "interview" ? "Open interview tasks" : "Review related tasks" };
  if (alert.kind === "focus") return { to: "/next-actions", label: "See focused actions" };
  return { to: "/next-actions", label: "Review next actions" };
}

/**
 * One alert, said briefly (review, 2026-09-26): what was noticed, the number behind it, and the move
 * with its button on one line. The full reasoning is one tap away, not a paragraph every time — the
 * card used to stack an icon, the title, the paragraph, the stat, a boxed "What to do" and a button.
 */
function AlertCard({ alert }: { alert: StrategyAlert }) {
  const look = alertLook(alert);
  const cta = alertCta(alert);

  return (
    <article id={alert.id} className={cn(CARD, "relative scroll-mt-24 overflow-hidden")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TONES[look.tone].rail)} aria-hidden />
      <div className="min-w-0 px-5 py-5 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-center gap-2">
          <ToneChip tone={look.tone}>{look.label}</ToneChip>
          {alert.timeframe_label ? <span className="text-[12px] text-muted-foreground">{alert.timeframe_label}</span> : null}
        </div>
        <h2 className="mt-2.5 text-[20px] font-bold leading-snug tracking-[-0.015em] text-foreground">{alert.title}</h2>
        {alert.supporting_stat ? (
          <p className="mt-1.5 text-[15px] font-semibold text-foreground/85">{alert.supporting_stat}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {alert.recommendation ? (
              <p className="flex max-w-[64ch] gap-2 text-[15px] leading-relaxed text-foreground">
                <ArrowRight className={cn("mt-1 h-4 w-4 shrink-0", TONES[look.tone].text)} aria-hidden />
                {alert.recommendation}
              </p>
            ) : <span />}
            <Link to={cta.to} className={cn(BUTTON.secondary, "shrink-0 self-start sm:self-center")}>
              {cta.label}
            </Link>
        </div>

        {alert.description ? <details className="mt-3 max-w-[74ch] text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium">Why this appeared</summary>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{alert.description}</p>
        </details> : null}

        {/* The finding's experiment: one change to try, measured on the next applications. */}
        {alert.kind !== "experiment" && alert.experiment?.status === "not_started" ? (
          <details className={cn("mt-3 rounded-xl border px-4 py-3", TONES.brand.surface)} data-testid="experiment-offer">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Try one change</summary>
            <p className={cn("flex items-center gap-1.5", EYEBROW, TONES.brand.text)}>
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Try it and see
            </p>
            <p className="mt-1 text-[13px] leading-snug text-foreground">{alert.experiment.ask}</p>
            {alert.experiment.howItWorks ? (
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{alert.experiment.howItWorks}</p>
            ) : null}
          </details>
        ) : alert.kind !== "experiment" && alert.experiment?.status === "started" ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            You are trying this now. Its progress is under Your experiments at the top of this page.
          </p>
        ) : null}
      </div>
    </article>
  );
}

const StrategyAlerts = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const location = useLocation();

  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "alerts", user?.uid],
    queryFn: fetchStrategyAlerts,
    select: requireStrategyAlerts,
    enabled: isAuthed,
    staleTime: 120_000,
    refetchOnWindowFocus: "always",
  });
  const gapsQuery = useQuery({
    queryKey: ["strategy-alerts", "skill-gaps", user?.uid],
    queryFn: fetchResumeGaps,
    select: requireResumePatterns,
    enabled: isAuthed,
    staleTime: 300_000,
    refetchOnWindowFocus: "always",
  });

  const allAlerts = useMemo(() => alertsQuery.data?.alerts || [], [alertsQuery.data]);
  // Only findings with evidence behind them. The "not enough data yet" placeholder is kept for its
  // honest floor, shown in the empty state instead of as a card of its own.
  const alerts = useMemo(() => visibleStrategyAlerts(allAlerts), [allAlerts]);
  // The interview questions are answered on the Dashboard; here they get one line pointing there,
  // not a second copy of the same card (persona review, 2026-10-14).
  const debrief = useMemo(() => findDebriefAlert(allAlerts), [allAlerts]);
  const debriefCount = debrief ? Math.max(debrief.debrief?.total ?? 0, debrief.debrief?.items?.length ?? 0) : 0;
  const floor = useMemo(() => allAlerts.find(isPlaceholder) || null, [allAlerts]);
  // Experiments lead: the user chose to run them, and each reports on what happened since.
  const experiments = alerts.filter((alert) => alert.kind === "experiment");
  const findings = alerts.filter((alert) => alert.kind !== "experiment");
  const attention = findings.filter((alert) => alert.severity !== "positive");
  const working = findings.filter((alert) => alert.severity === "positive");

  useEffect(() => {
    let id: string;
    try { id = decodeURIComponent((location.hash || "").replace(/^#/, "")); } catch { return; }
    if (!id || alerts.length === 0) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [alerts.length, location.hash]);

  const gapsCompatible = gapsQuery.data?.basis === "current_default_resume_checks";
  const showGaps = !gapsQuery.isLoading && !gapsQuery.isError && gapsCompatible && Boolean(gapsQuery.data);
  const alertsPaused = (alertsQuery.error as {payload?: {code?: string}} | null)?.payload?.code === "strategy_alerts_paused";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Patterns in your search"
          title="Strategy Alerts"
          description="What your tracked results suggest, and one step to consider next. Open the evidence when you want the detail."
        />

        {alertsQuery.isLoading ? (
          <div className={cn(CARD, "px-6 py-6")}>
            <LoadingRows rows={3} />
          </div>
        ) : alertsQuery.isError ? (
          <ErrorState
            title={alertsPaused ? "Strategy alerts are temporarily paused" : "Your alerts did not load"}
            detail={alertsPaused ? "Your records are safe. Next Actions, Apply Gate, and your saved resumes remain available." : "Your data is safe. Try again in a moment."}
            onRetry={() => void alertsQuery.refetch()}
          />
        ) : null}

        {!alertsQuery.isLoading && !alertsQuery.isError && debriefCount > 0 ? (
          <Link
            to="/dashboard"
            data-testid="debrief-link"
            className={cn(CARD, "flex flex-col items-start justify-between gap-3 px-5 py-4 transition-colors hover:border-foreground/25 sm:flex-row sm:items-center")}
          >
            <span className="flex min-w-0 items-center gap-3">
              <MessageCircleQuestion className={cn("h-4 w-4 shrink-0", TONES.attention.text)} aria-hidden />
              <span className="text-[15px] font-semibold text-foreground">
                {debriefCount} {debriefCount === 1 ? "interview needs" : "interviews need"} your answer
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
              Answer on the Dashboard
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
        ) : null}

        {!isAuthed || alertsQuery.isLoading || alertsQuery.isError ? null : alerts.length === 0 ? (
          <div className={cn(CARD, "p-5")}>
            <EmptyState
              icon={Radar}
              title="No strong patterns yet"
              body={
                floor?.description
                  ? `${floor.description}`
                  : "Alerts appear once enough of your applications have an outcome to show a real pattern. Nothing here is a sign anything is wrong."
              }
            />
          </div>
        ) : (
          <>
            {experiments.length ? (
              <section className="space-y-3" aria-label="Your experiments">
                <SectionLabel>Your experiments</SectionLabel>
                {experiments.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </section>
            ) : null}
            {attention.length ? (
              <section className="space-y-3" aria-label="Needs attention">
                <SectionLabel>Needs attention</SectionLabel>
                {attention.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </section>
            ) : null}
            {working.length ? (
              <section className="space-y-3" aria-label="Working for you">
                <SectionLabel>Working for you</SectionLabel>
                {working.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </section>
            ) : null}
          </>
        )}

        {gapsQuery.isError || (gapsQuery.isSuccess && !gapsCompatible) ? <ErrorState
          title="Your resume patterns did not load"
          detail="Retry to load patterns for your current default resume. You can review your resume library separately."
          onRetry={() => void gapsQuery.refetch()}
        /> : showGaps ? <ResumePatternsPanel data={gapsQuery.data!} /> : gapsQuery.isLoading && isAuthed ? <Panel title="Resume patterns"><LoadingRows rows={2} /></Panel> : null}

        <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
          These are observations from your tracked records, not proof of why an employer decided or whether you qualify for a new role.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default StrategyAlerts;
