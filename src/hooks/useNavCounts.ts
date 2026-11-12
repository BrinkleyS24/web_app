import { useQuery } from "@tanstack/react-query";

import { fetchRankedActionQueue, fetchStrategyAlerts } from "@/lib/emails";
import { buildDashboardMoveQueue, buildQueueItemsFromRankedQueue, splitTodayAndMore } from "@/lib/premiumTaskQueue";
import { visibleStrategyAlerts } from "@/lib/strategyAlertVisibility";
import { requireStrategyAlerts } from "@/lib/strategyPresentation";

/**
 * Counts for the sidebar: how many actions are in Today, and how many alert cards Strategy Alerts shows. The
 * nav gave no reason to click anything (review, 2026-09-26). Both read the Dashboard's own queries
 * (same keys), so on the Dashboard they cost nothing and elsewhere at most one fetch per 5 minutes.
 */
export function useNavCounts(enabled: boolean, ownerId?: string) {
  const queueQuery = useQuery({
    queryKey: ["dashboard", "queue", ownerId],
    queryFn: fetchRankedActionQueue,
    enabled: enabled && Boolean(ownerId),
    staleTime: 5 * 60_000,
  });
  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "alerts", ownerId],
    queryFn: fetchStrategyAlerts,
    select: requireStrategyAlerts,
    enabled: enabled && Boolean(ownerId),
    staleTime: 5 * 60_000,
  });

  // The queue parser throws on a malformed action. A page can show its own error for that; the
  // sidebar is on every page, so here a bad queue means no badge, never a broken screen.
  let today = 0;
  try {
    const queue = queueQuery.data?.queue ?? null;
    const split = queue ? splitTodayAndMore(buildDashboardMoveQueue(buildQueueItemsFromRankedQueue(queue))) : null;
    today = split?.fromBucket ? split.today.length : 0;
  } catch {
    today = 0;
  }

  // Exactly the cards Strategy Alerts shows (2026-10-14): the old "needs attention" subset said 2
  // beside a page of 3.
  const alertCards = alertsQuery.isError ? 0 : visibleStrategyAlerts(alertsQuery.data?.alerts).length;

  return { "/next-actions": today, "/strategy-alerts": alertCards } as Record<string, number>;
}
