import { apiFetch } from "@/lib/api";

/** Where an application stands now — the same buckets as the Dashboard's stage bar. */
export type AskStage = "waiting" | "quiet" | "interviewing" | "interview_quiet" | "offer" | "rejected" | "closed";

/** What is due now, computed by the backend with the Today list's follow-up timing. */
export type AskNextStep =
  | "research"
  | "find_contact"
  | "follow_up"
  // Days 21-29 after applying: one last check-in (backend askService.nextStepFor, 2026-10-15).
  | "final_check"
  | "thank_you"
  | "interview_follow_up"
  | "status_check"
  // Something they owe; these outrank every timing step (backend followUpBasis.COMMITMENT_STEPS).
  | "complete_assessment"
  | "prepare_interview";

export type AskApplication = {
  ref: string;
  company: string;
  role: string | null;
  stage: AskStage;
  interviewQuiet?: boolean;
  appliedOn: string | null;
  /** The latest email from the hiring process about this application. */
  lastUpdateOn: string | null;
  nextStep: AskNextStep | null;
  /** What the next step stands on, written by the backend (followUpBasis.js), never by the AI. */
  why?: string | null;
  /** What the inbox shows about this application (an assessment, a rejection), written by our code. */
  note?: string | null;
  threadId: string | null;
};

/** An email our server showed the member directly. The AI never saw its text. */
export type AskQuote = {
  ref: string;
  company: string;
  role: string | null;
  kind: string;
  date: string | null;
  passage: string;
  rejectionNote?: string | null;
  threadId: string | null;
};

/** All-time totals the backend computed with the Dashboard's rules (askService.buildAskTotals). */
export type AskTotals = {
  applications: number;
  open: number;
  noReplyYet: number;
  waitingForReply: number;
  wentQuiet: number;
  inInterviewStage: number;
  stillInterviewing: number;
  noWordSinceInterview: number;
  reachedInterview: number;
  offers: number;
  rejected: number;
  closedByYou: number;
  closed: number;
  interviewRate: number | null;
};

export type AskResponse = {
  success: boolean;
  answer: string;
  /** The answer as plain lines, no markdown or codes, and without the draft (2026-10-15). */
  answerLines?: string[];
  totals?: AskTotals | null;
  applications: AskApplication[];
  quotes?: AskQuote[];
  handoff?: { kind: "apply_gate" | "resumes" | "privacy" | "interview_prep"; label: string; source?: "confirmed_resume_outcomes" };
  basis?: { applications?: number; earliestTrackedOn?: string | null };
  /** A drafted email as fields, so it can be edited and copied; `answer` keeps the text too. */
  draft?: { subject?: string | null; body: string } | null;
  /** A list the backend computed in code (never the AI), e.g. applications with no reply. */
  list?: {
    kind: "no_reply";
    minDays: number;
    total: number;
    items: { ref: string; company: string; role: string | null; appliedOn: string | null; lastUpdateOn: string | null; daysSinceLastUpdate: number | null }[];
  } | null;
};

/** Where each handoff kind takes the member. */
export const ASK_HANDOFF_ROUTES: Record<NonNullable<AskResponse["handoff"]>["kind"], string> = {
  apply_gate: "/apply-gate",
  resumes: "/resumes",
  privacy: "/settings#your-data",
  interview_prep: "/interview-prep",
};

export const ASK_MAX_QUESTION_CHARS = 300;

function readableResponse(value: unknown): value is AskResponse {
  const object = (item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item);
  const optionalText = (item: unknown) => item == null || typeof item === "string";
  const count = (item: unknown) => typeof item === "number" && Number.isSafeInteger(item) && item >= 0;
  if (!object(value) || value.success !== true || typeof value.answer !== "string" || !value.answer.trim() || !Array.isArray(value.applications)) return false;
  const stages = new Set(["waiting", "quiet", "interviewing", "interview_quiet", "offer", "rejected", "closed"]);
  if (value.applications.some(item => !object(item) || typeof item.ref !== "string" || typeof item.company !== "string"
    || typeof item.stage !== "string" || !stages.has(item.stage) || !optionalText(item.role) || !optionalText(item.why) || !optionalText(item.note))) return false;
  if (value.quotes != null && (!Array.isArray(value.quotes) || value.quotes.some(item => !object(item)
    || typeof item.ref !== "string" || typeof item.company !== "string" || typeof item.passage !== "string" || !optionalText(item.rejectionNote)))) return false;
  if (value.draft != null && (!object(value.draft) || typeof value.draft.body !== "string" || !optionalText(value.draft.subject))) return false;
  if (value.handoff != null && (!object(value.handoff) || typeof value.handoff.kind !== "string" || typeof value.handoff.label !== "string")) return false;
  if (value.totals != null) {
    if (!object(value.totals)) return false;
    for (const key of ["applications", "open", "reachedInterview", "inInterviewStage", "offers", "rejected"]) {
      if (!count(value.totals[key])) return false;
    }
    if (Object.entries(value.totals).some(([key, item]) => key === "interviewRate"
      ? item != null && (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 100)
      : !count(item))) return false;
  }
  if (value.basis != null && (!object(value.basis) || (value.basis.applications != null && !count(value.basis.applications)) || !optionalText(value.basis.earliestTrackedOn))) return false;
  if (value.list != null && (!object(value.list) || !Array.isArray(value.list.items)
    || value.list.items.some(item => !object(item) || typeof item.ref !== "string" || typeof item.company !== "string" || !optionalText(item.role)))) return false;
  return true;
}

