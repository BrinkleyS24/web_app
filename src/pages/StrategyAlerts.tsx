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
  FileText,
  MessageCircleQuestion,
  Radar,
  TrendingUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { InterviewDebriefCards } from "@/components/InterviewDebriefCards";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SectionLabel, ToneChip } from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { useAuth } from "@/lib/AuthContext.jsx";
import { fetchResumeGaps, fetchStrategyAlerts, type ResumeGap, type StrategyAlert } from "@/lib/emails";
import { cn } from "@/lib/utils";

const isPlaceholder = (alert: StrategyAlert) => String(alert?.id || "").endsWith("coverage-gap");

function alertLook(alert: StrategyAlert): { tone: Tone; label: string; icon: LucideIcon } {
  if (alert.kind === "commitment") return { tone: "upcoming", label: "Coming up", icon: CalendarClock };
  if (alert.debrief?.items?.length) return { tone: "attention", label: "Needs your input", icon: MessageCircleQuestion };
  if (alert.severity === "positive") return { tone: "positive", label: "Keep doing this", icon: CheckCircle2 };
  if (alert.severity === "high") return { tone: "risk", label: "Act on this", icon: AlertTriangle };
  if (alert.kind === "focus") return { tone: "attention", label: "Worth a look", icon: Compass };
  return { tone: "attention", label: "Worth a look", icon: TrendingUp };
}

function alertCta(alert: StrategyAlert): { to: string; label: string } {
  if (alert.kind === "fit") return { to: "/apply-gate", label: "Check your next role" };
  if (alert.kind === "commitment") return { to: "/next-actions", label: "Open the prep card" };
  if (alert.kind === "focus") return { to: "/next-actions", label: "See focused actions" };
  return { to: "/next-actions", label: "See what to do today" };
}

function AlertCard({ alert }: { alert: StrategyAlert }) {
  const look = alertLook(alert);
  const cta = alertCta(alert);
  const debriefItems = alert.debrief?.items?.filter((item) => item?.emailId != null) || [];

  return (
    <article id={alert.id} className={cn(CARD, "relative scroll-mt-24 overflow-hidden")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TONES[look.tone].rail)} aria-hidden />
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <ToneChip tone={look.tone}>{look.label}</ToneChip>
          {alert.timeframe_label ? <span className="text-[12px] text-muted-foreground">{alert.timeframe_label}</span> : null}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES[look.tone].icon)}>
            <look.icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold leading-snug tracking-[-0.015em] text-foreground">{alert.title}</h2>
            <p className="mt-2 max-w-[74ch] text-[14px] leading-relaxed text-muted-foreground">{alert.description}</p>
            {alert.supporting_stat ? (
              <p className="mt-2 text-[13px] font-semibold text-foreground/80">{alert.supporting_stat}</p>
            ) : null}
          </div>
        </div>

        {alert.recommendation ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className={EYEBROW}>What to do</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">{alert.recommendation}</p>
          </div>
        ) : null}

        {debriefItems.length > 0 ? (
          <InterviewDebriefCards items={debriefItems} total={Math.max(alert.debrief?.total ?? 0, debriefItems.length)} />
        ) : (
          <div className="mt-4">
            <Link to={cta.to} className={BUTTON.secondary}>
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function SkillGapsPanel({ gaps, outdatedExcluded }: { gaps: ResumeGap[]; outdatedExcluded: number }) {
  return (
    <Panel
      icon={FileText}
      tone="brand"
      title="Skills that keep coming up"
      description="Requirements from roles you checked in Apply Gate that your résumé does not show yet — each seen in two or more roles."
    >
      {gaps.length === 0 ? (
        <EmptyState
          compact
          title="No repeated gaps"
          body={
            outdatedExcluded > 0
              ? `${outdatedExcluded} older ${outdatedExcluded === 1 ? "check was" : "checks were"} made before Apply Gate's Sep 24 update and ${outdatedExcluded === 1 ? "is" : "are"} left out. Re-check them in Apply Gate to include them.`
              : "When the same requirement shows up across the roles you check, it appears here so you can fix it once."
          }
          action={
            outdatedExcluded > 0 ? (
              <Link to="/apply-gate" className={BUTTON.secondary}>
                Open Apply Gate
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {gaps.slice(0, 6).map((gap) => (
            <li key={`${gap.category}-${gap.skill}`} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground">{gap.skill}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {gap.examples
                    .map((example) => [example.company, example.position].filter(Boolean).join(" · "))
                    .filter(Boolean)
                    .slice(0, 3)
                    .join("; ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ToneChip tone={gap.category === "preferred" ? "neutral" : "attention"}>
                  {gap.category === "required" ? "Required" : gap.category === "evidence" ? "Needs proof" : "Nice to have"}
                </ToneChip>
                <span className="text-[12px] font-medium text-muted-foreground">{gap.occurrences} roles</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const StrategyAlerts = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const location = useLocation();

  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "page"],
    queryFn: fetchStrategyAlerts,
    enabled: isAuthed,
    staleTime: 120_000,
  });
  const gapsQuery = useQuery({
    queryKey: ["strategy-alerts", "skill-gaps"],
    queryFn: fetchResumeGaps,
    enabled: isAuthed,
    staleTime: 300_000,
  });

  const allAlerts = useMemo(() => alertsQuery.data?.alerts || [], [alertsQuery.data]);
  // Only findings with evidence behind them. The "not enough data yet" placeholder is kept for its
  // honest floor, shown in the empty state instead of as a card of its own.
  const alerts = useMemo(() => allAlerts.filter((alert) => !isPlaceholder(alert)), [allAlerts]);
  const floor = useMemo(() => allAlerts.find(isPlaceholder) || null, [allAlerts]);
  const attention = alerts.filter((alert) => alert.severity !== "positive");
  const working = alerts.filter((alert) => alert.severity === "positive");

  useEffect(() => {
    const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id || alerts.length === 0) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [alerts.length, location.hash]);

  const gaps = gapsQuery.data?.gaps || [];
  const outdatedExcluded = gapsQuery.data?.outdatedVerdictsExcluded ?? 0;
  const showGaps = !gapsQuery.isLoading && !gapsQuery.isError && (gaps.length > 0 || outdatedExcluded > 0 || (gapsQuery.data?.distinctRolesEvaluated ?? 0) > 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Patterns in your search"
          title="Strategy Alerts"
          description="What Applendium noticed across your inbox, why it matters, and what to do about it. An alert only appears when there is enough evidence behind it."
        />

        {alertsQuery.isLoading ? (
          <div className={cn(CARD, "px-6 py-6")}>
            <LoadingRows rows={3} />
          </div>
        ) : alertsQuery.isError ? (
          <ErrorState
            title="Your alerts did not load"
            detail="Your data is safe. Try again in a moment."
            onRetry={() => void alertsQuery.refetch()}
          />
        ) : alerts.length === 0 ? (
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

        {showGaps ? <SkillGapsPanel gaps={gaps} outdatedExcluded={outdatedExcluded} /> : null}

        <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
          Alerts describe patterns in your own results. They show what tends to go with what — not proof that one thing caused another.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default StrategyAlerts;
