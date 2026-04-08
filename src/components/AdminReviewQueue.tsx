import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";

type ReviewFilterStatus = "all" | "pending" | "approved" | "processed" | "rejected" | "undone";
type ReviewActionStatus = "pending" | "approved" | "rejected";

type ReviewFilters = {
  search: string;
  status: ReviewFilterStatus;
  limit: number;
  offset: number;
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
  fromHeader: string;
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

type QueuePayload = {
  items: ReportRow[];
  pagination: {
    totalCount: number;
    limit: number;
    offset: number;
    returnedCount: number;
    hasMore: boolean;
  };
};

type AdminReviewQueueProps = {
  onQueueMutated?: () => Promise<void> | void;
};

const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  search: "",
  status: "pending",
  limit: 25,
  offset: 0,
};

const CORRECTION_OPTIONS = ["Applied", "Interviewed", "Offers", "Rejected", "Irrelevant"] as const;

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

function queueMetadataTone(report: ReportRow) {
  if (report.currentRecordMissing) {
    return "bg-destructive/10 text-destructive border border-destructive/20";
  }
  if (report.currentRecordSource === "thread_fallback") {
    return "bg-accent/10 text-accent border border-accent/20";
  }
  if (!report.metadataAvailable) {
    return "bg-warning/15 text-warning-foreground border border-warning/20";
  }
  return "bg-success/10 text-success border border-success/20";
}

function queueMetadataLabel(report: ReportRow) {
  if (report.currentRecordMissing) return "Missing row";
  if (report.currentRecordSource === "thread_fallback") return "Thread fallback";
  if (!report.metadataAvailable) return "Metadata empty";
  return "Metadata present";
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="h-4 w-4 rounded border-border bg-background text-accent accent-[color:var(--color-accent)]"
    />
  );
}

