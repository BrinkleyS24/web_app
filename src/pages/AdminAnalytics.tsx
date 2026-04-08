import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { AdminDebugDisabledNotice } from "@/components/AdminDebugDisabledNotice";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext.jsx";

type CounterEntry = {
  key: string;
  count: number;
};

type ReplayRow = {
  id: string | number | null;
  reportedAt: string | null;
  subject: string;
  originalCategory: string;
  correctedCategory: string;
  replayedCategory: string;
  outcome: string;
  guardrailApplied: boolean;
  guardrailReasons: string[];
};

type DashboardPayload = {
  requestedAt: string;
  summary: {
    totalReports: number;
    pendingReports: number;
    approvedReports: number;
    processedReports: number;
    rejectedReports: number;
    recent7Days: number;
    recent30Days: number;
    recentFilteredUsers: number;
  };
  recentTransitions: CounterEntry[];
  correctedCategories: CounterEntry[];
  replay: {
    total: number;
    availableApprovedCorrections: number;
    trainingApprovedCorrections: number;
    holdoutApprovedCorrections: number;
    fixed: number;
    changedButStillWrong: number;
    unchangedError: number;
    fixRate: number;
    guardrailReasons: CounterEntry[];
    sampleRows: ReplayRow[];
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function outcomeTone(outcome?: string) {
  switch (outcome) {
    case "fixed":
      return "text-success";
    case "changed_but_still_wrong":
      return "text-warning";
    default:
      return "text-destructive";
  }
}

function CounterList({ title, items, empty }: { title: string; items: CounterEntry[]; empty: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 8).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{item.key}</span>
              <span className="font-medium text-foreground">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const { debugRoutesEnabled } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    if (!debugRoutesEnabled) return;

    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/debug/classification-dashboard?limit=75&status=all", {
        method: "GET",
      });
      setData(response as DashboardPayload);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugRoutesEnabled]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Reports", value: data.summary.totalReports, tone: "text-foreground" },
      { label: "Approved", value: data.summary.approvedReports, tone: "text-success" },
      { label: "Processed", value: data.summary.processedReports, tone: "text-accent" },
      { label: "Pending", value: data.summary.pendingReports, tone: "text-warning" },
      { label: "Last 7 Days", value: data.summary.recent7Days, tone: "text-foreground" },
      { label: "Replay Fix Rate", value: formatPercent(data.replay.fixRate), tone: "text-success" },
    ];
  }, [data]);

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Replay quality, transition trends, and classifier debugging signals in a separate read-only surface.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card rounded-xl px-4 py-3 text-sm text-muted-foreground">
              Last refresh: <span className="font-medium text-foreground">{formatDateTime(data?.requestedAt)}</span>
            </div>
            <Button variant="outline" onClick={loadAnalytics} disabled={loading || !debugRoutesEnabled}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {!debugRoutesEnabled ? (
          <AdminDebugDisabledNotice />
        ) : (
          <>
            {error ? (
              <section className="glass-card rounded-xl p-4">
                <p className="text-sm text-destructive">{error}</p>
              </section>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="glass-card rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h2 className="text-base font-semibold text-foreground">Replay Summary</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Holdout replay over {data?.replay.total ?? 0} of {data?.replay.availableApprovedCorrections ?? 0} approved corrections
                  {" "}
                  ({data?.replay.holdoutApprovedCorrections ?? 0} eval / {data?.replay.trainingApprovedCorrections ?? 0} train).
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fixed</p>
                    <p className="mt-1 text-xl font-semibold text-success">{data?.replay.fixed ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Changed But Wrong</p>
                    <p className="mt-1 text-xl font-semibold text-warning">{data?.replay.changedButStillWrong ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Unchanged</p>
                    <p className="mt-1 text-xl font-semibold text-destructive">{data?.replay.unchangedError ?? 0}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(data?.replay.sampleRows || []).slice(0, 5).map((row) => (
                    <div key={`${row.id}-${row.reportedAt}`} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">{row.subject || "Untitled report"}</p>
                        <span className={`shrink-0 text-xs font-medium ${outcomeTone(row.outcome)}`}>
                          {row.outcome.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.originalCategory} {"->"} {row.replayedCategory} (expected {row.correctedCategory})
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <CounterList
                title="Top Guardrail Reasons"
                items={data?.replay.guardrailReasons || []}
                empty="No replay guardrail reasons yet."
              />

              <CounterList
                title="Recent Report Transitions"
                items={data?.recentTransitions || []}
                empty="No report transitions yet."
              />
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
