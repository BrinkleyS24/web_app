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
