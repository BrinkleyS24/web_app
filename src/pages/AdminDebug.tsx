import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
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

type ReportRow = {
  id: number;
  emailId: number;
  threadId: string;
  originalCategory: string;
  correctedCategory: string;
  status: string;
  reportedAt: string;
  userEmail: string;
  subject: string;
  subjectPreview: string;
  bodyPreview: string;
  body: string;
  currentCategory: string | null;
  currentEmailId: number | null;
  currentRecordSource: "email_id" | "thread_fallback" | null;
  currentRecordMissing: boolean;
  currentConfidence: number | null;
  companyName: string | null;
  position: string | null;
  emailDate: string | null;
  rawCategory: string | null;
  rawConfidence: number | null;
  guardrailApplied: boolean;
  guardrailReasons: string[];
  metadataAvailable: boolean;
  classificationMeta: Record<string, unknown>;
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
  originalCategories: CounterEntry[];
  correctedCategories: CounterEntry[];
  replay: {
    total: number;
    availableApprovedCorrections: number;
    trainingApprovedCorrections: number;
    holdoutApprovedCorrections: number;
    correctionsSplit: string;
    holdoutRatio: number;
    fixed: number;
    changedButStillWrong: number;
    unchangedError: number;
    fixRate: number;
    changedButStillWrongRate: number;
    unchangedErrorRate: number;
    transitions: CounterEntry[];
    replayTransitions: CounterEntry[];
    guardrailReasons: CounterEntry[];
    sampleRows: ReplayRow[];
  };
  reports: ReportRow[];
};

const DEFAULT_FILTERS = {
  search: "",
  status: "pending",
  limit: 75,
};

function truncateText(value?: string | null, max = 280) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function reportMetadataMessage(report: ReportRow) {
  if (report.metadataAvailable) {
    if (report.currentRecordSource === "thread_fallback") {
      return "Metadata restored from the current email row matched by thread.";
    }
    return "Current email metadata is available.";
  }

  if (report.currentRecordMissing) {
    return "No current emails row matched this report. The original row was likely deleted or replaced during a resync, so current metadata is unavailable.";
  }

  return "The current emails row exists, but classification metadata is empty on that row.";
}

function normalizeLifecycleStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "offer" || normalized === "offered" || normalized === "offers") return "offers";
  if (normalized === "interview" || normalized === "interviewed") return "interviewed";
  if (normalized === "rejected" || normalized === "reject") return "rejected";
  if (normalized === "applied" || normalized === "apply") return "applied";
  return null;
}

function categoryLabel(value?: string | null) {
  const normalized = normalizeLifecycleStatus(value);
  if (normalized === "offers") return "Offer";
  if (normalized === "interviewed") return "Interviewed";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "applied") return "Applied";
  if (!value) return "Unknown";
  return String(value);
}

