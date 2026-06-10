import { useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  FileText,
  CheckCircle2,
  Calendar,
  Sparkles,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchEmailMetrics, fetchWeeklyHighlights } from "@/lib/emails";
import type {
  WeeklyHighlightEmail,
  WeeklyHighlightSilent,
  WeeklyReadout,
} from "@/lib/emails";

function formatRelativeDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function HighlightRow({ item, accent }: { item: WeeklyHighlightEmail; accent?: string }) {
  const relativeDate = formatRelativeDate(item.date);
  return (
    <li className="text-sm leading-snug">
      <span className={`font-medium ${accent || "text-foreground"}`}>
        {item.company || "Unknown company"}
      </span>
      {item.position ? <span className="text-muted-foreground"> — {item.position}</span> : null}
      {item.subject ? (
        <span className="text-muted-foreground"> · "{item.subject}"</span>
      ) : null}
      {relativeDate ? (
        <span className="text-muted-foreground"> · {relativeDate}</span>
      ) : null}
    </li>
  );
}

function SilentRow({ item }: { item: WeeklyHighlightSilent }) {
  return (
    <li className="text-sm leading-snug">
      <span className="font-medium text-foreground">
        {item.company || "Unknown company"}
      </span>
      {item.position ? <span className="text-muted-foreground"> — {item.position}</span> : null}
      <span className="text-muted-foreground">
        {" "}
        · silent {item.daysSilent} day{item.daysSilent === 1 ? "" : "s"} after{" "}
        {item.stage === "interviewed" ? "interview" : "application"}
      </span>
      {item.subject ? (
        <span className="text-muted-foreground"> · last message "{item.subject}"</span>
      ) : null}
    </li>
  );
}

function ReadoutBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

// Neutral-coloured movement glyph: it shows direction of change only, never a
// good/bad verdict (more rejections "up" must not read as green/positive).
function DirectionGlyph({ direction }: { direction?: "up" | "down" | "flat" }) {
  const cls = "w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0";
  if (direction === "up") return <TrendingUp className={cls} />;
  if (direction === "down") return <TrendingDown className={cls} />;
  return <Minus className={cls} />;
}

