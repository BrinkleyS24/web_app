import { apiFetch } from "@/lib/api";

/**
 * Usage events and the uninstall survey (backend services/activityLog.js, 2026-10-05). Both are
 * recorded server-side against a one-way key, never a name or any email content.
 */

const WEB_OPEN_KEY = "applendium.webOpenReported";

/** Reports one website visit per browser session. Fire and forget: it never blocks or errors. */
export function reportWebOpen() {
  // The uninstall page is not a visit: counting it would make someone who just left look active.
  if (window.location.pathname === "/goodbye") return;
  try {
    if (window.sessionStorage.getItem(WEB_OPEN_KEY)) return;
    window.sessionStorage.setItem(WEB_OPEN_KEY, "1");
  } catch {
    // Storage blocked (private window): report anyway; the worst case is one extra line.
  }
  apiFetch("/api/activity", { method: "POST", body: JSON.stringify({ event: "web_open" }) }).catch(() => {});
}

/** The answers on /goodbye. The ids are the backend's UNINSTALL_REASONS. */
export const UNINSTALL_REASONS = [
  { id: "google_warning", label: "The Google security warning worried me" },
  { id: "missed_applications", label: "It didn't find my applications" },
  { id: "too_many_notifications", label: "Too many notifications" },
  { id: "not_applying_enough", label: "I don't apply to enough jobs to need it" },
  { id: "found_job", label: "I got a job" },
  { id: "other", label: "Something else" },
] as const;

export type UninstallReason = (typeof UNINSTALL_REASONS)[number]["id"];

export async function submitUninstallAnswer(answer: {
  reason: UninstallReason;
  note?: string;
  uk?: string | null;
  v?: string | null;
  si?: string | null;
}) {
  await apiFetch("/api/feedback/uninstall", { method: "POST", body: JSON.stringify(answer) });
}
