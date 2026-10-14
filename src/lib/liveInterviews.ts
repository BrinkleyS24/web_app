import { parseApiDate } from "@/lib/apiDate";
import type { StoredEmail } from "@/lib/emails";
import type { QueueItem } from "@/lib/premiumTaskQueue";

/**
 * The user's live interviews, for the Interview Prep page's starting point (persona review,
 * 2026-10-14). /interview-prep said "Open an interview task from Next Actions" and stopped, even for
 * a teacher with an interview in progress and no task, so prep could not be reached at all.
 *
 * "Live" uses the Dashboard's "Still interviewing" definition, so the two never disagree: an
 * interview email, no decision (offer or rejection) after it, not closed, and an email in the last
 * 30 days. Grouped by application when the email is linked to one, otherwise by company and role.
 */

export const LIVE_INTERVIEW_WINDOW_DAYS = 30;

export type LiveInterview = {
  key: string;
  company: string | null;
  role: string | null;
  applicationId: string | null;
  threadIds: string[];
  /** Date of the most recent email in this application. */
  lastEmailAt: Date;
  /** The prep task in Next Actions for this interview, when there is one. */
  prepTask: QueueItem | null;
};

const PREP_TYPES = new Set(["prep_interview", "prepare_interview"]);

const norm = (value?: string | null) => String(value || "").trim().toLowerCase();
const categoryOf = (email: StoredEmail) => norm(email.category);
const isInterview = (email: StoredEmail) => categoryOf(email).startsWith("interview");
const isDecision = (email: StoredEmail) => categoryOf(email) === "offers" || categoryOf(email) === "offer" || categoryOf(email) === "rejected";

function groupKey(email: StoredEmail): string | null {
  if (email.applicationId) return `app:${email.applicationId}`;
  const company = norm(email.company_name);
  if (company) return `co:${company}|${norm(email.position)}`;
  return email.thread_id ? `thread:${email.thread_id}` : null;
}

export function isPrepTask(item: Pick<QueueItem, "actionType" | "intent">) {
  return PREP_TYPES.has(norm(item.actionType)) || item.intent === "PREP_INTERVIEW";
}

function findPrepTask(interview: Omit<LiveInterview, "prepTask">, tasks: QueueItem[]): QueueItem | null {
  const byApplication = interview.applicationId
    ? tasks.find((task) => task.applicationId != null && String(task.applicationId) === interview.applicationId)
    : null;
  if (byApplication) return byApplication;
  const byThread = tasks.find((task) => task.threadId && interview.threadIds.includes(task.threadId));
  if (byThread) return byThread;
  const company = norm(interview.company);
  if (!company) return null;
  const sameCompany = tasks.filter((task) => norm(task.company) === company);
  // Two interviews at one company: only a role match is safe; otherwise do not guess.
  if (sameCompany.length === 1) return sameCompany[0];
  return sameCompany.find((task) => norm(task.roleTitle) === norm(interview.role)) || null;
}

export function deriveLiveInterviews(
  emails: StoredEmail[] | null | undefined,
  queueItems: QueueItem[] | null | undefined,
  now: Date = new Date(),
): LiveInterview[] {
  const groups = new Map<string, StoredEmail[]>();
  for (const email of emails || []) {
    const key = groupKey(email);
    if (!key || !parseApiDate(email.date)) continue;
    const list = groups.get(key) || [];
    list.push(email);
    groups.set(key, list);
  }

  const tasks = (queueItems || []).filter(isPrepTask);
  const cutoff = now.getTime() - LIVE_INTERVIEW_WINDOW_DAYS * 86_400_000;
  const live: LiveInterview[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => parseApiDate(a.date)!.getTime() - parseApiDate(b.date)!.getTime());
    const lastInterviewIndex = sorted.map(isInterview).lastIndexOf(true);
    if (lastInterviewIndex < 0) continue;
    if (sorted.slice(lastInterviewIndex + 1).some(isDecision)) continue;
    if (sorted.some((email) => email.isClosed || email.isUserClosed)) continue;
    const last = sorted[sorted.length - 1];
    const lastEmailAt = parseApiDate(last.date)!;
    if (lastEmailAt.getTime() < cutoff) continue;

    const named = [...sorted].reverse().find((email) => email.company_name) || last;
    const base = {
      key,
      company: named.company_name || null,
      role: [...sorted].reverse().find((email) => email.position)?.position || null,
      applicationId: sorted.find((email) => email.applicationId)?.applicationId || null,
      threadIds: Array.from(new Set(sorted.map((email) => email.thread_id).filter(Boolean) as string[])),
      lastEmailAt,
    };
    live.push({ ...base, prepTask: findPrepTask(base, tasks) });
  }

  return live.sort((a, b) => b.lastEmailAt.getTime() - a.lastEmailAt.getTime());
}
