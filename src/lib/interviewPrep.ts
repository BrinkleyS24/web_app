import { apiFetch } from "@/lib/api";
import type { ActionContext } from "./actionWorkspace";

export type InterviewSource = ActionContext & {
  sourceVersion: string; company: string; role: string; threadId: string;
  schedule: { startAt: string; timeZone: string | null; hasTime: boolean; source: string | null } | null;
  excerpts: { id: string; subject: string; sender: string; receivedAt: string | null; text: string }[];
};
export type PracticePack = {
  sourceVersion: string; resume: { id: string; name: string; version: string }; postingVersion: string; disclosure: string;
  practice: { id: string; quote: string; kind: "eligibility" | "experience"; question: string; guidance: string; askInterviewer: string; possibleExamples: string[] }[];
};
export type PracticeInput = ActionContext & { sourceVersion: string; variantId: string; jobDescription: string; focusAreas: string[] };

export async function fetchInterviewSource(keys: ActionContext): Promise<InterviewSource> {
  const response = await apiFetch(`/api/suggestions/interview-prep/context?${new URLSearchParams(keys)}`, { method:"GET" }) as {success:boolean;source:InterviewSource};
  if (!response.success || !/^[a-f0-9]{64}$/.test(response.source?.sourceVersion || "") || !Array.isArray(response.source?.excerpts)
    || response.source.logicalKey !== keys.logicalKey || response.source.dedupeKey !== keys.dedupeKey) throw new Error("Your interview source was not confirmed. Reload it.");
  return response.source;
}
export async function buildInterviewPractice(input: PracticeInput): Promise<PracticePack> {
  const response = await apiFetch("/api/suggestions/interview-prep/practice", { method:"POST",body:JSON.stringify(input),timeoutMs:20_000 }) as {success:boolean;pack:PracticePack};
  if (!response.success || !Array.isArray(response.pack?.practice) || !response.pack.practice.length || response.pack.sourceVersion !== input.sourceVersion
    || response.pack.resume?.id !== input.variantId) throw new Error("Your practice was not confirmed. Try again.");
  return response.pack;
}

/**
 * The backend stores a true instant when the invitation names a zone (10:00 America/New_York is
 * stored as 14:00Z), and a floating wall clock written as UTC only when it names none
 * (utils/scheduledEventExtraction.js). Showing every value as a floating clock printed "14:00
 * (America/New_York)" for a 10:00 AM ET interview (A+ review, 2026-10-15). A zoned instant is shown
 * in its own zone; a floating one is shown as written.
 */
function zonedScheduleLabel(schedule: NonNullable<InterviewSource["schedule"]>): string | null {
  if (!schedule.timeZone || !schedule.hasTime) return null;
  // Stored timestamps can arrive without an offset ("2026-10-08T14:30:00"); they are UTC, and a bare
  // Date() would read them in the viewer's zone instead.
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(schedule.startAt) ? schedule.startAt : `${schedule.startAt.replace(" ", "T")}Z`;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  try {
    const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: schedule.timeZone }).format(at);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: schedule.timeZone, timeZoneName: "short" }).format(at);
    return `${date}, ${time}.`;
  } catch {
    return null;
  }
}

