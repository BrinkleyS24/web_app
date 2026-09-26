import type { Tone } from "@/components/premium/tone";

/**
 * One color per application status, on every premium page and in the extension.
 *
 * The palette is the one the brand already publishes — the extension popup, the landing-page hero
 * and the store screenshots: interviews gold, offers green, rejections red, everything waiting or
 * settled neutral. Before this map the web app painted interviews brand-teal on the Weekly Summary
 * and Dashboard but green on Apply Gate and Résumés, and "waiting on a reply" was blue on the
 * Dashboard and amber on the Weekly Summary (review, 2026-09-26). On the light web theme gold is
 * the shared `--warning` token, the same one the popup's light fallback uses.
 *
 * Keep in step with the popup: frontend/job_sort/popup/src/App.jsx (tiles + tabs) and
 * components/EmailList.jsx (stepper + pills).
 */
export const STATUS_TONE = {
  applied: "neutral",
  waiting: "neutral",
  interview: "attention",
  offer: "positive",
  rejected: "risk",
  closed: "done",
} as const satisfies Record<string, Tone>;

export type ApplicationStatusKey = keyof typeof STATUS_TONE;
