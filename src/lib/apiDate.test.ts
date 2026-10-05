import { describe, expect, it } from "vitest";
import { apiDateMs, parseApiDate } from "./apiDate";
import { formatEmailDate } from "./emailFormatting";

describe("parseApiDate", () => {
  it("reads a stored email date (no zone marker) as UTC, whatever the viewer's time zone", () => {
    expect(parseApiDate("2026-09-28T17:59:00")?.toISOString()).toBe("2026-09-28T17:59:00.000Z");
    expect(parseApiDate("2026-09-28 17:59:00.123")?.toISOString()).toBe("2026-09-28T17:59:00.123Z");
    expect(parseApiDate("2026-09-28T17:59")?.toISOString()).toBe("2026-09-28T17:59:00.000Z");
  });

  it("leaves strings that carry a zone, date-only strings, numbers and Dates alone", () => {
    expect(parseApiDate("2026-09-28T17:59:00Z")?.toISOString()).toBe("2026-09-28T17:59:00.000Z");
    expect(parseApiDate("2026-09-28T13:59:00-04:00")?.toISOString()).toBe("2026-09-28T17:59:00.000Z");
    expect(parseApiDate("2026-09-28T17:59:00.000+00:00")?.toISOString()).toBe("2026-09-28T17:59:00.000Z");
    expect(parseApiDate("2026-09-28")?.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(parseApiDate(0)?.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    const date = new Date("2026-09-28T17:59:00Z");
    expect(parseApiDate(date)).toBe(date);
  });

  it("returns null for nothing or nonsense, and sorts it as 0", () => {
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate("")).toBeNull();
    expect(parseApiDate("not a date")).toBeNull();
    expect(apiDateMs(undefined)).toBe(0);
    expect(apiDateMs("2026-09-28T17:59:00")).toBe(Date.UTC(2026, 8, 28, 17, 59));
  });
});

describe("formatEmailDate", () => {
  it("shows the viewer's own date for an email stored in UTC (evening mail no longer jumps a day ahead)", () => {
    // 02:00 UTC on Sep 29 is the evening of Sep 28 across the Americas. Compared with the same
    // instant formatted in this test's own zone, so the assertion holds in any time zone.
    const expected = new Date("2026-09-29T02:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    expect(formatEmailDate("2026-09-29T02:00:00")).toBe(expected);
  });
});
