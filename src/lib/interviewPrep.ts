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

/** Calendar values are floating wall-clock values in this application's storage. Do not shift them. */
export function invitationScheduleLabel(schedule: InterviewSource["schedule"]): string {
  if (!schedule) return "Date and time are unconfirmed. Check the invitation in Gmail.";
  const match = schedule.startAt.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!match || Number.isNaN(new Date(`${match[1]}T00:00:00Z`).getTime()) || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0,10)!==match[1]) return "Date and time are unconfirmed. Check the invitation in Gmail.";
  const date = new Intl.DateTimeFormat("en-US",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${match[1]}T00:00:00Z`));
  if (!schedule.hasTime || !match[2]) return `${date}. Time is unconfirmed; check the invitation.`;
  return `${date}, ${match[2]} (${schedule.timeZone || "timezone unconfirmed — check the invitation"}).`;
}

export const splitFocusAreas = (text: string) => text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
