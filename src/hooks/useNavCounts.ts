import { useQuery } from "@tanstack/react-query";

import { fetchRankedActionQueue, fetchStrategyAlerts } from "@/lib/emails";
import { buildDashboardMoveQueue, buildQueueItemsFromRankedQueue, splitTodayAndMore } from "@/lib/premiumTaskQueue";
import { visibleStrategyAlerts } from "@/lib/strategyAlertVisibility";

/**
 * Counts for the sidebar: how many actions are in Today, and how many alert cards Strategy Alerts shows. The
 * nav gave no reason to click anything (review, 2026-09-26). Both read the Dashboard's own queries
 * (same keys), so on the Dashboard they cost nothing and elsewhere at most one fetch per 5 minutes.
 */
export function useNavCounts(enabled: boolean) {
  const queueQuery = useQuery({
    queryKey: ["dashboard", "queue"],
    queryFn: fetchRankedActionQueue,
    enabled,
    staleTime: 5 * 60_000,
  });
  const alertsQuery = useQuery({
    queryKey: ["strategy-alerts", "dashboard"],
    queryFn: fetchStrategyAlerts,
    enabled,
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
  const alertCards = visibleStrategyAlerts(alertsQuery.data?.alerts).length;

  return { "/next-actions": today, "/strategy-alerts": alertCards } as Record<string, number>;
}
