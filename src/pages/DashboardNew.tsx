import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Send, MessageSquare, UserCheck, TrendingUp, Bell, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import {
  fetchEmailMetrics,
  fetchFollowupSuggestions,
  fetchStoredEmails,
  startEmailSync,
} from "@/lib/emails";
import { getEmailCompany, getEmailTitle } from "@/lib/emailFormatting";

const Dashboard = () => {
  const [user, setUser] = useState(auth?.currentUser ?? null);
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    startEmailSync().catch(() => undefined);
  }, [isAuthed]);

  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const storedEmailsQuery = useQuery({
    queryKey: ["stored-emails", 4],
    queryFn: () => fetchStoredEmails({ limit: 4, offset: 0 }),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const followupQuery = useQuery({
    queryKey: ["followup-suggestions"],
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

  const metrics = metricsQuery.data?.metrics;
  const appliedCount = metrics?.totalApplications;
  const callbacksCount = metrics ? metrics.totalInterviewed + metrics.totalOffers : undefined;
  const interviewsCount = metrics?.totalInterviewed;
  const responseRate = metrics ? `${metrics.responseRate.toFixed(1)}%` : "-";

  const recentEmails = storedEmailsQuery.data?.emails || [];
  const recentItems = useMemo(
    () =>
      recentEmails.map((email) => {
        const rawCategory = (email.category || "").toString().toLowerCase();
        const status =
          rawCategory === "applied" ||
          rawCategory === "interviewed" ||
          rawCategory === "offers" ||
          rawCategory === "rejected"
            ? rawCategory
            : "applied";

        return {
          id: email.id,
          title: getEmailTitle(email),
          company: getEmailCompany(email),
          status: status as "applied" | "interviewed" | "offers" | "rejected",
        };
      }),
    [recentEmails]
  );

  const alertItems = useMemo(() => {
    const suggestions = followupQuery.data?.suggestions || [];
    if (suggestions.length > 0) {
      return suggestions.map((item) => {
        const title = item.title || item.subject || "Follow up";
        const company = item.company ? ` - ${item.company}` : "";
        const days = typeof item.daysAgo === "number" ? ` - ${item.daysAgo}d ago` : "";
        return `${title}${company}${days}`;
      });
    }

    if (!isAuthed) return ["Sign in to see follow-up suggestions."];
    if (followupQuery.data?.error?.includes("Premium feature required")) {
      return ["Upgrade to Premium to see follow-up suggestions."];
    }
    return ["No follow-up suggestions yet."];
  }, [followupQuery.data, isAuthed]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Where you stand</h1>
          <p className="text-muted-foreground mt-1">Your latest activity based on synced emails.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Send} label="Applied" value={appliedCount ?? "-"} />
          <MetricCard icon={MessageSquare} label="Callbacks" value={callbacksCount ?? "-"} />
          <MetricCard icon={UserCheck} label="Interviews" value={interviewsCount ?? "-"} />
          <MetricCard icon={TrendingUp} label="Response Rate" value={responseRate} />
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Strategy Alerts</h3>
          </div>
          <div className="space-y-2">
            {alertItems.map((alert, i) => (
              <p key={i} className="text-sm text-muted-foreground pl-6">{alert}</p>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Apply Gate Results</h2>
            <Link to="/apply-gate" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentItems.length === 0 ? (
              <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
                {isAuthed ? "No recent emails yet." : "Sign in to see recent emails."}
              </div>
            ) : (
              recentItems.map((job, i) => (
                <div key={job.id} className="glass-card rounded-xl p-4 flex items-center justify-between" style={{ animationDelay: i * 80 + "ms" }}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.company}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Fix Suggestions", to: "/fix-suggestions" },
            { label: "Outcome Memory", to: "/outcome-memory" },
            { label: "Weekly Summary", to: "/weekly-summary" },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="glass-card rounded-xl p-4 text-sm font-medium text-foreground hover:border-accent/40 transition-colors text-center"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
