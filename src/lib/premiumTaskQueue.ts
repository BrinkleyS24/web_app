import { getEmailCompany, getEmailTitle } from "@/lib/emailFormatting";
import { splitRoleAndCompany } from "@/lib/applyGateDisplay";
import type {
  ApplyGateHistoryItem,
  FollowupSuggestion,
  RankedAction,
  RankedActionQueue,
  StoredEmail,
  SuggestionActionState,
} from "@/lib/emails";

export type QueueSource = NonNullable<RankedAction["queueSource"]>;
export type QueueUrgency = "high" | "medium" | "low";
export type QueueConfidence = "high" | "medium" | "low";

export type QueueItem = {
  id: string;
  logicalKey?: string;
  dedupeKey?: string;
  status?: "open" | "blocked" | "done" | "dismissed" | "expired";
  bucket?: "doToday" | "thisWeek" | "later" | "blocked";
  source: QueueSource;
  urgency: QueueUrgency;
  title: string;
  description: string;
  company?: string | null;
  estimatedTime: string;
  daysAgo?: number | null;
  playbook: string[];
  whyNow?: string | null;
  evidence?: string[];
  actionConfidence?: QueueConfidence;
  hasDraft?: boolean;
  sourceLabel: string;
  sourceDescription: string;
  threadId?: string | null;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  intent?: RankedAction["intent"];
  intentLabel?: string | null;
  actionType?: string | null;
  suggestionSource?: string | null;
  stageLabel?: string | null;
  routeHref?: string | null;
  routeLabel?: string | null;
  blockerTitles?: string[];
  blockingReason?: string | null;
};

export type UpcomingFollowupWindow = {
  id: string;
  threadId: string;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  category: "applied" | "interviewed";
  company: string;
  role: string;
  subject?: string | null;
  daysAgo: number;
  opensInDays: number;
  windowStartDay: number;
  windowEndDay: number;
  title: string;
  description: string;
  sourceDescription: string;
};

export type OutreachDiagnostic = {
  id: string;
  label: string;
  count: number;
  description: string;
  examples: string[];
};

export const urgencyClasses: Record<QueueUrgency, string> = {
  high: "bg-destructive/10 text-destructive border border-destructive/20",
  medium: "bg-warning/10 text-warning border border-warning/20",
  low: "bg-accent/10 text-accent border border-accent/20",
};

export const sourceClasses: Record<QueueSource, string> = {
  followup: "bg-primary/10 text-primary border border-primary/20",
  stale: "bg-warning/10 text-warning border border-warning/20",
  apply_gate: "bg-accent/10 text-accent border border-accent/20",
  resume: "bg-success/10 text-success border border-success/20",
  cleanup: "bg-secondary text-secondary-foreground border border-border",
};

const rankedQueueSourceSet = new Set<QueueSource>(["followup", "stale", "apply_gate", "resume", "cleanup"]);

export const actionTypeLabels: Record<string, string> = {
  apply: "Apply",
  cleanup: "Cleanup",
  fix_targeting: "Fix targeting",
  prep_interview: "Prepare interview",
  prepare_interview: "Prepare interview",
  reply: "Reply",
  tailor_resume: "Tailor resume",
  thank_you: "Thank-you",
  follow_up: "Follow-up",
  status_check: "Status check",
  research: "Research",
  networking: "Networking",
  portfolio: "Portfolio",
  strategic_timing: "Timing",
  referral_request: "Referral",
  stale_application_status_check: "Final check",
  stale_interview_status_check: "Interview check",
  close_stale_application: "Close stale",
  close_stale_interview: "Close interview",
  apply_gate_fix: "Apply Gate fix",
  resume_proof_gap: "Resume proof",
  cleanup_structured_fields: "Extraction cleanup",
  cleanup_application_links: "Link cleanup",
};

export const daqV1ActionTypes = new Set([
  "prepare_interview",
  "prep_interview",
  "reply",
  "thank_you",
  "follow_up",
  "status_check",
]);

export function isDaqV1InboxAction(item: QueueItem) {
  return item.source === "followup" && daqV1ActionTypes.has(String(item.actionType || ""));
}