export function invitationScheduleLabel(schedule: InterviewSource["schedule"]): string {
  if (!schedule) return "Date and time are unconfirmed. Check the invitation in Gmail.";
  const zoned = zonedScheduleLabel(schedule);
  if (zoned) return zoned;
  const match = schedule.startAt.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!match || Number.isNaN(new Date(`${match[1]}T00:00:00Z`).getTime()) || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0,10)!==match[1]) return "Date and time are unconfirmed. Check the invitation in Gmail.";
  const date = new Intl.DateTimeFormat("en-US",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${match[1]}T00:00:00Z`));
  if (!schedule.hasTime || !match[2]) return `${date}. Time is unconfirmed; check the invitation.`;
  return `${date}, ${match[2]} (${schedule.timeZone || "timezone unconfirmed — check the invitation"}).`;
}

export const splitFocusAreas = (text: string) => text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);

/**
 * Has the interview already happened? null when the invitation names no date (2026-10-15: step 1
 * asked to "confirm the invitation" for an interview held two weeks earlier).
 */
export function interviewHasPassed(schedule: InterviewSource["schedule"], now = Date.now()): boolean | null {
  if (!schedule?.startAt) return null;
  const match = schedule.startAt.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  if (schedule.hasTime) {
    const iso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(schedule.startAt) ? schedule.startAt : `${schedule.startAt.replace(" ", "T")}Z`;
    const at = new Date(iso).getTime();
    if (Number.isFinite(at)) return at < now;
  }
  // Date only: passed once that whole day is over everywhere (UTC-12 is the last to finish it).
  const endOfDay = new Date(`${match[1]}T23:59:59Z`).getTime() + 12 * 3_600_000;
  return Number.isFinite(endOfDay) ? endOfDay < now : null;
}

// What an employer asks a candidate to prepare or bring ("have an example of a lesson or unit you
// designed ready to walk through"): the most useful thing to practice first (teacher review, 2026-10-15).
const PREP_CUE = /\b(prepare|bring|ready to|be ready|walk (?:us |me )?through|example|portfolio|sample|presentation|present|case study|exercise|assessment|discuss|talk about|tell us about|questions? about|demonstrat|show us)\b/i;
const DUTY_CUE = /\b(responsib|you will|you'll|require|qualif|experience (?:with|in)|ability to|skills?|duties|manage|support|lead|develop|design|coordinate|teach|plan)\b/i;
const LOGISTICS = /(https?:|www\.|@|\b(?:zoom|teams|google meet|calendar invit\w*|reschedul\w*|unsubscribe|parking|dial[- ]in|meeting id|passcode|privacy (?:policy|notice)|confirm (?:your|the) (?:time|availability)|let us know if|reply to this|this email)\b)/i;
const CLOCK_OR_DAY = /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const SALUTATION = /^(hi|hello|dear|hey|thanks|thank you|best|regards|sincerely|cheers|good (?:morning|afternoon))\b/i;
// The backend refuses these as practice quotes (services/interviewPrepService.js).
const BOILERPLATE = /^(?:responsibilities|qualifications|requirements|benefits|about us|equal opportunity|we are an equal|all qualified applicants|salary range|compensation range|apply now|privacy policy|privacy notice)\s*[:.]?$|^(?:we are an equal opportunity|all qualified applicants|salary range\s*:|compensation range\s*:|benefits include|privacy (?:policy|notice))/i;

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** Up to `max` exact sentences from `text` worth practicing: employer asks first, then duties. */
export function pickFocusAreas(text: string, max = 3): string[] {
  const sentences = text.split(/\r?\n+|(?<=[.!?])\s+/).map(squash).filter((line) => line.length >= 10 && line.length <= 600);
  const usable = sentences.filter((line) => !SALUTATION.test(line) && !BOILERPLATE.test(line) && !/(https?:|www\.|@)/i.test(line));
  const asks = usable.filter((line) => PREP_CUE.test(line) && !LOGISTICS.test(line));
  const duties = usable.filter((line) => !asks.includes(line) && DUTY_CUE.test(line) && !LOGISTICS.test(line) && !CLOCK_OR_DAY.test(line) && line.length >= 25);
  return [...new Set([...asks, ...duties])].slice(0, max);
}

/**
 * Practice from what the app already has when no posting is pasted: the invitation's own text, with
 * the employer's asks as the quotes (mobile + teacher review, 2026-10-15: prep required pasting a full
 * posting plus exact quotes before anything appeared). null when the invitation is too thin.
 */
export function invitationPracticeInput(source: Pick<InterviewSource, "excerpts"> | null | undefined): { posting: string; focusAreas: string[] } | null {
  const texts = (source?.excerpts || []).map((email) => String(email.text || "").trim()).filter(Boolean);
  const posting = texts.join("\n\n").slice(0, 25_000);
  if (squash(posting).length < 100) return null;
  const focusAreas = pickFocusAreas(posting);
  return focusAreas.length ? { posting, focusAreas } : null;
}
