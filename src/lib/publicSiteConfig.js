const DEFAULT_CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/applendium/aaalkagnioipinkfogjlgkdoacebaoji?hl=en&authuser=0";

function normalizeStoreState(value) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "live" ? "live" : "review";
}

export const CHROME_WEB_STORE_URL =
  (import.meta.env.VITE_CHROME_WEB_STORE_URL || DEFAULT_CHROME_WEB_STORE_URL).trim();

export const CHROME_WEB_STORE_STATE = normalizeStoreState(
  import.meta.env.VITE_CHROME_WEB_STORE_STATE || "live",
);

export const CHROME_EXTENSION_IS_LIVE = CHROME_WEB_STORE_STATE === "live";

export const WEB_WORKSPACE_IS_PUBLIC =
  String(import.meta.env.VITE_WEB_WORKSPACE_IS_PUBLIC || "false").trim().toLowerCase() === "true";

export const CHROME_STORE_CTA_LABEL = CHROME_EXTENSION_IS_LIVE
  ? "Install Chrome extension"
  : "View Chrome Store listing";

export const CHROME_STORE_STATUS_LABEL = CHROME_EXTENSION_IS_LIVE
  ? "Chrome extension live now"
  : "Chrome Web Store review in progress";

export const CHROME_STORE_STATUS_SENTENCE = CHROME_EXTENSION_IS_LIVE
  ? "The Chrome extension is available now."
  : "The Chrome extension listing is under review right now.";

// Founding-member lifetime deal (one-time Stripe Payment Link).
// Empty string = the founding section does not render. Paste the live
// Payment Link URL here (or set VITE_FOUNDING_CHECKOUT_URL) to launch it.
const DEFAULT_FOUNDING_CHECKOUT_URL = "";

export const FOUNDING_CHECKOUT_URL =
  (import.meta.env.VITE_FOUNDING_CHECKOUT_URL || DEFAULT_FOUNDING_CHECKOUT_URL).trim();
