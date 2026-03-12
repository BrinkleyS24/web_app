import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FileText, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/firebase";
import { fetchEmailMetrics } from "@/lib/emails";

const WeeklySummary = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  const weekMetricsQuery = useQuery({
    queryKey: ["weekly-summary", "last_7_days"],
    queryFn: () => fetchEmailMetrics("last_7_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const monthMetricsQuery = useQuery({
    queryKey: ["weekly-summary", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const weekMetrics = weekMetricsQuery.data?.metrics;
  const monthMetrics = monthMetricsQuery.data?.metrics;

  const summaryText = useMemo(() => {
    if (!weekMetrics) return "Loading your weekly summary...";
    const callbacks = weekMetrics.totalInterviewed + weekMetrics.totalOffers;
    const responseRate = weekMetrics.responseRate.toFixed(1);
    const mostActive = monthMetrics?.totalApplications ? "Keep momentum to improve response rate." : "Start with a few targeted applications.";
    return `This week you sent ${weekMetrics.totalApplications} applications, received ${callbacks} callbacks, and landed ${weekMetrics.totalInterviewed} interviews. Your response rate for the week is ${responseRate}%. ${mostActive}`;
  }, [monthMetrics?.totalApplications, weekMetrics]);

  const cards = useMemo(() => {
    return [
      { label: "Applications Sent", value: weekMetrics?.totalApplications ?? "-", tone: "text-foreground" },
      { label: "Callbacks Received", value: weekMetrics ? weekMetrics.totalInterviewed + weekMetrics.totalOffers : "-", tone: "text-success" },
      { label: "Interviews Scheduled", value: weekMetrics?.totalInterviewed ?? "-", tone: "text-accent" },
    ];
  }, [weekMetrics]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            Weekly Summary
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Your latest 7-day summary.</p>
        </div>
        {!isAuthed ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            Sign in to see your weekly summary.
          </div>
        ) : (
          <>
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">What to Do Next</h2>
              <p className="text-sm text-foreground leading-relaxed">{summaryText}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div key={card.label} className="glass-card rounded-xl p-5 text-center">
                  <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Key Takeaways</h3>
              <div className="space-y-2">
                {[
                  `Response rate this week: ${weekMetrics ? weekMetrics.responseRate.toFixed(1) : "-"}%.`,
                  `Interview rate: ${weekMetrics ? weekMetrics.interviewRate.toFixed(1) : "-"}%.`,
                  `Offer rate: ${weekMetrics ? weekMetrics.offerRate.toFixed(1) : "-"}%.`,
                  `Rejection rate: ${weekMetrics ? weekMetrics.rejectionRate.toFixed(1) : "-"}%.`,
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowRight className="w-3 h-3 text-accent shrink-0 mt-1" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Delivery Preferences</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Switch id="dash-summary" defaultChecked />
              <Label htmlFor="dash-summary" className="text-sm text-muted-foreground">Show in dashboard</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="email-summary" />
              <Label htmlFor="email-summary" className="text-sm text-muted-foreground">Email every Monday</Label>
            </div>
          </div>
        </div>

        <Button variant="outline" className="text-sm gap-2" disabled={!isAuthed}>
          <Send className="w-4 h-4" />
          Send to My Email Now
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default WeeklySummary;
