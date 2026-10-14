import { describe, expect, test } from "vitest";

import { deriveLiveInterviews } from "./liveInterviews";

const now = new Date("2026-10-14T12:00:00Z");
const email = (over: Record<string, unknown>) => ({
  id: String(Math.random()), thread_id: "t1", category: "Applied", company_name: "Quillstone", position: "Curriculum Developer",
  date: "2026-10-01T12:00:00", applicationId: "app-1", ...over,
});

describe("deriveLiveInterviews (Dashboard's 'Still interviewing' rule)", () => {
  test("an interview with no decision and a recent email is live", () => {
    const live = deriveLiveInterviews([email({ date: "2026-09-20T12:00:00" }), email({ category: "Interviewed", date: "2026-09-30T12:00:00" })], [], now);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ company: "Quillstone", role: "Curriculum Developer", applicationId: "app-1", prepTask: null });
  });

  test("a decision after the interview, a close, or 30 quiet days ends it", () => {
    const rejected = [email({ category: "Interviewed" }), email({ category: "Rejected", date: "2026-10-05T12:00:00" })];
    const closed = [email({ category: "Interviewed", isUserClosed: true })];
    const quiet = [email({ category: "Interviewed", date: "2026-08-01T12:00:00" })];
    expect(deriveLiveInterviews(rejected, [], now)).toHaveLength(0);
    expect(deriveLiveInterviews(closed, [], now)).toHaveLength(0);
    expect(deriveLiveInterviews(quiet, [], now)).toHaveLength(0);
  });

  test("matches the prep task by application, and does not guess between two roles at one company", () => {
    const task = { id: "p", actionType: "prep_interview", applicationId: "app-1", company: "Quillstone" } as never;
    expect(deriveLiveInterviews([email({ category: "Interviewed" })], [task], now)[0].prepTask).toBe(task);
    const a = { id: "a", actionType: "prep_interview", company: "Quillstone", roleTitle: "Designer" } as never;
    const b = { id: "b", actionType: "prep_interview", company: "Quillstone", roleTitle: "Writer" } as never;
    expect(deriveLiveInterviews([email({ category: "Interviewed", applicationId: null, thread_id: "x" })], [a, b], now)[0].prepTask).toBeNull();
  });
});
