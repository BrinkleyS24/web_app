import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Bell, AlertTriangle, TrendingUp, Target } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/firebase";
import { fetchFollowupSuggestions } from "@/lib/emails";

const typeStyles: Record<string, string> = {
  warning: "border-l-warning bg-warning/5",
  positive: "border-l-success bg-success/5",
  neutral: "border-l-accent bg-accent/5",
};

const StrategyAlerts = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  const followupQuery = useQuery({
    queryKey: ["strategy-alerts", "followup"],
    queryFn: async () => {
      try {
        return await fetchFollowupSuggestions();
      } catch (err) {
        return {
          success: false,
          suggestions: [],
          error: err instanceof Error ? err.message : "Unable to load suggestions",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const alerts = useMemo(() => {
    const suggestions = followupQuery.data?.suggestions || [];
    if (suggestions.length === 0) return [];

    return suggestions.map((item) => {
      const urgency = item.urgency || "medium";
      const type = urgency === "high" ? "warning" : urgency === "low" ? "neutral" : "positive";
      const text = item.description || item.title || item.subject || "Follow up";
      const company = item.company ? ` - ${item.company}` : "";
      const days = typeof item.daysAgo === "number" ? ` - ${item.daysAgo}d ago` : "";
      return {
        type,
        text: `${text}${company}`,
        time: days || "",
      };
    });
  }, [followupQuery.data]);

  const emptyMessage = useMemo(() => {
    if (!isAuthed) return "Sign in to see strategy alerts.";
    if (followupQuery.data?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock strategy alerts.";
    }
    if (followupQuery.isLoading) return "Loading alerts...";
    return "No alerts yet.";
  }, [followupQuery.data?.error, followupQuery.isLoading, isAuthed]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" />
              Strategy Alerts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Smart nudges to sharpen your job search.</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Notification Preferences</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Switch id="dashboard-notif" defaultChecked />
              <Label htmlFor="dashboard-notif" className="text-sm text-muted-foreground">Dashboard pop-ups</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="email-notif" />
              <Label htmlFor="email-notif" className="text-sm text-muted-foreground">Email notifications</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div
                key={`${alert.text}-${i}`}
                className={"glass-card rounded-xl p-4 border-l-4 flex items-start gap-3 animate-fade-in " + typeStyles[alert.type]}
                style={{ animationDelay: i * 60 + "ms" }}
              >
                {alert.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                ) : alert.type === "positive" ? (
                  <TrendingUp className="w-4 h-4 shrink-0 mt-0.5 text-success" />
                ) : (
                  <Target className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">{alert.text}</p>
                  {alert.time ? <p className="text-xs text-muted-foreground mt-1">{alert.time}</p> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StrategyAlerts;
