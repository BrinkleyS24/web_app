import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  CircleDot,
  Inbox,
  ListChecks,
  MessageCircleQuestion,
  Minus,
  Radar,
  RefreshCw,
  ScanSearch,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Unplug,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardLayout } from "@/components/DashboardLayout";
import { FirstMoveCard } from "@/components/FirstMoveCard";
import { InterviewDebriefCards } from "@/components/InterviewDebriefCards";
import { ActionCtaButton, ActionIcon, actionVisual } from "@/components/premium/ActionPieces";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PanelLink,
  ToneChip,
} from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { Skeleton } from "@/components/ui/skeleton";
import { useInboxSync } from "@/hooks/useInboxSync";
import { describeActionIdentity, resolveActionCta } from "@/lib/actionPresentation";
import { splitRoleAndCompany } from "@/lib/applyGateDisplay";
import { useAuth } from "@/lib/AuthContext.jsx";
import { buildDashboardAnswer, findAnswerMove, type DashboardAnswer } from "@/lib/dashboardAnswer";
import {
  fetchApplyGateHistory,
  fetchEmailMetrics,
  fetchRankedActionQueue,
  fetchStrategyAlerts,
  fetchWeeklyHighlights,
  type ApplyGateHistoryItem,
  type MetricsResponse,
  type StrategyAlert,
  type WeeklyHighlightEmail,
  type WeeklyHighlightsResponse,
} from "@/lib/emails";
import {
  buildDashboardMoveQueue,
  buildGmailThreadUrl,
  buildQueueItemsFromRankedQueue,
  type QueueItem,
} from "@/lib/premiumTaskQueue";
import { cn } from "@/lib/utils";
import { describeVerdictDecision, describeVerdictOutcome } from "@/lib/verdictPresentation";
import { describeOutcomeSource } from "@/lib/outcomeSource";

const isPlaceholderAlert = (alert: StrategyAlert) => String(alert?.id || "").endsWith("coverage-gap");

function gmailUrlFor(item: QueueItem) {
  return item.source === "followup" || item.source === "stale" ? buildGmailThreadUrl(item.threadId) : null;
}

/** What kind of moment the lead card is, so it looks like one. */
function heroLook(answer: DashboardAnswer): { eyebrow: string; icon: LucideIcon; tone: Tone } {
  const id = answer.alertId || "";
  if (answer.debriefItems.length > 0) return { eyebrow: "Needs your input", icon: MessageCircleQuestion, tone: "attention" };
  if (id.startsWith("commitment-")) return { eyebrow: "Coming up", icon: CalendarClock, tone: "upcoming" };
  if (id.endsWith("coverage-gap") || !id) return { eyebrow: "Where your search stands", icon: Sparkles, tone: "neutral" };
  return { eyebrow: "What Applendium noticed", icon: Radar, tone: "brand" };
}

