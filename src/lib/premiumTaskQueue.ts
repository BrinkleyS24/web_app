import { getEmailCompany, getEmailTitle } from "@/lib/emailFormatting";
import { splitRoleAndCompany } from "@/lib/applyGateDisplay";
import type {
  ApplyGateHistoryItem,
  FollowupSuggestion,
  StoredEmail,
  SuggestionActionState,
} from "@/lib/emails";

export type QueueSource = "followup" | "apply_gate" | "resume" | "cleanup";
export type QueueUrgency = "high" | "medium" | "low";

export type QueueItem = {
  id: string;
  source: QueueSource;
  urgency: QueueUrgency;
  title: string;
  description: string;
  company?: string | null;
  estimatedTime: string;
  daysAgo?: number | null;
  playbook: string[];
  sourceLabel: string;
  sourceDescription: string;
  threadId?: string | null;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  actionType?: string | null;
  suggestionSource?: string | null;
  stageLabel?: string | null;
  routeHref?: string | null;
  routeLabel?: string | null;
};

export const urgencyClasses: Record<QueueUrgency, string> = {
  high: "bg-destructive/10 text-destructive border border-destructive/20",
  medium: "bg-warning/10 text-warning border border-warning/20",
  low: "bg-accent/10 text-accent border border-accent/20",
};

export const sourceClasses: Record<QueueSource, string> = {
  followup: "bg-primary/10 text-primary border border-primary/20",
  apply_gate: "bg-accent/10 text-accent border border-accent/20",
  resume: "bg-success/10 text-success border border-success/20",
  cleanup: "bg-secondary text-secondary-foreground border border-border",
};

export const actionTypeLabels: Record<string, string> = {
  thank_you: "Thank-you",
  follow_up: "Follow-up",
  status_check: "Status check",
  research: "Research",
  networking: "Networking",
  portfolio: "Portfolio",
  strategic_timing: "Timing",
  referral_request: "Referral",
  apply_gate_fix: "Apply Gate fix",
  resume_proof_gap: "Resume proof",
  cleanup_structured_fields: "Extraction cleanup",
  cleanup_application_links: "Link cleanup",
};

const actionPlaybook: Record<string, string[]> = {
  thank_you: [
    "Reply in-thread within 24 hours and reference one specific conversation point.",
    "Close with interest, availability, and one sentence on role fit.",
  ],
  follow_up: [
    "Keep the message under five sentences and ask for timing, not a decision.",
    "Re-state interest and attach one concrete reason you fit the role.",
  ],
  status_check: [
    "Use a short status check instead of a long update.",
    "Acknowledge their timeline and ask whether there is anything else they need.",
  ],
  research: [
    "Read the job description again and pull two company-specific talking points.",
    "Find the hiring manager or likely team lead before you reach out.",
  ],
  networking: [
    "Send one personalized LinkedIn request tied to the exact role you applied for.",
    "Reference the application and one reason the team caught your attention.",
  ],
  portfolio: [
    "Choose one relevant project and write a two-sentence explanation of impact.",
    "Share only the strongest proof, not a generic portfolio dump.",
  ],
  strategic_timing: [
    "Use this waiting window to improve your next touchpoint instead of sending noise.",
    "Prepare one concise follow-up note and one tailored resume bullet now.",
  ],
  referral_request: [
    "Ask for a referral only if you can explain role fit in one short paragraph.",
    "Make the request easy to decline and easy to forward.",
  ],
};

