import { apiFetch } from "./api.js";
import { auth } from "./firebase.js";

const UPGRADE_SOURCE_PATTERN = /^[a-z0-9_]{1,40}$/;

/**
 * The surface that sent this visitor to /upgrade (e.g. "ext_search_read"), from the page URL.
 * Anything malformed is dropped rather than forwarded — the backend would reject it anyway.
 */
export function readUpgradeSource(search = typeof window !== "undefined" ? window.location.search : "") {
  const value = new URLSearchParams(search || "").get("source");
  return value && UPGRADE_SOURCE_PATTERN.test(value) ? value : null;
}

function checkCheckoutOwner(owner, signal) {
  if (signal?.aborted || auth?.currentUser?.uid !== owner) throw new DOMException("Checkout was canceled because the account or page changed.", "AbortError");
}

export async function createPremiumCheckoutSession({ source = null, plan = "monthly", signal } = {}) {
  const owner = auth?.currentUser?.uid;
  if (!owner) throw new Error("Sign in before starting checkout.");
  checkCheckoutOwner(owner, signal);
  const response = await apiFetch("/api/subscriptions/create-checkout-session", {
    method: "POST",
    body: {
      plan: plan === "quarterly" ? "quarterly" : "premium",
      ...(source ? { source } : {}),
    },
    timeoutMs: 30000,
    signal,
  });
  checkCheckoutOwner(owner, signal);
  let url;
  try { url = new URL(response?.url || ""); } catch { throw new Error("Checkout could not be opened. Please retry."); }
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) {
    throw new Error("The checkout URL could not be verified. Please retry.");
  }
  return url.href;
}

export async function startPremiumCheckout({ source = readUpgradeSource(), plan = "monthly", signal } = {}) {
  const owner = auth?.currentUser?.uid;
  const url = await createPremiumCheckoutSession({ source, plan, signal });
  checkCheckoutOwner(owner, signal);
  window.location.assign(url);
}

/**
 * Fetch the live Premium price from the backend (which reads it from Stripe).
 * Returns null on any failure / when billing isn't configured, so callers can
 * fall back to neutral copy instead of showing a wrong or broken price.
 */
export async function fetchPremiumPrice() {
  try {
    const resp = await apiFetch("/api/subscriptions/price", { method: "GET", timeoutMs: 8000 });
    if (!resp?.success || typeof resp.unitAmount !== "number") return null;
    const q = resp.quarterly;
    return {
      unitAmount: resp.unitAmount,
      currency: resp.currency || "usd",
      interval: resp.interval || null,
      intervalCount: resp.intervalCount || 1,
      // Older backends do not send it; the page then offers monthly only.
      quarterly: q && typeof q.unitAmount === "number"
        ? { unitAmount: q.unitAmount, currency: q.currency || resp.currency || "usd", interval: q.interval || null, intervalCount: q.intervalCount || 1 }
        : null,
    };
  } catch {
    return null;
  }
}

/**
 * Format a price object from fetchPremiumPrice into display parts, e.g.
 * { amount: "$9", suffix: "/mo" }. Uses the currency's own formatting and drops
 * cents only when the amount is a whole number. Returns null for null input.
 */
export function formatPremiumPrice(price) {
  if (!price || typeof price.unitAmount !== "number") return null;
  const value = price.unitAmount / 100;
  let amount;
  try {
    amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(price.currency || "usd").toUpperCase(),
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    amount = `$${value}`;
  }
  const count = Number(price.intervalCount) || 1;
  const suffix = price.interval === "month"
    ? (count === 1 ? "/mo" : `/${count} mo`)
    : price.interval === "year" ? "/yr" : "";
  return { amount, suffix };
}
