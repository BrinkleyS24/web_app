import { beforeEach, describe, expect, test, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
const auth=vi.hoisted(()=>({currentUser:{uid:'checkout-owner'}}));
vi.mock("./api.js", () => ({ apiFetch }));
vi.mock('./firebase.js',()=>({auth}));

import { createPremiumCheckoutSession, fetchPremiumPrice, formatPremiumPrice, readUpgradeSource } from "./premiumCheckout.js";
beforeEach(()=>{auth.currentUser={uid:'checkout-owner'};});

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

describe('checkout ownership and navigation safety',()=>{
  test('a response from a previous account cannot expose its checkout URL',async()=>{
    let finish;apiFetch.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    const pending=createPremiumCheckoutSession();auth.currentUser={uid:'another-owner'};
    finish({url:'https://checkout.stripe.com/c/pay/old'});await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
  test('an aborted page request cannot redirect after a late response',async()=>{
    let finish;apiFetch.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const controller=new AbortController();
    const pending=createPremiumCheckoutSession({signal:controller.signal});controller.abort();finish({url:'https://checkout.stripe.com/c/pay/old'});
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
  test('unverified redirect hosts and schemes are refused',async()=>{
    for(const url of ['javascript:alert(1)','https://example.invalid/pay','http://checkout.stripe.com/pay','https://user:pass@checkout.stripe.com/pay']){
      apiFetch.mockResolvedValue({url});await expect(createPremiumCheckoutSession()).rejects.toThrow(/could not be verified/);
    }
  });
});

describe("quarterly plan", () => {
  beforeEach(() => {
    apiFetch.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
  });

  test("asks the backend for the quarterly plan by name", async () => {
    await createPremiumCheckoutSession({ plan: "quarterly", source: "web_gate_apply_gate" });
    expect(apiFetch.mock.calls[0][1].body).toEqual({ plan: "quarterly", source: "web_gate_apply_gate" });
  });

  test("reads the quarterly price when offered, and null from an older backend", async () => {
    apiFetch.mockResolvedValueOnce({ success: true, unitAmount: 2499, interval: "month", quarterly: { unitAmount: 5900, interval: "month", intervalCount: 3 } });
    expect((await fetchPremiumPrice()).quarterly).toEqual({ unitAmount: 5900, currency: "usd", interval: "month", intervalCount: 3 });
    apiFetch.mockResolvedValueOnce({ success: true, unitAmount: 2499, interval: "month" });
    expect((await fetchPremiumPrice()).quarterly).toBeNull();
  });

  test("labels a three-month price as such", () => {
    expect(formatPremiumPrice({ unitAmount: 5900, currency: "usd", interval: "month", intervalCount: 3 }).suffix).toBe("/3 mo");
    expect(formatPremiumPrice({ unitAmount: 2499, currency: "usd", interval: "month", intervalCount: 1 }).suffix).toBe("/mo");
  });
});
