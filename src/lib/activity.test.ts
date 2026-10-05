import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch }));

import { reportWebOpen, submitUninstallAnswer, UNINSTALL_REASONS } from "./activity";

describe("usage events", () => {
  beforeEach(() => {
    apiFetch.mockReset().mockResolvedValue(null);
    window.sessionStorage.clear();
  });

  it("reports a website visit once per browser session", () => {
    reportWebOpen();
    reportWebOpen();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/api/activity", { method: "POST", body: JSON.stringify({ event: "web_open" }) });
  });

  it("does not count the uninstall page as a visit", () => {
    window.history.pushState({}, "", "/goodbye?v=2.1.7&si=1");
    try {
      reportWebOpen();
      expect(apiFetch).not.toHaveBeenCalled();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("never surfaces a failure to the page", async () => {
    apiFetch.mockRejectedValueOnce(new Error("offline"));
    expect(() => reportWebOpen()).not.toThrow();
    await Promise.resolve();
  });

  it("sends an uninstall answer to the public survey endpoint", async () => {
    await submitUninstallAnswer({ reason: "found_job", uk: "0123456789abcdef", v: "2.1.7", si: "1" });
    expect(apiFetch).toHaveBeenCalledWith("/api/feedback/uninstall", {
      method: "POST",
      body: JSON.stringify({ reason: "found_job", uk: "0123456789abcdef", v: "2.1.7", si: "1" }),
    });
  });

  it("offers exactly the reasons the backend accepts", () => {
    expect(UNINSTALL_REASONS.map((r) => r.id)).toEqual([
      "google_warning", "missed_applications", "too_many_notifications", "not_applying_enough", "found_job", "other",
    ]);
  });
});