export function AdminReviewQueue({ onQueueMutated }: AdminReviewQueueProps) {
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_REVIEW_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ReviewFilters>(DEFAULT_REVIEW_FILTERS);
  const [queueData, setQueueData] = useState<QueuePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<string>("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [draftCorrectedCategory, setDraftCorrectedCategory] = useState<string>("Applied");

  async function loadQueue(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(nextFilters.limit),
        offset: String(nextFilters.offset),
        status: nextFilters.status,
      });
      if (nextFilters.search.trim()) params.set("search", nextFilters.search.trim());
      const response = await apiFetch(`/api/admin/debug/report-queue?${params.toString()}`, {
        method: "GET",
      });
      setQueueData(response as QueuePayload);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin report queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const visibleIds = new Set((queueData?.items || []).map((report) => report.id));
    setSelectedReportIds((prev) => prev.filter((id) => visibleIds.has(id)));
    if (activeReportId != null && !visibleIds.has(activeReportId)) {
      setActiveReportId(null);
    }
  }, [queueData, activeReportId]);

  async function runAction(
    actionKey: string,
    runner: () => Promise<any>,
    options: { clearSelection?: boolean } = {},
  ) {
    setActionBusy(actionKey);
    setActionMessage("");
    try {
      const result = await runner();
      if (options.clearSelection) {
        setSelectedReportIds([]);
      }
      const message = result?.message
        || `Completed ${actionKey.replace(/-/g, " ")} successfully.`;
      setActionMessage(message);
      await loadQueue(filters);
      if (onQueueMutated) {
        await onQueueMutated();
      }
    } catch (err: any) {
      setActionMessage(err?.message || `Failed to run ${actionKey}.`);
    } finally {
      setActionBusy("");
    }
  }

  async function reviewReport(reportId: number, nextStatus: ReviewActionStatus) {
    await runAction(`report-${reportId}-${nextStatus}`, () =>
      apiFetch(`/api/admin/debug/misclassification-reports/${reportId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      }));
  }

  async function bulkReview(reportIds: number[], nextStatus: ReviewActionStatus) {
    if (!reportIds.length) return;
    await runAction(`bulk-${nextStatus}`, () =>
      apiFetch("/api/admin/debug/misclassification-reports/bulk-status", {
        method: "POST",
        body: { reportIds, status: nextStatus },
      }), { clearSelection: true });
  }

  async function saveCorrection(reportId: number, correctedCategory: string) {
    await runAction(`correction-${reportId}`, () =>
      apiFetch(`/api/admin/debug/misclassification-reports/${reportId}/correction`, {
        method: "PATCH",
        body: {
          correctedCategory,
          resetStatus: true,
        },
      }));
  }

  const queueItems = queueData?.items || [];
  const visibleReportIds = useMemo(() => queueItems.map((report) => report.id), [queueItems]);
  const allVisibleSelected = visibleReportIds.length > 0
    && visibleReportIds.every((id) => selectedReportIds.includes(id));
  const someVisibleSelected = visibleReportIds.some((id) => selectedReportIds.includes(id)) && !allVisibleSelected;

  const selectedReports = useMemo(() => {
    const byId = new Map(queueItems.map((report) => [report.id, report]));
    return selectedReportIds
      .map((id) => byId.get(id))
      .filter(Boolean) as ReportRow[];
  }, [queueItems, selectedReportIds]);

  const selectedPendingIds = useMemo(
    () => selectedReports
      .filter((report) => report.status === "pending")
      .map((report) => report.id),
    [selectedReports],
  );

  const selectedReviewedIds = useMemo(
    () => selectedReports
      .filter((report) => report.status === "approved" || report.status === "rejected")
      .map((report) => report.id),
    [selectedReports],
  );

  const activeReport = useMemo(
    () => queueItems.find((report) => report.id === activeReportId) || null,
    [activeReportId, queueItems],
  );

  const pagination = queueData?.pagination;
  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalCount / pagination.limit)) : 1;
  const firstVisibleIndex = pagination && pagination.totalCount > 0 ? pagination.offset + 1 : 0;
  const lastVisibleIndex = pagination ? pagination.offset + pagination.returnedCount : 0;

  useEffect(() => {
    if (activeReport) {
      setDraftCorrectedCategory(activeReport.correctedCategory || "Applied");
      return;
    }

    setDraftCorrectedCategory("Applied");
  }, [activeReport]);

  function toggleReportSelection(reportId: number) {
    setSelectedReportIds((prev) => (
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    ));
  }

  function toggleAllVisibleSelection() {
    setSelectedReportIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleReportIds.includes(id));
      }
      return [...new Set([...prev, ...visibleReportIds])];
    });
  }

  function applyDraftFilters() {
    const nextFilters = {
      ...draftFilters,
      search: draftFilters.search.trim(),
      offset: 0,
    };
    setSelectedReportIds([]);
    setActiveReportId(null);
    setFilters(nextFilters);
  }

  function resetFilters() {
    setSelectedReportIds([]);
    setActiveReportId(null);
    setDraftFilters(DEFAULT_REVIEW_FILTERS);
    setFilters(DEFAULT_REVIEW_FILTERS);
  }

  function goToOffset(nextOffset: number) {
    setSelectedReportIds([]);
    setActiveReportId(null);
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, nextOffset),
    }));
  }

  return (
    <>
      <section className="glass-card overflow-hidden rounded-xl">
        <div className="border-b border-border px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Review Queue</p>
              <h2 className="text-base font-semibold text-foreground">Server-backed triage queue</h2>
              <p className="text-sm text-muted-foreground">
                Search and pagination run against the backend instead of filtering only the visible slice.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => loadQueue(filters)}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </Button>
              <div className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{firstVisibleIndex}</span>
                {" - "}
                <span className="font-medium text-foreground">{lastVisibleIndex}</span>
                {" "}of{" "}
                <span className="font-medium text-foreground">{pagination?.totalCount ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
            <Input
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search subject, sender, body, reporter, category, status, thread"
            />

            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value as ReviewFilterStatus }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processed">Processed</option>
              <option value="rejected">Rejected</option>
              <option value="undone">Undone</option>
            </select>

            <select
              value={String(draftFilters.limit)}
              onChange={(event) => setDraftFilters((prev) => ({
                ...prev,
                limit: Number(event.target.value || 25),
              }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={applyDraftFilters}
                disabled={loading}
              >
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={resetFilters}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Selected rows</p>
              <p className="text-sm text-muted-foreground">
                {selectedReportIds.length} selected · {selectedPendingIds.length} pending · {selectedReviewedIds.length} reviewed
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedPendingIds.length || actionBusy === "bulk-approved"}
                onClick={() => bulkReview(selectedPendingIds, "approved")}
              >
                {actionBusy === "bulk-approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!selectedPendingIds.length || actionBusy === "bulk-rejected"}
                onClick={() => bulkReview(selectedPendingIds, "rejected")}
              >
                {actionBusy === "bulk-rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Reject Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedReviewedIds.length || actionBusy === "bulk-pending"}
                onClick={() => bulkReview(selectedReviewedIds, "pending")}
              >
                {actionBusy === "bulk-pending" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Move Selected To Pending
              </Button>
            </div>
          </div>

          {actionMessage ? (
            <p className="mt-4 text-sm text-muted-foreground">{actionMessage}</p>
          ) : null}
        </div>

        {!queueItems.length ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            {loading ? "Loading report queue…" : "No reports matched the current filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1240px] w-full border-collapse">
                <thead className="bg-background/80">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 px-4 py-3">
                      <SelectionCheckbox
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected}
                        onChange={toggleAllVisibleSelection}
                        ariaLabel="Select all visible reports"
                      />
                    </th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Transition</th>
                    <th className="px-4 py-3">Current</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Company / Role</th>
                    <th className="px-4 py-3">Reporter / Time</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((report) => {
                    const lifecycleStatus = normalizeLifecycleStatus(report.correctedCategory);
                    const currentLifecycleStatus = normalizeLifecycleStatus(report.currentCategory);
                    const reportActionBusy = actionBusy.startsWith(`report-${report.id}-`);
                    const isSelected = selectedReportIds.includes(report.id);

                    return (
                      <tr
                        key={report.id}
                        className={`border-b border-border/70 align-top ${isSelected ? "bg-accent/5" : "hover:bg-muted/25"}`}
                      >
                        <td className="px-4 py-4">
                          <SelectionCheckbox
                            checked={isSelected}
                            onChange={() => toggleReportSelection(report.id)}
                            ariaLabel={`Select report ${report.id}`}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${reportStatusClass(report.status)}`}>
                              {report.status}
                            </span>
                            <div>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${queueMetadataTone(report)}`}>
                                {queueMetadataLabel(report)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">
                              {report.originalCategory || "Unknown"} {"→"} {report.correctedCategory || "Unknown"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {lifecycleStatus ? (
                                <StatusBadge status={lifecycleStatus as "applied" | "interviewed" | "offers" | "rejected"} />
                              ) : (
                                <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {categoryLabel(report.correctedCategory)}
                                </span>
                              )}
                              {report.guardrailReasons?.length > 0 ? (
                                <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                                  {report.guardrailReasons.length} guardrail reason{report.guardrailReasons.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1 text-sm">
                            <div className="font-medium text-foreground">{report.currentCategory || "Missing"}</div>
                            {currentLifecycleStatus ? (
                              <StatusBadge status={currentLifecycleStatus as "applied" | "interviewed" | "offers" | "rejected"} />
                            ) : null}
                            <div className="text-muted-foreground">
                              Confidence {formatPercent(report.currentConfidence)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Raw {report.rawCategory || "n/a"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[340px] space-y-2">
                            <button
                              type="button"
                              onClick={() => setActiveReportId(report.id)}
                              className="text-left text-sm font-semibold text-foreground hover:text-accent hover:underline"
                            >
                              {truncateText(report.subject || "Untitled report", 110)}
                            </button>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {truncateText(report.bodyPreview, 170) || "No body captured."}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[220px] space-y-1 text-sm">
                            <div className="font-medium text-foreground">{report.companyName || "—"}</div>
                            <div className="text-muted-foreground">{report.position || "—"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[220px] space-y-1 text-sm">
                            <div className="break-all font-medium text-foreground">{report.userEmail || "unknown user"}</div>
                            <div className="text-muted-foreground">{formatDateTime(report.reportedAt)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[200px] flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveReportId(report.id)}
                            >
                              Open
                            </Button>
                            {report.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reportActionBusy}
                                  onClick={() => reviewReport(report.id, "approved")}
                                >
                                  {actionBusy === `report-${report.id}-approved` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={reportActionBusy}
                                  onClick={() => reviewReport(report.id, "rejected")}
                                >
                                  {actionBusy === `report-${report.id}-rejected` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reportActionBusy}
                                onClick={() => reviewReport(report.id, "pending")}
                              >
                                {actionBusy === `report-${report.id}-pending` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Move To Pending
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
                <span className="font-medium text-foreground">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination || pagination.offset === 0 || loading}
                  onClick={() => goToOffset((pagination?.offset || 0) - (pagination?.limit || filters.limit))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination?.hasMore || loading}
                  onClick={() => goToOffset((pagination?.offset || 0) + (pagination?.limit || filters.limit))}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Sheet
        open={Boolean(activeReport)}
        onOpenChange={(open) => {
          if (!open) setActiveReportId(null);
        }}
      >
        {activeReport ? (
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
            <SheetHeader className="border-b border-border">
              <div className="pr-8">
                <SheetTitle>{activeReport.subject || "Untitled report"}</SheetTitle>
                <SheetDescription>
                  {activeReport.originalCategory || "Unknown"} {"→"} {activeReport.correctedCategory || "Unknown"}
                  {" · "}
                  reported by {activeReport.userEmail || "unknown user"}
                  {" · "}
                  {formatDateTime(activeReport.reportedAt)}
                </SheetDescription>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${reportStatusClass(activeReport.status)}`}>
                  {activeReport.status}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${queueMetadataTone(activeReport)}`}>
                  {queueMetadataLabel(activeReport)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {activeReport.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionBusy.startsWith(`report-${activeReport.id}-`)}
                      onClick={() => reviewReport(activeReport.id, "approved")}
                    >
                      {actionBusy === `report-${activeReport.id}-approved` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionBusy.startsWith(`report-${activeReport.id}-`)}
                      onClick={() => reviewReport(activeReport.id, "rejected")}
                    >
                      {actionBusy === `report-${activeReport.id}-rejected` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy.startsWith(`report-${activeReport.id}-`)}
                    onClick={() => reviewReport(activeReport.id, "pending")}
                  >
                    {actionBusy === `report-${activeReport.id}-pending` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Move To Pending
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-6 p-5">
              <section className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Correction target</p>
                  <p className="text-sm text-muted-foreground">
                    If the user picked the wrong correction, change it here. Saving resets the review status to pending
                    and attempts to repair the current email state.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Corrected category</span>
                    <select
                      value={draftCorrectedCategory}
                      onChange={(event) => setDraftCorrectedCategory(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      {CORRECTION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    disabled={
                      draftCorrectedCategory === activeReport.correctedCategory
                      || actionBusy === `correction-${activeReport.id}`
                    }
                    onClick={() => saveCorrection(activeReport.id, draftCorrectedCategory)}
                  >
                    {actionBusy === `correction-${activeReport.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save Correction
                  </Button>
                </div>
                {activeReport.currentRecordMissing ? (
                  <p className="text-xs text-muted-foreground">
                    This report does not have a current email row. If you move it out of Irrelevant, the thread may
                    need a future sync to reappear.
                  </p>
                ) : null}
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current category</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{activeReport.currentCategory || "Missing"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confidence {formatPercent(activeReport.currentConfidence)} · Raw {activeReport.rawCategory || "n/a"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Metadata state</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{queueMetadataLabel(activeReport)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reportMetadataMessage(activeReport)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{activeReport.companyName || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Position</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{activeReport.position || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Email date</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(activeReport.emailDate)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">From header</p>
                  <p className="mt-1 break-words text-sm font-medium text-foreground">{activeReport.fromHeader || "—"}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Guardrail reasons</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeReport.guardrailReasons?.length > 0 ? activeReport.guardrailReasons.map((reason) => (
                    <span key={reason} className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      {reason}
                    </span>
                  )) : (
                    <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      No guardrail reasons on current row
                    </span>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Body</p>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {activeReport.body || "No body captured."}
                </pre>
              </section>

              <section className="rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Classification metadata</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {reportMetadataMessage(activeReport)}
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                  {JSON.stringify(activeReport.classificationMeta || {}, null, 2)}
                </pre>
              </section>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </>
  );
}
