import { describe, expect, test, vi } from "vitest";

import { apiErrorMessage, friendlyErrorMessage, isHumanMessage } from "@/lib/apiErrors";

describe("friendly API errors (persona review, 2026-10-14)", () => {
  test("a backend code is never the message; it goes to the console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const message = apiErrorMessage(403, "BLOCKED_BY_QA_HARNESS");
    expect(message).not.toContain("BLOCKED_BY_QA_HARNESS");
    expect(message).toMatch(/not available for your account/);
    expect(warn).toHaveBeenCalledWith("[api] request failed", expect.objectContaining({ code: "BLOCKED_BY_QA_HARNESS" }));
    warn.mockRestore();
  });

  test("statuses map to advice, readable backend sentences pass through", () => {
    expect(apiErrorMessage(429, null)).toMatch(/Too many requests/);
    expect(apiErrorMessage(500, "Server error (500). Please try again.")).toMatch(/problem on its side/);
    expect(apiErrorMessage(403, "Premium feature required for this page")).toBe("Premium feature required for this page");
    expect(isHumanMessage("RATE_LIMITED")).toBe(false);
  });

  test("thrown errors: network, timeout, status and unknown", () => {
    expect(friendlyErrorMessage(new TypeError("Failed to fetch"))).toMatch(/Could not reach Applendium/);
    expect(friendlyErrorMessage(new Error("Request timed out after 15000ms."))).toMatch(/took too long/);
    expect(friendlyErrorMessage({ message: "E_CODE", status: 503 })).toMatch(/problem on its side/);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(friendlyErrorMessage(new Error("SOME_CODE"), "Fallback sentence.")).toBe("Fallback sentence.");
    warn.mockRestore();
  });
});
