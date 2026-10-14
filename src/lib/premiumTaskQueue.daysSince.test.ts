import { describe, expect, it } from "vitest";
import { daysSince } from "./premiumTaskQueue";

describe("daysSince", () => {
  it("counts calendar days, not elapsed 24-hour periods", () => {
    const lateLastNight = new Date(2026, 9, 13, 23, 0, 0);
    const thisMorning = new Date(2026, 9, 14, 9, 0, 0);
    expect(daysSince(lateLastNight.toISOString(), thisMorning)).toBe(1);
    expect(daysSince(thisMorning.toISOString(), new Date(2026, 9, 14, 22, 0, 0))).toBe(0);
  });
});
