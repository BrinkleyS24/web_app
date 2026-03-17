import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Filter,
  FileSearch,
  Mail,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getEmailCompany, getEmailTitle } from "@/lib/emailFormatting";
import { useAuth } from "@/lib/AuthContext.jsx";
import {
  completeSuggestionAction,
  fetchApplyGateHistory,
  fetchFollowupSuggestions,
  fetchStoredEmails,
  fetchSuggestionActionStates,
  recordSuggestionImpressions,
  type ApplyGateHistoryItem,
  type FollowupSuggestion,
  type StoredEmail,
  type SuggestionActionState,
  snoozeSuggestionAction,
  undoSuggestionAction,
} from "@/lib/emails";

type UrgencyFilter = "all" | "high" | "medium" | "low";
type SourceFilter = "all" | "followup" | "apply_gate" | "resume" | "cleanup";
type QueueSource = Exclude<SourceFilter, "all">;

type QueueItem = {
  id: string;
  source: QueueSource;
  urgency: "high" | "medium" | "low";
  title: string;
  description: string;
  company: string;
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

function buildActionKey(threadId?: string | null, actionType?: string | null) {
  const safeThreadId = String(threadId || "").trim();
  const safeActionType = String(actionType || "").trim();
  return `${safeThreadId}:${safeActionType}`;
}

const urgencyClasses: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border border-destructive/20",
  medium: "bg-warning/10 text-warning border border-warning/20",
  low: "bg-accent/10 text-accent border border-accent/20",
};

const sourceClasses: Record<QueueSource, string> = {
  followup: "bg-primary/10 text-primary border border-primary/20",
  apply_gate: "bg-accent/10 text-accent border border-accent/20",
  resume: "bg-success/10 text-success border border-success/20",
  cleanup: "bg-secondary text-secondary-foreground border border-border",
};

const actionTypeLabels: Record<string, string> = {
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

const KNOWN_COMPANIES: Record<string, string> = {
  citadelsecurities: "Citadel Securities",
  goldmansachs: "Goldman Sachs",
  spotandtango: "Spot & Tango",
  rockstargames: "Rockstar Games",
};

function buildGmailThreadUrl(threadId?: string | null) {
  if (!threadId) return null;
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
}

function parseMinutes(label?: string | null) {
  if (!label) return 0;
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatRelativeAge(daysAgo?: number | null) {
  if (typeof daysAgo !== "number") return "Recently";
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "1 day ago";
  return `${daysAgo} days ago`;
}

function formatSnoozedUntil(value?: string | null) {
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

function invalidateSuggestionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["followup-suggestions"] }),
    queryClient.invalidateQueries({ queryKey: ["strategy-alerts", "followup"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "followup"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "states"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "apply-gate"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "stored-emails"] }),
  ]);
}

function companyFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const hostname = new URL(rawUrl.trim()).hostname.replace(/^www\./i, "");
    const root = (hostname.split(".")[0] || "").toLowerCase();
    if (!root) return null;
    if (KNOWN_COMPANIES[root]) return KNOWN_COMPANIES[root];
    return root
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

function splitRoleAndCompany(rawTitle: string | null | undefined, fallbackUrl?: string | null) {
  const title = String(rawTitle || "").trim();
  if (!title) {
    return {
      role: "Current Job Analysis",
      company: companyFromUrl(fallbackUrl) || "Company unavailable",
    };
  }

  const separators = [" at ", " @ ", " - ", " | ", " — ", " – "];
  for (const separator of separators) {
    if (!title.includes(separator)) continue;
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { role: parts[0], company: parts.slice(1).join(" ") };
    }
  }

  return {
    role: title,
    company: companyFromUrl(fallbackUrl) || "Company unavailable",
  };
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

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

