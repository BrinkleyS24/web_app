import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { formatSinceLabel, shouldAutoSync } from "@/lib/autoSync";
import { parseApiDate } from "@/lib/apiDate";
import { fetchSyncStatus, startEmailSync, type SyncStatusResponse } from "@/lib/emails";

const LOCAL_KEY_PREFIX = "applendium:lastAutoSync:";

function readLocal(uid: string | null | undefined): number | null {
  if (!uid) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY_PREFIX + uid);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLocal(uid: string | null | undefined, at: number) {
  if (!uid) return;
  try {
    window.localStorage.setItem(LOCAL_KEY_PREFIX + uid, String(at));
  } catch {
    // Storage can be unavailable (private mode); the throttle then relies on the server's time.
  }
}

/**
 * What "Sync now" is doing, from this tab's point of view (engineer review, 2026-10-15: the button
 * sat on "Checking your inbox…" for 110+ s because a held lease kept `inProgress` true and nothing
 * asked again). Every phase but "running" and "waiting" is an end state the user can read.
 */
export type SyncPhase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "waiting"; since: number; alreadyRunning: boolean }
  | { kind: "finished"; newEmails: number | null; at: number }
  | { kind: "background"; at: number }
  | { kind: "failed"; message: string; at: number }
  | { kind: "reconnect"; at: number };

/** Stop waiting on a sync after this long and say it continues in the background. */
export const SYNC_WAIT_CAP_MS = 120_000;
/** An older backend (no `state`) whose lock is older than this is not treated as running. */
const LEGACY_RUNNING_MAX_MS = 3 * 60_000;
const DEFAULT_POLL_MS = 5_000;

type Sync = NonNullable<SyncStatusResponse["sync"]>;

/** Is a sync running right now, per the server? New backends say so; old ones get a time bound. */
export function serverSyncRunning(sync: Sync | undefined, now = Date.now()): boolean {
  if (!sync) return false;
  if (sync.state) return sync.state === "running";
  if (!sync.inProgress) return false;
  const started = parseApiDate(sync.startedAt)?.getTime() ?? NaN;
  return !Number.isFinite(started) || now - started < LEGACY_RUNNING_MAX_MS;
}

function newEmailsText(count: number) {
  if (count === 0) return "No new emails";
  return `${count} new email${count === 1 ? "" : "s"}`;
}

/** The one line beside "Sync now". "risk" lines are shown at every width. */
export function describeSyncLine({
  phase,
  status,
  now = Date.now(),
}: {
  phase: SyncPhase;
  status: SyncStatusResponse | undefined;
  now?: number;
}): { text: string | null; tone: "neutral" | "risk" } {
  const sync = status?.sync;
  switch (phase.kind) {
    case "running":
      return { text: "Checking your inbox…", tone: "neutral" };
    case "waiting":
      return { text: phase.alreadyRunning ? "A sync is already running. Waiting for it…" : "Checking your inbox…", tone: "neutral" };
    case "finished": {
      const when = formatSinceLabel(new Date(phase.at).toISOString(), now) || "just now";
      if (phase.newEmails == null) return { text: `Inbox checked ${when}`, tone: "neutral" };
      return { text: `${newEmailsText(phase.newEmails)} · checked ${when}`, tone: "neutral" };
    }
    case "background":
      return { text: "Still syncing. It continues in the background.", tone: "neutral" };
    case "failed":
      return { text: "Sync failed. Try again.", tone: "risk" };
    case "reconnect":
      return { text: "Reconnect Gmail in the extension to sync.", tone: "risk" };
    default:
      break;
  }
  if (status?.gmailAuth?.requiresReconnect || sync?.state === "needs_reconnect") {
    return { text: "Reconnect Gmail in the extension to sync.", tone: "risk" };
  }
  if (serverSyncRunning(sync, now)) return { text: "Checking your inbox…", tone: "neutral" };
  if (sync?.state === "stalled") return { text: "A sync is taking longer than usual. It continues in the background.", tone: "neutral" };
  if (sync?.state === "failed") return { text: "The last sync failed. Try again.", tone: "risk" };
  const lastChecked = formatSinceLabel(sync?.lastRunAt, now);
  return { text: lastChecked ? `Inbox checked ${lastChecked}` : null, tone: "neutral" };
}