function reportStatusClass(status?: string) {
  switch (String(status || "").trim().toLowerCase()) {
    case "approved":
      return "bg-success/10 text-success border border-success/20";
    case "processed":
      return "bg-accent/10 text-accent border border-accent/20";
    case "pending":
      return "bg-warning/15 text-warning-foreground border border-warning/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
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

export default function AdminDebug() {
  const { debugRoutesEnabled } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<string>("");
  const [actionMessage, setActionMessage] = useState("");
  const [companyBackfillLimit, setCompanyBackfillLimit] = useState("500");
  const [applicationBackfillLimit, setApplicationBackfillLimit] = useState("500");

  async function reviewReport(reportId: number, nextStatus: "pending" | "approved" | "rejected") {
    await runAction(`report-${reportId}-${nextStatus}`, () =>
      apiFetch(`/api/admin/debug/misclassification-reports/${reportId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      }));
  }

  async function bulkReview(reportIds: number[], nextStatus: "pending" | "approved" | "rejected") {
    if (!reportIds.length) return;
    await runAction(`bulk-${nextStatus}`, () =>
      apiFetch("/api/admin/debug/misclassification-reports/bulk-status", {
        method: "POST",
        body: { reportIds, status: nextStatus },
      }));
  }

  async function loadDashboard(nextFilters = filters) {
    if (!debugRoutesEnabled) return;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(nextFilters.limit),
        status: nextFilters.status,
      });
      if (nextFilters.search.trim()) params.set("search", nextFilters.search.trim());
      const response = await apiFetch(`/api/admin/debug/classification-dashboard?${params.toString()}`, {
        method: "GET",
      });
      setData(response as DashboardPayload);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin debug dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugRoutesEnabled, filters]);

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

  const visiblePendingReportIds = useMemo(
    () => (data?.reports || []).filter((report) => report.status === "pending").map((report) => report.id),
    [data],
  );

  const visibleReviewedReportIds = useMemo(
    () => (data?.reports || []).filter((report) => report.status === "approved" || report.status === "rejected").map((report) => report.id),
    [data],
  );

  async function runAction(actionKey: string, runner: () => Promise<any>) {
    setActionBusy(actionKey);
    setActionMessage("");
    try {
      const result = await runner();
      const message = result?.message
        || `Completed ${actionKey.replace(/-/g, " ")} successfully.`;
      setActionMessage(message);
      await loadDashboard(filters);
    } catch (err: any) {
      setActionMessage(err?.message || `Failed to run ${actionKey}.`);
    } finally {
      setActionBusy("");
    }
  }

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review misclassification reports, inspect classifier metadata, and run debugging tools from a dedicated admin surface.
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3 text-sm text-muted-foreground">
            Last refresh: <span className="font-medium text-foreground">{formatDateTime(data?.requestedAt)}</span>
          </div>
        </div>

        <section className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium text-foreground">Review workflow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            New reports should sit in <span className="font-medium text-foreground">pending</span>. Approve clean corrections that should count for replay, benchmarking, and future fine-tuning. Reject noisy reports. If you are unsure, move a reviewed item back to pending and decide later.
          </p>
        </section>

        {!debugRoutesEnabled ? (
          <section className="glass-card rounded-xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-warning-foreground">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-base font-semibold text-foreground">Debug Routes Disabled</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              The frontend route is available for admin accounts, but the backend gate is off. Set <code>ENABLE_ADMIN_DEBUG_ROUTES=true</code> on the backend to enable live debug data and repair actions.
            </p>
          </section>
        ) : (
          <>
            <section className="glass-card rounded-xl p-5 space-y-4 w-full min-w-0">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Filters</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_120px_auto]">
                <Input
                  value={draftFilters.search}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Search subject, body, user, category, status"
                />

                <select
                  value={draftFilters.status}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="processed">Processed</option>
                  <option value="rejected">Rejected</option>
                  <option value="undone">Undone</option>
                </select>

                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={draftFilters.limit}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, limit: Number(event.target.value || 75) }))}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFilters(draftFilters)}
                    disabled={loading}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => loadDashboard(filters)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Bulk Review</p>
                  <p className="text-sm text-muted-foreground">
                    Visible pending: {visiblePendingReportIds.length} | visible reviewed: {visibleReviewedReportIds.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!visiblePendingReportIds.length || actionBusy === "bulk-approved"}
                    onClick={() => bulkReview(visiblePendingReportIds, "approved")}
                  >
                    {actionBusy === "bulk-approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Approve Visible Pending
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!visiblePendingReportIds.length || actionBusy === "bulk-rejected"}
                    onClick={() => bulkReview(visiblePendingReportIds, "rejected")}
                  >
                    {actionBusy === "bulk-rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Reject Visible Pending
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!visibleReviewedReportIds.length || actionBusy === "bulk-pending"}
                    onClick={() => bulkReview(visibleReviewedReportIds, "pending")}
                  >
                    {actionBusy === "bulk-pending" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Move Visible Back To Pending
                  </Button>
                </div>
              </div>
            </section>

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
                  {" "}({data?.replay.holdoutApprovedCorrections ?? 0} eval / {data?.replay.trainingApprovedCorrections ?? 0} train).
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

            <section className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Repair Tools</h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Company / Position Backfill</p>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={companyBackfillLimit}
                    onChange={(event) => setCompanyBackfillLimit(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionBusy === "company-backfill"}
                    onClick={() => runAction("company-backfill", () => apiFetch("/api/emails/company-position/backfill", {
                      method: "POST",
                      body: {
                        limit: Number(companyBackfillLimit || 500),
                        all: false,
                        relink: true,
                      },
                    }))}
                  >
                    {actionBusy === "company-backfill" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    Run Backfill
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Application Link Backfill</p>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={applicationBackfillLimit}
                    onChange={(event) => setApplicationBackfillLimit(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionBusy === "application-backfill"}
                    onClick={() => runAction("application-backfill", () => apiFetch("/api/emails/applications/backfill", {
                      method: "POST",
                      body: {
                        limit: Number(applicationBackfillLimit || 500),
                      },
                    }))}
                  >
                    {actionBusy === "application-backfill" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    Repair Links
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Role Normalization Cache</p>
                  <p className="text-sm text-muted-foreground">
                    Clear the normalization cache when you want fresh role-family grouping during debugging.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionBusy === "clear-role-cache"}
                    onClick={() => runAction("clear-role-cache", () => apiFetch("/api/emails/normalize-roles/cache", {
                      method: "DELETE",
                    }))}
                  >
                    {actionBusy === "clear-role-cache" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Clear Cache
                  </Button>
                </div>
              </div>

              {actionMessage && (
                <p className="text-sm text-muted-foreground">{actionMessage}</p>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h2 className="text-base font-semibold text-foreground">Recent Misclassification Reports</h2>
              </div>

              {!data?.reports?.length ? (
                <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
                  No reports matched the current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.reports.map((report) => {
                    const lifecycleStatus = normalizeLifecycleStatus(report.correctedCategory);
                    const currentLifecycleStatus = normalizeLifecycleStatus(report.currentCategory);
                    const reportActionBusy = actionBusy.startsWith(`report-${report.id}-`);

                    return (
                      <article key={report.id} className="glass-card w-full max-w-full min-w-0 overflow-hidden rounded-xl p-4 space-y-3">
                        <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${reportStatusClass(report.status)}`}>
                                {report.status}
                              </span>
                              {lifecycleStatus ? (
                                <StatusBadge status={lifecycleStatus as "applied" | "interviewed" | "offers" | "rejected"} />
                              ) : (
                                <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {categoryLabel(report.correctedCategory)}
                                </span>
                              )}
                              {currentLifecycleStatus && (
                                <StatusBadge status={currentLifecycleStatus as "applied" | "interviewed" | "offers" | "rejected"} />
                              )}
                            </div>
                            <h3 className="break-words text-base font-semibold text-foreground">
                              {truncateText(report.subjectPreview || report.subject, 110) || "Untitled report"}
                            </h3>
                            <p className="break-words text-sm text-muted-foreground">
                              {report.originalCategory || "Unknown"} {"->"} {report.correctedCategory || "Unknown"} {"-"} reported by {report.userEmail || "unknown user"} {"-"} {formatDateTime(report.reportedAt)}
                            </p>
                          </div>

                          <div className="min-w-0 text-left text-sm text-muted-foreground 2xl:w-[200px] 2xl:text-right">
                            <div>Current: <span className="font-medium text-foreground">{report.currentCategory || "missing"}</span></div>
                            <div>Confidence: <span className="font-medium text-foreground">{formatPercent(report.currentConfidence)}</span></div>
                            <div>Raw: <span className="font-medium text-foreground">{report.rawCategory || "n/a"}</span></div>
                            <div className="mt-2 text-xs text-muted-foreground/90 break-words">
                              {reportMetadataMessage(report)}
                            </div>
                            {report.status === "pending" ? (
                              <div className="mt-3 flex flex-wrap gap-2 2xl:justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reportActionBusy}
                                  onClick={() => reviewReport(report.id, "approved")}
                                >
                                  {actionBusy === `report-${report.id}-approved` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : null}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={reportActionBusy}
                                  onClick={() => reviewReport(report.id, "rejected")}
                                >
                                  {actionBusy === `report-${report.id}-rejected` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : null}
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-3 flex flex-wrap gap-2 2xl:justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reportActionBusy}
                                  onClick={() => reviewReport(report.id, "pending")}
                                >
                                  {actionBusy === `report-${report.id}-pending` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : null}
                                  Move To Pending
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
                            <p className="mt-1 break-words text-foreground">{report.companyName || "--"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Position</p>
                            <p className="mt-1 break-words text-foreground">{report.position || "--"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email Date</p>
                            <p className="mt-1 text-foreground">{formatDateTime(report.emailDate)}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Body Preview</p>
                          <p className="break-all text-sm text-muted-foreground leading-relaxed">
                            {truncateText(report.bodyPreview, 260) || "No body captured."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {report.guardrailReasons?.length > 0 ? report.guardrailReasons.map((reason) => (
                            <span key={reason} className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                              {reason}
                            </span>
                          )) : (
                            <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              No guardrail reasons on current row
                            </span>
                          )}
                        </div>

                        <details className="min-w-0 overflow-hidden rounded-lg border border-border bg-background/60 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-medium text-foreground">
                            Classification Metadata
                          </summary>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {reportMetadataMessage(report)}
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                            {JSON.stringify(report.classificationMeta || {}, null, 2)}
                          </pre>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