const Dashboard = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const inbox = useInboxSync(user?.uid);

  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });
  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "dashboard"],
    queryFn: fetchStrategyAlerts,
    enabled: isAuthed,
    staleTime: 120_000,
  });
  const queueQuery = useQuery({
    queryKey: ["dashboard", "queue"],
    queryFn: fetchRankedActionQueue,
    enabled: isAuthed,
    staleTime: 30_000,
  });
  const weeklyQuery = useQuery({
    queryKey: ["weekly-summary", "highlights", "last_7_days"],
    queryFn: () => fetchWeeklyHighlights("last_7_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });
  const historyQuery = useQuery({
    queryKey: ["dashboard", "apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const cohortMetrics = metricsQuery.data?.cohortMetrics;
  const alerts = useMemo(() => alertsQuery.data?.alerts || [], [alertsQuery.data]);
  const moveQueue = useMemo(
    () => buildDashboardMoveQueue(buildQueueItemsFromRankedQueue(queueQuery.data?.queue || null)),
    [queueQuery.data],
  );

  // The lead card waits for its data. Rendering it early showed "Your search read is not available
  // right now" for a second on every visit — a loading state dressed as a failure (2026-09-25).
  const answerLoading = alertsQuery.isLoading || metricsQuery.isLoading;
  const answer = useMemo(
    () =>
      buildDashboardAnswer({
        alerts,
        cohortMetrics,
        alertsUnavailableMessage: alertsQuery.isError
          ? "Applendium could not load your strategy read just now. Your data is safe; try again in a moment."
          : null,
      }),
    [alerts, alertsQuery.isError, cohortMetrics],
  );
  const answerMove = useMemo(() => findAnswerMove(answer, moveQueue), [answer, moveQueue]);
  const asksInPlace = answer.debriefItems.length > 0;
  const heroMove = asksInPlace ? null : answerMove || moveQueue[0] || null;
  const todayMoves = useMemo(
    () => moveQueue.filter((item) => item.id !== heroMove?.id).slice(0, 3),
    [heroMove?.id, moveQueue],
  );
  const patterns = useMemo(
    () => alerts.filter((alert) => alert.id !== answer.alertId && !isPlaceholderAlert(alert)).slice(0, 2),
    [alerts, answer.alertId],
  );

  const now = new Date();
  const greetingWord = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const rawName = String(user?.displayName || user?.email || "").split(/[@\s]/)[0];
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow={dateLabel}
          title={`${greetingWord}${firstName ? `, ${firstName}` : ""}.`}
          actions={
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground" aria-live="polite">
                {inbox.isSyncing
                  ? "Checking your inbox…"
                  : inbox.lastCheckedLabel
                    ? `Inbox checked ${inbox.lastCheckedLabel}`
                    : null}
              </span>
              <button type="button" onClick={inbox.syncNow} disabled={inbox.isSyncing} className={BUTTON.secondary}>
                <RefreshCw className={cn("h-3.5 w-3.5", inbox.isSyncing && "animate-spin")} aria-hidden />
                Sync now
              </button>
            </div>
          }
        />

        {inbox.requiresReconnect ? (
          <div className={cn(CARD, "flex items-start gap-3 px-5 py-4", TONES.attention.surface)} role="status">
            <Unplug className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Gmail is disconnected</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                New applications and replies are not coming in. Open the Applendium extension and sign in again to reconnect —
                everything already here is safe.
              </p>
            </div>
          </div>
        ) : null}
        {inbox.error ? <ErrorState title="Your inbox could not be checked just now" detail={inbox.error} onRetry={inbox.syncNow} /> : null}

        <FirstMoveCard />

        <HeroCard answer={answer} loading={answerLoading} heroMove={heroMove} pairedWithClaim={Boolean(answerMove)} />

        <div className="grid items-start gap-5 lg:grid-cols-5">
          <TodayPanel
            className="lg:col-span-3"
            loading={queueQuery.isLoading}
            error={queueQuery.isError}
            onRetry={() => queueQuery.refetch()}
            moves={todayMoves}
            total={moveQueue.length}
            heroTaken={Boolean(heroMove)}
          />
          <ThisWeekPanel className="lg:col-span-2" loading={weeklyQuery.isLoading} weekly={weeklyQuery.data} />
        </div>

        <SearchStatusPanel loading={metricsQuery.isLoading} metrics={metricsQuery.data} />

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <RecentOutcomesPanel loading={weeklyQuery.isLoading} weekly={weeklyQuery.data} />
          <RecentChecksPanel
            loading={historyQuery.isLoading}
            history={historyQuery.data?.history || []}
          />
        </div>

        {patterns.length ? <PatternsPanel alerts={patterns} /> : null}
      </div>
    </DashboardLayout>
  );
};

function HeroCard({
  answer,
  loading,
  heroMove,
  pairedWithClaim,
}: {
  answer: DashboardAnswer;
  loading: boolean;
  heroMove: QueueItem | null;
  pairedWithClaim: boolean;
}) {
  if (loading) {
    return (
      <section className={cn(CARD, "px-6 py-6")} aria-busy="true">
        <span className="sr-only">Loading what matters today</span>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-7 w-3/4" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />
      </section>
    );
  }

  const look = heroLook(answer);
  const cta = heroMove ? resolveActionCta(heroMove, gmailUrlFor(heroMove)) : null;
  const moveIdentity = heroMove ? describeActionIdentity(heroMove) : null;

  return (
    <section className={cn(CARD, "relative overflow-hidden")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TONES[look.tone].rail)} aria-hidden />
      <div className="px-6 py-6 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn("inline-flex items-center gap-2", EYEBROW, TONES[look.tone].text)}>
            <look.icon className="h-3.5 w-3.5" aria-hidden />
            {look.eyebrow}
          </span>
          {answer.stat ? <ToneChip tone={look.tone === "neutral" ? "neutral" : look.tone}>{answer.stat}</ToneChip> : null}
        </div>
        <h2 className="mt-3 max-w-[44ch] text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[26px]">
          {answer.claim}
        </h2>
        {answer.evidence ? (
          <p className="mt-2.5 max-w-[72ch] text-[14px] leading-relaxed text-muted-foreground">{answer.evidence}</p>
        ) : null}

        {answer.recommendation ? (
          <div className="mt-4 flex max-w-[72ch] gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="text-[13.5px] leading-relaxed text-foreground/85">{answer.recommendation}</p>
          </div>
        ) : null}

        {answer.debriefItems.length > 0 ? (
          <InterviewDebriefCards items={answer.debriefItems} total={answer.debriefTotal} />
        ) : heroMove && cta ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ActionCtaButton item={heroMove} cta={cta} className={BUTTON.primary}>
              {cta.label}
            </ActionCtaButton>
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              {pairedWithClaim ? "The move for the read above" : "Top of your list right now"}
              {" · "}
              <span className="font-medium text-foreground/80">{heroMove.title}</span>
              {moveIdentity ? ` · ${moveIdentity}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TodayPanel({
  className,
  loading,
  error,
  onRetry,
  moves,
  total,
  heroTaken,
}: {
  className?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  moves: QueueItem[];
  total: number;
  heroTaken: boolean;
}) {
  // What remains beyond the lead card and these three.
  const more = Math.max(0, total - moves.length - (heroTaken ? 1 : 0));
  return (
    <Panel
      className={className}
      icon={ListChecks}
      tone="brand"
      title="Next Actions"
      description="The most useful things to do next, ranked for you."
      action={<PanelLink to="/next-actions">{more > 0 ? `All actions (${more} more)` : "All actions"}</PanelLink>}
    >
      {loading ? (
        <LoadingRows rows={3} />
      ) : error ? (
        <ErrorState title="Your actions did not load" onRetry={onRetry} />
      ) : moves.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          compact
          title={heroTaken ? "That's the whole list for now" : "You're caught up"}
          body={
            heroTaken
              ? "The move above is the only thing waiting. New actions appear as replies and outcomes arrive."
              : "New actions appear as replies, interviews and outcomes arrive in your inbox."
          }
        />
      ) : (
        <ul className="-mx-2 divide-y divide-border">
          {moves.map((item) => {
            const cta = resolveActionCta(item, gmailUrlFor(item));
            const identity = describeActionIdentity(item);
            const { kind } = actionVisual(item);
            return (
              <li key={item.id} className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/30">
                <ActionIcon item={item} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">{kind}</span>
                    {identity ? ` · ${identity}` : ""}
                  </p>
                </div>
                <ActionCtaButton item={item} cta={cta} className={cn(BUTTON.secondary, "shrink-0 px-3 py-1.5 text-[12.5px]")} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Delta({ value, prior }: { value: number; prior: number | undefined }) {
  if (prior == null) return null;
  // Direction only, in a neutral color: more rejections "up" must not read as good news.
  const Icon = value > prior ? TrendingUp : value < prior ? TrendingDown : Minus;
  const text = value > prior ? `up from ${prior}` : value < prior ? `down from ${prior}` : "same as last week";
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  );
}

function ThisWeekPanel({
  className,
  loading,
  weekly,
}: {
  className?: string;
  loading: boolean;
  weekly?: WeeklyHighlightsResponse;
}) {
  const counts = weekly?.counts;
  const prior = weekly?.priorCounts;
  const rows = counts
    ? [
        { label: "Applications sent", value: counts.applications, prior: prior?.applications },
        { label: "Replies and interviews", value: counts.callbacks, prior: prior?.callbacks },
        { label: "Rejections", value: counts.rejections, prior: prior?.rejections },
      ]
    : [];
  return (
    <Panel
      className={className}
      icon={CalendarRange}
      tone="upcoming"
      title="This week"
      description={weekly?.readout?.headline || "The last 7 days against the 7 before."}
      action={<PanelLink to="/weekly-summary">Summary</PanelLink>}
    >
      {loading ? (
        <LoadingRows rows={3} />
      ) : !counts ? (
        <ErrorState title="This week's numbers did not load" />
      ) : (
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
              <dd className="flex items-baseline gap-2.5">
                <Delta value={row.value} prior={row.prior} />
                <span className="text-[20px] font-bold tabular-nums tracking-[-0.02em] text-foreground">{row.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

function BarRow({ label, value, of, tone, hint }: { label: string; value: number; of: number; tone: Tone; hint?: string }) {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-foreground/85">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {value}
          {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", TONES[tone].rail)} style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

const VELOCITY_ROWS: Array<{ key: string; label: string; tone: Tone }> = [
  { key: "auto_screen", label: "Within 3 days of applying", tone: "risk" },
  { key: "recruiter_screen", label: "3 to 14 days", tone: "attention" },
  { key: "late_stage", label: "After 14 days", tone: "neutral" },
  { key: "post_interview", label: "After an interview", tone: "upcoming" },
];

function SearchStatusPanel({ loading, metrics }: { loading: boolean; metrics?: MetricsResponse }) {
  const cohort = metrics?.cohortMetrics;
  // The Signal Layer's funnel when the backend sends it; the same all-time cohort counts otherwise.
  const funnel = metrics?.searchSignals?.funnel
    ?? (cohort
      ? {
          applied: cohort.applicationsSent,
          pending: null,
          silent: null,
          rejected: cohort.rejectedCohorts,
          reachedInterview: cohort.reachedInterview,
          reachedOffer: cohort.reachedOffer,
          interviewRate: cohort.interviewRate / 100,
        }
      : null);
  const velocity = metrics?.searchSignals?.rejectionVelocity;
  const applied = funnel?.applied ?? 0;
  const ratePct = funnel?.interviewRate != null ? `${(funnel.interviewRate * 100).toFixed(1)}%` : null;

  return (
    <Panel
      icon={CircleDot}
      tone="neutral"
      title="How your search is going"
      description={applied ? `Across all ${applied} applications Applendium has tracked, counted once per application.` : undefined}
    >
      {loading ? (
        <LoadingRows rows={3} />
      ) : !funnel || applied === 0 ? (
        <EmptyState
          icon={Inbox}
          compact
          title="Nothing tracked yet"
          body="As applications arrive in your inbox, this shows where each one stands."
        />
      ) : (
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <div className="space-y-3.5">
            <p className={EYEBROW}>Where your applications stand</p>
            {funnel.pending != null ? <BarRow label="Waiting on a reply" value={funnel.pending} of={applied} tone="upcoming" /> : null}
            {funnel.silent != null ? <BarRow label="Went quiet (30+ days)" value={funnel.silent} of={applied} tone="neutral" /> : null}
            <BarRow label="Rejected" value={funnel.rejected} of={applied} tone="risk" />
            <BarRow label="Reached an interview" value={funnel.reachedInterview} of={applied} tone="brand" hint={ratePct ?? undefined} />
            <BarRow label="Offers" value={funnel.reachedOffer} of={applied} tone="positive" />
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              An application can count twice — an interview that ended in a rejection is in both rows.
            </p>
          </div>
          <div className="space-y-3.5">
            <p className={EYEBROW}>When rejections arrive</p>
            {velocity && velocity.classified >= 5 ? (
              <>
                {VELOCITY_ROWS.map((row) => (
                  <BarRow
                    key={row.key}
                    label={row.label}
                    value={velocity.counts?.[row.key] ?? 0}
                    of={velocity.classified}
                    tone={row.tone}
                  />
                ))}
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  {velocity.classified} rejections could be timed from application to decision
                  {velocity.averageDays != null ? `, averaging ${velocity.averageDays} days` : ""}. Only an inbox can see this.
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                This appears once 5 rejections can be timed from application to decision
                {velocity ? ` — ${velocity.classified} so far` : ""}. How fast a decision comes back says whether a person or a
                form turned you down.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function outcomeRows(weekly?: WeeklyHighlightsResponse) {
  if (!weekly) return [];
  const tag = (items: WeeklyHighlightEmail[], label: string, tone: Tone) => items.map((item) => ({ item, label, tone }));
  return [
    ...tag(weekly.highlights.newOffers, "Offer", "positive"),
    ...tag(weekly.highlights.newCallbacks, "Interview", "brand"),
    ...tag(weekly.highlights.newRejections, "Rejected", "risk"),
  ]
    .sort((a, b) => new Date(b.item.date || 0).getTime() - new Date(a.item.date || 0).getTime())
    .slice(0, 5);
}

function relativeDay(date: string | null) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function RecentOutcomesPanel({ loading, weekly }: { loading: boolean; weekly?: WeeklyHighlightsResponse }) {
  const rows = outcomeRows(weekly);
  return (
    <Panel icon={Inbox} tone="neutral" title="Recent outcomes" description="Replies and decisions from the last 7 days.">
      {loading ? (
        <LoadingRows rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState compact title="No replies or decisions this week" body="Interviews, offers and rejections show up here as they arrive." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(({ item, label, tone }, index) => {
            const source = describeOutcomeSource(item);
            return (
              <li key={`${label}-${item.id ?? index}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-foreground">{source.primary}</p>
                  {source.secondary ? <p className="truncate text-[12px] text-muted-foreground">{source.secondary}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[12px] text-muted-foreground">{relativeDay(item.date)}</span>
                  <ToneChip tone={tone}>{label}</ToneChip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RecentChecksPanel({ loading, history }: { loading: boolean; history: ApplyGateHistoryItem[] }) {
  const rows = history.slice(0, 3);
  return (
    <Panel
      icon={ScanSearch}
      tone="brand"
      title="Recent Apply Gate checks"
      description="Roles you checked before applying."
      action={<PanelLink to="/apply-gate">Apply Gate</PanelLink>}
    >
      {loading ? (
        <LoadingRows rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          title="No roles checked yet"
          body="Paste a job before you apply and get a clear apply, fix-first or skip call."
          action={
            <Link to="/apply-gate" className={BUTTON.secondary}>
              Check a role
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((item) => {
            const { role, company } = splitRoleAndCompany(item.job_title, item.company_name, item.job_url || null);
            const decision = describeVerdictDecision(item);
            const outcome = describeVerdictOutcome(item);
            return (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-foreground">{role}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {[company, outcome?.label].filter(Boolean).join(" · ")}
                    {item.outdated ? (company || outcome ? " · " : "") + "checked before the Sep 24 update" : ""}
                  </p>
                </div>
                <ToneChip tone={item.outdated ? "neutral" : decision.tone}>{decision.label}</ToneChip>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function PatternsPanel({ alerts }: { alerts: StrategyAlert[] }) {
  return (
    <Panel
      icon={Radar}
      tone="brand"
      title="Other patterns in your search"
      action={<PanelLink to="/strategy-alerts">Strategy Alerts</PanelLink>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            to={`/strategy-alerts#${encodeURIComponent(alert.id)}`}
            className="group rounded-xl border border-border bg-muted/30 px-4 py-3.5 transition-colors hover:border-foreground/20 hover:bg-card"
          >
            <p className="text-[14px] font-semibold leading-snug text-foreground">{alert.title}</p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{alert.description}</p>
            {alert.supporting_stat ? <p className="mt-2 text-[12px] font-medium text-foreground/70">{alert.supporting_stat}</p> : null}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export default Dashboard;
