import type { SyncStatusResponse } from "@/lib/emails";

/**
 * How stale the inbox may be before opening the Dashboard checks it. The Dashboard used to start a
 * full Gmail sync on every visit (founder review, 2026-09-25); the extension syncs on its own, so
 * most of those found nothing and cost the user seconds. Fifteen minutes keeps the Dashboard fresh
 * without duplicating the extension's work.
 */
export const AUTO_SYNC_THRESHOLD_MS = 15 * 60_000;

export function shouldAutoSync({
  status,
  now = Date.now(),
  lastLocalSyncAt = null,
  thresholdMs = AUTO_SYNC_THRESHOLD_MS,
}: {
  status: SyncStatusResponse | null | undefined;
  now?: number;
  lastLocalSyncAt?: number | null;
  thresholdMs?: number;
}): boolean {
  if (!status?.sync) return false;
  if (status.sync.inProgress) return false;
  if (status.gmailAuth?.requiresReconnect) return false;

  const lastRun = status.sync.lastRunAt ? new Date(status.sync.lastRunAt).getTime() : NaN;
  if (Number.isFinite(lastRun)) return now - lastRun > thresholdMs;

  // The backend records run times once its migration has run; until then, this browser's own last
  // auto-sync is the best evidence available.
  return lastLocalSyncAt == null || now - lastLocalSyncAt > thresholdMs;
}

/** "just now", "4 min ago", "2 hr ago", "Sep 24". */
export function formatSinceLabel(iso: string | null | undefined, now = Date.now()): string | null {
  const ts = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(ts)) return null;
  const minutes = Math.max(0, Math.round((now - ts) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
