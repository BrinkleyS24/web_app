/**
 * Next Actions items that came from an Apply Gate check, aligned with that posting's LATEST check.
 *
 * Teacher review, 2026-10-15:
 *   - "Tailor in Apply Gate" opened an empty form with the default resume, not the posting and the
 *     resume version she had checked. The link now carries the check (`verdict`) and the resume it
 *     used (`resume`, only when that version still exists), next to the task's action/version keys.
 *   - "Apply to Clinical Operations Coordinator" sat in More while Apply Gate had rated it Fix first,
 *     and "Tailor resume before applying" followed two Apply now results. The backend raises both
 *     tasks from one check, so the words here follow the newest check of the same posting.
 *
 * Display only: completion and keys stay the backend's.
 */
import type { ApplyGateHistoryItem, ResumeVariant } from "@/lib/emails";
import type { QueueItem } from "@/lib/premiumTaskQueue";
import { apiDateMs } from "@/lib/apiDate";
import { describeVerdictDecision, type VerdictDecisionKey } from "@/lib/verdictPresentation";

const RESUME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same posting identity the backend uses for these tasks (normalizeEntityFromJob). */
function postingKey(item: Pick<ApplyGateHistoryItem, "job_url" | "company_name" | "job_title">) {
  const url = String(item.job_url || "").trim();
  if (url) return `job:${url}`;
  const company = String(item.company_name || "").trim().toLowerCase() || "unknown-company";
  const role = String(item.job_title || "").trim().toLowerCase() || "unknown-role";
  return `job:${company}:${role}`;
}

function isApplyGateTask(item: QueueItem) {
  const type = String(item.actionType || "").toLowerCase();
  // The tailor task's queue source is "resume", so the Apply Gate origin is read from the
  // suggestion source the backend stamps on both tasks.
  const fromApplyGate = item.suggestionSource === "apply_gate_action_plan" || item.source === "apply_gate";
  return fromApplyGate && (type === "tailor_resume" || type === "apply");
}

/** The newest check of the posting this task's check was about, or null when it is not in history. */
export function latestCheckForTask(item: QueueItem, history: ApplyGateHistoryItem[]): ApplyGateHistoryItem | null {
  if (!isApplyGateTask(item) || item.applicationId == null) return null;
  const source = history.find((entry) => String(entry.id) === String(item.applicationId));
  if (!source) return null;
  const key = postingKey(source);
  return history
    .filter((entry) => postingKey(entry) === key)
    .reduce((latest, entry) => (apiDateMs(entry.created_at) > apiDateMs(latest.created_at) ? entry : latest), source);
}

/** Apply Gate opened on that check, with the resume it used when the version still exists. */
export function applyGateHrefForCheck(check: ApplyGateHistoryItem, variants: ResumeVariant[] | null) {
  const params = new URLSearchParams({ verdict: String(check.id) });
  const resumeId = String(check.resume_variant_id || "");
  if (RESUME_ID.test(resumeId) && variants?.some((variant) => variant.id.toLowerCase() === resumeId.toLowerCase())) {
    params.set("resume", resumeId.toLowerCase());
  }
  return `/apply-gate?${params}`;
}

function roleName(check: ApplyGateHistoryItem) {
  const role = String(check.job_title || "").trim() || "this role";
  const company = String(check.company_name || "").trim();
  return company ? `${role} at ${company}` : role;
}

type Wording = { title: string; lead: string; ctaLabel: string };

function wordingFor(type: string, decision: VerdictDecisionKey, label: string, role: string): Wording | null {
  const said = `Apply Gate's latest check said ${label}.`;
  if (type === "apply") {
    if (decision === "fix_first") {
      return { title: `Recheck ${role} before you apply`, lead: `${said} Update your resume, then check it again.`, ctaLabel: "Recheck in Apply Gate" };
    }
    if (decision === "skip") {
      return { title: `Apply Gate now says skip ${role}`, lead: `${said} See why before you spend time on it.`, ctaLabel: "See why in Apply Gate" };
    }
    return null;
  }
  // tailor_resume
  if (decision === "apply" || decision === "apply_with_care") {
    return { title: `Optional: strengthen your resume for ${role}`, lead: `${said} These edits can help, but you can send it as it is.`, ctaLabel: "Review in Apply Gate" };
  }
  if (decision === "skip") {
    return { title: `Apply Gate now says skip ${role}`, lead: `${said} Tailoring is not worth your time here.`, ctaLabel: "See why in Apply Gate" };
  }
  return null;
}

export function alignApplyGateActions<T extends QueueItem>(
  items: T[],
  history: ApplyGateHistoryItem[] | null | undefined,
  variants: ResumeVariant[] | null | undefined,
): T[] {
  if (!history?.length) return items;
  return items.map((item) => {
    const check = latestCheckForTask(item, history);
    if (!check) return item;
    const type = String(item.actionType || "").toLowerCase();
    const decision = describeVerdictDecision(check);
    const wording = wordingFor(type, decision.key, decision.label, roleName(check));
    return {
      ...item,
      routeHref: applyGateHrefForCheck(check, variants ?? null),
      ...(wording
        ? { title: wording.title, description: wording.lead, whyNow: wording.lead, ctaLabel: wording.ctaLabel }
        : {}),
    };
  });
}
