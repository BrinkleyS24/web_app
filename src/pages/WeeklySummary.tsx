import { useMemo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Hourglass,
  Lightbulb,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, StatTile, ToneChip } from "@/components/premium/PremiumUI";
import { CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { useAuth } from "@/lib/AuthContext.jsx";
import { fetchWeeklyHighlights } from "@/lib/emails";
import type { WeeklyHighlightEmail, WeeklyHighlightSilent, WeeklyReadout, WeeklyReadoutItem } from "@/lib/emails";
import { describeOutcomeSource } from "@/lib/outcomeSource";
import { cn } from "@/lib/utils";

function formatRelativeDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EventRow({ item, tone, label }: { item: WeeklyHighlightEmail; tone: Tone; label?: string }) {
  const source = describeOutcomeSource(item);
  const when = formatRelativeDate(item.date);
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">
          {source.primary}
          {source.secondary ? <span className="font-normal text-muted-foreground"> · {source.secondary}</span> : null}
        </p>
        {item.subject && item.company ? (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">“{item.subject}”</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {when ? <span className="text-[12px] text-muted-foreground">{when}</span> : null}
        {label ? <ToneChip tone={tone}>{label}</ToneChip> : null}
      </div>
    </li>
  );
}

function SilentRow({ item }: { item: WeeklyHighlightSilent }) {
  const source = describeOutcomeSource(item);
  // Whose move it is. A thread whose last email is an assessment nobody has confirmed as
  // submitted is waiting on the user, not on them.
  const waitingOnYou = item.waitingOn === "you";
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">
          {source.primary}
          {source.secondary ? <span className="font-normal text-muted-foreground"> · {source.secondary}</span> : null}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {waitingOnYou
            ? `Their last email was about an assessment ${item.daysSilent} day${item.daysSilent === 1 ? "" : "s"} ago, and no submission has reached your inbox`
            : `No reply for ${item.daysSilent} day${item.daysSilent === 1 ? "" : "s"} since the ${item.stage === "interviewed" ? "interview" : "application"}`}
          {item.subject ? ` · last: “${item.subject}”` : ""}
        </p>
      </div>
      <ToneChip tone={waitingOnYou ? "attention" : "neutral"}>{waitingOnYou ? "Waiting on you" : "Quiet"}</ToneChip>
    </li>
  );
}

function ReadoutList({ title, icon: Icon, tone, items, glyph }: {
  title: string;
  icon: LucideIcon;
  tone: Tone;
  items: WeeklyReadoutItem[];
  glyph?: (item: WeeklyReadoutItem) => ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className={cn("flex items-center gap-1.5", EYEBROW)}>
        <Icon className={cn("h-3.5 w-3.5", TONES[tone].text)} aria-hidden />
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-[13px] leading-snug text-foreground/85">
            {glyph ? glyph(item) : null}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Direction only, in a neutral color: more rejections "up" must not read as good news.
function DirectionGlyph({ direction }: { direction?: "up" | "down" | "flat" }) {
  const cls = "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (direction === "up") return <TrendingUp className={cls} aria-hidden />;
  if (direction === "down") return <TrendingDown className={cls} aria-hidden />;
  return <Minus className={cls} aria-hidden />;
}

function WeeksRead({ readout }: { readout: WeeklyReadout }) {
  const { headline, confidence, sections } = readout;
  return (
    <section className={cn(CARD, "relative overflow-hidden")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TONES.brand.rail)} aria-hidden />
      <div className="space-y-5 px-6 py-6 sm:px-7">
        <div>
          <p className={cn("inline-flex items-center gap-2", EYEBROW, TONES.brand.text)}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            This week's read
          </p>
          <h2 className="mt-2 max-w-[48ch] text-[22px] font-bold leading-snug tracking-[-0.02em] text-foreground">{headline}</h2>
          {confidence !== "normal" ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {confidence === "quiet"
                ? "A quiet week in your inbox, so this read is light by design."
                : "Only a couple of events this week, so treat this as a snapshot rather than a trend."}
            </p>
          ) : null}
        </div>

        {sections.nextWeek.length ? (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3.5">
            <p className={EYEBROW}>Do next week</p>
            <ol className="mt-2 space-y-2">
              {sections.nextWeek.map((item, index) => (
                <li key={`nw-${index}`} className="flex gap-2.5 text-[13.5px] leading-snug">
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      item.priority === "high" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={item.priority === "high" ? "font-medium text-foreground" : "text-foreground/80"}>{item.text}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {sections.whatChanged.length || sections.whatWorked.length || sections.whatDidnt.length ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <ReadoutList title="What changed" icon={TrendingUp} tone="neutral" items={sections.whatChanged} glyph={(item) => <DirectionGlyph direction={item.direction} />} />
            <ReadoutList title="What worked" icon={CheckCircle2} tone="positive" items={sections.whatWorked} glyph={() => <span className="text-success">+</span>} />
            <ReadoutList title="What didn't" icon={XCircle} tone="risk" items={sections.whatDidnt} glyph={() => <span className="text-destructive">–</span>} />
          </div>
        ) : null}

        {sections.emergingPattern ? (
          <div className={cn("flex gap-3 rounded-xl border px-4 py-3", TONES.brand.surface)}>
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <p className={cn(EYEBROW, TONES.brand.text)}>Emerging pattern</p>
              <p className="mt-1 text-[13.5px] leading-snug text-foreground">{sections.emergingPattern.text}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function deltaHint(value: number | undefined, prior: number | undefined) {
  if (value == null || prior == null) return undefined;
  if (value === prior) return "Same as last week";
  return `${prior} last week`;
}

const WeeklySummary = () => {
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  // The same trailing 7 days the highlights query uses (today and the six before it).
  const weekRangeLabel = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fmtEnd = start.getMonth() === end.getMonth() ? end.toLocaleDateString("en-US", { day: "numeric" }) : fmtDay(end);
    return `Week of ${fmtDay(start)} – ${fmtEnd}`;
  }, []);

  const highlightsQuery = useQuery({
    queryKey: ["weekly-summary", "highlights", "last_7_days"],
    queryFn: () => fetchWeeklyHighlights("last_7_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const data = highlightsQuery.data;
  const counts = data?.counts;
  const prior = data?.priorCounts;
  const loading = highlightsQuery.isLoading;
  const h = data?.highlights;
  const hasEvents = Boolean(
    h && (h.newCallbacks.length || h.newOffers.length || h.newRejections.length || h.newApplications.length || h.silentThreads.length),
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow={weekRangeLabel}
          title="Weekly Summary"
          description="Your last 7 days, read from your inbox: what moved, what didn't, and what to do next week."
        />

        {highlightsQuery.isError ? (
          <ErrorState title="This week did not load" detail="Your data is safe. Try again in a moment." onRetry={() => void highlightsQuery.refetch()} />
        ) : null}

        {loading ? (
          <div className={cn(CARD, "px-6 py-6")}>
            <LoadingRows rows={3} />
          </div>
        ) : data?.readout ? (
          <WeeksRead readout={data.readout} />
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Applications sent" value={counts?.applications ?? "–"} hint={deltaHint(counts?.applications, prior?.applications)} loading={loading} />
          <StatTile label="Replies & interviews" value={counts ? counts.callbacks : "–"} hint={deltaHint(counts?.callbacks, prior?.callbacks)} tone="brand" loading={loading} />
          <StatTile label="Offers" value={counts?.offers ?? "–"} hint={deltaHint(counts?.offers, prior?.offers)} tone="positive" loading={loading} />
          <StatTile label="Rejections" value={counts?.rejections ?? "–"} hint={deltaHint(counts?.rejections, prior?.rejections)} tone="risk" loading={loading} />
        </div>

        {!loading && !highlightsQuery.isError && !hasEvents ? (
          <div className={cn(CARD, "p-5")}>
            <EmptyState
              icon={CalendarPlus}
              title="A quiet week in your inbox"
              body="As replies, interviews, offers and rejections arrive, this page lists each one and what to do about it."
            />
          </div>
        ) : null}

        {h && hasEvents ? (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {h.newOffers.length ? (
              <Panel icon={Sparkles} tone="positive" title="Offers">
                <ul className="divide-y divide-border">
                  {h.newOffers.map((item, idx) => <EventRow key={`offer-${idx}`} item={item} tone="positive" label="Offer" />)}
                </ul>
              </Panel>
            ) : null}

            {h.newCallbacks.length ? (
              <Panel icon={CheckCircle2} tone="brand" title="Replies and interview moves">
                <ul className="divide-y divide-border">
                  {h.newCallbacks.map((item, idx) => <EventRow key={`cb-${idx}`} item={item} tone="brand" label="Interview" />)}
                </ul>
              </Panel>
            ) : null}

            {h.silentThreads.length ? (
              <Panel icon={Hourglass} tone="attention" title="Waiting on a reply" description="Applications that went quiet — and any where the next move is yours.">
                <ul className="divide-y divide-border">
                  {h.silentThreads.map((item, idx) => <SilentRow key={`silent-${idx}`} item={item} />)}
                </ul>
              </Panel>
            ) : null}

            {h.newRejections.length ? (
              <Panel icon={XCircle} tone="risk" title="Rejections">
                <ul className="divide-y divide-border">
                  {h.newRejections.map((item, idx) => <EventRow key={`rej-${idx}`} item={item} tone="risk" />)}
                </ul>
                {h.topRejectionTheme ? (
                  <div className={cn("mt-4 rounded-xl border px-4 py-3", TONES.risk.surface)}>
                    <p className={cn(EYEBROW, TONES.risk.text)}>Keeps coming up (last 30 days)</p>
                    <p className="mt-1 text-[13.5px] text-foreground">
                      “{h.topRejectionTheme.phrase}”
                      <span className="text-muted-foreground"> — in {h.topRejectionTheme.occurrences} rejections</span>
                    </p>
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {h.newApplications.length ? (
              <Panel icon={Clock} tone="neutral" title="New applications">
                <ul className="divide-y divide-border">
                  {h.newApplications.map((item, idx) => <EventRow key={`app-${idx}`} item={item} tone="neutral" />)}
                </ul>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {/* No "weekly rates": dividing this week's outcomes by this week's applications mixes two
            cohorts — an interview today belongs to an application sent weeks ago. The honest
            all-time rate lives on the Dashboard. */}
        <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted-foreground">
          <ArrowRight className="h-3 w-3" aria-hidden />
          A shorter version of this arrives by email each week. Every email has an unsubscribe link.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default WeeklySummary;
