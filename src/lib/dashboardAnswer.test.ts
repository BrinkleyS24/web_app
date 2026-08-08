import { describe, expect, test } from "vitest";

import { buildDashboardAnswer, selectAnswerAlert } from "./dashboardAnswer";

function alert(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "performance",
    severity: "medium",
    title: `title for ${id}`,
    description: `description for ${id}`,
    recommendation: `recommendation for ${id}`,
    supporting_stat: `stat for ${id}`,
    timeframe_label: "All time",
    ...overrides,
  } as never;
}

/** An alert carrying the debrief payload, in the shape `buildInterviewDebriefAlert` emits. */
function debriefAlert(itemCount: number, total = itemCount) {
  return alert("performance-interview-debrief", {
    title: "You have reached 23 interviews. I can only see how 4 of them ended.",
    debrief: {
      kind: "interview_outcome",
      total,
      items: Array.from({ length: itemCount }, (_, i) => ({
        key: `verisk-${i}||sdet`,
        emailId: 100 + i,
        label: `Verisk ${i} · Software Engineer in Test`,
        company: `Verisk ${i}`,
        position: "Software Engineer in Test",
        interviewedAt: "2026-07-16T00:00:00.000Z",
        daysSilent: 20 + i,
        silentLabel: `${20 + i} days ago`,
      })),
    },
  });
}

describe("selectAnswerAlert", () => {
  test("prefers the funnel focus read over everything else", () => {
    const chosen = selectAnswerAlert([
      alert("performance-coverage-gap"),
      alert("performance-rejection-velocity-fast"),
      alert("performance-focus-interview"),
    ]);

    // Focus is the only alert that names where the next unit of effort belongs, which is the
    // question a dashboard headline should answer.
    expect(chosen?.id).toBe("performance-focus-interview");
  });

  test("a question outranks every read, because the reads depend on the answer", () => {
    const chosen = selectAnswerAlert([
      alert("performance-focus-interview"),
      alert("performance-rejection-velocity-fast"),
      debriefAlert(3),
    ]);

    // The debrief is raised precisely when the product cannot see how most interviews ended.
    // Leading with a read in that state is a guess delivered in the voice of a finding.
    expect(chosen?.id).toBe("performance-interview-debrief");
  });

  test("falls back through velocity to the coverage gap", () => {
    expect(
      selectAnswerAlert([alert("performance-coverage-gap"), alert("performance-rejection-velocity-fast")])?.id,
    ).toBe("performance-rejection-velocity-fast");

    // "We are quiet, and here is the floor we are waiting on" is a better headline than
    // silently promoting an unrelated alert into the hero slot.
    expect(selectAnswerAlert([alert("performance-coverage-gap")])?.id).toBe("performance-coverage-gap");
  });

  test("uses the first alert when no performance read exists", () => {
    expect(selectAnswerAlert([alert("fit-1", { kind: "fit" }), alert("fit-2", { kind: "fit" })])?.id).toBe("fit-1");
  });

  test("returns null for an empty or missing list", () => {
    expect(selectAnswerAlert([])).toBeNull();
    expect(selectAnswerAlert(null)).toBeNull();
    expect(selectAnswerAlert(undefined)).toBeNull();
  });
});

