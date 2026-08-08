import type { StrategyAlert, InterviewDebriefItem } from "@/lib/emails";

/**
 * The one thing the dashboard says before it says anything else.
 *
 * The dashboard used to open with `Applications 344` — a number nobody can act on — and then
 * hand over four tiles, three queue rows, an alert, three verdicts and two drawers at roughly
 * equal weight. Founder's read, as a user: "a bunch of info just thrown at me." The fix is not
 * fewer facts, it is one claim with its evidence under it and everything else demoted.
 *
 * Deliberately NO new derivation here. The backend's Signal Layer already decides where the
 * next unit of effort belongs (`buildFunnelFocusAlert`) and already writes the sentence for it,
 * honesty floors and all. Re-deriving that copy client-side would create yet another definition
 * of the same idea — the exact failure that put five different interview rates on five screens.
 * This module only CHOOSES which alert is the answer, and shapes it for a hero slot.
 */

export type DashboardAnswer = {
  claim: string;
  evidence: string;
  /** Short supporting figure for the chip. Null when the source alert had none. */
  stat: string | null;
  /** What to do about it, in the alert's own words. Null when the alert had no recommendation. */
  recommendation: string | null;
  /**
   * Which alert produced this. Used to pair the hero with the queue item generated from the
   * SAME alert (`strategy:<id>`), so the button under a claim is provably about that claim
   * rather than whatever happened to rank first.
   */
  alertId: string | null;
  /**
   * Set only when the answer IS a question. The hero then renders the cards instead of a
   * link, because the thing being asked for happens here, in one tap, not on another screen.
   */
  debriefItems: InterviewDebriefItem[];
  debriefTotal: number;
};

/**
 * Answer priority, most specific first.
 *
 * `performance-interview-debrief` outranks everything, and it is the only entry here that is a
 * question rather than a read. It is raised precisely when the product cannot see how most of
 * a user's interviews ended, and in that state every alert below it would be characterising a
 * search we can barely observe. Asking has to come before advising, or the advice is a guess
 * delivered in the voice of a finding.
 *
 * `performance-focus-*` names where effort belongs and is the closest thing the product has to
 * a thesis about a user's search. `performance-rejection-velocity-*` describes how rejections
 * arrive, which is the next most decision-changing read. `performance-coverage-gap` is the
 * honest "we are quiet, and here is the exact floor we are waiting on" — a far better headline
 * than silently promoting an unrelated alert into the hero slot.
 */
const ANSWER_ALERT_PRIORITY = [
  "performance-interview-debrief",
  "performance-focus-",
  "performance-rejection-velocity-",
  "performance-coverage-gap",
];

export function selectAnswerAlert(alerts: StrategyAlert[] | null | undefined): StrategyAlert | null {
  const list = (alerts || []).filter(Boolean);
  if (list.length === 0) return null;

  for (const prefix of ANSWER_ALERT_PRIORITY) {
    const match = list.find((alert) => String(alert?.id || "").startsWith(prefix));
    if (match) return match;
  }

  // No performance read available, but the user still has alerts. Leading with the first one
  // beats leading with a count, and the alert carries its own timeframe label.
  return list[0];
}

export function buildDashboardAnswer({
  alerts,
  cohortMetrics,
  alertsUnavailableMessage,
}: {
  alerts: StrategyAlert[] | null | undefined;
  cohortMetrics?: { applicationsSent: number; reachedInterview: number } | null;
  /** Non-null when alerts could not be loaded at all (signed out, not premium, request failed). */
  alertsUnavailableMessage?: string | null;
}): DashboardAnswer {
  const alert = selectAnswerAlert(alerts);

  if (alert) {
    const debriefItems = (alert.debrief?.items || []).filter((item) => item?.emailId != null);
    return {
      claim: String(alert.title || "").trim() || "Here is where your search stands",
      evidence: String(alert.description || "").trim(),
      stat: String(alert.supporting_stat || "").trim() || null,
      recommendation: String(alert.recommendation || "").trim() || null,
      alertId: String(alert.id || "") || null,
      debriefItems,
      // `total` counts every answerable interview; `items` is the capped page the payload
      // carries. Showing the cap as the total would understate the ask and make the counter
      // stall at "0 more" while questions remain.
      debriefTotal: Math.max(alert.debrief?.total ?? 0, debriefItems.length),
    };
  }

  if (alertsUnavailableMessage) {
    return {
      claim: "Your search read is not available right now",
      evidence: alertsUnavailableMessage,
      stat: null,
      recommendation: null,
      alertId: null,
      debriefItems: [],
      debriefTotal: 0,
    };
  }

  const applied = cohortMetrics?.applicationsSent ?? 0;
  const interviewed = cohortMetrics?.reachedInterview ?? 0;

  if (applied > 0) {
    // Tracking works, the read does not exist yet. Says so plainly instead of inventing an
    // opinion from a handful of applications — and never frames still-open applications as
    // failures, because a pending application is a censored observation, not a loss.
    return {
      claim: "Tracking is working. There is not enough finished data to call your bottleneck yet.",
      evidence:
        `${applied} application${applied === 1 ? "" : "s"} tracked so far, ${interviewed} of which reached an interview. ` +
        "Applications still waiting on a reply are not counted against you — the read appears once enough of them reach an outcome.",
      stat: null,
      recommendation: null,
      alertId: null,
      debriefItems: [],
      debriefTotal: 0,
    };
  }

  return {
    claim: "Nothing is tracked yet",
    evidence:
      "Once Applendium has read your job-search email, this is where it tells you what to do next and why.",
    stat: null,
    recommendation: null,
    alertId: null,
    debriefItems: [],
    debriefTotal: 0,
  };
}
