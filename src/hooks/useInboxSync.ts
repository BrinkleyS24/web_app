import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { formatSinceLabel, shouldAutoSync } from "@/lib/autoSync";
import { fetchSyncStatus, startEmailSync } from "@/lib/emails";

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
 * The inbox's freshness on the Dashboard: a "checked N min ago" line, a Sync now button, and one
 * automatic sync per visit only when the last sync from any client is over 15 minutes old.
 * After an automatic sync the page's data is refreshed only when new mail actually arrived.
 */
export function useInboxSync(uid: string | null | undefined) {
  const enabled = Boolean(uid);
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    enabled,
    staleTime: 30_000,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoDecided = useRef(false);

  const run = useCallback(
    async (auto: boolean) => {
      setIsSyncing(true);
      setError(null);
      try {
        const result = await startEmailSync();
        writeLocal(uid, Date.now());
        if (!auto || (result?.newEmailsCount ?? 0) > 0) {
          await queryClient.invalidateQueries();
        } else {
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to check your inbox.");
      } finally {
        setIsSyncing(false);
      }
    },
    [queryClient, uid],
  );

  useEffect(() => {
    if (!enabled || autoDecided.current || !statusQuery.data) return;
    autoDecided.current = true;
    if (shouldAutoSync({ status: statusQuery.data, lastLocalSyncAt: readLocal(uid) })) {
      void run(true);
    }
  }, [enabled, run, statusQuery.data, uid]);

  const sync = statusQuery.data?.sync;
  const lastCheckedLabel = formatSinceLabel(sync?.lastRunAt);
  return {
    isSyncing: isSyncing || Boolean(sync?.inProgress),
    error,
    requiresReconnect: Boolean(statusQuery.data?.gmailAuth?.requiresReconnect),
    lastCheckedLabel,
    syncNow: () => run(false),
  };
}