function uniqueStrings(values: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function getRelevantTrackedEmails(emails: StoredEmail[]) {
  return emails.filter((email) => {
    const category = String(email.category || "").toLowerCase();
    return (
      category === "applied" ||
      category === "interviewed" ||
      category === "rejected" ||
      category === "offers"
    );
  });
}

export function getCleanupStructuredCandidates(emails: StoredEmail[]) {
  return getRelevantTrackedEmails(emails).filter((email) => {
    const company = String(email.company_name || "").trim();
    const position = String(email.position || "").trim();
    return !company || !position;
  });
}

export function getCleanupUnlinkedCandidates(emails: StoredEmail[]) {
  return getRelevantTrackedEmails(emails).filter((email) => {
    const category = String(email.category || "").toLowerCase();
    return (
      (category === "applied" || category === "interviewed") &&
      !email.applicationId &&
      !email.isClosed &&
      !email.isUserClosed
    );
  });
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function buildFollowupQueue(suggestions: FollowupSuggestion[]): QueueItem[] {
  return suggestions.map((item, index) => ({
    id: `followup:${item.threadId || index}:${item.actionType || "action"}`,
    source: "followup",
    urgency: (item.urgency || "medium") as QueueUrgency,
    title: item.title || item.subject || "Suggested action",
    description: item.description || "Suggested next step based on your application timeline.",
    company: item.company || null,
    estimatedTime: item.estimatedTime || "10 mins",
    daysAgo: item.daysAgo,
    playbook: actionPlaybook[item.actionType || ""] || [
      "Review the thread and choose the smallest useful next action.",
      "Keep the message specific to this role and this company.",
    ],
    sourceLabel: "Follow-up task",
    sourceDescription:
      item.category?.toLowerCase() === "interviewed" ? "Interview timing signal" : "Email timing signal",
    threadId: item.threadId,
    emailId: item.emailId ?? null,
    applicationId: item.applicationId ?? null,
    actionType: item.actionType,
    suggestionSource: item.suggestionSource || "email_followup",
    stageLabel: item.category?.toLowerCase() === "interviewed" ? "Interview" : "Application",
    routeHref: "/fix-suggestions",
    routeLabel: "Open queue",
  }));
}

function buildApplyGateQueue(history: ApplyGateHistoryItem[]): QueueItem[] {
  const unresolved = history
    .filter((item) => !item.user_action)
    .filter((item) => {
      const quickFixes = item.explanation_payload?.action_plan?.quick_fixes || [];
      const longTerm = item.explanation_payload?.action_plan?.long_term_gaps || [];
      return quickFixes.length > 0 || longTerm.length > 0;
    })
    .slice(0, 4);

  return unresolved.map((item) => {
    const explanation = item.explanation_payload;
    const quickFixes = uniqueStrings(explanation?.action_plan?.quick_fixes || [], 2);
    const longTerm = uniqueStrings(explanation?.action_plan?.long_term_gaps || [], 1);
    const drivers = uniqueStrings(explanation?.primary_rejection_drivers || [], 2);
    const { role, company } = splitRoleAndCompany(item.job_title, item.company_name, item.job_url);
    const isHigh =
      explanation?.decision === "fix_first" || item.verdict === "risky" || Boolean(item.hard_blocker);

    return {
      id: `apply-gate:${item.id}`,
      source: "apply_gate",
      urgency: isHigh ? "high" : "medium",
      title:
        explanation?.decision === "fix_first"
          ? `Fix before applying to ${role}`
          : `Tighten ${role} before applying`,
      description:
        drivers[0] || quickFixes[0] || "Apply Gate found issues worth resolving before you send this application.",
      company,
      estimatedTime: quickFixes.length > 1 ? "20 mins" : "15 mins",
      daysAgo: daysSince(item.created_at),
      playbook: uniqueStrings([...quickFixes, ...longTerm, ...drivers], 3),
      sourceLabel: "Apply Gate",
      sourceDescription: item.hard_blocker ? "Hard-blocker or high-risk fit issue" : "Role-specific fit action plan",
      threadId: `apply-gate:${item.id}`,
      actionType: "apply_gate_fix",
      suggestionSource: "apply_gate_action_plan",
      routeHref: "/apply-gate",
      routeLabel: "Open Apply Gate",
      stageLabel: "Job fit",
    };
  });
}

function buildResumeQueue(history: ApplyGateHistoryItem[]): QueueItem[] {
  const unresolved = history.filter((item) => !item.user_action);
  const evidenceCounts = new Map<string, { label: string; count: number }>();
  const resumeFixes: string[] = [];

  for (const item of unresolved) {
    for (const gap of item.explanation_payload?.evidence_gaps || []) {
      const label = String(gap || "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const current = evidenceCounts.get(key);
      if (current) {
        current.count += 1;
      } else {
        evidenceCounts.set(key, { label, count: 1 });
      }
    }
    resumeFixes.push(...(item.explanation_payload?.action_plan?.resume_proof_improvements || []));
  }

  const repeatedGaps = Array.from(evidenceCounts.values())
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  if (repeatedGaps.length === 0 && resumeFixes.length === 0) return [];

  const topResumeFixes = uniqueStrings(resumeFixes, 3);
  const recurringGapText = repeatedGaps.map((item) => item.label).join(", ");

  return [
    {
      id: "resume-proof:aggregate",
      source: "resume",
      urgency: repeatedGaps.length > 0 ? "high" : "medium",
      title:
        repeatedGaps.length > 0
          ? `Resume is repeatedly under-proving ${recurringGapText}`
          : "Add stronger proof to your resume before the next applications",
      description:
        repeatedGaps.length > 0
          ? `Recent Apply Gate screenings are repeatedly missing evidence for ${recurringGapText}.`
          : topResumeFixes[0] || "Apply Gate is finding weak resume proof for work you may already have done.",
      company: repeatedGaps.length > 0 ? "Across recent screenings" : "Resume proof",
      estimatedTime: "20 mins",
      playbook: uniqueStrings(
        [
          ...topResumeFixes,
          repeatedGaps.length > 0 ? `Add concrete bullets proving ${recurringGapText}.` : null,
          "Prioritize bullet evidence over adding more skills to a skills list.",
        ],
        3,
      ),
      sourceLabel: "Resume-proof gap",
      sourceDescription: "Repeated evidence gaps across recent role screenings",
      threadId: "resume-proof:aggregate",
      actionType: "resume_proof_gap",
      suggestionSource: "resume_proof_gap",
      routeHref: "/apply-gate",
      routeLabel: "Review Apply Gate",
      stageLabel: "Resume proof",
    },
  ];
}

function buildCleanupQueue(emails: StoredEmail[]): QueueItem[] {
  const missingStructured = getCleanupStructuredCandidates(emails);
  const unlinkedActive = getCleanupUnlinkedCandidates(emails);

  const queue: QueueItem[] = [];

  if (missingStructured.length > 0) {
    const examples = missingStructured.slice(0, 3).map((email) => email.subject || "Unnamed thread");
    queue.push({
      id: "cleanup:structured-fields",
      source: "cleanup",
      urgency: "high",
      title: `Clean up ${missingStructured.length} emails with missing company or role data`,
      description: "These threads are not carrying enough structured data to support tracking and grouping.",
      company: "Email extraction",
      estimatedTime: missingStructured.length > 3 ? "20 mins" : "10 mins",
      playbook: uniqueStrings(
        [
          `Review these threads in the extension: ${examples.join("; ")}.`,
          "Correct company and role where extraction is blank or obviously wrong.",
          "After corrections, verify the emails attach to the right application journey.",
        ],
        3,
      ),
      sourceLabel: "Cleanup task",
      sourceDescription: "Structured data is incomplete",
      threadId: "cleanup:structured-fields",
      actionType: "cleanup_structured_fields",
      suggestionSource: "cleanup_task",
      stageLabel: "Cleanup",
      routeHref: "/fix-suggestions",
      routeLabel: "Open queue",
    });
  }

  if (unlinkedActive.length > 0) {
    const examples = unlinkedActive
      .slice(0, 3)
      .map((email) => `${getEmailCompany(email)} - ${getEmailTitle(email)}`);
    queue.push({
      id: "cleanup:unlinked-applications",
      source: "cleanup",
      urgency: "medium",
      title: `Link ${unlinkedActive.length} active emails to applications`,
      description:
        "These threads look relevant, but they are not yet attached to an application record, so they will weaken pipeline metrics.",
      company: "Application tracking",
      estimatedTime: unlinkedActive.length > 5 ? "25 mins" : "15 mins",
      playbook: uniqueStrings(
        [
          `Start with: ${examples.join("; ")}.`,
          "Repair application links for active threads before using outcome metrics to judge progress.",
          "Once linked, re-check whether the application is still open or should be closed out.",
        ],
        3,
      ),
      sourceLabel: "Cleanup task",
      sourceDescription: "Application tracking is incomplete",
      threadId: "cleanup:unlinked-applications",
      actionType: "cleanup_application_links",
      suggestionSource: "cleanup_task",
      stageLabel: "Tracking",
      routeHref: "/fix-suggestions",
      routeLabel: "Open queue",
    });
  }

  return queue;
}

function queueSortValue(item: QueueItem) {
  const urgencyScore = item.urgency === "high" ? 0 : item.urgency === "medium" ? 1 : 2;
  const sourceScore =
    item.source === "followup"
      ? 0
      : item.source === "apply_gate"
        ? 1
        : item.source === "resume"
          ? 2
          : 3;
  const ageScore = typeof item.daysAgo === "number" ? -item.daysAgo : 0;
  return `${urgencyScore}:${sourceScore}:${String(ageScore).padStart(4, "0")}`;
}

export function buildActionKey(threadId?: string | null, actionType?: string | null) {
  const safeThreadId = String(threadId || "").trim();
  const safeActionType = String(actionType || "").trim();
  return `${safeThreadId}:${safeActionType}`;
}

export function buildGmailThreadUrl(threadId?: string | null) {
  if (!threadId) return null;
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
}

export function parseMinutes(label?: string | null) {
  if (!label) return 0;
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function formatRelativeAge(daysAgo?: number | null) {
  if (typeof daysAgo !== "number") return "Recently";
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "1 day ago";
  return `${daysAgo} days ago`;
}

export function formatSnoozedUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildHiddenActionKeys(actionStates: SuggestionActionState[]) {
  return new Set(
    actionStates
      .filter((item) => item.state === "completed" || item.state === "snoozed")
      .map((item) => buildActionKey(item.thread_id, item.action_type)),
  );
}

export function buildCombinedSuggestionQueue(params: {
  followupSuggestions: FollowupSuggestion[];
  applyGateHistory: ApplyGateHistoryItem[];
  storedEmails: StoredEmail[];
  actionStates?: SuggestionActionState[];
}) {
  const hiddenActionKeys = buildHiddenActionKeys(params.actionStates || []);
  const queue = [
    ...buildFollowupQueue(params.followupSuggestions),
    ...buildApplyGateQueue(params.applyGateHistory),
    ...buildResumeQueue(params.applyGateHistory),
    ...buildCleanupQueue(params.storedEmails),
  ];

  return queue
    .filter((item) => !hiddenActionKeys.has(buildActionKey(item.threadId, item.actionType)))
    .sort((a, b) => queueSortValue(a).localeCompare(queueSortValue(b)));
}

export function buildSuggestionQueueStats(queue: QueueItem[], actionStates: SuggestionActionState[]) {
  return {
    active: queue.length,
    highPriority: queue.filter((item) => item.urgency === "high").length,
    totalMinutes: queue.reduce((sum, item) => sum + parseMinutes(item.estimatedTime), 0),
    snoozed: actionStates.filter((item) => item.state === "snoozed").length,
    completed: actionStates.filter((item) => item.state === "completed").length,
  };
}

export function buildSnoozedSuggestionItems(actionStates: SuggestionActionState[]) {
  return actionStates
    .filter((item) => item.state === "snoozed")
    .sort(
      (a, b) =>
        new Date(a.snoozed_until || 0).getTime() - new Date(b.snoozed_until || 0).getTime(),
    )
    .slice(0, 5);
}

export function buildSuggestionImpressionPayload(queue: QueueItem[]) {
  return queue
    .filter((item) => item.threadId && item.actionType)
    .map((item) => ({
      threadId: String(item.threadId),
      actionType: String(item.actionType),
      emailId: item.emailId ?? null,
      applicationId: item.applicationId ?? null,
      suggestionSource: item.suggestionSource || item.source,
    }));
}
