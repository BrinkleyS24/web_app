/**
 * Friendly sentences for failed requests.
 *
 * Settings once showed "Billing details did not load: BLOCKED_BY_QA_HARNESS" (persona review,
 * 2026-10-14): the backend's machine code went straight to the screen. A code helps whoever reads
 * the console, never the person reading the page, so codes and bare HTTP statuses are logged and
 * replaced by a sentence that says what happened and what to do. Backend messages that are already
 * written for people ("Premium feature required") pass through unchanged.
 */

type ErrorLike = { name?: string; message?: string; status?: number | null; payload?: unknown } | null | undefined;

const CODE_LIKE = /^[A-Z0-9_.:-]{3,}$/;

/** True when a backend message is a sentence a person can read, not a code or a raw status line. */
export function isHumanMessage(message: unknown): message is string {
  if (typeof message !== "string") return false;
  const text = message.trim();
  if (text.length < 8 || text.length > 300) return false;
  if (CODE_LIKE.test(text)) return false;
  if (!/\s/.test(text)) return false;
  // Raw transport or status lines carry no advice.
  if (/^(server error \(\d+\)|request failed|internal server error|bad request|forbidden|unauthorized|not found)(?=[\s.:]|$)/i.test(text)) return false;
  if (/^https?:\/\//i.test(text) || /^</.test(text)) return false;
  return true;
}

/** The sentence for a status when the backend gave no readable message. */
export function messageForStatus(status: number | null | undefined): string {
  if (status === 401) return "Your sign-in has expired. Sign in again, then try again.";
  if (status === 403) return "This is not available for your account right now. Sign out and back in if that seems wrong.";
  if (status === 404) return "This is not available right now.";
  if (status === 408) return "This took too long. Check your connection and try again.";
  if (status === 409) return "Something changed while this was saving. Refresh the page, then try again.";
  if (status === 413) return "That is too large to send. Try a shorter version.";
  if (status === 429) return "Too many requests right now. Wait a minute, then try again.";
  if (status != null && status >= 500) return "Applendium had a problem on its side. Your data is safe. Try again in a moment.";
  return "Something went wrong. Try again in a moment.";
}

/**
 * Message for an ApiRequestError at the point it is created (api.js). Returns the backend's own
 * sentence when it is readable, otherwise the status sentence, logging what was replaced.
 */
export function apiErrorMessage(status: number | null | undefined, rawMessage: unknown): string {
  if (isHumanMessage(rawMessage)) return rawMessage.trim();
  if (rawMessage != null && rawMessage !== "") {
    console.warn("[api] request failed", { status, code: String(rawMessage).slice(0, 120) });
  }
  return messageForStatus(status);
}

/**
 * The sentence to show for any thrown error. `fallback` is used when nothing better is known.
 * Network failures and timeouts get their own advice, since retrying sooner will not help them.
 */
export function friendlyErrorMessage(error: unknown, fallback = "Something went wrong. Try again in a moment."): string {
  const err = error as ErrorLike;
  const message = typeof err?.message === "string" ? err.message : "";
  if (/timed out/i.test(message)) return "This took too long. Check your connection and try again.";
  if (err?.name === "TypeError" || /failed to fetch|network ?error|load failed|networkrequest/i.test(message)) {
    return "Could not reach Applendium. Check your connection and try again.";
  }
  if (typeof err?.status === "number") {
    return isHumanMessage(message) ? message.trim() : messageForStatus(err.status);
  }
  if (isHumanMessage(message)) return message.trim();
  if (message) console.warn("[api] error replaced with a friendly message", message.slice(0, 120));
  return fallback;
}
