import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  Lightbulb,
  Sparkles,
  XCircle,
} from "lucide-react";

import { ErrorState, LoadingRows, Panel, ToneChip } from "@/components/premium/PremiumUI";
import { BUTTON, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { useAuth } from "@/lib/AuthContext.jsx";
import { fetchWeeklyHighlights } from "@/lib/emails";
import type { WeeklyHighlightEmail, WeeklyReadout, WeeklyReadoutItem } from "@/lib/emails";
import { describeOutcomeSource } from "@/lib/outcomeSource";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/statusTone";
import { parseApiDate } from "@/lib/apiDate";
import { daysSince } from "@/lib/premiumTaskQueue";

/**
 * The one week summary, on the Dashboard since 2026-10-14. Next Actions and the Dashboard each had
 * their own (4 tiles with Offers there, 3 rows without them here), so the persona review read two
 * different weeks; now there is one component in one place.
 *
 * History: the week in review, folded into Next Actions (2026-10-04). It used to be its own Weekly Summary
 * page beside Next Actions and the Dashboard's "This week" panel: three places for one week. Here it
 * is context for the actions, collapsed to the headline and four counts; Details opens the read and
 * the week's emails. /weekly-summary redirects to #this-week, which opens it.
 */

export const WEEK_ANCHOR = "this-week";

function formatRelativeDate(dateString: string | null) {
  if (!dateString) return null;
  const date = parseApiDate(dateString);
  if (!date) return null;
  const days = daysSince(date.toISOString());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function deltaHint(value: number | undefined, prior: number | undefined) {
  if (value == null || prior == null) return undefined;
  if (value === prior) return "Same as last week";
  return `${prior} last week`;
}

function EventRow({ item, tone, label, subjectLabel = "Email subject" }: { item: WeeklyHighlightEmail; tone: Tone; label?: string; subjectLabel?: string }) {
  const source = describeOutcomeSource(item);
  const when = formatRelativeDate(item.date);
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">
          {source.primary}
          {source.secondary ? <span className="font-normal text-muted-foreground"> · {source.secondary}</span> : null}
        </p>
        {item.subject && item.company ? (
          <p className="mt-0.5 break-words text-[12px] text-muted-foreground">{subjectLabel}: “{item.subject}”</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {when ? <span className="text-[12px] text-muted-foreground">{when}</span> : null}
        {label ? <ToneChip tone={tone}>{label}</ToneChip> : null}
      </div>
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

/** The read, without its own card: it sits inside this one. The headline is the card's description. */
function WeeksRead({ readout }: { readout: WeeklyReadout }) {
  const { confidence, sections } = readout;
  return (
    <div className="space-y-4">
      {confidence !== "normal" ? (
        <p className="text-[13px] text-muted-foreground">
          {confidence === "quiet"
            ? "A quiet week in your inbox, so this read is light by design."
            : "Limited activity was recorded this week. Treat this as a snapshot rather than a trend."}
        </p>
      ) : null}

      {sections.whatWorked.length || sections.whatDidnt.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <ReadoutList title="What worked" icon={CheckCircle2} tone="positive" items={sections.whatWorked} glyph={() => <span className="text-success">+</span>} />
          <ReadoutList title="Other recorded activity" icon={XCircle} tone="risk" items={sections.whatDidnt} glyph={() => <span className="text-destructive">–</span>} />
        </div>
      ) : null}

      {sections.emergingPattern ? (
        <div className={cn("flex gap-3 rounded-xl border px-4 py-3", TONES.brand.surface)}>
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div>
            <p className={cn(EYEBROW, TONES.brand.text)}>Emerging pattern</p>
            <p className="mt-1 text-[13px] leading-snug text-foreground">{sections.emergingPattern.text}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventGroup({ icon: Icon, tone, title, description, children }: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className={cn("flex items-center gap-1.5", EYEBROW)}>
        <Icon className={cn("h-3.5 w-3.5", TONES[tone].text)} aria-hidden />
        {title}
      </p>
      {description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p> : null}
      <ul className="mt-2 divide-y divide-border">{children}</ul>
    </div>
  );
}

export function WeekInReview({
  defaultOpen = false,
  className,
  compact = false,
}: {
  defaultOpen?: boolean;
  className?: string;
  /** Narrow column: tiles two by two and event groups stacked. */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const linkedHere = location.hash === `#${WEEK_ANCHOR}`;
  const [open, setOpen] = useState(defaultOpen || linkedHere);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Arriving from /weekly-summary or the Dashboard: open the card and bring it into view.
  useEffect(() => {
    if (!linkedHere) return;
    setOpen(true);
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }, [linkedHere]);

  // Same key as the Dashboard's "This week" panel, so the two share one request.
  const highlightsQuery = useQuery({
    queryKey: ["weekly-summary", "highlights", "last_7_days", user?.uid],
    queryFn: () => fetchWeeklyHighlights("last_7_days"),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const data = highlightsQuery.data;
  const start = parseApiDate(data?.windowStart);
  const end = parseApiDate(data?.windowEnd);
  const windowLabel = start && end && start < end
    ? `Trailing 7 days · ${start.toLocaleString()} to ${end.toLocaleString()}`
    : "Trailing 7 days";
  const counts = data?.counts;
  const prior = data?.priorCounts;
  const h = data?.highlights;
  const hasEvents = Boolean(
    h && (h.newCallbacks.length || h.newOffers.length || h.newRejections.length || h.newApplications.length),
  );
  const stats = counts
    ? [
        { label: "Applications first tracked", value: counts.applications, prior: prior?.applications },
        { label: "Interview & offer updates", value: counts.callbacks, prior: prior?.callbacks },
        { label: "Offers", value: counts.offers, prior: prior?.offers },
        { label: "Rejections", value: counts.rejections, prior: prior?.rejections },
      ]
    : [];

  return (
    <div ref={panelRef} id={WEEK_ANCHOR} className={cn("scroll-mt-6", className)}>
      <Panel
        icon={CalendarRange}
        tone="upcoming"
        title="Your week"
        description={highlightsQuery.isError ? "The weekly report is unavailable." : data?.readout?.headline || "The last 7 days against the 7 before."}
        action={
          counts ? (
            <button
              type="button"
              data-testid="week-toggle"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={cn(BUTTON.secondary, "px-3 py-1.5 text-[13px]")}
            >
              {open ? "Hide" : "Details"}
            </button>
          ) : null
        }
      >
        {highlightsQuery.isLoading ? (
          <LoadingRows rows={2} />
        ) : highlightsQuery.isError || !counts ? (
          <ErrorState title="This week did not load" detail="Your data is safe. Try again in a moment." onRetry={() => void highlightsQuery.refetch()} />
        ) : (
          <div className="space-y-5">
            <dl className={cn("grid grid-cols-2 gap-3", !compact && "sm:grid-cols-4")} data-testid="week-counts">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border px-3 py-2">
                  <dt className="text-[12px] text-muted-foreground">{stat.label}</dt>
                  <dd className="text-[20px] font-semibold tabular-nums text-foreground">{stat.value}</dd>
                  {deltaHint(stat.value, stat.prior) ? (
                    <dd className="text-[12px] text-muted-foreground">{deltaHint(stat.value, stat.prior)}</dd>
                  ) : null}
                </div>
              ))}
            </dl>

            {open ? (
              <div className="space-y-5 border-t border-border pt-4" data-testid="week-details">
                <p className="text-[12px] text-muted-foreground">{windowLabel}. These are recorded updates, not the conversion rate of this week's applications.</p>
                <Link to="/next-actions" className={cn(BUTTON.secondary, "inline-flex")}>Open Next Actions for current tasks</Link>
                {data?.readout ? <WeeksRead readout={data.readout} /> : null}

                {!hasEvents ? (
                  <p className="text-[13px] text-muted-foreground">
                    A quiet week in your inbox. As replies, interviews, offers and rejections arrive, they are listed here.
                  </p>
                ) : null}

                {h && hasEvents ? (
                  <div className={cn("grid items-start gap-5", !compact && "lg:grid-cols-2")}>
                    {h.newOffers.length ? (
                      <EventGroup icon={Sparkles} tone="positive" title="Offers">
                        {h.newOffers.map((item, idx) => <EventRow key={`offer-${idx}`} item={item} tone="positive" label="Offer" />)}
                      </EventGroup>
                    ) : null}
                    {h.newCallbacks.length ? (
                      <EventGroup icon={CheckCircle2} tone={STATUS_TONE.interview} title="Replies and interview moves">
                        {h.newCallbacks.map((item, idx) => <EventRow key={`cb-${idx}`} item={item} tone={STATUS_TONE.interview} label="Interview" />)}
                      </EventGroup>
                    ) : null}
                    {h.newRejections.length ? (
                      <EventGroup icon={XCircle} tone="risk" title="Rejections">
                        {h.newRejections.map((item, idx) => <EventRow key={`rej-${idx}`} item={item} tone="risk" />)}
                      </EventGroup>
                    ) : null}
                    {h.newApplications.length ? (
                      <EventGroup icon={Clock} tone="neutral" title="Applications first tracked">
                        {h.newApplications.map((item, idx) => <EventRow key={`app-${idx}`} item={item} tone="neutral" subjectLabel="First recorded email, for reference" />)}
                      </EventGroup>
                    ) : null}
                  </div>
                ) : null}

                {h?.topRejectionTheme ? (
                  <div className={cn("rounded-xl border px-4 py-3", TONES.risk.surface)}>
                    <p className={cn(EYEBROW, TONES.risk.text)}>Repeated wording (last 30 days)</p>
                    <p className="mt-1 text-[13px] text-foreground">
                      “{h.topRejectionTheme.phrase}”
                      <span className="text-muted-foreground"> — in {h.topRejectionTheme.occurrences} sampled rejection messages</span>
                    </p>
                    <p className="mt-2 text-[12px] text-muted-foreground">From up to 50 recent messages. Wording can be generic and does not establish a missing qualification.</p>
                  </div>
                ) : null}

                {/* No "weekly rates": dividing this week's outcomes by this week's applications mixes
                    two cohorts. The honest all-time rate lives on the Dashboard. */}
                <p className="text-[12px] text-muted-foreground">
                  Applications can have more than one kind of update in this window. Current tasks and their saved status are in Next Actions.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
