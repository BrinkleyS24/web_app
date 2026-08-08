/**
 * Search memory must not report absence as measurement.
 *
 * The panel rendered four fixed tiles, so a user with fourteen tracked roles — nine still silent —
 * read "No response 0" next to "Rejected 2" and concluded everyone else had replied. And because
 * `Number(null)` is 0 and 0 is finite, an unmeasured median printed as "Median response time: 0
 * days". Both are the same defect: a number standing in for a thing we never observed.
 */
import { describe, expect, test } from "vitest";

import { memoryOutcomeTiles, memoryResponseTimeLine } from "./ApplyGate";

const censored = {
  similarRoleCount: 14,
  interviewed: 3,
  offered: 0,
  rejected: 2,
  noResponse: 0,
  unresolved: 9,
  interviewRate: 0,
  rejectionRate: 0,
  noResponseRate: 0,
  medianDaysToResponse: null,
};

describe("memoryOutcomeTiles", () => {
  test("hides zero counts while the sample still has open roles, and names the open ones", () => {
    const tiles = memoryOutcomeTiles(censored);
    expect(tiles).toEqual([
      { label: "Interviews", value: 3 },
      { label: "Rejected", value: 2 },
      { label: "Still open", value: 9 },
    ]);
  });

  test("a zero is printable once every role has an ending", () => {
    const tiles = memoryOutcomeTiles({ ...censored, unresolved: 0, rejected: 11 });
    expect(tiles.map((t) => t.label)).toEqual(["Interviews", "Offers", "Rejected", "No response"]);
    expect(tiles.find((t) => t.label === "Offers")?.value).toBe(0);
    expect(tiles.some((t) => t.label === "Still open")).toBe(false);
  });

  test("a history with nothing resolved shows only the open count", () => {
    const tiles = memoryOutcomeTiles({
      ...censored, interviewed: 0, rejected: 0, unresolved: 14,
    });
    expect(tiles).toEqual([{ label: "Still open", value: 14 }]);
  });

  test("no tracked roles renders no tiles at all", () => {
    expect(memoryOutcomeTiles({ ...censored, similarRoleCount: 0 })).toEqual([]);
    expect(memoryOutcomeTiles(null)).toEqual([]);
  });

  test("an older payload without the field keeps the fully-observed reading", () => {
    const { unresolved, ...legacy } = censored;
    void unresolved;
    expect(memoryOutcomeTiles(legacy).map((t) => t.label))
      .toEqual(["Interviews", "Offers", "Rejected", "No response"]);
  });
});

describe("memoryResponseTimeLine", () => {
  test("says nothing when the median was never measured", () => {
    expect(memoryResponseTimeLine(censored)).toBeNull();
    expect(memoryResponseTimeLine({ ...censored, medianDaysToResponse: undefined })).toBeNull();
    expect(memoryResponseTimeLine(null)).toBeNull();
    // An empty string coerces to 0 through Number() — the original defect, one layer down.
    expect(memoryResponseTimeLine({ ...censored, medianDaysToResponse: "" as unknown as number })).toBeNull();
  });

  test("a genuine zero is same-day, not zero days", () => {
    expect(memoryResponseTimeLine({ ...censored, medianDaysToResponse: 0 }))
      .toBe("Similar roles that answered did so the same day.");
  });

  test("a real median reads as a duration", () => {
    expect(memoryResponseTimeLine({ ...censored, medianDaysToResponse: 6 }))
      .toBe("Median response time: 6 days.");
    expect(memoryResponseTimeLine({ ...censored, medianDaysToResponse: 1 }))
      .toBe("Median response time: 1 day.");
  });
});
