import { apiFetch } from "@/lib/api";

/** Where an application stands now — the same buckets as the Dashboard's stage bar. */
export type AskStage = "waiting" | "quiet" | "interviewing" | "offer" | "rejected" | "closed";

/** What is due now, computed by the backend with the Today list's follow-up timing. */
export type AskNextStep =
  | "research"
  | "find_contact"
  | "follow_up"
  | "thank_you"
  | "interview_follow_up"
  | "status_check";

export type AskApplication = {
  ref: string;
  company: string;
  role: string | null;
  stage: AskStage;
  appliedOn: string | null;
  /** The latest email from the hiring process about this application. */
  lastUpdateOn: string | null;
  nextStep: AskNextStep | null;
  /** What the next step stands on, written by the backend (followUpBasis.js), never by the AI. */
  why?: string | null;
  threadId: string | null;
};

export type AskResponse = {
  success: boolean;
  answer: string;
  applications: AskApplication[];
  basis?: { applications?: number; earliestTrackedOn?: string | null };
};

export const ASK_MAX_QUESTION_CHARS = 300;

/**
 * One question to Ask Applendium. A lookup plus one or two AI calls usually takes a few seconds;
 * the wider timeout covers a slow model without leaving the member staring at a spinner forever.
 */
export async function askApplendium(question: string): Promise<AskResponse> {
  return apiFetch("/api/ask", { method: "POST", body: { question }, timeoutMs: 45_000 });
}
