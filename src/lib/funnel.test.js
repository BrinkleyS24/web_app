import { afterEach, describe, expect, test, vi } from "vitest";
import { gateSource, trackFunnel } from "./funnel.js";
import { readUpgradeSource } from "./premiumCheckout.js";

describe("trackFunnel", () => {
  afterEach(() => {
    delete window.umami;
  });

  test("sends the event to Umami when it is loaded", () => {
    window.umami = { track: vi.fn() };
    trackFunnel("upgrade_click", { source: "ext_search_read", plan: "quarterly" });
    expect(window.umami.track).toHaveBeenCalledWith("upgrade_click", { source: "ext_search_read", plan: "quarterly" });
  });

  test("is a silent no-op without Umami, and never throws", () => {
    expect(() => trackFunnel("upgrade_view")).not.toThrow();
    window.umami = { track: () => { throw new Error("blocked"); } };
    expect(() => trackFunnel("upgrade_view")).not.toThrow();
  });
});

describe("gateSource", () => {
  test("names the Premium page a free user was turned away from", () => {
    expect(gateSource("/apply-gate")).toBe("web_gate_apply_gate");
    expect(gateSource("/next-actions/abc")).toBe("web_gate_next_actions");
    expect(gateSource("")).toBe("web_gate_unknown");
  });

  test("always produces a tag the checkout accepts", () => {
    for (const path of ["/apply-gate", "/Weird Path!/x", "/" + "a".repeat(80)]) {
      expect(readUpgradeSource(`?source=${gateSource(path)}`)).toBe(gateSource(path));
    }
  });
});
