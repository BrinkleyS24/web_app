import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Crown,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
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

type AdminUserRow = {
  id: string;
  email: string;
  plan: string;
  createdAt: string | null;
  lastEmailSyncAt: string | null;
  initialSyncComplete: boolean;
  syncProgressPercentage: number | null;
  emailsProcessed: number;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  hasGoogleRefreshToken: boolean;
  pendingFullRefresh: boolean;
  pendingFullRefreshRequestedAt: string | null;
  isAdmin: boolean;
  isPermanentPremium: boolean;
};

type UsersPayload = {
  users: AdminUserRow[];
  pagination: {
    totalCount: number;
    limit: number;
    offset: number;
    returnedCount: number;
    hasMore: boolean;
  };
};

type UserImpact = {
  blockers: string[];
  canDelete: boolean;
  firebaseAdminAvailable: boolean;
  requiresEmailConfirmation: boolean;
  counts: Record<string, number | null>;
};

type UserDetailPayload = {
  user: AdminUserRow;
  impact: UserImpact;
};

type IgnoredEmailRecoveryJob = {
  id: string;
  userId: string;
  status: string;
  totalEstimate: number;
  processedCount: number;
  recoveredCount: number;
  failedCount: number;
  skippedCount: number;
  dbFirstCount: number;
  gmailFetchCount: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatApproxMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.ceil(minutes % 60);
  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function looksLikeEmail(value?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function countLabel(key: string) {
  switch (key) {
    case "emails":
      return "Emails";
    case "applications":
      return "Applications";
    case "ignoredEmails":
      return "Ignored emails";
    case "ignoredEmailRecoveryJobs":
      return "Ignored email recovery jobs";
    case "roleMappings":
      return "Role mappings";
    case "suggestionActions":
      return "Suggestion actions";
    case "fieldCorrections":
      return "Field corrections";
    case "applyGateVerdicts":
      return "Apply Gate verdicts";
    case "misclassificationReports":
      return "Misclassification reports";
    default:
      return key;
  }
}

function fullRefreshRuntimeHint(impact?: UserImpact | null) {
  const recoverableCount = Number(impact?.counts?.ignoredEmails || 0);
  if (!Number.isFinite(recoverableCount) || recoverableCount <= 0) {
    return "Pending means the request is queued or running. Refresh this view to check whether it has cleared.";
  }

  const batches = Math.ceil(recoverableCount / 100);
  const lowMinutes = Math.max(2, batches * 2);
  const highMinutes = Math.max(lowMinutes + 2, batches * 3);
  const lowLabel = formatApproxMinutes(lowMinutes);
  const highLabel = formatApproxMinutes(highMinutes);

  return `This account has ${recoverableCount.toLocaleString()} recoverable ignored emails. Full refresh runs in safe batches of about 100 emails, so it can take roughly ${lowLabel}-${highLabel}.`;
}

function FlagPill({
  tone = "default",
  children,
}: {
  tone?: "default" | "warning" | "success" | "danger";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success border-success/20"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground border-warning/20"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-muted text-muted-foreground border-border";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [listData, setListData] = useState<UsersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailData, setDetailData] = useState<UserDetailPayload | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [fullRefreshBusy, setFullRefreshBusy] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryStatusBusy, setRecoveryStatusBusy] = useState(false);
  const [recoveryJob, setRecoveryJob] = useState<IgnoredEmailRecoveryJob | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  async function loadUsers(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "100",
        offset: "0",
      });
      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      const response = await apiFetch(`/api/admin/users?${params.toString()}`, {
        method: "GET",
      });
      setListData(response as UsersPayload);
    } catch (err: any) {
      setError(err?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function openUser(userId: string) {
    setSheetOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setConfirmEmail("");
    setActionMessage("");

    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "GET",
      });
      setDetailData(response as UserDetailPayload);
      const recoveryResponse = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/ignored-email-recovery`, {
        method: "GET",
      });
      setRecoveryJob((recoveryResponse?.job as IgnoredEmailRecoveryJob | null) || null);
    } catch (err: any) {
      setDetailData(null);
      setRecoveryJob(null);
      setDetailError(err?.message || "Failed to load user details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete() {
    if (!detailData?.user?.id) return;

    setDeleteBusy(true);
    setActionMessage("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(detailData.user.id)}`, {
        method: "DELETE",
        body: {
          confirmEmail,
        },
      });

      setActionMessage(String(response?.message || `Deleted ${detailData.user.email}.`));
      setSheetOpen(false);
      setDetailData(null);
      setConfirmEmail("");
      await loadUsers(search);
    } catch (err: any) {
      setActionMessage(err?.message || "Failed to delete user.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleQueueFullRefresh() {
    if (!detailData?.user?.id) return;

    setFullRefreshBusy(true);
    setActionMessage("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(detailData.user.id)}/full-refresh`, {
        method: "POST",
        body: {},
      });

      const updatedUser = response?.user as AdminUserRow | undefined;
      if (updatedUser) {
        setDetailData((current) => current ? { ...current, user: updatedUser } : current);
      }
      setActionMessage(String(response?.message || `Full refresh requested for ${detailData.user.email}.`));
      await loadUsers(search);
    } catch (err: any) {
      setActionMessage(err?.message || "Failed to queue full refresh.");
    } finally {
      setFullRefreshBusy(false);
    }
  }

  async function loadRecoveryStatus() {
    if (!detailData?.user?.id) return;

    setRecoveryStatusBusy(true);
    setActionMessage("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(detailData.user.id)}/ignored-email-recovery`, {
        method: "GET",
      });
      setRecoveryJob((response?.job as IgnoredEmailRecoveryJob | null) || null);
    } catch (err: any) {
      setActionMessage(err?.message || "Failed to load recovery status.");
    } finally {
      setRecoveryStatusBusy(false);
    }
  }

  async function handleQueueIgnoredRecovery() {
    if (!detailData?.user?.id) return;

    setRecoveryBusy(true);
    setActionMessage("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(detailData.user.id)}/ignored-email-recovery`, {
        method: "POST",
        body: {},
      });
      setRecoveryJob((response?.job as IgnoredEmailRecoveryJob | null) || null);
      setActionMessage(String(response?.message || `Targeted recovery requested for ${detailData.user.email}.`));
    } catch (err: any) {
      setActionMessage(err?.message || "Failed to queue targeted recovery.");
    } finally {
      setRecoveryBusy(false);
    }
  }

  const totalUsers = listData?.pagination?.totalCount || 0;
  const canDelete =
    detailData?.impact?.canDelete === true
    && normalizeEmail(confirmEmail) === normalizeEmail(detailData?.user?.email)
    && !deleteBusy;
  const confirmationTarget = detailData?.user?.email || "";
  const confirmationTargetIsEmail = looksLikeEmail(confirmationTarget);

  const impactRows = useMemo(() => {
    const counts = detailData?.impact?.counts || {};
    return Object.entries(counts);
  }, [detailData]);
  const recoveryPercent = recoveryJob && recoveryJob.totalEstimate > 0
    ? Math.min(100, Math.round((recoveryJob.processedCount / recoveryJob.totalEstimate) * 100))
    : null;

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin directory for account inspection and guarded deletion.
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3 text-sm text-muted-foreground">
            Total users: <span className="font-medium text-foreground">{totalUsers}</span>
          </div>
        </div>

        <section className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Account Access</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Admins can inspect all users here. Deletion is intentionally guarded: it is blocked for admin accounts,
            your own account, and billing-linked accounts, and it requires an exact email confirmation.
          </p>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search by email"
              className="md:max-w-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSearch(draftSearch)}
                disabled={loading}
              >
                Apply Search
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraftSearch("");
                  setSearch("");
                }}
                disabled={loading || (!search && !draftSearch)}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={() => loadUsers(search)} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium text-foreground">User</th>
                  <th className="px-4 py-3 font-medium text-foreground">Plan</th>
                  <th className="px-4 py-3 font-medium text-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-foreground">Usage</th>
                  <th className="px-4 py-3 font-medium text-foreground">Last Sync</th>
                  <th className="px-4 py-3 font-medium text-foreground">Flags</th>
                  <th className="px-4 py-3 font-medium text-right font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(listData?.users || []).map((user) => (
                  <tr key={user.id} className="border-b border-border/70 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{user.email}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        UID: {user.id} • Created {formatDateTime(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <FlagPill tone={user.plan === "premium" ? "success" : "default"}>
                          {user.plan}
                        </FlagPill>
                        {user.isPermanentPremium ? (
                          <FlagPill tone="warning">Permanent premium</FlagPill>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{user.subscriptionStatus || "inactive"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Sync {user.initialSyncComplete ? "complete" : "in progress"} • {formatPercent(user.syncProgressPercentage)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{user.emailsProcessed} processed</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(user.lastEmailSyncAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.isAdmin ? <FlagPill tone="danger">Admin</FlagPill> : null}
                        {user.hasStripeCustomer || user.hasStripeSubscription ? (
                          <FlagPill tone="warning">Billing linked</FlagPill>
                        ) : null}
                        {user.hasGoogleRefreshToken ? <FlagPill tone="success">Google linked</FlagPill> : null}
                        {user.pendingFullRefresh ? <FlagPill tone="warning">Refresh pending</FlagPill> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openUser(user.id)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && (listData?.users || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No users matched the current search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {actionMessage && !sheetOpen ? (
          <section className="glass-card rounded-xl p-4">
            <p className="text-sm text-foreground">{actionMessage}</p>
          </section>
        ) : null}
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(nextOpen) => {
          setSheetOpen(nextOpen);
          if (!nextOpen) {
            setDetailError("");
            setConfirmEmail("");
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>User Management</SheetTitle>
            <SheetDescription>
              Review the account state before taking a destructive action.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-6">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading user details...
              </div>
            ) : null}

            {!detailLoading && detailError ? (
              <p className="text-sm text-destructive">{detailError}</p>
            ) : null}

            {!detailLoading && detailData ? (
              <>
                <section className="rounded-xl border border-border bg-background/70 p-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{detailData.user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">UID: {detailData.user.id}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
                      <p className="mt-1 text-sm text-foreground">{detailData.user.plan}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Subscription</p>
                      <p className="mt-1 text-sm text-foreground">{detailData.user.subscriptionStatus || "inactive"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                      <p className="mt-1 text-sm text-foreground">{formatDateTime(detailData.user.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Last sync</p>
                      <p className="mt-1 text-sm text-foreground">{formatDateTime(detailData.user.lastEmailSyncAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Full refresh</p>
                      <p className="mt-1 text-sm text-foreground">
                        {detailData.user.pendingFullRefresh
                          ? `Pending since ${formatDateTime(detailData.user.pendingFullRefreshRequestedAt)}`
                          : "Not pending"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detailData.user.isAdmin ? (
                      <FlagPill tone="danger">
                        <ShieldAlert className="w-3 h-3" />
                        Admin
                      </FlagPill>
                    ) : null}
                    {detailData.user.isPermanentPremium ? (
                      <FlagPill tone="warning">
                        <Crown className="w-3 h-3" />
                        Permanent premium
                      </FlagPill>
                    ) : null}
                    {detailData.user.hasStripeCustomer || detailData.user.hasStripeSubscription ? (
                      <FlagPill tone="warning">Billing linked</FlagPill>
                    ) : null}
                    {detailData.user.hasGoogleRefreshToken ? (
                      <FlagPill tone="success">Google refresh token present</FlagPill>
                    ) : null}
                    {detailData.user.pendingFullRefresh ? (
                      <FlagPill tone="warning">Full refresh pending</FlagPill>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-background/70 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-semibold text-foreground">Targeted Recovery</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Reclassify recoverable auto-ignored messages by cursor. Stored email bodies are used first; Gmail is queried only when a candidate lacks a stored body.
                  </p>

                  {!detailData.user.hasGoogleRefreshToken ? (
                    <p className="text-sm text-warning-foreground">
                      This user has not connected Gmail, so targeted recovery cannot run.
                    </p>
                  ) : null}

                  {recoveryJob ? (
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">Status: {recoveryJob.status}</span>
                        <span className="text-muted-foreground">
                          {recoveryPercent === null ? "--" : `${recoveryPercent}%`}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>Processed {recoveryJob.processedCount} / {recoveryJob.totalEstimate}</span>
                        <span>Recovered {recoveryJob.recoveredCount}</span>
                        <span>DB-first {recoveryJob.dbFirstCount}</span>
                        <span>Gmail fetch {recoveryJob.gmailFetchCount}</span>
                        <span>Failed {recoveryJob.failedCount}</span>
                        <span>Updated {formatDateTime(recoveryJob.updatedAt)}</span>
                      </div>
                      {recoveryJob.lastError ? (
                        <p className="mt-2 text-xs text-destructive">{recoveryJob.lastError}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleQueueIgnoredRecovery}
                      disabled={recoveryBusy || !detailData.user.hasGoogleRefreshToken || recoveryJob?.status === "queued" || recoveryJob?.status === "running"}
                    >
                      {recoveryBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {recoveryJob?.status === "queued" || recoveryJob?.status === "running" ? "Recovery active" : "Run targeted recovery"}
                    </Button>
                    <Button variant="outline" onClick={loadRecoveryStatus} disabled={recoveryStatusBusy}>
                      {recoveryStatusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Refresh status
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-background/70 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Full Refresh Fallback</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Keep this rollback path for cases where targeted recovery is not enough.
                  </p>

                  {detailData.user.pendingFullRefresh ? (
                    <p className="text-sm text-muted-foreground">
                      {fullRefreshRuntimeHint(detailData.impact)}
                    </p>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={handleQueueFullRefresh}
                    disabled={fullRefreshBusy || !detailData.user.hasGoogleRefreshToken}
                  >
                    {fullRefreshBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {detailData.user.pendingFullRefresh ? "Refresh already pending" : "Queue full refresh"}
                  </Button>
                </section>

                <section className="rounded-xl border border-border bg-background/70 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <h3 className="text-sm font-semibold text-foreground">Delete Impact</h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {impactRows.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-border bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{countLabel(key)}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {typeof value === "number" ? value : "Not available"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {detailData.impact.blockers.length > 0 ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive">Deletion is currently blocked</p>
                      <ul className="list-disc pl-5 text-sm text-destructive space-y-1">
                        {detailData.impact.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This will remove the Firebase auth account and the stored application data listed above.
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {confirmationTargetIsEmail
                        ? "Type the user email to confirm deletion"
                        : "Type the account identifier to confirm deletion"}
                    </p>
                    <Input
                      value={confirmEmail}
                      onChange={(event) => setConfirmEmail(event.target.value)}
                      name="admin-delete-confirmation"
                      autoComplete="off"
                      placeholder={confirmationTarget}
                      disabled={deleteBusy || detailData.impact.blockers.length > 0}
                    />
                  </div>

                  {actionMessage ? (
                    <p className="text-sm text-muted-foreground">{actionMessage}</p>
                  ) : null}

                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={!canDelete}
                  >
                    {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete user
                  </Button>
                </section>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