/** Where a wait on the server ends, or null to keep waiting. */
export function resolveWait(
  phase: Extract<SyncPhase, { kind: "waiting" }>,
  status: SyncStatusResponse | undefined,
  now = Date.now(),
): SyncPhase | null {
  const sync = status?.sync;
  if (!sync) return null;
  if (status?.gmailAuth?.requiresReconnect || sync.state === "needs_reconnect") return { kind: "reconnect", at: now };
  if (sync.state === "failed") return { kind: "failed", message: "Sync failed.", at: now };
  if (sync.state === "stalled") return { kind: "background", at: now };
  if (serverSyncRunning(sync, now)) {
    return now - phase.since >= SYNC_WAIT_CAP_MS ? { kind: "background", at: now } : null;
  }
  // Finished on the server: how much new mail it found is not known to this tab.
  return { kind: "finished", newEmails: null, at: now };
}

function isTimeout(err: unknown) {
  return err instanceof Error && /timed out/i.test(err.message);
}

/**
 * The inbox's freshness: a status line, a Sync now button, and one automatic sync per Dashboard visit
 * only when the last sync from any client is over 15 minutes old. After an automatic sync the page's
 * data is refreshed only when new mail actually arrived.
 */
export function useInboxSync(uid: string | null | undefined, { auto = true }: { auto?: boolean } = {}) {
  const enabled = Boolean(uid);
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<SyncPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const autoDecided = useRef(false);
  const waitingRef = useRef(false);
  waitingRef.current = phase.kind === "waiting";
  const statusQuery = useQuery({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    enabled,
    staleTime: 30_000,
    // Ask again while the server says a sync is running, so the line ends when the sync does.
    refetchInterval: (query) => {
      const sync = (query.state.data as SyncStatusResponse | undefined)?.sync;
      if (sync?.state === "running") return Math.max(1, sync.pollAfterSeconds ?? 5) * 1000;
      if (waitingRef.current) return DEFAULT_POLL_MS;
      return false;
    },
  });

  const run = useCallback(
    async (isAuto: boolean) => {
      setPhase({ kind: "running" });
      setError(null);
      try {
        const result = await startEmailSync();
        writeLocal(uid, Date.now());
        const outcome = result?.sync?.outcome;
        if (result?.sync?.state === "needs_reconnect") {
          setPhase({ kind: "reconnect", at: Date.now() });
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
          return;
        }
        if (outcome === "already_running" || outcome === "queued") {
          setPhase({ kind: "waiting", since: Date.now(), alreadyRunning: outcome === "already_running" });
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
          return;
        }
        // 'finished', or an older backend, which answers once its sync is done.
        const newEmails = typeof result?.newEmailsCount === "number" ? result.newEmailsCount : null;
        setPhase({ kind: "finished", newEmails, at: Date.now() });
        if (!isAuto || (newEmails ?? 0) > 0) {
          await queryClient.invalidateQueries();
        } else {
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
        }
      } catch (err) {
        if (isTimeout(err)) {
          // The request gave up, not the sync: keep watching it on the server.
          setPhase({ kind: "waiting", since: Date.now(), alreadyRunning: false });
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to check your inbox.";
        setError(message);
        setPhase({ kind: "failed", message, at: Date.now() });
      }
    },
    [queryClient, uid],
  );

  // Settle a wait when the server answers (each poll re-runs this, so the cap is checked too).
  useEffect(() => {
    if (phase.kind !== "waiting" || !statusQuery.data || statusQuery.isFetching) return;
    const next = resolveWait(phase, statusQuery.data);
    if (!next) return;
    setPhase(next);
    if (next.kind === "finished") void queryClient.invalidateQueries();
  }, [phase, queryClient, statusQuery.data, statusQuery.dataUpdatedAt, statusQuery.isFetching]);

  useEffect(() => {
    if (!auto || !enabled || autoDecided.current || !statusQuery.data) return;
    autoDecided.current = true;
    if (shouldAutoSync({ status: statusQuery.data, lastLocalSyncAt: readLocal(uid) })) {
      void run(true);
    }
  }, [auto, enabled, run, statusQuery.data, uid]);

  const sync = statusQuery.data?.sync;
  const line = describeSyncLine({ phase, status: statusQuery.data });
  const localBusy = phase.kind === "running" || phase.kind === "waiting";
  return {
    isSyncing: localBusy || (phase.kind === "idle" && serverSyncRunning(sync)),
    error,
    phase,
    statusLine: line.text,
    statusTone: line.tone,
    requiresReconnect: Boolean(statusQuery.data?.gmailAuth?.requiresReconnect),
    lastCheckedLabel: formatSinceLabel(sync?.lastRunAt),
    syncNow: () => run(false),
  };
}