describe("buildDashboardAnswer", () => {
  test("passes the backend's own sentence through untouched", () => {
    const answer = buildDashboardAnswer({
      alerts: [
        alert("performance-focus-interview", {
          title: "Getting interviews is working; converting them is the live problem",
          description: "23 of 344 applications reached an interview (6.7%), and none has become an offer yet.",
          supporting_stat: "23 interviews, 0 offers",
        }),
      ],
      cohortMetrics: { applicationsSent: 344, reachedInterview: 23 },
    });

    // The Signal Layer already applied the honesty floors when it wrote this copy. Re-deriving
    // it here would create a second definition of the same claim.
    expect(answer.claim).toBe("Getting interviews is working; converting them is the live problem");
    expect(answer.evidence).toBe(
      "23 of 344 applications reached an interview (6.7%), and none has become an offer yet.",
    );
    expect(answer.stat).toBe("23 interviews, 0 offers");
    expect(answer.alertId).toBe("performance-focus-interview");
  });

  test("says the read is unavailable rather than inventing one", () => {
    const answer = buildDashboardAnswer({
      alerts: [],
      cohortMetrics: { applicationsSent: 344, reachedInterview: 23 },
      alertsUnavailableMessage: "Sign in to see strategy alerts.",
    });

    expect(answer.claim).toBe("Your search read is not available right now");
    expect(answer.evidence).toBe("Sign in to see strategy alerts.");
    expect(answer.alertId).toBeNull();
  });

  test("never frames pending applications as failures when there is no read yet", () => {
    const answer = buildDashboardAnswer({
      alerts: [],
      cohortMetrics: { applicationsSent: 6, reachedInterview: 1 },
    });

    expect(answer.claim).toBe(
      "Tracking is working. There is not enough finished data to call your bottleneck yet.",
    );
    expect(answer.evidence).toContain("6 applications tracked so far, 1 of which reached an interview.");
    // A still-open application is a censored observation, not a loss, and the copy has to say so
    // or a quiet week reads as a verdict on the user.
    expect(answer.evidence).toContain("not counted against you");
    expect(answer.stat).toBeNull();
  });

  test("handles the cold start without pretending to have an opinion", () => {
    const answer = buildDashboardAnswer({ alerts: [], cohortMetrics: { applicationsSent: 0, reachedInterview: 0 } });

    expect(answer.claim).toBe("Nothing is tracked yet");
    expect(answer.recommendation).toBeNull();
    expect(answer.alertId).toBeNull();
  });

  test("carries the debrief rows through so the hero can ask in place", () => {
    const answer = buildDashboardAnswer({ alerts: [debriefAlert(3)] });

    expect(answer.debriefItems).toHaveLength(3);
    expect(answer.debriefItems[0].label).toBe("Verisk 0 · Software Engineer in Test");
    expect(answer.debriefTotal).toBe(3);
  });

  test("reports the real size of the ask, not the size of the page it was sent", () => {
    // The payload caps the cards it carries. Showing the cap as the total would understate the
    // ask and stall the counter at "0 more" while questions remain.
    const answer = buildDashboardAnswer({ alerts: [debriefAlert(12, 19)] });

    expect(answer.debriefItems).toHaveLength(12);
    expect(answer.debriefTotal).toBe(19);
  });

  test("drops a row whose answer could not be written anywhere", () => {
    const broken = debriefAlert(3) as unknown as {
      debrief: { items: Array<{ emailId: number | null }> };
    };
    broken.debrief.items[1].emailId = null;

    const answer = buildDashboardAnswer({ alerts: [broken as never] });

    // A card that cannot save is worse than no card: the user answers, nothing happens, and
    // the same question is back tomorrow.
    expect(answer.debriefItems).toHaveLength(2);
    expect(answer.debriefTotal).toBe(3);
  });

  test("every non-debrief answer is still a complete answer shape", () => {
    // The hero reads `debriefItems.length` unconditionally, so a missing field here is a
    // runtime crash on the cold-start path rather than a missing card.
    for (const answer of [
      buildDashboardAnswer({ alerts: [alert("performance-focus-reach")] }),
      buildDashboardAnswer({ alerts: [], alertsUnavailableMessage: "Sign in." }),
      buildDashboardAnswer({ alerts: [], cohortMetrics: { applicationsSent: 6, reachedInterview: 1 } }),
      buildDashboardAnswer({ alerts: [] }),
    ]) {
      expect(answer.debriefItems).toEqual([]);
      expect(answer.debriefTotal).toBe(0);
    }
  });

  test("singularizes a one-application account", () => {
    const answer = buildDashboardAnswer({ alerts: [], cohortMetrics: { applicationsSent: 1, reachedInterview: 0 } });

    expect(answer.evidence).toContain("1 application tracked so far");
  });
});