function buildFollowupQueue(suggestions: FollowupSuggestion[]): QueueItem[] {
  return suggestions.map((item, index) => ({
    id: `followup:${item.threadId || index}:${item.actionType || "action"}`,
    source: "followup",
    urgency: (item.urgency || "medium") as QueueItem["urgency"],
    title: item.title || item.subject || "Suggested action",
    description: item.description || "Suggested next step based on your application timeline.",
    company: item.company || "Company unavailable",
    estimatedTime: item.estimatedTime || "10 mins",
    daysAgo: item.daysAgo,
    playbook: actionPlaybook[item.actionType || ""] || [
      "Review the thread and choose the smallest useful next action.",
      "Keep the message specific to this role and this company.",
    ],
    sourceLabel: "Follow-up task",
    sourceDescription: item.category?.toLowerCase() === "interviewed" ? "Interview timing signal" : "Email timing signal",
    threadId: item.threadId,
    emailId: item.emailId ?? null,
    applicationId: item.applicationId ?? null,
    actionType: item.actionType,
    suggestionSource: item.suggestionSource || "email_followup",
    stageLabel: item.category?.toLowerCase() === "interviewed" ? "Interview" : "Application",
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
    const { role, company } = splitRoleAndCompany(item.job_title, item.job_url);
    const isHigh = explanation?.decision === "fix_first" || item.verdict === "risky" || Boolean(item.hard_blocker);

    return {
      id: `apply-gate:${item.id}`,
      source: "apply_gate",
      urgency: isHigh ? "high" : "medium",
      title: explanation?.decision === "fix_first" ? `Fix before applying to ${role}` : `Tighten ${role} before applying`,
      description: drivers[0] || quickFixes[0] || "Apply Gate found issues worth resolving before you send this application.",
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

  return [{
    id: "resume-proof:aggregate",
    source: "resume",
    urgency: repeatedGaps.length > 0 ? "high" : "medium",
    title: repeatedGaps.length > 0
      ? `Resume is repeatedly under-proving ${recurringGapText}`
      : "Add stronger proof to your resume before the next applications",
    description: repeatedGaps.length > 0
      ? `Recent Apply Gate screenings are repeatedly missing evidence for ${recurringGapText}.`
      : topResumeFixes[0] || "Apply Gate is finding weak resume proof for work you may already have done.",
    company: repeatedGaps.length > 0 ? "Across recent screenings" : "Resume proof",
    estimatedTime: "20 mins",
    playbook: uniqueStrings([
      ...topResumeFixes,
      repeatedGaps.length > 0 ? `Add concrete bullets proving ${recurringGapText}.` : null,
      "Prioritize bullet evidence over adding more skills to a skills list.",
    ], 3),
    sourceLabel: "Resume-proof gap",
    sourceDescription: "Repeated evidence gaps across recent role screenings",
    threadId: "resume-proof:aggregate",
    actionType: "resume_proof_gap",
    suggestionSource: "resume_proof_gap",
    routeHref: "/apply-gate",
    routeLabel: "Review Apply Gate",
    stageLabel: "Resume proof",
  }];
}

function buildCleanupQueue(emails: StoredEmail[]): QueueItem[] {
  const relevant = emails.filter((email) => {
    const category = String(email.category || "").toLowerCase();
    return category === "applied" || category === "interviewed" || category === "rejected" || category === "offers";
  });

  const missingStructured = relevant.filter((email) => {
    const company = String(email.company_name_corrected || email.company_name || "").trim();
    const position = String(email.position_corrected || email.position || "").trim();
    return !company || !position;
  });

  const unlinkedActive = relevant.filter((email) => {
    const category = String(email.category || "").toLowerCase();
    return (category === "applied" || category === "interviewed")
      && !email.applicationId
      && !email.isClosed
      && !email.isUserClosed;
  });

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
      playbook: uniqueStrings([
        `Review these threads in the extension: ${examples.join("; ")}.`,
        "Correct company and role where extraction is blank or obviously wrong.",
        "After corrections, verify the emails attach to the right application journey.",
      ], 3),
      sourceLabel: "Cleanup task",
      sourceDescription: "Structured data is incomplete",
      threadId: "cleanup:structured-fields",
      actionType: "cleanup_structured_fields",
      suggestionSource: "cleanup_task",
      stageLabel: "Cleanup",
    });
  }

  if (unlinkedActive.length > 0) {
    const examples = unlinkedActive.slice(0, 3).map((email) => `${getEmailCompany(email)} — ${getEmailTitle(email)}`);
    queue.push({
      id: "cleanup:unlinked-applications",
      source: "cleanup",
      urgency: "medium",
      title: `Link ${unlinkedActive.length} active emails to applications`,
      description: "These threads look relevant, but they are not yet attached to an application record, so they will weaken pipeline metrics.",
      company: "Application tracking",
      estimatedTime: unlinkedActive.length > 5 ? "25 mins" : "15 mins",
      playbook: uniqueStrings([
        `Start with: ${examples.join("; ")}.`,
        "Repair application links for active threads before using outcome metrics to judge progress.",
        "Once linked, re-check whether the application is still open or should be closed out.",
      ], 3),
      sourceLabel: "Cleanup task",
      sourceDescription: "Application tracking is incomplete",
      threadId: "cleanup:unlinked-applications",
      actionType: "cleanup_application_links",
      suggestionSource: "cleanup_task",
      stageLabel: "Tracking",
    });
  }

  return queue;
}

function queueSortValue(item: QueueItem) {
  const urgencyScore = item.urgency === "high" ? 0 : item.urgency === "medium" ? 1 : 2;
  const sourceScore = item.source === "followup"
    ? 0
    : item.source === "apply_gate"
      ? 1
      : item.source === "resume"
        ? 2
        : 3;
  const ageScore = typeof item.daysAgo === "number" ? -item.daysAgo : 0;
  return `${urgencyScore}:${sourceScore}:${String(ageScore).padStart(4, "0")}`;
}

const FixSuggestions = () => {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const isAuthed = Boolean(user);

  const followupQuery = useQuery({
    queryKey: ["fix-suggestions", "followup"],
    queryFn: async () => {
      try {
        return await fetchFollowupSuggestions();
      } catch (err) {
        return {
          success: false,
          suggestions: [],
          error: err instanceof Error ? err.message : "Unable to load fix suggestions",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const statesQuery = useQuery({
    queryKey: ["fix-suggestions", "states"],
    queryFn: async () => {
      try {
        return await fetchSuggestionActionStates();
      } catch (err) {
        return {
          success: false,
          actions: [],
          error: err instanceof Error ? err.message : "Unable to load suggestion states",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const applyGateQuery = useQuery({
    queryKey: ["fix-suggestions", "apply-gate"],
    queryFn: async () => {
      try {
        return await fetchApplyGateHistory();
      } catch (err) {
        return {
          success: false,
          history: [],
          error: err instanceof Error ? err.message : "Unable to load Apply Gate history",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });

  const storedEmailsQuery = useQuery({
    queryKey: ["fix-suggestions", "stored-emails"],
    queryFn: async () => {
      try {
        return await fetchStoredEmails({ limit: 200, offset: 0 });
      } catch (err) {
        return {
          success: false,
          emails: [],
          error: err instanceof Error ? err.message : "Unable to load stored emails",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 120_000,
  });
  const completeMutation = useMutation({
    mutationFn: completeSuggestionAction,
    onSuccess: async () => {
      await invalidateSuggestionQueries(queryClient);
      toast.success("Suggestion marked complete.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to mark suggestion complete.");
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: snoozeSuggestionAction,
    onSuccess: async (_, variables) => {
      await invalidateSuggestionQueries(queryClient);
      const hours = variables.snoozeDuration ?? 24;
      toast.success(hours >= 168 ? "Suggestion snoozed for a week." : "Suggestion snoozed for a day.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to snooze suggestion.");
    },
  });

  const undoMutation = useMutation({
    mutationFn: undoSuggestionAction,
    onSuccess: async () => {
      await invalidateSuggestionQueries(queryClient);
      toast.success("Suggestion restored.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to restore suggestion.");
    },
  });

  const activeFollowupSuggestions = (followupQuery.data?.suggestions || []) as FollowupSuggestion[];
  const actionStates = (statesQuery.data?.actions || []) as SuggestionActionState[];
  const applyGateHistory = (applyGateQuery.data?.history || []) as ApplyGateHistoryItem[];
  const storedEmails = (storedEmailsQuery.data?.emails || []) as StoredEmail[];

  const hiddenActionKeys = useMemo(() => {
    return new Set(
      actionStates
        .filter((item) => item.state === "completed" || item.state === "snoozed")
        .map((item) => buildActionKey(item.thread_id, item.action_type))
    );
  }, [actionStates]);

  const combinedSuggestions = useMemo(() => {
    const queue = [
      ...buildFollowupQueue(activeFollowupSuggestions),
      ...buildApplyGateQueue(applyGateHistory),
      ...buildResumeQueue(applyGateHistory),
      ...buildCleanupQueue(storedEmails),
    ];

    return queue
      .filter((item) => !hiddenActionKeys.has(buildActionKey(item.threadId, item.actionType)))
      .sort((a, b) => queueSortValue(a).localeCompare(queueSortValue(b)));
  }, [activeFollowupSuggestions, applyGateHistory, hiddenActionKeys, storedEmails]);

  const filteredSuggestions = useMemo(() => {
    return combinedSuggestions.filter((item) => {
      const urgencyMatch = urgencyFilter === "all" || item.urgency === urgencyFilter;
      const sourceMatch = sourceFilter === "all" || item.source === sourceFilter;
      return urgencyMatch && sourceMatch;
    });
  }, [combinedSuggestions, sourceFilter, urgencyFilter]);

  const stats = useMemo(() => {
    const highPriority = combinedSuggestions.filter((item) => item.urgency === "high").length;
    const totalMinutes = combinedSuggestions.reduce((sum, item) => sum + parseMinutes(item.estimatedTime), 0);
    const snoozed = actionStates.filter((item) => item.state === "snoozed").length;
    const completed = actionStates.filter((item) => item.state === "completed").length;

    return {
      active: combinedSuggestions.length,
      highPriority,
      totalMinutes,
      snoozed,
      completed,
    };
  }, [actionStates, combinedSuggestions]);

  const snoozedItems = useMemo(() => {
    return actionStates
      .filter((item) => item.state === "snoozed")
      .sort((a, b) => new Date(a.snoozed_until || 0).getTime() - new Date(b.snoozed_until || 0).getTime())
      .slice(0, 5);
  }, [actionStates]);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading your fix queue...";
    if (!isAuthed) return "Sign in to see fix suggestions.";
    if ((followupQuery.data as { error?: string } | undefined)?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock fix suggestions.";
    }
    if (followupQuery.isLoading || applyGateQuery.isLoading || storedEmailsQuery.isLoading) {
      return "Building your fix queue...";
    }
    if (combinedSuggestions.length === 0) return "No active fix suggestions right now.";
    return "No suggestions match the current filters.";
  }, [
    applyGateQuery.isLoading,
    combinedSuggestions.length,
    followupQuery.data,
    followupQuery.isLoading,
    isAuthed,
    loading,
    storedEmailsQuery.isLoading,
  ]);

  useEffect(() => {
    if (!isAuthed || combinedSuggestions.length === 0) return;

    const impressionPayload = combinedSuggestions
      .filter((item) => item.threadId && item.actionType)
      .map((item) => ({
        threadId: String(item.threadId),
        actionType: String(item.actionType),
        emailId: item.emailId ?? null,
        applicationId: item.applicationId ?? null,
        suggestionSource: item.suggestionSource || item.source,
      }));

    if (impressionPayload.length === 0) return;

    recordSuggestionImpressions({ suggestions: impressionPayload }).catch(() => undefined);
  }, [combinedSuggestions, isAuthed]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-6 h-6 text-accent" />
              Fix Suggestions
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              One queue for follow-ups, job-fit fixes, resume-proof gaps, and cleanup work that keeps your pipeline measurable.
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3 text-sm text-muted-foreground lg:min-w-[300px]">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Sparkles className="w-4 h-4 text-accent" />
              How this works
            </div>
            <p className="mt-2">
              Email follow-ups stay stateful here. Apply Gate, resume-proof, and cleanup tasks now keep their own completion state too.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
            <p className="text-xs text-muted-foreground mt-1">Active suggestions</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{stats.highPriority}</p>
            <p className="text-xs text-muted-foreground mt-1">High priority</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{stats.totalMinutes || 0}m</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated to clear</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{stats.snoozed}</p>
            <p className="text-xs text-muted-foreground mt-1">Snoozed suggestions</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed suggestions</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Filter the queue</h2>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "high", "medium", "low"] as UrgencyFilter[]).map((value) => (
                <Button
                  key={value}
                  variant={urgencyFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter(value)}
                >
                  {value === "all" ? "All urgency" : `${value[0].toUpperCase()}${value.slice(1)} urgency`}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "followup", "apply_gate", "resume", "cleanup"] as SourceFilter[]).map((value) => (
                <Button
                  key={value}
                  variant={sourceFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter(value)}
                >
                  {value === "all"
                    ? "All sources"
                    : value === "apply_gate"
                      ? "Apply Gate"
                      : value === "followup"
                        ? "Follow-ups"
                        : value === "resume"
                          ? "Resume proof"
                          : "Cleanup"}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {filteredSuggestions.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredSuggestions.map((item, index) => {
                const gmailUrl = buildGmailThreadUrl(item.threadId);
                const mutationBusy =
                  completeMutation.isPending || snoozeMutation.isPending || undoMutation.isPending;

                return (
                  <div
                    key={item.id}
                    className="glass-card rounded-xl p-5 animate-fade-in"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${urgencyClasses[item.urgency]}`}>
                            {item.urgency.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${sourceClasses[item.source]}`}>
                            {item.sourceLabel}
                          </span>
                          {item.stageLabel ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border border-border bg-background text-foreground">
                              {item.stageLabel}
                            </span>
                          ) : null}
                          {item.actionType ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border border-border bg-background text-foreground">
                              {actionTypeLabels[item.actionType] || item.actionType}
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-4 h-4" />
                            {item.company}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="w-4 h-4" />
                            {formatRelativeAge(item.daysAgo)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <AlarmClock className="w-4 h-4" />
                            {item.estimatedTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
                        {gmailUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(gmailUrl, "_blank", "noopener,noreferrer")}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            Open in Gmail
                          </Button>
                        ) : null}
                        {item.routeHref ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(item.routeHref || "/")}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            {item.routeLabel || "Open"}
                          </Button>
                        ) : null}
                        {item.threadId && item.actionType ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={mutationBusy}
                              onClick={() => snoozeMutation.mutate({
                                threadId: item.threadId || "",
                                actionType: item.actionType || "",
                                snoozeDuration: 24,
                                emailId: item.emailId ?? null,
                                applicationId: item.applicationId ?? null,
                                suggestionSource: item.suggestionSource || item.source,
                              })}
                            >
                              <PauseCircle className="w-4 h-4" />
                              Snooze 1 day
                            </Button>
                            <Button
                              size="sm"
                              disabled={mutationBusy}
                              onClick={() => completeMutation.mutate({
                                threadId: item.threadId || "",
                                actionType: item.actionType || "",
                                emailId: item.emailId ?? null,
                                applicationId: item.applicationId ?? null,
                                suggestionSource: item.suggestionSource || item.source,
                              })}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Mark done
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-sm font-medium text-foreground">Suggested move</p>
                        <span className="text-xs text-muted-foreground">{item.sourceDescription}</span>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {item.playbook.map((tip) => (
                          <li key={tip} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground">Queue rules</h2>
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p>Follow-up tasks are timing-sensitive. Resume, Apply Gate, and cleanup tasks now share the same snooze and completion model so the queue can stay honest.</p>
                <p>Apply Gate items are pulled from unresolved verdicts only, so once you act on a screening decision it drops out of this queue.</p>
                <p>Cleanup tasks exist because incomplete company, role, or application linking weakens the rest of the premium metrics.</p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Analytics guardrail</h2>
              </div>
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p>Outcome lift in Strategy Alerts still measures email follow-up suggestions only.</p>
                <p>Apply Gate, resume-proof, and cleanup task completion are persisted, but they are kept out of follow-up outcome comparisons.</p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Hidden right now</h2>
              </div>
              {statesQuery.isLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading action state...</p>
              ) : snoozedItems.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No snoozed suggestions at the moment.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {snoozedItems.map((item) => (
                    <div key={`${item.thread_id}:${item.action_type}`} className="rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {actionTypeLabels[item.action_type] || item.action_type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Resurfaces {formatSnoozedUntil(item.snoozed_until) || "later"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={undoMutation.isPending}
                          onClick={() => undoMutation.mutate({ threadId: item.thread_id, actionType: item.action_type })}
                        >
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FixSuggestions;
