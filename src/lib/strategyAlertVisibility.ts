import type { StrategyAlert } from "@/lib/emails";

/**
 * Which strategy alerts the Strategy Alerts page shows as cards. The sidebar badge counts this exact
 * list: it used to count only "needs attention" alerts, so it said 2 while the page showed 3
 * (persona review, 2026-10-14).
 *
 * Left out: the "not enough data yet" placeholder (a floor, not a finding) and the interview
 * debrief, which is answered on the Dashboard. The debrief used to appear word for word on both
 * pages; Strategy Alerts now links to it instead.
 */
export const isPlaceholderAlert = (alert: StrategyAlert) => String(alert?.id || "").endsWith("coverage-gap");

export const isDebriefAlert = (alert: StrategyAlert) =>
  Boolean(alert?.debrief?.items?.length) || String(alert?.id || "") === "performance-interview-debrief";

export function visibleStrategyAlerts(alerts: StrategyAlert[] | null | undefined): StrategyAlert[] {
  return (alerts || []).filter((alert) => alert && !isPlaceholderAlert(alert) && !isDebriefAlert(alert));
}

export function findDebriefAlert(alerts: StrategyAlert[] | null | undefined): StrategyAlert | null {
  return (alerts || []).find((alert) => alert && isDebriefAlert(alert) && (alert.debrief?.items?.length ?? 0) > 0) || null;
}
