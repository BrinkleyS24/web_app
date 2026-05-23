import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchEmailMetrics, fetchWeeklyHighlights } from "@/lib/emails";
import type { WeeklyHighlightEmail, WeeklyHighlightSilent } from "@/lib/emails";

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