const actionPlaybook: Record<string, string[]> = {
  reply: [
    "Open the conversation and answer the direct question first.",
    "Keep the reply short and preserve the original recruiter context.",
  ],
  thank_you: [
    "Review the conversation so the company, role, and interview context are fresh.",
    "Reply in-thread within 24 hours and reference one specific conversation point.",
    "Close with interest, availability, and one sentence on role fit.",
  ],
  follow_up: [
    "Check the conversation first so you do not follow up over a newer reply.",
    "Keep the message under five sentences and ask for timing, not a decision.",
    "Re-state interest and attach one concrete reason you fit the role.",
  ],
  status_check: [
    "Check the conversation first so you do not follow up over a newer reply.",
    "Use a short status check instead of a long update.",
    "Acknowledge their timeline and ask whether there is anything else they need.",
  ],
  prep_interview: [
    "Review the conversation so timing, format, and contact details are correct.",
    "Re-read the role and write three proof points that match the team needs.",
  ],
  prepare_interview: [
    "Review the conversation so timing, format, and contact details are correct.",
    "Re-read the role and write three proof points that match the team needs.",
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

const OUTREACH_ACTION_TYPES = new Set([
  "thank_you",
  "follow_up",
  "status_check",
  "research",
  "networking",
  "stale_application_status_check",
  "stale_interview_status_check",
  "close_stale_application",
  "close_stale_interview",
]);

function normalizeQueueActionType(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function looksLikeRawEvidenceStep(value?: string | null) {
  const normalized = normalizeDisplayString(value)?.toLowerCase() || "";
  if (!normalized) return false;
  return (
    normalized.startsWith("subject:") ||
    normalized.startsWith("latest update:") ||
    normalized.startsWith("latest activity:") ||
    normalized.startsWith("sender:") ||
    normalized.startsWith("scheduled date:")
  );
}

function sanitizeQueuePlaybook(actionType: string | null | undefined, playbook: string[]) {
  const normalizedType = normalizeQueueActionType(actionType);
  const defaults = actionPlaybook[normalizedType] || [];
  const cleaned = (playbook || []).filter((step) => !looksLikeRawEvidenceStep(step));
  return uniqueStrings([...defaults, ...cleaned], 3);
}

function getDaqIdentityKey(item: QueueItem) {
  if (item.applicationId) return `application:${item.applicationId}`;
  if (item.threadId) return `thread:${item.threadId}`;

  const subjectEvidence = (item.evidence || []).find((entry) => /^subject:\s*/i.test(entry));
  if (subjectEvidence) {
    return `subject:${subjectEvidence.replace(/^subject:\s*/i, "").trim().toLowerCase()}`;
  }

  return `item:${item.id}`;
}

function getDaqActionPriority(item: QueueItem) {
  const actionType = normalizeQueueActionType(item.actionType);
  if (actionType === "reply" || actionType === "thank_you") return 0;
  if (actionType === "status_check" || actionType === "follow_up") return 1;
  if (actionType === "prep_interview" || actionType === "prepare_interview") return 2;
  return 3;
}

export function buildDaqV1InboxQueue(items: QueueItem[]) {
  const deduped = new Map<string, QueueItem>();

  for (const item of items.filter((candidate) => isDaqV1InboxAction(candidate) && candidate.bucket !== "blocked")) {
    const key = getDaqIdentityKey(item);
    const existing = deduped.get(key);
    if (!existing || getDaqActionPriority(item) < getDaqActionPriority(existing)) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values());
}

const APPLIED_ACTIVE_WINDOW_DAYS = 30;
const INTERVIEW_ACTIVE_WINDOW_DAYS = 21;

type ThreadIdentity = {
  company: string | null;
  role: string | null;
};

function coerceStringArray(value: unknown): Array<string | null | undefined> {
  if (Array.isArray(value)) {
    const fragments = value
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter((entry) => entry.length > 0);
    const looksLikeSplitString =
      fragments.length >= 3 &&
      fragments.every((entry) => entry.length <= 1) &&
      normalizeDisplayString(fragments.join(""));

    if (looksLikeSplitString) {
      return [fragments.join("")];
    }

    return value;
  }

  const normalized = normalizeDisplayString(
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : null,
  );
  if (!normalized) return [];

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      const singleQuotedJson = normalized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner: string) => {
        return JSON.stringify(inner.replace(/\\'/g, "'"));
      });
      try {
        const parsed = JSON.parse(singleQuotedJson);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        const unwrapped = normalizeDisplayString(normalized.replace(/^\[\s*/, "").replace(/\s*\]$/, ""));
        return unwrapped ? [unwrapped] : [];
      }
    }
  }

  return [normalized];
}

function uniqueStrings(values: unknown, limit = 4) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of coerceStringArray(values)) {
    const normalized = normalizeDisplayString(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeDisplayString(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (/^[\[\]{}"',:]+$/.test(normalized)) return null;
  if (/^\[\s*["']?[^"'\]]{1,20}$/i.test(normalized)) return null;
  if (/^["']?[^"'\[]+\s*["']?\]$/.test(normalized)) return null;
  if (/^(null|undefined|nan)$/i.test(normalized)) return null;
  return normalized;
}

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getRelevantTrackedEmails(emails: StoredEmail[]) {
  return emails.filter((email) => {
    const category = normalizeKey(email.category);
    return (
      category === "applied" ||
      category === "interviewed" ||
      category === "rejected" ||
      category === "offers"
    );
  });
}

function buildTerminalCompanyKeys(emails: StoredEmail[]) {
  const terminalCompanyKeys = new Set<string>();
  for (const email of getRelevantTrackedEmails(emails)) {
    const companyKey = normalizeKey(email.company_name);
    if (!companyKey) continue;
    const category = normalizeKey(email.category);
    if (category === "offers" || category === "rejected" || email.isClosed || email.isUserClosed) {
      terminalCompanyKeys.add(companyKey);
    }
  }
  return terminalCompanyKeys;
}

function getOpenTrackedEmails(emails: StoredEmail[]) {
  return getRelevantTrackedEmails(emails).filter((email) => {
    const category = normalizeKey(email.category);
    return category !== "offers" && category !== "rejected" && !email.isClosed && !email.isUserClosed;
  });
}

function groupEmailsByThread(emails: StoredEmail[]) {
  const grouped = new Map<string, StoredEmail[]>();

  for (const email of emails) {
    const key = String(email.thread_id || email.email_id || email.id || "").trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(email);
  }

  return grouped;
}

function buildThreadIdentityMap(emails: StoredEmail[]) {
  const grouped = groupEmailsByThread(getRelevantTrackedEmails(emails));
  const identities = new Map<string, ThreadIdentity>();

  for (const [threadId, threadEmails] of grouped.entries()) {
    const sorted = [...threadEmails].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );
    const company = sorted.find((email) => String(email.company_name || "").trim())?.company_name || null;
    const role = sorted.find((email) => String(email.position || "").trim())?.position || null;
    identities.set(threadId, {
      company: company ? String(company).trim() : null,
      role: role ? String(role).trim() : null,
    });
  }

  return identities;
}

function getResolvedThreadIdentity(email: StoredEmail, threadIdentityMap: Map<string, ThreadIdentity>) {
  const threadKey = String(email.thread_id || email.email_id || email.id || "").trim();
  const inherited = threadKey ? threadIdentityMap.get(threadKey) : null;
  const company = String(email.company_name || inherited?.company || "").trim();
  const role = String(email.position || inherited?.role || "").trim();
  return {
    company,
    role,
  };
}

function hasResolvedThreadIdentity(email: StoredEmail, threadIdentityMap: Map<string, ThreadIdentity>) {
  const identity = getResolvedThreadIdentity(email, threadIdentityMap);
  return Boolean(identity.company && identity.role);
}

function getOpenAttentionWindowDays(email: StoredEmail) {
  const category = normalizeKey(email.category);
  if (category === "applied") return APPLIED_ACTIVE_WINDOW_DAYS;
  if (category === "interviewed") return INTERVIEW_ACTIVE_WINDOW_DAYS;
  return null;
}

function isWithinOpenAttentionWindow(email: StoredEmail) {
  const age = daysSince(email.date);
  const windowDays = getOpenAttentionWindowDays(email);
  if (typeof age !== "number" || typeof windowDays !== "number") return false;
  return age < windowDays;
}

export function getCleanupStructuredCandidates(emails: StoredEmail[]) {
  const threadIdentityMap = buildThreadIdentityMap(emails);
  return getOpenTrackedEmails(emails).filter((email) => {
    return isWithinOpenAttentionWindow(email) && !hasResolvedThreadIdentity(email, threadIdentityMap);
  });
}

export function getCleanupUnlinkedCandidates(emails: StoredEmail[]) {
  const threadIdentityMap = buildThreadIdentityMap(emails);
  return getOpenTrackedEmails(emails).filter((email) => {
    return (
      !email.applicationId &&
      isWithinOpenAttentionWindow(email) &&
      hasResolvedThreadIdentity(email, threadIdentityMap)
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
    description: coachDaqCopy(item.description) || "Suggested next step based on your application timeline.",
    company: item.company || null,
    estimatedTime: item.estimatedTime || "10 mins",
    daysAgo: item.daysAgo,
    playbook: actionPlaybook[item.actionType || ""] || [
      "Review the conversation and choose the smallest useful next action.",
      "Keep the message specific to this role and this company.",
    ],
    whyNow: coachDaqCopy(item.whyNow || item.description) || null,
    evidence: uniqueStrings(item.evidence || [], 4),
    actionConfidence: item.actionConfidence || "medium",
    hasDraft: Boolean(item.draftAvailable) && Boolean(item.threadId),
    sourceLabel: "Outreach task",
    sourceDescription:
      item.category?.toLowerCase() === "interviewed" ? "Interview timing cue" : "Follow-up timing cue",
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
      const quickFixes = coerceStringArray(item.explanation_payload?.action_plan?.quick_fixes);
      const longTerm = coerceStringArray(item.explanation_payload?.action_plan?.long_term_gaps);
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
      whyNow:
        explanation?.decision === "fix_first"
          ? "Apply Gate marked this as fix-first, so applying before resolving the top issue would weaken the application."
          : "Apply Gate found unresolved fit issues that should be addressed before this role leaves active consideration.",
      evidence: uniqueStrings(
        [
          ...drivers,
          ...quickFixes,
          explanation?.assessment_confidence ? `Assessment confidence: ${explanation.assessment_confidence}` : null,
        ],
        4,
      ),
      actionConfidence: explanation?.assessment_confidence || "medium",
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
    for (const gap of coerceStringArray(item.explanation_payload?.evidence_gaps)) {
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
    resumeFixes.push(...uniqueStrings(item.explanation_payload?.action_plan?.resume_proof_improvements, 10));
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
      whyNow:
        repeatedGaps.length > 0
          ? "The same proof gap is appearing across multiple recent screenings."
          : "Recent screenings found resume-proof issues that are fixable before the next application batch.",
      evidence: uniqueStrings(
        [
          repeatedGaps.length > 0 ? `${repeatedGaps.length} repeated gap(s): ${recurringGapText}` : null,
          ...topResumeFixes,
        ],
        4,
      ),
      actionConfidence: repeatedGaps.length > 0 ? "high" : "medium",
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

function buildStaleQueue(emails: StoredEmail[]): QueueItem[] {
  const grouped = groupEmailsByThread(getRelevantTrackedEmails(emails));
  const terminalCompanyKeys = buildTerminalCompanyKeys(emails);
  const threadIdentityMap = buildThreadIdentityMap(emails);

  const queue: QueueItem[] = [];

  for (const [threadId, threadEmails] of grouped.entries()) {
    const sorted = [...threadEmails].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    if (!latest) continue;

    const hasTerminalSignal = sorted.some((email) => {
      const category = String(email.category || "").toLowerCase();
      return category === "rejected" || category === "offers" || email.isClosed || email.isUserClosed;
    });
    if (hasTerminalSignal) continue;

    const latestCompanyKey = normalizeKey(latest.company_name);
    if (latestCompanyKey && terminalCompanyKeys.has(latestCompanyKey)) continue;

    const category = normalizeKey(latest.category);
    if (category !== "applied" && category !== "interviewed") continue;
    if (!hasResolvedThreadIdentity(latest, threadIdentityMap)) continue;

    const age = daysSince(latest.date);
    if (typeof age !== "number") continue;

    const identity = getResolvedThreadIdentity(latest, threadIdentityMap);
    const company = identity.company || getEmailCompany(latest);
    const role = identity.role || getEmailTitle(latest);
    const evidence = uniqueStrings(
      [
        latest.subject ? `Latest conversation: ${latest.subject}` : null,
        latest.from ? `Latest sender: ${latest.from}` : null,
        `No final outcome yet after ${age} day(s).`,
      ],
      4,
    );

    if (category === "applied" && age >= 21 && age < 30) {
      queue.push({
        id: `stale:${threadId}:status-check`,
        source: "stale",
        urgency: age >= 21 ? "high" : "medium",
        title: `Send one final status check for ${role}`,
        description: `${company} has been quiet for ${age} days, so one clear status check is reasonable.`,
        company,
        estimatedTime: "8 mins",
        daysAgo: age,
        playbook: [
          "Send one short status check that asks for timing, not a decision.",
          "If there is no response after this touch, move the role out of active focus.",
        ],
        whyNow: `${age} days have passed since the last application touchpoint. A short check-in gives you clarity without over-investing.`,
        evidence,
        actionConfidence: "medium",
        hasDraft: true,
        sourceLabel: "Ghosting signal",
        sourceDescription: "No recent next step",
        threadId,
        emailId: latest.id ?? null,
        applicationId: latest.applicationId ?? null,
        actionType: "stale_application_status_check",
        suggestionSource: "stale_role_signal",
        stageLabel: "Stale application",
        routeHref: "/fix-suggestions",
        routeLabel: "Open queue",
      });
    }

    if (category === "applied" && age >= 30) {
      queue.push({
        id: `stale:${threadId}:close-application`,
        source: "stale",
        urgency: "low",
        title: `Move ${role} out of active focus`,
        description: `${company} has been quiet for ${age} days after your application touchpoint.`,
        company,
        estimatedTime: "5 mins",
        daysAgo: age,
        playbook: [
          "Send a final close-the-loop note only if this role still matters.",
          "Otherwise mark the action done and stop treating this application as active work.",
        ],
        whyNow: "The role is old enough that it should not keep consuming active search attention.",
        evidence,
        actionConfidence: "medium",
        hasDraft: true,
        sourceLabel: "Ghosting signal",
        sourceDescription: "Application appears stale",
        threadId,
        emailId: latest.id ?? null,
        applicationId: latest.applicationId ?? null,
        actionType: "close_stale_application",
        suggestionSource: "stale_role_signal",
        stageLabel: "Close out",
        routeHref: "/fix-suggestions",
        routeLabel: "Open queue",
      });
    }

    if (category === "interviewed" && age >= 11 && age < 21) {
      queue.push({
        id: `stale:${threadId}:interview-check`,
        source: "stale",
        urgency: "high",
        title: `Check interview status for ${role}`,
        description: `${company} has been quiet for ${age} days after the interview. Ask once for timing and clarity.`,
        company,
        estimatedTime: "8 mins",
        daysAgo: age,
        playbook: [
          "Send a polite status check that references the interview and asks for timeline.",
          "Keep it short; the goal is clarity, not a second pitch.",
        ],
        whyNow: "Post-interview silence is high-ambiguity and deserves one clear status check.",
        evidence,
        actionConfidence: "high",
        hasDraft: true,
        sourceLabel: "Ghosting signal",
        sourceDescription: "Post-interview silence",
        threadId,
        emailId: latest.id ?? null,
        applicationId: latest.applicationId ?? null,
        actionType: "stale_interview_status_check",
        suggestionSource: "stale_role_signal",
        stageLabel: "Interview follow-up",
        routeHref: "/fix-suggestions",
        routeLabel: "Open queue",
      });
    }

    if (category === "interviewed" && age >= 21) {
      queue.push({
        id: `stale:${threadId}:close-interview`,
        source: "stale",
        urgency: "medium",
        title: `Close the loop on ${role}`,
        description: `${company} has been silent for ${age} days after the interview.`,
        company,
        estimatedTime: "5 mins",
        daysAgo: age,
        playbook: [
          "Send one final note if this opportunity is still important.",
          "If there is no response, stop letting this role occupy active search bandwidth.",
        ],
        whyNow: "This interview conversation is old enough that the next action is closure, not repeated follow-up.",
        evidence,
        actionConfidence: "medium",
        hasDraft: true,
        sourceLabel: "Ghosting signal",
        sourceDescription: "Interview appears stale",
        threadId,
        emailId: latest.id ?? null,
        applicationId: latest.applicationId ?? null,
        actionType: "close_stale_interview",
        suggestionSource: "stale_role_signal",
        stageLabel: "Close out",
        routeHref: "/fix-suggestions",
        routeLabel: "Open queue",
      });
    }
  }

  return queue
    .sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0))
    .slice(0, 5);
}

function buildCleanupQueue(emails: StoredEmail[]): QueueItem[] {
  const missingStructured = getCleanupStructuredCandidates(emails);
  const unlinkedActive = getCleanupUnlinkedCandidates(emails);

  const queue: QueueItem[] = [];

  if (missingStructured.length > 0) {
    const examples = missingStructured.slice(0, 3).map((email) => email.subject || "Unnamed conversation");
    queue.push({
      id: "cleanup:structured-fields",
      source: "cleanup",
      urgency: "high",
      title: `Clean up ${missingStructured.length} emails with missing company or role data`,
      description: "These conversations are missing the company or role details needed for useful coaching.",
      company: "Email extraction",
      estimatedTime: missingStructured.length > 3 ? "20 mins" : "10 mins",
      playbook: uniqueStrings(
        [
          `Review these conversations in the extension: ${examples.join("; ")}.`,
          "Correct company and role where extraction is blank or obviously wrong.",
          "After corrections, verify the emails attach to the right application journey.",
        ],
        3,
      ),
      whyNow: "Missing company or role data makes the rest of the premium recommendations less reliable.",
      evidence: uniqueStrings(examples, 3),
      actionConfidence: "high",
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
        "These conversations look relevant, but they are not yet attached to an application record, so your pipeline view may be incomplete.",
      company: "Application tracking",
      estimatedTime: unlinkedActive.length > 5 ? "25 mins" : "15 mins",
      playbook: uniqueStrings(
        [
          `Start with: ${examples.join("; ")}.`,
          "Link active conversations before using outcome metrics to judge progress.",
          "Once linked, re-check whether the application is still open or should be closed out.",
        ],
        3,
      ),
      whyNow: "Unlinked active conversations can hide follow-up opportunities and make your pipeline look less accurate than it is.",
      evidence: uniqueStrings(examples, 3),
      actionConfidence: "medium",
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
      : item.source === "stale"
        ? 1
        : item.source === "apply_gate"
          ? 2
          : item.source === "resume"
            ? 3
            : 4;
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
    ...buildStaleQueue(params.storedEmails),
    ...buildApplyGateQueue(params.applyGateHistory),
    ...buildResumeQueue(params.applyGateHistory),
    ...buildCleanupQueue(params.storedEmails),
  ];

  return queue
    .filter((item) => !hiddenActionKeys.has(buildActionKey(item.threadId, item.actionType)))
    .sort((a, b) => queueSortValue(a).localeCompare(queueSortValue(b)));
}

export function buildUpcomingFollowupWindows(params: {
  storedEmails: StoredEmail[];
  followupSuggestions?: FollowupSuggestion[];
  actionStates?: SuggestionActionState[];
}) {
  const activeKeys = new Set(
    (params.followupSuggestions || [])
      .filter((item) => item.threadId && item.actionType)
      .map((item) => buildActionKey(item.threadId, item.actionType)),
  );
  const activeOpportunityKeys = new Set(
    (params.followupSuggestions || [])
      .map((item) => {
        if (item.applicationId) return `app:${item.applicationId}`;
        const companyKey = normalizeKey(item.company);
        return companyKey ? `company:${companyKey}` : null;
      })
      .filter(Boolean) as string[],
  );
  const hiddenActionKeys = buildHiddenActionKeys(params.actionStates || []);
  const grouped = groupEmailsByThread(getOpenTrackedEmails(params.storedEmails));
  const terminalCompanyKeys = buildTerminalCompanyKeys(params.storedEmails);
  const threadIdentityMap = buildThreadIdentityMap(params.storedEmails);
  const windows: UpcomingFollowupWindow[] = [];

  for (const [threadId, threadEmails] of grouped.entries()) {
    const sorted = [...threadEmails].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    if (!latest) continue;

    const latestCompanyKey = normalizeKey(latest.company_name);
    if (latestCompanyKey && terminalCompanyKeys.has(latestCompanyKey)) continue;
    const latestOpportunityKeys = [
      latest.applicationId ? `app:${latest.applicationId}` : null,
      latestCompanyKey ? `company:${latestCompanyKey}` : null,
    ].filter(Boolean) as string[];
    if (latestOpportunityKeys.some((key) => activeOpportunityKeys.has(key))) continue;

    const category = normalizeKey(latest.category);
    if (category !== "applied" && category !== "interviewed") continue;
    if (!hasResolvedThreadIdentity(latest, threadIdentityMap)) continue;

    const age = daysSince(latest.date);
    if (typeof age !== "number") continue;

    const identity = getResolvedThreadIdentity(latest, threadIdentityMap);
    const company = identity.company || getEmailCompany(latest);
    const role = identity.role || getEmailTitle(latest);
    const base = {
      threadId,
      emailId: latest.id ?? null,
      applicationId: latest.applicationId ?? null,
      company,
      role,
      subject: latest.subject,
      daysAgo: age,
    };

    if (category === "applied") {
      const firstFollowupKey = buildActionKey(threadId, "follow_up");
      const finalFollowupKey = buildActionKey(threadId, "stale_application_status_check");

      if (age <= 14 && !activeKeys.has(firstFollowupKey) && !hiddenActionKeys.has(firstFollowupKey)) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:application-follow-up`,
          category: "applied",
          opensInDays: Math.max(0, 10 - age),
          windowStartDay: 10,
          windowEndDay: 14,
          title: `First follow-up window for ${role}`,
          description:
            age >= 10
              ? `${company} is inside the day 10-14 application follow-up window.`
              : `${company} is ${age} day(s) after application. A status follow-up is usually better around day 10-14.`,
          sourceDescription: age >= 10 ? "Application follow-up due now" : "Application follow-up opens soon",
        });
      } else if (
        age > 14
        && age < 21
        && !activeKeys.has(finalFollowupKey)
        && !hiddenActionKeys.has(finalFollowupKey)
      ) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:final-application-check`,
          category: "applied",
          opensInDays: 21 - age,
          windowStartDay: 21,
          windowEndDay: 29,
          title: `Final check-in window for ${role}`,
          description: `${company} is past the first follow-up window. If nothing changes, one final status check becomes reasonable around day 21.`,
          sourceDescription: "Final application check opens soon",
        });
      }
    }

    if (category === "interviewed") {
      const thankYouKey = buildActionKey(threadId, "thank_you");
      const interviewFollowupKey = buildActionKey(threadId, "follow_up");
      const statusCheckKey = buildActionKey(threadId, "status_check");
      const staleInterviewKey = buildActionKey(threadId, "stale_interview_status_check");

      if (age <= 1 && !activeKeys.has(thankYouKey) && !hiddenActionKeys.has(thankYouKey)) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:interview-thank-you`,
          category: "interviewed",
          opensInDays: 0,
          windowStartDay: 0,
          windowEndDay: 1,
          title: `Thank-you note for ${role}`,
          description: `${company} is inside the 24-hour interview thank-you window.`,
          sourceDescription: "Interview thank-you due now",
        });
      } else if (age <= 5 && !activeKeys.has(interviewFollowupKey) && !hiddenActionKeys.has(interviewFollowupKey)) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:interview-follow-up`,
          category: "interviewed",
          opensInDays: 0,
          windowStartDay: 2,
          windowEndDay: 5,
          title: `Interview follow-up for ${role}`,
          description: `${company} is inside the early post-interview follow-up window.`,
          sourceDescription: "Interview follow-up due now",
        });
      } else if (age <= 10 && !activeKeys.has(statusCheckKey) && !hiddenActionKeys.has(statusCheckKey)) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:interview-status-check`,
          category: "interviewed",
          opensInDays: Math.max(0, 6 - age),
          windowStartDay: 6,
          windowEndDay: 10,
          title: `Status-check window for ${role}`,
          description:
            age >= 6
              ? `${company} is inside the post-interview status-check window.`
              : `${company} is ${age} day(s) after the interview. If no timeline was given, status checks become more appropriate after several business days.`,
          sourceDescription: age >= 6 ? "Interview status check due now" : "Interview status check opens soon",
        });
      } else if (
        age > 10
        && age < 21
        && !activeKeys.has(staleInterviewKey)
        && !hiddenActionKeys.has(staleInterviewKey)
      ) {
        windows.push({
          ...base,
          id: `upcoming:${threadId}:interview-close-loop`,
          category: "interviewed",
          opensInDays: Math.max(0, 21 - age),
          windowStartDay: 21,
          windowEndDay: 21,
          title: `Close-loop window for ${role}`,
          description: `${company} is ${age} day(s) after the interview. If silence continues, this should move from follow-up to close-out.`,
          sourceDescription: "Interview close-out window approaching",
        });
      }
    }
  }

  function upcomingPriority(item: UpcomingFollowupWindow) {
    if (item.category === "interviewed" && item.windowStartDay <= 1) return 5;
    if (item.category === "interviewed" && item.windowStartDay <= 2) return 4;
    if (item.category === "interviewed") return 3;
    if (item.category === "applied" && item.windowStartDay <= 10) return 2;
    return 1;
  }

  const seenWindows = new Set<string>();
  return windows
    .filter((item) => item.opensInDays > 0)
    .sort((a, b) => (
      a.opensInDays - b.opensInDays
      || upcomingPriority(b) - upcomingPriority(a)
      || b.daysAgo - a.daysAgo
    ))
    .filter((item) => {
      const key = item.applicationId
        ? `app:${item.applicationId}`
        : `${normalizeKey(item.company)}:${normalizeKey(item.role)}`;
      if (seenWindows.has(key)) return false;
      seenWindows.add(key);
      return true;
    })
    .slice(0, 5);
}

export function buildOutreachDiagnostics(params: {
  storedEmails: StoredEmail[];
  followupSuggestions?: FollowupSuggestion[];
  actionStates?: SuggestionActionState[];
  upcomingWindows?: UpcomingFollowupWindow[];
}) {
  const upcomingWindows = params.upcomingWindows || buildUpcomingFollowupWindows(params);
  const grouped = groupEmailsByThread(getRelevantTrackedEmails(params.storedEmails));
  const terminalCompanyKeys = buildTerminalCompanyKeys(params.storedEmails);
  const threadIdentityMap = buildThreadIdentityMap(params.storedEmails);
  const closedExamples: string[] = [];
  const ghostingExamples: string[] = [];
  let closedCount = 0;
  let ghostingCount = 0;

  for (const [, threadEmails] of grouped.entries()) {
    const sorted = [...threadEmails].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    if (!latest) continue;

    const hasTerminalSignal = sorted.some((email) => {
      const category = normalizeKey(email.category);
      return category === "offers" || category === "rejected" || email.isClosed || email.isUserClosed;
    });

    const latestCompanyKey = normalizeKey(latest.company_name);
    if (hasTerminalSignal || (latestCompanyKey && terminalCompanyKeys.has(latestCompanyKey))) {
      closedCount += 1;
      closedExamples.push(`${getEmailCompany(latest)} - ${getEmailTitle(latest)}`);
      continue;
    }

    const category = normalizeKey(latest.category);
    const age = daysSince(latest.date);
    if (typeof age !== "number") continue;
    if (!hasResolvedThreadIdentity(latest, threadIdentityMap)) continue;

    const identity = getResolvedThreadIdentity(latest, threadIdentityMap);
    const company = identity.company || getEmailCompany(latest);
    const role = identity.role || getEmailTitle(latest);

    if ((category === "applied" && age >= 21) || (category === "interviewed" && age >= 11)) {
      ghostingCount += 1;
      ghostingExamples.push(`${company} - ${role}`);
    }
  }

  const hiddenOutreachStates = (params.actionStates || []).filter((item) => {
    return (
      OUTREACH_ACTION_TYPES.has(String(item.action_type || "")) &&
      (item.state === "completed" || item.state === "snoozed")
    );
  });

  const diagnostics: OutreachDiagnostic[] = [
    {
      id: "active",
      label: "Active outreach",
      count: params.followupSuggestions?.length || 0,
      description: "Backend cards currently due in the Outreach lane.",
      examples: uniqueStrings((params.followupSuggestions || []).map((item) => item.title || item.subject), 3),
    },
    {
      id: "upcoming",
      label: "Upcoming windows",
      count: upcomingWindows.length,
      description: "Roles that are too early or waiting for a better follow-up window.",
      examples: uniqueStrings(upcomingWindows.map((item) => item.title), 3),
    },
    {
      id: "hidden",
      label: "Hidden by you",
      count: hiddenOutreachStates.length,
      description: "Outreach actions already completed or snoozed.",
      examples: uniqueStrings(hiddenOutreachStates.map((item) => actionTypeLabels[item.action_type] || item.action_type), 3),
    },
    {
      id: "ghosting",
      label: "Ghosting",
      count: ghostingCount,
      description: "Older open roles that may need one final check-in or a clean close-out.",
      examples: uniqueStrings(ghostingExamples, 3),
    },
    {
      id: "closed",
      label: "Closed outcomes",
      count: closedCount,
      description: "Roles with a rejection, offer, or manual close are kept out of outreach.",
      examples: uniqueStrings(closedExamples, 3),
    },
  ];

  return diagnostics;
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

function mapConfidence(level?: string | null): QueueConfidence | undefined {
  if (level === "strong") return "high";
  if (level === "moderate") return "medium";
  if (level === "weak") return "low";
  return undefined;
}

function formatEstimatedTime(minutes?: number | null) {
  const value = typeof minutes === "number" && Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 10;
  return `${value} mins`;
}

function getRankedActionDebugKey(action: RankedAction) {
  return action.dedupeKey || action.logicalKey || action.id || "unknown";
}

function requireRankedSource(action: RankedAction): QueueSource {
  const queueSource = action.queueSource;
  if (queueSource && rankedQueueSourceSet.has(queueSource)) return queueSource;
  throw new Error(`[premiumTaskQueue] Ranked action ${getRankedActionDebugKey(action)} missing queueSource`);
}

function requireRankedString(action: RankedAction, fieldName: string, value?: string | null) {
  const normalized = normalizeDisplayString(value);
  if (normalized) return normalized;
  throw new Error(`[premiumTaskQueue] Ranked action ${getRankedActionDebugKey(action)} missing ${fieldName}`);
}

function requireRankedIntent(action: RankedAction) {
  return requireRankedString(action, "intent", action.intent) as NonNullable<RankedAction["intent"]>;
}

function requireRankedStringArray(action: RankedAction, fieldName: string, value?: unknown) {
  const normalized = uniqueStrings(value, 20);
  if (normalized.length > 0) return normalized;
  throw new Error(`[premiumTaskQueue] Ranked action ${getRankedActionDebugKey(action)} missing ${fieldName}`);
}

function requireRankedBoolean(action: RankedAction, fieldName: string, value?: boolean) {
  if (typeof value === "boolean") return value;
  throw new Error(`[premiumTaskQueue] Ranked action ${getRankedActionDebugKey(action)} missing ${fieldName}`);
}

function coachDaqCopy(value?: string | null) {
  const normalized = normalizeDisplayString(value);
  if (!normalized) return null;
  return normalized
    .replace(/(\d+\s+days?\s+have\s+passed)\s+without\s+a\s+tracked\s+next-step\s+email\s+from\s+([^.;]+)/gi, "$1 without a response from $2")
    .replace(/without\s+a\s+tracked\s+next-step\s+email/gi, "without a response")
    .replace(/tracked\s+next-step\s+email/gi, "response")
    .replace(/tracked\s+next\s+step/gi, "response")
    .replace(/The tracked thread has gone cold and is now in close-out territory\./gi, "This role has gone quiet and is ready for a clean close-out.")
    .replace(/No tracked terminal outcome\./gi, "No final outcome yet.")
    .replace(/tracked terminal outcome/gi, "final outcome")
    .replace(/tracked thread/gi, "conversation")
    .replace(/ghosting signal/gi, "Ghosting signal")
    .replace(/^ghosting$/i, "Ghosting")
    .replace(/high-signal/gi, "high-value");
}

function coachDaqCopyList(values?: Array<string | null | undefined>, limit = 4) {
  return uniqueStrings(values || [], limit).map((value) => coachDaqCopy(value) || value);
}

function buildRankedDescription(action: RankedAction) {
  if (action.effectiveStatus === "blocked") {
    return coachDaqCopy(action.blockingReason) || "A prerequisite action is still open.";
  }
  return (
    coachDaqCopy(action.whyNow) ||
    coachDaqCopy(action.targetOutcome) ||
    "Open the source context before acting."
  );
}

function mapRankedActionToQueueItem(
  action: RankedAction,
  blockerMap: Map<string, RankedAction>,
  bucket: "doToday" | "thisWeek" | "later" | "blocked",
): QueueItem {
  const source = requireRankedSource(action);
  const intent = requireRankedIntent(action);
  const intentLabel = requireRankedString(action, "intentLabel", action.intentLabel);
  const blockers = (action.unresolvedBlockedBy || [])
    .map((key) => blockerMap.get(key))
    .filter(Boolean) as RankedAction[];
  const playbook = sanitizeQueuePlaybook(
    action.legacyActionType || action.actionType,
    requireRankedStringArray(action, "playbook", action.playbook),
  );
  const sourceLabel = coachDaqCopy(requireRankedString(action, "sourceLabel", action.sourceLabel)) || "Recommended action";
  const stageLabel = coachDaqCopy(requireRankedString(action, "stageLabel", action.stageLabel)) || "Action";
  const routeHref = requireRankedString(action, "routeHref", action.routeHref);
  const routeLabel = requireRankedString(action, "routeLabel", action.routeLabel);
  const draftEligible = requireRankedBoolean(action, "draftEligible", action.draftEligible);

  return {
    id: action.id,
    logicalKey: action.logicalKey,
    dedupeKey: action.dedupeKey,
    status: action.effectiveStatus || action.status,
    bucket,
    source,
    urgency: (action.urgencyLevel || "medium") as QueueUrgency,
    title: normalizeDisplayString(action.title) || "Review recommended action",
    description: buildRankedDescription(action),
    company: action.company || null,
    estimatedTime: formatEstimatedTime(action.effortMinutes),
    daysAgo: daysSince(action.createdAt),
    playbook: coachDaqCopyList(playbook, 3),
    whyNow: coachDaqCopy(action.whyNow),
    evidence: coachDaqCopyList(action.evidence || [], 4),
    actionConfidence: mapConfidence(action.confidenceLevel),
    hasDraft: draftEligible,
    sourceLabel,
    sourceDescription: coachDaqCopy(action.targetOutcome) || buildRankedDescription(action),
    threadId: action.threadId || null,
    emailId: action.emailId ?? null,
    applicationId: action.applicationId ?? null,
    intent,
    intentLabel,
    actionType: action.legacyActionType || action.actionType,
    suggestionSource: action.suggestionSource || action.source,
    stageLabel,
    routeHref,
    routeLabel,
    blockerTitles: blockers.map((item) => item.title),
    blockingReason: action.blockingReason || null,
  };
}

export function buildQueueItemsFromRankedQueue(queue?: RankedActionQueue | null) {
  if (!queue) return [] as QueueItem[];

  const blockerMap = new Map((queue.resolvedActions || []).map((action) => [action.logicalKey, action]));

  return [
    ...(queue.doToday || []).map((action) => mapRankedActionToQueueItem(action, blockerMap, "doToday")),
    ...(queue.thisWeek || []).map((action) => mapRankedActionToQueueItem(action, blockerMap, "thisWeek")),
    ...(queue.blocked || []).map((action) => mapRankedActionToQueueItem(action, blockerMap, "blocked")),
    ...(queue.later || []).map((action) => mapRankedActionToQueueItem(action, blockerMap, "later")),
  ];
}

export function buildRankedQueueStats(queue?: RankedActionQueue | null) {
  const active = [
    ...(queue?.doToday || []),
    ...(queue?.thisWeek || []),
    ...(queue?.later || []),
    ...(queue?.blocked || []),
  ];

  return {
    active: active.length,
    highPriority: active.filter((item) => item.urgencyLevel === "high").length,
    totalMinutes: active.reduce((sum, item) => sum + (item.effortMinutes || 0), 0),
    snoozed: queue?.dismissed?.length || 0,
    completed: queue?.done?.length || 0,
  };
}

export function buildQueueImpressionPayload(actions: RankedAction[]) {
  return (actions || []).map((item) => ({
    logicalKey: item.logicalKey,
    dedupeKey: item.dedupeKey,
  }));
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