/**
 * One question to Ask Applendium™. A lookup plus one or two AI calls usually takes a few seconds;
 * the wider timeout covers a slow model without leaving the member staring at a spinner forever.
 */
export async function askApplendium(question: string, options: { signal?: AbortSignal } = {}): Promise<AskResponse> {
  // Include token acquisition in the budget; apiFetch's own timer starts after it.
  const controller = new AbortController();
  let rejectAbort: (reason: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = (error: Error) => {
    if (controller.signal.aborted) return;
    controller.abort(error);
    rejectAbort(error);
  };
  const onParentAbort = () => abort(new DOMException("Ask request cancelled.", "AbortError"));
  const timer = setTimeout(() => abort(new Error("Ask took too long. Try again.")), 45_000);
  options.signal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    const result = Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return apiFetch("/api/ask", { method: "POST", body: { question }, timeoutMs: 45_000, signal: controller.signal });
      }), interrupted,
    ]);
    if (options.signal?.aborted) onParentAbort();
    const response: unknown = await result;
    if (!readableResponse(response)) throw new Error("Ask returned an incomplete response. Try again.");
    return response;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

/** The words for codes an older backend's answer may still contain (backend askAnswerText.js). */
const CODE_WORDS: Record<string, string> = {
  interview_quiet: "no word since the interview",
  interviewing: "still interviewing",
  find_contact: "find a contact",
  follow_up: "follow-up",
  final_check: "final check-in",
  interview_follow_up: "post-interview follow-up",
  status_check: "status check",
  thank_you: "thank-you note",
  complete_assessment: "complete the assessment",
  prepare_interview: "prepare for the interview",
  no_submission_seen: "no submission seen",
  role_gone: "role filled or closed",
};

function cleanLine(line: string) {
  return line
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*[*•]\s+/, "- ")
    .replace(/\*\*/g, "")
    // Snake_case in an answer is always one of ours, never the member's words.
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (code) => CODE_WORDS[code] || code.replace(/_/g, " "))
    .trim();
}

/** "...: 1. A 2. B 3. C" onto separate lines, only for a real 1, 2, 3 sequence. */
function splitNumbered(text: string): string[] {
  const at: number[] = [];
  let from = 0;
  for (let n = 1; ; n += 1) {
    const match = new RegExp(`(^|\\s)${n}[.)]\\s+(?=\\S)`).exec(text.slice(from));
    if (!match) break;
    const index = from + match.index + match[1].length;
    at.push(index);
    from = index + 2;
  }
  if (at.length < 2) return [text];
  const parts = [text.slice(0, at[0]), ...at.map((start, i) => text.slice(start, at[i + 1] ?? text.length))];
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * What to show as the answer, one entry per line (persona review, 2026-10-15: literal **bold**, an
 * internal "interview_quiet", numbered lists crammed into one paragraph, and the draft printed again
 * above its own edit box). Prefers the backend's `answerLines`; older backends get the same clean-up
 * here, with the drafted email taken out of the prose.
 */
export function askAnswerLines(result: Pick<AskResponse, "answer" | "answerLines" | "draft">): string[] {
  const provided = Array.isArray(result.answerLines) ? result.answerLines.filter((line): line is string => typeof line === "string") : null;
  let source = provided && provided.length ? provided.join("\n") : String(result.answer || "");
  if (!provided?.length && result.draft?.body) {
    for (const part of [result.draft.body, result.draft.subject ? `Subject: ${result.draft.subject}` : "", result.draft.subject || ""]) {
      if (part && source.includes(part)) source = source.replace(part, "");
    }
  }
  const lines = source
    .split(/\r?\n+/)
    .flatMap((line) => splitNumbered(cleanLine(line)))
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length && result.draft?.body) return ["Here is a draft you can edit and copy."];
  return lines;
}

/** A list line: "- item" or "2. item". */
export function askListMarker(line: string): { ordered: boolean; text: string } | null {
  const bullet = line.match(/^-\s+(.*)$/);
  if (bullet) return { ordered: false, text: bullet[1] };
  const numbered = line.match(/^\d+[.)]\s+(.*)$/);
  return numbered ? { ordered: true, text: numbered[1] } : null;
}
