/**
 * Premium funnel events, sent to Umami (cookieless, anonymous — the only analytics on the site).
 * Steps, in order:
 *   upgrade_view   — the Upgrade page was shown; `source` says which wall or link sent them
 *                    (a Premium-only page redirecting here counts as "saw the wall")
 *   upgrade_plan   — they switched between monthly and quarterly
 *   upgrade_click  — they pressed the checkout button
 *   checkout_error — checkout could not start
 *   checkout_success / checkout_cancel — Stripe sent them back
 * "Checkout started" and "paid" per source are in Stripe: GET /api/admin/debug/premium-funnel.
 *
 * Only fixed tags go out — never an email, user id, or job/company name. Tracking must never
 * break the page, so a missing Umami (ad blocker, tests, local dev) is a silent no-op.
 */
export function trackFunnel(name, data = {}) {
  try {
    const umami = typeof window !== "undefined" ? window.umami : undefined;
    if (umami && typeof umami.track === "function") umami.track(name, data);
  } catch {
    // Analytics is never allowed to break checkout.
  }
}

/** "/apply-gate/123" → "web_gate_apply_gate": which Premium page a free user was turned away from. */
export function gateSource(pathname = "") {
  const first = String(pathname).split("/").filter(Boolean)[0] || "unknown";
  const slug = first.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
  return `web_gate_${slug}`.slice(0, 40);
}
