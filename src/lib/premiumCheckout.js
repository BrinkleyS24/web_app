import { apiFetch } from "./api.js";

const UPGRADE_SOURCE_PATTERN = /^[a-z0-9_]{1,40}$/;

/**
 * The surface that sent this visitor to /upgrade (e.g. "ext_search_read"), from the page URL.
 * Anything malformed is dropped rather than forwarded — the backend would reject it anyway.
 */
export function readUpgradeSource(search = typeof window !== "undefined" ? window.location.search : "") {
  const value = new URLSearchParams(search || "").get("source");
  return value && UPGRADE_SOURCE_PATTERN.test(value) ? value : null;
}

export async function createPremiumCheckoutSession({ source = null, plan = "monthly" } = {}) {
  const response = await apiFetch("/api/subscriptions/create-checkout-session", {
    method: "POST",
    body: {
      plan: plan === "quarterly" ? "quarterly" : "premium",
      ...(source ? { source } : {}),
    },
    timeoutMs: 30000,
  });

  const url = response?.url;
  if (!url) {
    throw new Error("Backend did not return a checkout URL.");
  }

  return url;
}

export async function startPremiumCheckout({ source = readUpgradeSource(), plan = "monthly" } = {}) {
  const url = await createPremiumCheckoutSession({ source, plan });
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
