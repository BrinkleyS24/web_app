/**
 * How a Next Actions item presents itself: what it is, which application it is about, and the one
 * button that starts it.
 *
 * Every card used to offer "Generate draft" (founder review, 2026-09-25) — including research
 * cards, where there is nothing to send. The button now matches the task: follow-ups draft the
 * email, research opens a search, networking finds people, prep opens the plan, résumé and role
 * work go to the tool that does them.
 */
import type { QueueItem } from "@/lib/premiumTaskQueue";

export type ActionCtaKind = "draft" | "gmail" | "route" | "external" | "close" | "cleanup" | "prep" | "complete";

export type ActionCta = {
  kind: ActionCtaKind;
  label: string;
  href?: string;
};

const DRAFT_LABELS: Record<string, string> = {
  follow_up: "Draft follow-up",
  status_check: "Draft status check",
  reply: "Draft reply",
  thank_you: "Draft thank-you note",
  referral_request: "Draft referral ask",
};

const RESUME_TYPES = new Set(["tailor_resume", "resume_proof_gap", "portfolio"]);
const APPLY_GATE_TYPES = new Set(["apply_gate_fix", "fix_targeting", "apply"]);
const PREP_TYPES = new Set(["prep_interview", "prepare_interview"]);

function actionTypeOf(item: QueueItem) {
  return String(item.actionType || "").trim().toLowerCase();
}

function searchTerms(item: QueueItem) {
  return [item.company, item.roleTitle].map((value) => String(value || "").trim()).filter(Boolean);
}

export function resolveActionCta(item: QueueItem, gmailUrl: string | null): ActionCta {
  const type = actionTypeOf(item);
  const intent = item.intent || null;

  if (intent === "CLEANUP_STRUCTURED_FIELDS" || intent === "LINK_APPLICATIONS") {
    return { kind: "cleanup", label: intent === "LINK_APPLICATIONS" ? "Link applications" : "Fix the details" };
  }
  if (intent === "CLOSE_STALE_ROLE") return { kind: "close", label: "Close it out" };

  if (DRAFT_LABELS[type] && item.hasDraft && item.threadId) {
    return { kind: "draft", label: DRAFT_LABELS[type] };
  }

  if (type === "research") {
    const terms = searchTerms(item);
    if (terms.length) {
      return {
        kind: "external",
        label: item.company ? `Research ${item.company}` : "Research the role",
        href: `https://www.google.com/search?q=${encodeURIComponent(terms.join(" "))}`,
      };
    }
  }

  if (type === "networking" || intent === "NETWORKING_OUTREACH") {
    if (item.company) {
      return {
        kind: "external",
        label: `Find people at ${item.company}`,
        href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(item.company)}`,
      };
    }
  }

  if (PREP_TYPES.has(type) || intent === "PREP_INTERVIEW") return { kind: "prep", label: "See prep plan" };

  if ((type === "complete_assessment" || intent === "COMPLETE_ASSESSMENT") && gmailUrl) {
    return { kind: "gmail", label: "Open assessment email", href: gmailUrl };
  }

  if (RESUME_TYPES.has(type) || intent === "TAILOR_RESUME" || item.source === "resume") {
    // The label follows the destination: tailoring for one posting happens in Apply Gate.
    const href = item.routeHref || "/resumes";
    return { kind: "route", label: href.startsWith("/apply-gate") ? "Tailor in Apply Gate" : "Update your résumé", href };
  }

  if (APPLY_GATE_TYPES.has(type) || intent === "FIX_TARGETING" || intent === "APPLY_TO_ROLE" || item.source === "apply_gate") {
    return { kind: "route", label: "Open in Apply Gate", href: item.routeHref || "/apply-gate" };
  }

  if (item.routeHref) return { kind: "route", label: item.routeLabel || "Open", href: item.routeHref };
  if (gmailUrl) return { kind: "gmail", label: "Open in Gmail", href: gmailUrl };
  return { kind: "complete", label: "Mark done" };
}

const SUBJECT_PREFIX = /^subject:\s*/i;

/**
 * Which application this is about. Company and role when known; otherwise the email's own subject,
 * quoted, because "Follow up on your application" with no name leaves the user guessing which one.
 */
export function describeActionIdentity(item: QueueItem): string | null {
  const parts = [item.company, item.roleTitle].map((value) => String(value || "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  const subject = (item.evidence || [])
    .map((entry) => String(entry || ""))
    .find((entry) => SUBJECT_PREFIX.test(entry));
  const cleaned = subject ? subject.replace(SUBJECT_PREFIX, "").trim() : "";
  return cleaned ? `“${cleaned}”` : null;
}

/** A plain name for the kind of task, shown beside the title. */
export function describeActionKind(item: QueueItem): string {
  const type = actionTypeOf(item);
  const intent = item.intent || null;
  if (intent === "CLOSE_STALE_ROLE") return "Close-out";
  if (intent === "CLEANUP_STRUCTURED_FIELDS" || intent === "LINK_APPLICATIONS") return "Data fix";
  if (PREP_TYPES.has(type) || intent === "PREP_INTERVIEW") return "Interview prep";
  if (type === "complete_assessment" || intent === "COMPLETE_ASSESSMENT") return "Assessment";
  if (type === "research") return "Research";
  if (type === "networking" || intent === "NETWORKING_OUTREACH") return "Networking";
  if (type === "thank_you") return "Thank-you";
  if (type === "reply") return "Reply";
  if (type === "status_check") return "Status check";
  if (RESUME_TYPES.has(type) || item.source === "resume") return "Résumé";
  if (APPLY_GATE_TYPES.has(type) || item.source === "apply_gate") return "Apply Gate";
  return "Follow-up";
}
