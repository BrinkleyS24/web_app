import { describe, expect, test } from "vitest";
import { AUTO_SYNC_THRESHOLD_MS, shouldAutoSync } from "./autoSync";

const NOW = new Date("2026-09-25T15:00:00Z").getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("shouldAutoSync", () => {
  // 2026-09-25: the Dashboard started a full Gmail sync on every single visit.
  test("syncs when the last sync from any client finished more than 15 minutes ago", () => {
    expect(AUTO_SYNC_THRESHOLD_MS).toBe(15 * 60_000);
    expect(shouldAutoSync({ status: { success: true, sync: { inProgress: false, lastRunAt: minutesAgo(16) } }, now: NOW })).toBe(true);
    expect(shouldAutoSync({ status: { success: true, sync: { inProgress: false, lastRunAt: minutesAgo(4) } }, now: NOW })).toBe(false);
  });

  test("never starts a second sync while one is running or while Gmail needs reconnecting", () => {
    expect(shouldAutoSync({ status: { success: true, sync: { inProgress: true, lastRunAt: minutesAgo(60) } }, now: NOW })).toBe(false);
    expect(shouldAutoSync({
      status: { success: true, sync: { inProgress: false, lastRunAt: minutesAgo(60) }, gmailAuth: { requiresReconnect: true } },
      now: NOW,
    })).toBe(false);
  });

  test("waits for the status before deciding", () => {
    expect(shouldAutoSync({ status: null, now: NOW })).toBe(false);
  });

  test("before the backend records run times, falls back to this browser's last auto-sync", () => {
    const status = { success: true, sync: { inProgress: false, lastRunAt: null } };
    expect(shouldAutoSync({ status, now: NOW, lastLocalSyncAt: null })).toBe(true);
    expect(shouldAutoSync({ status, now: NOW, lastLocalSyncAt: NOW - 5 * 60_000 })).toBe(false);
    expect(shouldAutoSync({ status, now: NOW, lastLocalSyncAt: NOW - 20 * 60_000 })).toBe(true);
  });
});
