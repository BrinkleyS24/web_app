import { apiFetch } from "./api.js";

export async function createPremiumCheckoutSession() {
  const response = await apiFetch("/api/subscriptions/create-checkout-session", {
    method: "POST",
    body: {
      plan: "premium",
    },
    timeoutMs: 30000,
  });

  const url = response?.url;
  if (!url) {
    throw new Error("Backend did not return a checkout URL.");
  }

  return url;
}

export async function startPremiumCheckout() {
  const url = await createPremiumCheckoutSession();
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
    return {
      unitAmount: resp.unitAmount,
      currency: resp.currency || "usd",
      interval: resp.interval || null,
      intervalCount: resp.intervalCount || 1,
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
  const suffix = price.interval === "month" ? "/mo" : price.interval === "year" ? "/yr" : "";
  return { amount, suffix };
}