function StrategicReadout({ readout }: { readout: WeeklyReadout }) {
  const { headline, confidence, sections } = readout;
  return (
    <div className="glass-card rounded-xl p-6 space-y-5 border border-accent/20">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-accent mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            This week's read
          </p>
          <p className="mt-1 text-base font-medium text-foreground leading-snug">
            {headline}
          </p>
          {confidence !== "normal" ? (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {confidence === "quiet"
                ? "Not much tracked activity this week — this read is light by design."
                : "Only a couple of events this week, so treat this as descriptive, not a trend."}
            </p>
          ) : null}
        </div>
      </div>

      {sections.nextWeek.length ? (
        <ReadoutBlock title="Do next week" icon={<ArrowRight className="w-4 h-4 text-accent" />}>
          {sections.nextWeek.map((item, idx) => (
            <li
              key={`nw-${idx}`}
              className={`text-sm leading-snug flex gap-2 ${
                item.priority === "high" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span className={item.priority === "high" ? "text-accent" : "text-muted-foreground"}>
                ›
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ReadoutBlock>
      ) : null}

      {sections.whatChanged.length || sections.whatWorked.length || sections.whatDidnt.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {sections.whatChanged.length ? (
            <ReadoutBlock
              title="What changed"
              icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
            >
              {sections.whatChanged.map((item, idx) => (
                <li key={`wc-${idx}`} className="text-sm leading-snug text-muted-foreground flex gap-2">
                  <DirectionGlyph direction={item.direction} />
                  <span>{item.text}</span>
                </li>
              ))}
            </ReadoutBlock>
          ) : null}

          {sections.whatWorked.length ? (
            <ReadoutBlock
              title="What worked"
              icon={<CheckCircle2 className="w-4 h-4 text-success" />}
            >
              {sections.whatWorked.map((item, idx) => (
                <li key={`ww-${idx}`} className="text-sm leading-snug text-foreground flex gap-2">
                  <span className="text-success">+</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ReadoutBlock>
          ) : null}

          {sections.whatDidnt.length ? (
            <ReadoutBlock
              title="What didn't"
              icon={<XCircle className="w-4 h-4 text-destructive" />}
            >
              {sections.whatDidnt.map((item, idx) => (
                <li key={`wd-${idx}`} className="text-sm leading-snug text-muted-foreground flex gap-2">
                  <span className="text-destructive">–</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ReadoutBlock>
          ) : null}
        </div>
      ) : null}

      {sections.emergingPattern ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 flex gap-3">
          <Lightbulb className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Emerging pattern
            </p>
            <p className="mt-1 text-sm text-foreground leading-snug">
              {sections.emergingPattern.text}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const WeeklySummary = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  const highlightsQuery = useQuery({
    queryKey: ["weekly-summary", "highlights", "last_7_days"],
    queryFn: () => fetchWeeklyHighlights("last_7_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const weekMetricsQuery = useQuery({
    queryKey: ["weekly-summary", "metrics", "last_7_days"],
    queryFn: () => fetchEmailMetrics("last_7_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const highlights = highlightsQuery.data;
  const readout = highlights?.readout;
  const weekMetrics = weekMetricsQuery.data?.metrics;

  const cards = useMemo(() => {
    const counts = highlights?.counts;
    return [
      {
        label: "Applications Sent",
        value: counts?.applications ?? "-",
        tone: "text-foreground",
      },
      {
        label: "Callbacks",
        value: counts ? counts.interviews + counts.offers : "-",
        tone: "text-success",
      },
      {
        label: "Interviews",
        value: counts?.interviews ?? "-",
        tone: "text-accent",
      },
      {
        label: "Rejections",
        value: counts?.rejections ?? "-",
        tone: "text-destructive",
      },
    ];
  }, [highlights]);

  const hasAnyHighlight =
    !!highlights &&
    (highlights.highlights.newCallbacks.length > 0
      || highlights.highlights.newOffers.length > 0
      || highlights.highlights.newRejections.length > 0
      || highlights.highlights.newApplications.length > 0
      || highlights.highlights.silentThreads.length > 0
      || !!highlights.highlights.topRejectionTheme);

  const isLoading = highlightsQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Weekly Summary
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Built from your inbox in the last 7 days, not just totals.
          </p>
        </div>

        {!isAuthed ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            Sign in to see your weekly summary.
          </div>
        ) : (
          <>
            {readout ? <StrategicReadout readout={readout} /> : null}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cards.map((card) => (
                <div key={card.label} className="glass-card rounded-xl p-4 text-center">
                  <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
                Building your weekly summary from this week's inbox activity...
              </div>
            ) : !hasAnyHighlight ? (
              <div className="glass-card rounded-xl p-6 space-y-2">
                <p className="text-sm text-foreground font-medium">
                  No tracked job-search activity this week.
                </p>
                <p className="text-sm text-muted-foreground">
                  As soon as recruiter emails, interviews, offers, or rejections land in your inbox, this view will quote them back to you here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {highlights?.highlights.newOffers.length ? (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-success" />
                      Offers this week
                    </h3>
                    <ul className="space-y-2">
                      {highlights.highlights.newOffers.map((item, idx) => (
                        <HighlightRow key={`offer-${idx}`} item={item} accent="text-success" />
                      ))}
                    </ul>
                  </div>
                ) : null}

                {highlights?.highlights.newCallbacks.length ? (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      Callbacks and interview moves
                    </h3>
                    <ul className="space-y-2">
                      {highlights.highlights.newCallbacks.map((item, idx) => (
                        <HighlightRow key={`cb-${idx}`} item={item} accent="text-accent" />
                      ))}
                    </ul>
                  </div>
                ) : null}

                {highlights?.highlights.newRejections.length ? (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Rejections this week
                    </h3>
                    <ul className="space-y-2">
                      {highlights.highlights.newRejections.map((item, idx) => (
                        <HighlightRow key={`rej-${idx}`} item={item} accent="text-destructive" />
                      ))}
                    </ul>
                    {highlights.highlights.topRejectionTheme ? (
                      <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                          Recurring rejection theme (last 30 days)
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          "{highlights.highlights.topRejectionTheme.phrase}"{" "}
                          <span className="text-muted-foreground">
                            — appeared in {highlights.highlights.topRejectionTheme.occurrences} rejections
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {highlights?.highlights.silentThreads.length ? (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      Threads going silent
                    </h3>
                    <ul className="space-y-2">
                      {highlights.highlights.silentThreads.map((item, idx) => (
                        <SilentRow key={`silent-${idx}`} item={item} />
                      ))}
                    </ul>
                  </div>
                ) : null}

                {highlights?.highlights.newApplications.length ? (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      New applications detected
                    </h3>
                    <ul className="space-y-2">
                      {highlights.highlights.newApplications.map((item, idx) => (
                        <HighlightRow key={`app-${idx}`} item={item} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {weekMetrics ? (
              <div className="glass-card rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  Weekly rates
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Response rate: {weekMetrics.responseRate.toFixed(1)}%</li>
                  <li>Interview rate: {weekMetrics.interviewRate.toFixed(1)}%</li>
                  <li>Offer rate: {weekMetrics.offerRate.toFixed(1)}%</li>
                  <li>Rejection rate: {weekMetrics.rejectionRate.toFixed(1)}%</li>
                </ul>
                {weekMetrics.windowMisaligned ? (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    Some outcomes this week match applications sent outside the 7-day window. Rates are capped at 100% — check the all-time view in Outcome Memory for an unclipped picture.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Beta note</h3>
          <p className="text-sm text-muted-foreground">
            This is an in-app summary. Scheduled email delivery is not part of the current beta.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WeeklySummary;
