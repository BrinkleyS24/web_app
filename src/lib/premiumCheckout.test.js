import { beforeEach, describe, expect, test, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("./api.js", () => ({ apiFetch }));

import { createPremiumCheckoutSession, readUpgradeSource } from "./premiumCheckout.js";

describe("upgrade source attribution", () => {
  beforeEach(() => {
    apiFetch.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
  });

  test("reads a well-formed source tag from the page URL", () => {
    expect(readUpgradeSource("?source=ext_search_read")).toBe("ext_search_read");
    expect(readUpgradeSource("?source=digest_search_read&x=1")).toBe("digest_search_read");
  });

  test("ignores a missing or malformed source", () => {
    expect(readUpgradeSource("")).toBeNull();
    expect(readUpgradeSource("?source=%3Cscript%3E")).toBeNull();
    expect(readUpgradeSource("?source=" + "a".repeat(41))).toBeNull();
  });

  test("sends the source with the checkout only when there is one", async () => {
    await createPremiumCheckoutSession({ source: "ext_search_read" });
    expect(apiFetch.mock.calls[0][1].body).toEqual({ plan: "premium", source: "ext_search_read" });
    await createPremiumCheckoutSession();
    expect(apiFetch.mock.calls[1][1].body).toEqual({ plan: "premium" });
  });
});
