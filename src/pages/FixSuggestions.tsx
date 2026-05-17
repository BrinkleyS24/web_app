import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  ChevronsUpDown,
  Clock3,
  Copy,
  Filter,
  FileSearch,
  Layers3,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/DashboardLayout";
import { CleanupTaskInlinePanel } from "@/components/CleanupTaskInlinePanel";
import { Button } from "@/components/ui/button";
import { useCanonicalQueueImpressions } from "@/hooks/useCanonicalQueueImpressions";
import { useAuth } from "@/lib/AuthContext.jsx";
import { ApiRequestError } from "@/lib/api.js";
import {
  closeApplication,
  completeQueueAction,
  dismissQueueAction,
  fetchRankedActionQueue,
  fetchFollowupSuggestions,
  fetchStoredEmails,
  fetchSuggestionActionStates,
  generateSuggestionDraft,
  recordSuggestionDraftFeedback,
  type FollowupSuggestion,
  type RankedAction,
  type RankedActionQueue,
  type StoredEmail,
  type SuggestionDraft,
  type SuggestionDraftFeedbackLabel,
  type SuggestionDraftTone,
  type SuggestionActionState,
} from "@/lib/emails";
import {
  actionTypeLabels,
  buildDaqV1InboxQueue,
  buildActionKey,
  buildQueueItemsFromRankedQueue,
  buildRankedQueueStats,
  buildGmailThreadUrl,
  buildOutreachDiagnostics,
  buildUpcomingFollowupWindows,
  formatRelativeAge,
  formatSnoozedUntil,
  sourceClasses,
  type QueueItem,
  type QueueSource,
  type UpcomingFollowupWindow,
  urgencyClasses,
} from "@/lib/premiumTaskQueue";

type UrgencyFilter = "all" | "high" | "medium" | "low";
type SourceFilter = "all" | QueueSource;
type QueueView = "inbox" | "all";
type DraftToneOption = {
  value: SuggestionDraftTone;
  label: string;
  description: string;
};
type DraftFeedbackOption = {
  value: SuggestionDraftFeedbackLabel;
  label: string;
};
type DisplayQueueEntry =
  | { type: "item"; key: string; item: QueueItem }
  | { type: "stale_group"; key: string; items: QueueItem[] };

const actionMenuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const destructiveActionMenuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50";

const sourceFilterLabels: Record<SourceFilter, string> = {
  all: "All",
  followup: "Outreach tasks",
  stale: "Ghosting",
  apply_gate: "Apply Gate",
  resume: "Resume proof",
  cleanup: "Cleanup",
};

const sourceAccentClasses: Record<QueueSource, string> = {
  followup: "from-primary/10 via-background to-background border-primary/20",
  stale: "from-warning/10 via-background to-background border-warning/20",
  apply_gate: "from-accent/10 via-background to-background border-accent/20",
  resume: "from-success/10 via-background to-background border-success/20",
  cleanup: "from-muted/80 via-background to-background border-border",
};

const sourceRailClasses: Record<QueueSource, string> = {
  followup: "bg-primary",
  stale: "bg-warning",
  apply_gate: "bg-accent",
  resume: "bg-success",
  cleanup: "bg-foreground/30",
};

type PrimaryActionKind = "cleanup" | "close" | "draft" | "gmail" | "route" | "complete" | null;

function isCloseIntent(intent?: QueueItem["intent"] | null) {
  return intent === "CLOSE_STALE_ROLE";
}

function isInlineCleanupIntent(intent?: QueueItem["intent"] | null) {
  return intent === "CLEANUP_STRUCTURED_FIELDS" || intent === "LINK_APPLICATIONS";
}

function normalizeActionType(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isOutreachQueueItem(item: QueueItem) {
  return item.source === "followup";
}

function isGmailHandledCandidate(item: QueueItem) {
  const actionType = normalizeActionType(item.actionType);
  return (
    isOutreachQueueItem(item)
    && ["reply", "thank_you", "follow_up", "status_check", "prep_interview", "prepare_interview"].includes(actionType)
  );
}

function getCleanupPrimaryLabel(intent?: QueueItem["intent"] | null, inlineOpen = false) {
  if (inlineOpen) return "Hide repair panel";
  if (intent === "LINK_APPLICATIONS") return "Link applications";
  return "Resolve missing data";
}

function getPrimaryActionKind(params: {
  inlineCleanupTask: boolean;
  canCloseFromCard: boolean;
  canDraft: boolean;
  gmailUrl: string | null;
  showRouteAction: boolean;
  item: QueueItem;
}): PrimaryActionKind {
  if (params.inlineCleanupTask) return "cleanup";
  if (params.canCloseFromCard && isCloseIntent(params.item.intent)) return "close";
  if (params.canDraft) return "draft";
  if (params.gmailUrl) return "gmail";
  if (params.showRouteAction) return "route";
  if (params.item.threadId && params.item.actionType) return "complete";
  return null;
}

function getPrimaryActionLabel(
  kind: PrimaryActionKind,
  item: QueueItem,
  draft: SuggestionDraft | undefined,
  inlineOpen: boolean,
  draftOpen = false,
) {
  if (kind === "cleanup") return getCleanupPrimaryLabel(item.intent, inlineOpen);
  if (kind === "close") return "Close application";
  if (kind === "draft") return draftOpen ? "Hide copilot" : draft ? "Show copilot" : "Generate draft";
  if (kind === "gmail") return "Open Gmail";
  if (kind === "route") return item.routeLabel || "Open workspace";
  if (kind === "complete") return isGmailHandledCandidate(item) ? "Already handled" : "Mark done";
  return "Review action";
}

function getPrimaryActionHelper(kind: PrimaryActionKind, item: QueueItem) {
  if (kind === "cleanup") {
    return item.intent === "LINK_APPLICATIONS"
      ? "Repair application links before trusting pipeline metrics."
      : "Fix extracted company and role fields so recommendations stop drifting.";
  }
  if (kind === "close") return "Close this only after checking there is no newer reply.";
  if (kind === "draft") return "Draft from the conversation, then review it before sending.";
  if (kind === "gmail") return "Open Gmail first when timing, sender, or conversation details matter.";
  if (kind === "route") return "Jump into the workspace that can resolve this recommendation.";
  if (kind === "complete") return "Use this when you already handled the action in Gmail.";
  return item.sourceDescription;
}

function buildDisplayQueueEntries(queue: QueueItem[]): DisplayQueueEntry[] {
  const groupedStaleCloseouts = queue.filter(
    (item) => item.source === "stale" && item.urgency === "low" && isCloseIntent(item.intent),
  );

  if (groupedStaleCloseouts.length < 2) {
    return queue.map((item) => ({ type: "item", key: item.id, item }));
  }

  const groupedIds = new Set(groupedStaleCloseouts.map((item) => item.id));
  const entries: DisplayQueueEntry[] = [];
  let insertedGroup = false;

  for (const item of queue) {
    if (groupedIds.has(item.id)) {
      if (!insertedGroup) {
        entries.push({
          type: "stale_group",
          key: "stale-group:low-closeouts",
          items: groupedStaleCloseouts,
        });
        insertedGroup = true;
      }
      continue;
    }

    entries.push({ type: "item", key: item.id, item });
  }

  return entries;
}

function UpcomingFollowupWindowList({
  windows,
  compact = false,
}: {
  windows: UpcomingFollowupWindow[];
  compact?: boolean;
}) {
  if (windows.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
      {windows.map((window) => (
        <div key={window.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{window.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{window.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              {window.opensInDays <= 0 ? "due now" : `${window.opensInDays}d`}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-1">{window.company}</span>
            <span className="rounded-full bg-muted px-2 py-1">day {window.windowStartDay}-{window.windowEndDay}</span>
            <span className="rounded-full bg-muted px-2 py-1">{window.sourceDescription}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const draftToneOptions: DraftToneOption[] = [
  {
    value: "warm",
    label: "Warm follow-up",
    description: "Polite check-in that restates interest and asks about timing.",
  },
  {
    value: "concise",
    label: "Concise follow-up",
    description: "Short version for conversations that already carry enough context.",
  },
  {
    value: "direct",
    label: "Direct status check",
    description: "Straight to timing and next steps without extra framing.",
  },
  {
    value: "post_interview",
    label: "Post-interview thank-you",
    description: "Best soon after an interview while the conversation is still fresh.",
  },
  {
    value: "recruiter_went_cold",
    label: "Final status check",
    description: "Last polite touch before you move the role out of active focus.",
  },
  {
    value: "referral",
    label: "Referral / networking",
    description: "Reach out to a human contact for advice, context, or a warm intro.",
  },
];

const draftFeedbackOptions: DraftFeedbackOption[] = [
  { value: "helpful", label: "Helpful" },
  { value: "too_generic", label: "Too generic" },
  { value: "wrong_recipient", label: "Wrong recipient" },
  { value: "wrong_grounding", label: "Wrong grounding" },
  { value: "wrong_tone", label: "Wrong tone" },
];

const draftToneOptionByValue = new Map(draftToneOptions.map((option) => [option.value, option]));

function getDraftToneOptionsForItem(item: QueueItem): DraftToneOption[] {
  switch (item.intent) {
    case "SEND_THANK_YOU":
      return draftToneOptions.filter((option) => ["post_interview", "warm", "concise"].includes(option.value));
    case "NETWORKING_OUTREACH":
      return draftToneOptions.filter((option) => ["referral", "warm", "concise"].includes(option.value));
    case "STATUS_CHECK":
      return draftToneOptions.filter((option) => ["direct", "warm", "concise"].includes(option.value));
    case "CLOSE_STALE_ROLE":
      return draftToneOptions.filter((option) =>
        ["recruiter_went_cold", "direct", "concise"].includes(option.value),
      );
    case "FOLLOW_UP_THREAD":
    case "APPLY_TO_ROLE":
    case "TAILOR_RESUME":
    case "FIX_TARGETING":
    case "PREP_INTERVIEW":
    case "CLEANUP_STRUCTURED_FIELDS":
    case "LINK_APPLICATIONS":
    case "CLEANUP_DATA":
    default:
      return draftToneOptions.filter((option) => ["warm", "concise", "direct"].includes(option.value));
  }
}

function getDraftToneMeta(tone?: SuggestionDraftTone | string | null) {
  return tone ? draftToneOptionByValue.get(tone as SuggestionDraftTone) || null : null;
}

function defaultDraftTone(item: QueueItem): SuggestionDraftTone {
  if (item.intent === "SEND_THANK_YOU") return "post_interview";
  if (item.intent === "NETWORKING_OUTREACH") return "referral";
  if (item.intent === "CLOSE_STALE_ROLE") {
    return "recruiter_went_cold";
  }
  if (item.intent === "STATUS_CHECK") return "direct";
  return "warm";
}

function buildDraftClipboardText(draft: SuggestionDraft, includeSubject = false) {
  if (!includeSubject) return draft.body;
  return [`Subject: ${draft.subject}`, "", draft.body].join("\n");
}

function buildDraftTaskKey(
  threadId?: string | null,
  actionType?: string | null,
  emailId?: string | number | null,
) {
  return `${buildActionKey(threadId, actionType)}:${String(emailId ?? "").trim()}`;
}

function CollapsibleQueueSection({
  title,
  preview,
  badge,
  children,
}: {
  title: string;
  preview: string;
  badge?: string | null;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border/70 bg-background/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge ? (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground group-open:hidden">{preview}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <ChevronsUpDown className="h-3.5 w-3.5" />
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-border/70 px-4 pb-3 pt-2.5">{children}</div>
    </details>
  );
}

function coerceSourceEvidence(entries?: unknown) {
  if (Array.isArray(entries)) {
    const fragments = entries
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter((entry) => entry.length > 0);
    const looksLikeSplitString =
      fragments.length >= 3 &&
      fragments.every((entry) => entry.length <= 1) &&
      fragments.join("").trim().length > 1;

    if (looksLikeSplitString) {
      return [fragments.join("").trim()];
    }

    return entries;
  }
  if (typeof entries !== "string") return [];

  const value = entries.trim();
  if (!value) return [];

  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [value.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim()].filter(Boolean);
    }
  }

  return [value];
}

function parseSourceEvidence(entries: unknown = []) {
  const parsed = {
    subject: "",
    sender: "",
    timing: "",
    other: [] as string[],
  };

  for (const entry of coerceSourceEvidence(entries)) {
    const value = String(entry || "").trim();
    if (!value) continue;

    const subjectMatch = value.match(/^subject:\s*(.+)$/i);
    if (subjectMatch) {
      parsed.subject ||= subjectMatch[1].trim();
      continue;
    }

    const senderMatch = value.match(/^sender:\s*(.+)$/i);
    if (senderMatch) {
      parsed.sender ||= senderMatch[1].trim();
      continue;
    }

    if (/^(tracked|received|sent|last|latest|\d+\s+day)/i.test(value)) {
      parsed.timing ||= value;
      continue;
    }

    parsed.other.push(value);
  }

  return parsed;
}

function looksLikeBrokenSerializedEvidence(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  if (/^[\[\]{}"',:]+$/.test(normalized)) return true;
  if (/^\[\s*["']?[^"'\]]{1,20}$/i.test(normalized)) return true;
  if (/^["']?[^"'\[]+\s*["']?\]$/.test(normalized)) return true;
  if ((normalized.includes("[") || normalized.includes("]")) && !/^\[[\s\S]*\]$/.test(normalized)) return true;
  return false;
}

function getReadableSourceValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || looksLikeBrokenSerializedEvidence(normalized)) continue;
    return normalized;
  }
  return "";
}

function getDecisionSourceRows(item: QueueItem) {
  if (item.source === "apply_gate") {
    const recommendation = getReadableSourceValue(item.blockingReason, item.description, item.whyNow, item.sourceDescription);
    const nextStep = getReadableSourceValue(item.playbook?.[0], item.sourceDescription, item.routeLabel);
    return [
      recommendation ? { label: "Recommendation", value: recommendation } : null,
      nextStep ? { label: "Best next step", value: nextStep } : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));
  }

  if (item.source === "resume") {
    const proofGap = getReadableSourceValue(item.description, item.whyNow, item.playbook?.[0], item.sourceDescription);
    const nextStep = getReadableSourceValue(item.playbook?.[0], item.playbook?.[1], item.routeLabel);
    return [
      proofGap ? { label: "Proof gap", value: proofGap } : null,
      nextStep ? { label: "Best next step", value: nextStep } : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));
  }

  return [];
}

function buildSourceCheckPreview(item: QueueItem) {
  const decisionRows = getDecisionSourceRows(item);
  if (decisionRows[0]?.value) return decisionRows[0].value;

  const parsed = parseSourceEvidence(item.evidence || []);
  if (parsed.subject && item.company) return `${item.company} conversation: ${parsed.subject}`;
  if (parsed.subject) return parsed.subject;
  if (item.company) return `${item.company} conversation`;
  return "Confirm the source before acting.";
}

function getSourceCheckTitle(item: QueueItem) {
  if (item.source === "apply_gate" || item.source === "resume") return "Why this is queued";
  if (item.source === "cleanup") return "Data to fix";
  return "Source check";
}

function getSourceCheckPurpose(item: QueueItem) {
  const actionType = normalizeActionType(item.actionType);

  if (item.source === "apply_gate") {
    return "Use this to confirm the Apply Gate recommendation before spending time on this role.";
  }

  if (item.source === "resume") {
    return "Use this to see which resume proof gap keeps showing up before you apply again.";
  }

  if (item.source === "cleanup") {
    return "Use this to fix missing company or role details so the queue stays accurate.";
  }

  if (actionType === "thank_you") {
    return "Use this to refresh the interview context before writing the thank-you note.";
  }

  if (actionType === "follow_up" || actionType === "status_check") {
    return "Use this to confirm there has not been a newer reply before you follow up.";
  }

  if (actionType === "prep_interview" || actionType === "prepare_interview") {
    return "Use this to confirm interview timing, format, and contact details.";
  }

  if (isOutreachQueueItem(item)) {
    return "Use this to confirm the conversation, sender, and company before acting.";
  }

  return "Use this to confirm the source behind the recommendation.";
}

function getSourceCheckBadge(item: QueueItem, rowCount: number) {
  const actionType = normalizeActionType(item.actionType);
  if (!rowCount) return "Needs verification";
  if (item.source === "apply_gate") return "Apply Gate source";
  if (item.source === "resume") return "Resume proof";
  if (item.source === "cleanup") return "Missing data";
  if (actionType === "prep_interview" || actionType === "prepare_interview") return "Interview source";
  if (isOutreachQueueItem(item)) return "Gmail conversation";
  return "Source context";
}

function getSourceCheckChecklist(item: QueueItem) {
  const actionType = normalizeActionType(item.actionType);

  if (item.source === "apply_gate") {
    return [
      "Open Apply Gate and confirm the recommendation still matches the role.",
      "Fix the strongest proof gap before applying.",
      "If you already applied, mark this handled so it leaves the queue.",
    ];
  }

  if (item.source === "resume") {
    return [
      "Add proof that directly matches the repeated gap.",
      "Move the strongest role-relevant bullet higher on the resume.",
      "Re-run Apply Gate after the resume update.",
    ];
  }

  if (item.source === "cleanup") {
    return [
      "Confirm the company and role from the original email.",
      "Fix the missing fields before relying on this recommendation.",
      "Mark the cleanup done once the source data is corrected.",
    ];
  }

  if (actionType === "thank_you") {
    return [
      "Confirm this is the actual interview conversation.",
      "Check the recruiter name and company before drafting.",
      "If you already sent the note in Gmail, mark this handled.",
    ];
  }

  if (actionType === "follow_up" || actionType === "status_check") {
    return [
      "Check Gmail for a newer reply before sending anything.",
      "Confirm this role is still worth active attention.",
      "If you already followed up elsewhere, mark this handled.",
    ];
  }

  if (actionType === "prep_interview" || actionType === "prepare_interview") {
    return [
      "Confirm date, format, and contact details in the conversation.",
      "Pull the role title and company into your prep notes.",
      "Mark this handled after the prep is complete.",
    ];
  }

  return [
    "Confirm the source matches this action.",
    "Check whether anything newer changes the recommendation.",
    "Use the source context before marking this done.",
  ];
}

function SourceCheckSection({ item }: { item: QueueItem }) {
  const parsed = parseSourceEvidence(item.evidence || []);
  const decisionRows = getDecisionSourceRows(item);
  const rows = decisionRows.length
    ? decisionRows
    : [
        parsed.subject ? { label: "Thread", value: parsed.subject } : null,
        parsed.sender ? { label: "Contact", value: parsed.sender } : null,
        item.company ? { label: "Company", value: item.company } : null,
        parsed.timing ? { label: "Timing", value: parsed.timing } : null,
      ].filter((row): row is { label: string; value: string } => Boolean(row));
  const fallbackRows = decisionRows.length
    ? []
    : parsed.other
        .filter((value) => !looksLikeBrokenSerializedEvidence(value))
        .slice(0, Math.max(1, 3 - rows.length));
  const checklist = getSourceCheckChecklist(item);
  const fallbackLabel =
    item.source === "apply_gate"
      ? "Apply Gate note"
      : item.source === "resume"
      ? "Resume proof gap"
      : item.source === "cleanup"
      ? "Missing field"
      : "Source detail";

  return (
    <CollapsibleQueueSection
      title={getSourceCheckTitle(item)}
      preview={buildSourceCheckPreview(item)}
      badge={getSourceCheckBadge(item, rows.length)}
    >
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          {getSourceCheckPurpose(item)}
        </p>

        {rows.length || fallbackRows.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-sm leading-5 text-foreground">{row.value}</p>
              </div>
            ))}
            {fallbackRows.map((value) => (
              <div key={value} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{fallbackLabel}</p>
                <p className="mt-1 text-sm leading-5 text-foreground">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
            <p className="text-sm text-muted-foreground">No source details were available for this card.</p>
          </div>
        )}

        <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Before you act</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-5 text-muted-foreground">
            {checklist.map((step) => (
              <li key={step} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CollapsibleQueueSection>
  );
}

function SuggestionDraftPanel({
  draft,
  draftKey,
  draftTone,
  draftToneMeta,
  availableDraftToneOptions,
  gmailUrl,
  isGenerating,
  submittedFeedback,
  isSubmittingFeedback,
  onToneChange,
  onCopyDraft,
  onCopyDraftWithSubject,
  onSubmitFeedback,
}: {
  draft: SuggestionDraft | undefined;
  draftKey: string;
  draftTone: SuggestionDraftTone;
  draftToneMeta: DraftToneOption | null;
  availableDraftToneOptions: DraftToneOption[];
  gmailUrl: string | null;
  isGenerating: boolean;
  submittedFeedback?: SuggestionDraftFeedbackLabel | null;
  isSubmittingFeedback: boolean;
  onToneChange: (tone: SuggestionDraftTone) => void;
  onCopyDraft: () => void;
  onCopyDraftWithSubject: () => void;
  onSubmitFeedback: (label: SuggestionDraftFeedbackLabel) => void;
}) {
  const feedbackLabel = submittedFeedback
    ? draftFeedbackOptions.find((option) => option.value === submittedFeedback)?.label || submittedFeedback
    : "";

  return (
    <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)))] p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Outreach Copilot</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Draft, verify the send path, then copy into Gmail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-primary/20 bg-background/80 px-2.5 py-1 text-xs font-medium text-primary">
            {draft?.contextLabel || draftToneMeta?.label || "Draft preset"}
          </span>
          <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {draft?.confidence || "medium"} confidence
          </span>
          {draft?.sendStrategyLabel ? (
            <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {draft.sendStrategyLabel}
            </span>
          ) : null}
        </div>
      </div>

      {isGenerating ? (
        <p className="mt-4 text-sm text-muted-foreground">Generating draft...</p>
      ) : draft ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`draft-tone-${draftKey}`}>
                  Preset
                </label>
                <select
                  id={`draft-tone-${draftKey}`}
                  className="mt-2 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                  value={draftTone}
                  onChange={(event) => onToneChange(event.target.value as SuggestionDraftTone)}
                >
                  {availableDraftToneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                <p className="mt-2 truncate text-sm font-medium text-foreground" title={draft.subject}>
                  {draft.subject}
                </p>
              </div>
            </div>

            {draft.warning ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                {draft.warning}
              </div>
            ) : null}

            <textarea
              className="min-h-[180px] w-full rounded-2xl border border-border bg-background/90 p-4 text-sm leading-6 text-foreground outline-none focus:border-primary"
              readOnly
              value={draft.body}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCopyDraft}>
                <Copy className="h-4 w-4" />
                Copy draft
              </Button>
              <Button variant="outline" size="sm" onClick={onCopyDraftWithSubject}>
                <Copy className="h-4 w-4" />
                Copy subject + body
              </Button>
              {gmailUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(gmailUrl, "_blank", "noopener,noreferrer")}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Open Gmail
                </Button>
              ) : null}
            </div>

            <details className="group rounded-2xl border border-border/70 bg-background/70">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden">
                <span>{submittedFeedback ? `Feedback saved: ${feedbackLabel}` : "Report draft issue"}</span>
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </summary>
              <div className="border-t border-border/70 px-3 py-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Mark the failure mode when this draft misses. This builds the live copilot regression bank.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                {draftFeedbackOptions.map((option) => {
                  const active = submittedFeedback === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      disabled={isSubmittingFeedback}
                      data-testid={`copilot-feedback-${option.value}`}
                      onClick={() => onSubmitFeedback(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
                </div>
                {submittedFeedback ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Latest feedback saved: {feedbackLabel}
                  </p>
                ) : null}
              </div>
            </details>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send path</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {draft.sendStrategyLabel || "Review recipient"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {draft.sendStrategyDescription || "Verify the recipient and send path before you act."}
              </p>
              {draft.recipient ? (
                <p className="mt-2 truncate rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground" title={draft.recipient}>
                  Suggested reply contact: {draft.recipient}
                </p>
              ) : null}
              {draft.latestSender && draft.latestSender !== draft.recipient ? (
                <p className="mt-2 truncate rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground" title={draft.latestSender}>
                  Latest sender in conversation: {draft.latestSender}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Before sending</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {(draft.coachingPoints || []).map((entry, entryIndex) => (
                  <li key={entry} className="flex gap-3">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {entryIndex + 1}
                    </span>
                    <span className="leading-5">{entry}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grounding</p>
              {draft.evidence?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {draft.evidence.map((entry) => (
                    <span key={entry} className="max-w-full truncate rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground" title={entry}>
                      {entry}
                    </span>
                  ))}
                </div>
              ) : null}
              {draft.threadPreview ? (
                <div className="mt-2 rounded-xl border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                  <p className="mt-1 max-h-24 overflow-hidden text-xs leading-5 text-muted-foreground">{draft.threadPreview}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No draft generated yet.</p>
      )}
    </div>
  );
}

function invalidateSuggestionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "queue"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "followup"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "states"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "stored-emails"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard", "queue"] }),
  ]);
}

function getRankedQueueActiveActions(queue?: RankedActionQueue | null): RankedAction[] {
  if (!queue) return [];
  return [
    ...(queue.doToday || []),
    ...(queue.thisWeek || []),
    ...(queue.blocked || []),
    ...(queue.later || []),
  ];
}

function getRankedQueueActionsForQueueItems(queue: RankedActionQueue | null | undefined, items: QueueItem[]) {
  if (!queue || items.length === 0) return [] as RankedAction[];

  const visibleKeys = new Set(
    items
      .map((item) => item.dedupeKey || item.logicalKey)
      .filter((key): key is string => Boolean(key)),
  );

  return getRankedQueueActiveActions(queue).filter((action) => (
    (action.effectiveStatus || action.status) === "open"
    && (visibleKeys.has(action.dedupeKey) || visibleKeys.has(action.logicalKey))
  ));
}

function matchesUrgencyFilter(item: QueueItem, urgencyFilter: UrgencyFilter) {
  return urgencyFilter === "all" || item.urgency === urgencyFilter;
}

function buildQueueItemStats(items: QueueItem[], urgencyFilter: UrgencyFilter = "all") {
  const scopedItems = items.filter((item) => matchesUrgencyFilter(item, urgencyFilter));
  return {
    active: scopedItems.length,
    highPriority: scopedItems.filter((item) => item.urgency === "high").length,
    totalMinutes: scopedItems.reduce((sum, item) => {
      const match = item.estimatedTime.match(/(\d+)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0),
    snoozed: 0,
    completed: 0,
  };
}

function emailBelongsToQueueItem(email: StoredEmail, item: QueueItem) {
  const emailThreadId = String(email.thread_id || "").trim();
  const itemThreadId = String(item.threadId || "").trim();
  if (emailThreadId && itemThreadId && emailThreadId === itemThreadId) return true;

  const emailApplicationId = String(email.applicationId || "").trim();
  const itemApplicationId = String(item.applicationId || "").trim();
  return Boolean(emailApplicationId && itemApplicationId && emailApplicationId === itemApplicationId);
}

function isFromCurrentUser(email: StoredEmail, userEmail?: string | null) {
  const normalizedUserEmail = String(userEmail || "").trim().toLowerCase();
  if (!normalizedUserEmail) return false;
  return String(email.from || "").toLowerCase().includes(normalizedUserEmail);
}

function getEmailTime(email: StoredEmail) {
  const time = new Date(email.date || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestEmailForQueueItem(item: QueueItem, emails: StoredEmail[]) {
  return emails
    .filter((email) => emailBelongsToQueueItem(email, item))
    .sort((a, b) => getEmailTime(b) - getEmailTime(a))[0] || null;
}

function shouldSuppressAlreadyHandledGmailAction(item: QueueItem, storedEmails: StoredEmail[], userEmail?: string | null) {
  if (!isGmailHandledCandidate(item)) return false;

  const latestEmail = latestEmailForQueueItem(item, storedEmails);
  return Boolean(latestEmail && isFromCurrentUser(latestEmail, userEmail));
}

function suppressAlreadyHandledGmailActions(items: QueueItem[], storedEmails: StoredEmail[], userEmail?: string | null) {
  if (!userEmail || storedEmails.length === 0) return items;
  return items.filter((item) => !shouldSuppressAlreadyHandledGmailAction(item, storedEmails, userEmail));
}

const FixSuggestions = () => {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [queueView, setQueueView] = useState<QueueView>("inbox");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedInlineTaskId, setExpandedInlineTaskId] = useState<string>("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string>("");
  const [openDraftTaskId, setOpenDraftTaskId] = useState<string>("");
  const [draftToneByTaskId, setDraftToneByTaskId] = useState<Record<string, SuggestionDraftTone>>({});
  const [draftByTaskId, setDraftByTaskId] = useState<Record<string, SuggestionDraft>>({});
  const [draftFeedbackByTaskId, setDraftFeedbackByTaskId] = useState<Record<string, SuggestionDraftFeedbackLabel>>({});
  const [pendingLogicalKeys, setPendingLogicalKeys] = useState<Record<string, true>>({});

  const isAuthed = Boolean(user);

  const queueQuery = useQuery({
    queryKey: ["fix-suggestions", "queue"],
    queryFn: async () => {
      try {
        return await fetchRankedActionQueue();
      } catch (err) {
        return {
          success: false,
          queue: {
            now: new Date().toISOString(),
            doToday: [],
            thisWeek: [],
            later: [],
            blocked: [],
            dismissed: [],
            expired: [],
            done: [],
            emptyState: null,
            resolvedActions: [],
          },
          error: err instanceof Error ? err.message : "Unable to load the action queue",
        };
      }
    },
    enabled: isAuthed,
    staleTime: 30_000,
  });

  const followupQuery = useQuery({
    queryKey: ["fix-suggestions", "followup"],
    queryFn: async () => {
      try {
        return await fetchFollowupSuggestions();
      } catch (err) {
        return {
          success: false,
          suggestions: [],
          error: err instanceof Error ? err.message : "Unable to load the action queue",
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
  const draftMutation = useMutation({
    mutationFn: generateSuggestionDraft,
    onSuccess: (data, variables) => {
      const itemId = buildDraftTaskKey(variables.threadId, variables.actionType, variables.emailId);
      setDraftByTaskId((current) => ({
        ...current,
        [itemId]: data.draft,
      }));
      toast.success("Draft generated.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to generate draft.");
    },
  });

  const draftFeedbackMutation = useMutation({
    mutationFn: recordSuggestionDraftFeedback,
    onSuccess: (_, variables) => {
      const itemId = buildDraftTaskKey(variables.threadId, variables.actionType, variables.emailId);
      setDraftFeedbackByTaskId((current) => ({
        ...current,
        [itemId]: variables.feedbackLabel,
      }));
      toast.success("Draft feedback saved.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to save draft feedback.");
    },
  });

  const activeFollowupSuggestions = (followupQuery.data?.suggestions || []) as FollowupSuggestion[];
  const actionStates = (statesQuery.data?.actions || []) as SuggestionActionState[];
  const storedEmails = (storedEmailsQuery.data?.emails || []) as StoredEmail[];
  const rankedQueue = (queueQuery.data?.queue || null) as RankedActionQueue | null;
  const combinedSuggestions = useMemo(
    () => suppressAlreadyHandledGmailActions(
      buildQueueItemsFromRankedQueue(rankedQueue),
      storedEmails,
      user?.email,
    ),
    [rankedQueue, storedEmails, user?.email],
  );
  const daqInboxSuggestions = useMemo(
    () => buildDaqV1InboxQueue(combinedSuggestions),
    [combinedSuggestions],
  );
  const visibleSuggestionPool = queueView === "inbox" ? daqInboxSuggestions : combinedSuggestions;
  const effectiveSourceFilter = queueView === "inbox" && sourceFilter !== "followup" ? "all" : sourceFilter;
  const sourceFilterOptions: SourceFilter[] =
    queueView === "inbox" ? ["all"] : ["all", "followup", "stale", "apply_gate", "resume", "cleanup"];
  const urgencyFilteredSuggestionPool = useMemo(
    () => visibleSuggestionPool.filter((item) => matchesUrgencyFilter(item, urgencyFilter)),
    [urgencyFilter, visibleSuggestionPool],
  );

  const filteredSuggestions = useMemo(() => {
    return urgencyFilteredSuggestionPool.filter((item) => {
      const sourceMatch = effectiveSourceFilter === "all" || item.source === effectiveSourceFilter;
      return sourceMatch;
    });
  }, [effectiveSourceFilter, urgencyFilteredSuggestionPool]);

  const allStats = useMemo(() => buildRankedQueueStats(rankedQueue), [rankedQueue]);
  const allVisibleStats = useMemo(() => buildQueueItemStats(combinedSuggestions, urgencyFilter), [combinedSuggestions, urgencyFilter]);
  const daqStats = useMemo(() => buildQueueItemStats(daqInboxSuggestions, urgencyFilter), [daqInboxSuggestions, urgencyFilter]);
  const stats = queueView === "inbox" ? daqStats : urgencyFilter === "all" ? allStats : allVisibleStats;

  const upcomingFollowupWindows = useMemo(() => {
    return buildUpcomingFollowupWindows({
      storedEmails,
      followupSuggestions: activeFollowupSuggestions,
      actionStates,
    });
  }, [actionStates, activeFollowupSuggestions, storedEmails]);

  const outreachDiagnostics = useMemo(() => {
    return buildOutreachDiagnostics({
      storedEmails,
      followupSuggestions: activeFollowupSuggestions,
      actionStates,
      upcomingWindows: upcomingFollowupWindows,
    });
  }, [actionStates, activeFollowupSuggestions, storedEmails, upcomingFollowupWindows]);

  const hasDueFollowupWindow = upcomingFollowupWindows.some((item) => item.opensInDays <= 0);
  const followupSuppressionReason = followupQuery.data?.meta?.suppressionReason || "";

  const sourceCounts = useMemo(() => {
    return urgencyFilteredSuggestionPool.reduce<Record<QueueSource, number>>(
      (counts, item) => ({
        ...counts,
        [item.source]: counts[item.source] + 1,
      }),
      {
        followup: 0,
        stale: 0,
        apply_gate: 0,
        resume: 0,
        cleanup: 0,
      },
    );
  }, [urgencyFilteredSuggestionPool]);

  const visibleQueueActions = useMemo(
    () => getRankedQueueActionsForQueueItems(rankedQueue, filteredSuggestions),
    [filteredSuggestions, rankedQueue],
  );
  const snoozedItems = useMemo(() => {
    if (!rankedQueue?.dismissed?.length) return [] as QueueItem[];
    return buildQueueItemsFromRankedQueue({
      ...rankedQueue,
      doToday: [],
      thisWeek: [],
      blocked: [],
      later: rankedQueue.dismissed,
    });
  }, [rankedQueue]);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading your action queue...";
    if (!isAuthed) return "Sign in to see next-best actions.";
    if ((queueQuery.data as { error?: string } | undefined)?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock the daily action queue.";
    }
    if (queueQuery.isLoading) {
      return "Building your action queue...";
    }
    if (combinedSuggestions.length === 0) return rankedQueue?.emptyState?.title || "No active next-best actions right now.";
    if (visibleSuggestionPool.length === 0 && queueView === "inbox") {
      return "No urgent inbox actions are due right now. Switch to all actions for Apply Gate, resume, cleanup, and stale-role work.";
    }
    return "No suggestions match the current filters.";
  }, [
    combinedSuggestions.length,
    isAuthed,
    loading,
    queueQuery.data,
    queueQuery.isLoading,
    queueView,
    rankedQueue,
    visibleSuggestionPool.length,
  ]);

  useCanonicalQueueImpressions({
    enabled: isAuthed,
    actions: visibleQueueActions,
  });

  const withPendingLogicalKey = async <T,>(logicalKey: string | undefined, fn: () => Promise<T>) => {
    if (!logicalKey) return fn();
    setPendingLogicalKeys((current) => ({ ...current, [logicalKey]: true }));
    try {
      return await fn();
    } finally {
      setPendingLogicalKeys((current) => {
        if (!current[logicalKey]) return current;
        const next = { ...current };
        delete next[logicalKey];
        return next;
      });
    }
  };

  const refreshQueueState = async () => {
    await invalidateSuggestionQueries(queryClient);
  };

  const isStaleQueueActionError = (error: unknown) =>
    error instanceof ApiRequestError && Boolean(error.payload?.stale && error.payload?.requiresRefresh);

  const completeQueueItem = async (item: QueueItem, successMessage = "Suggestion marked complete.") => {
    if (!item.logicalKey) return;

    await withPendingLogicalKey(item.logicalKey, async () => {
      try {
        await completeQueueAction({
          logicalKey: item.logicalKey,
          dedupeKey: item.dedupeKey,
        });
        await refreshQueueState();
        toast.success(successMessage);
      } catch (error) {
        if (isStaleQueueActionError(error)) {
          await refreshQueueState();
          return;
        }
        toast.error(error instanceof Error ? error.message : "Unable to mark suggestion complete.");
      }
    });
  };

  const dismissQueueItem = async (item: QueueItem) => {
    if (!item.logicalKey || !item.dedupeKey) return;

    await withPendingLogicalKey(item.logicalKey, async () => {
      try {
        await dismissQueueAction({
          logicalKey: item.logicalKey,
          dedupeKey: item.dedupeKey,
        });
        await refreshQueueState();
        toast.success("Suggestion snoozed for a day.");
      } catch (error) {
        if (isStaleQueueActionError(error)) {
          await refreshQueueState();
          return;
        }
        toast.error(error instanceof Error ? error.message : "Unable to snooze suggestion.");
      }
    });
  };

  const closeQueueItem = async (item: QueueItem) => {
    if (!item.logicalKey) return;

    await withPendingLogicalKey(item.logicalKey, async () => {
      try {
        await closeApplication({
          applicationId: item.applicationId ?? null,
          emailId: item.emailId ?? null,
          reason: `Closed from Daily Action Queue close-out cue: ${item.title}`,
        });
        await completeQueueAction({
          logicalKey: item.logicalKey,
          dedupeKey: item.dedupeKey,
        });
        await refreshQueueState();
        toast.success("Application closed and removed from active focus.");
      } catch (error) {
        if (isStaleQueueActionError(error)) {
          await refreshQueueState();
          return;
        }
        toast.error(error instanceof Error ? error.message : "Unable to close application.");
      }
    });
  };

  const copyDraft = async (draft: SuggestionDraft, includeSubject = false) => {
    try {
      await navigator.clipboard.writeText(buildDraftClipboardText(draft, includeSubject));
      toast.success(includeSubject ? "Subject and draft copied." : "Draft copied.");
    } catch {
      toast.error("Unable to copy draft.");
    }
  };

  const displayEntries = useMemo(() => buildDisplayQueueEntries(filteredSuggestions), [filteredSuggestions]);

  const getDraftUiForItem = (item: QueueItem) => {
    const gmailUrl =
      item.source === "followup" || item.source === "stale" ? buildGmailThreadUrl(item.threadId) : null;
    const draftKey = buildDraftTaskKey(item.threadId, item.actionType, item.emailId);
    const draft = draftByTaskId[draftKey];
    const draftOpen = openDraftTaskId === draftKey;
    const availableDraftToneOptions = getDraftToneOptionsForItem(item);
    const preferredDraftTone = (draftToneByTaskId[draftKey] || defaultDraftTone(item)) as SuggestionDraftTone;
    const draftTone = availableDraftToneOptions.some((option) => option.value === preferredDraftTone)
      ? preferredDraftTone
      : availableDraftToneOptions[0]?.value || defaultDraftTone(item);
    const draftToneMeta = getDraftToneMeta(draft?.context || draftTone);
    const canDraft = Boolean(item.hasDraft && item.threadId && item.actionType);

    return {
      gmailUrl,
      draftKey,
      draft,
      draftOpen,
      availableDraftToneOptions,
      draftTone,
      draftToneMeta,
      canDraft,
    };
  };

  const toggleDraftForItem = (item: QueueItem, tone: SuggestionDraftTone) => {
    const draftKey = buildDraftTaskKey(item.threadId, item.actionType, item.emailId);
    const existingDraft = draftByTaskId[draftKey];
    setOpenDraftTaskId((current) => (current === draftKey ? "" : draftKey));
    if (!existingDraft) {
      draftMutation.mutate({
        threadId: item.threadId || "",
        actionType: item.actionType || "",
        tone,
        emailId: item.emailId ?? null,
        applicationId: item.applicationId ?? null,
        suggestionSource: item.suggestionSource || item.source,
      });
    }
  };

  const renderDraftPanel = (item: QueueItem) => {
    const {
      draftKey,
      draft,
      draftTone,
      draftToneMeta,
      availableDraftToneOptions,
      gmailUrl,
    } = getDraftUiForItem(item);

    return (
      <SuggestionDraftPanel
        draft={draft}
        draftKey={draftKey}
        draftTone={draftTone}
        draftToneMeta={draftToneMeta}
        availableDraftToneOptions={availableDraftToneOptions}
        gmailUrl={gmailUrl}
        isGenerating={draftMutation.isPending && openDraftTaskId === draftKey}
        submittedFeedback={draftFeedbackByTaskId[draftKey] || null}
        isSubmittingFeedback={draftFeedbackMutation.isPending}
        onToneChange={(nextTone) => {
          setDraftToneByTaskId((current) => ({
            ...current,
            [draftKey]: nextTone,
          }));
          draftMutation.mutate({
            threadId: item.threadId || "",
            actionType: item.actionType || "",
            tone: nextTone,
            emailId: item.emailId ?? null,
            applicationId: item.applicationId ?? null,
            suggestionSource: item.suggestionSource || item.source,
          });
        }}
        onCopyDraft={() => copyDraft(draft as SuggestionDraft)}
        onCopyDraftWithSubject={() => copyDraft(draft as SuggestionDraft, true)}
        onSubmitFeedback={(feedbackLabel) => {
          if (!draft || !item.threadId || !item.actionType) return;
          draftFeedbackMutation.mutate({
            threadId: item.threadId,
            actionType: item.actionType,
            feedbackLabel,
            tone: draftTone,
            emailId: item.emailId ?? null,
            applicationId: item.applicationId ?? null,
            suggestionSource: item.suggestionSource || item.source,
            draft: {
              subject: draft.subject,
              body: draft.body,
              context: draft.context,
              confidence: draft.confidence,
              sendStrategy: draft.sendStrategy || undefined,
              sendStrategyLabel: draft.sendStrategyLabel || undefined,
              recipient: draft.recipient || undefined,
              recipientName: draft.recipientName || undefined,
              latestSender: draft.latestSender || undefined,
              warning: draft.warning || undefined,
              evidence: draft.evidence,
              threadPreview: draft.threadPreview || undefined,
            },
            feedback: {
              surface: "fix_suggestions",
            },
          });
        }}
      />
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.16),transparent_32%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-4 shadow-sm sm:p-5">
          <div className="absolute -right-16 -top-24 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                <Sparkles className="h-3 w-3" />
                Premium action command center
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Daily Action Queue
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Career-coach next actions based on your Gmail context: interview prep, recruiter replies, and follow-up windows.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Active", stats.active],
                ["High priority", stats.highPriority],
                ["To clear", `${stats.totalMinutes || 0}m`],
                ["Hidden", stats.snoozed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-background/75 px-3 py-2.5 shadow-sm backdrop-blur">
                  <p className="text-xl font-bold leading-none text-foreground">{value}</p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="h-4 w-4 text-accent" />
                Focus the queue
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                Inbox actions are time-sensitive Gmail moves. All actions includes resume, Apply Gate, cleanup, and stale-role work.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(["inbox", "all"] as QueueView[]).map((value) => (
                  <Button
                    key={value}
                    variant={queueView === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setQueueView(value);
                      setSourceFilter("all");
                    }}
                  >
                    {value === "inbox" ? `Inbox actions (${daqInboxSuggestions.length})` : `All actions (${combinedSuggestions.length})`}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "high", "medium", "low"] as UrgencyFilter[]).map((value) => (
                  <Button
                    key={value}
                    variant={urgencyFilter === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUrgencyFilter(value)}
                  >
                    {value === "all" ? "All urgency" : value}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {sourceFilterOptions.map((value) => {
              const count = value === "all" ? urgencyFilteredSuggestionPool.length : sourceCounts[value];
              const active = effectiveSourceFilter === value;

              return (
                <button
                  key={value}
                  type="button"
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-all ${
                    active
                      ? "border-accent/50 bg-accent/10 shadow-sm"
                      : "border-border/70 bg-background/60 hover:border-accent/30 hover:bg-accent/5"
                  }`}
                  onClick={() => setSourceFilter(value)}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {queueView === "inbox" && value === "all" ? "Inbox due now" : sourceFilterLabels[value]}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {count}
                  </span>
                  {value === "followup" && upcomingFollowupWindows.length > 0 ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                      {upcomingFollowupWindows.length} upcoming
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {displayEntries.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  {effectiveSourceFilter === "followup" && followupSuppressionReason === "dev_bypass_auth"
                    ? "Outreach is suppressed in local bypass mode"
                    : effectiveSourceFilter === "followup" && upcomingFollowupWindows.length > 0
                    ? hasDueFollowupWindow
                      ? "Outreach window detected"
                      : "No outreach is due yet"
                    : "No active actions"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {effectiveSourceFilter === "followup" && followupSuppressionReason === "dev_bypass_auth"
                    ? followupQuery.data?.meta?.message || "The backend returned no outreach cards because this session is using local bypass auth."
                    : effectiveSourceFilter === "followup" && upcomingFollowupWindows.length > 0
                    ? hasDueFollowupWindow
                      ? "The stored email timing says an outreach window is open, but no active card is visible. It may be hidden, snoozed, completed, or waiting on the latest sync."
                      : "Your applications are between action windows. Nothing is broken; the queue is waiting until a follow-up would help instead of adding noise."
                    : emptyMessage}
                </p>
                {effectiveSourceFilter === "followup" && upcomingFollowupWindows.length > 0 ? (
                  <div className="mt-5">
                    <UpcomingFollowupWindowList windows={upcomingFollowupWindows} />
                  </div>
                ) : null}
              </div>
            ) : (
              displayEntries.map((entry, index) => {
                if (entry.type === "stale_group") {
                  return (
                    <article
                      key={entry.key}
                      className={`relative overflow-visible rounded-2xl border bg-gradient-to-br p-0 shadow-sm animate-fade-in ${sourceAccentClasses.stale}`}
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${sourceRailClasses.stale}`} />
                      <div className="space-y-3 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyClasses.low}`}>
                            LOW
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sourceClasses.stale}`}>
                            Ghosting
                          </span>
                          <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground">
                            Batch close-out
                          </span>
                          <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {entry.items.length} roles
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            Review {entry.items.length} stale roles in one pass
                          </h3>
                          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                            These low-urgency roles are all in close-out territory. Review them once, send a final note only if a role still matters, and close the rest without letting them consume the whole queue.
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-warning" />
                            <p className="text-sm font-semibold text-foreground">Batch close-out lane</p>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            This group replaces repeated low-urgency stale cards so you can clear aging applications without scrolling through identical layouts.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {entry.items.map((item) => {
                            const mutationBusy = Boolean(item.logicalKey && pendingLogicalKeys[item.logicalKey]);
                            const { gmailUrl, draft, draftOpen, draftTone, canDraft } = getDraftUiForItem(item);

                            return (
                              <div key={item.id} className="rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      {item.company ? (
                                        <span className="rounded-full bg-muted px-2 py-1">{item.company}</span>
                                      ) : null}
                                      <span className="rounded-full bg-muted px-2 py-1">{formatRelativeAge(item.daysAgo)}</span>
                                      <span className="rounded-full bg-muted px-2 py-1">{item.estimatedTime}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {canDraft ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={draftMutation.isPending}
                                        onClick={() => toggleDraftForItem(item, draftTone)}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                        {draftOpen ? "Hide copilot" : draft ? "Show copilot" : "Generate draft"}
                                      </Button>
                                    ) : null}
                                    {gmailUrl ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(gmailUrl, "_blank", "noopener,noreferrer")}
                                      >
                                        <ArrowUpRight className="h-4 w-4" />
                                        Open Gmail
                                      </Button>
                                    ) : null}
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={mutationBusy}
                                      onClick={() => void closeQueueItem(item)}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Close
                                    </Button>
                                  </div>
                                </div>

                                {canDraft && draftOpen ? <div className="mt-4">{renderDraftPanel(item)}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  );
                }

                const item = entry.item;
                const mutationBusy = Boolean(item.logicalKey && pendingLogicalKeys[item.logicalKey]);
                const inlineCleanupTask = isInlineCleanupIntent(item.intent);
                const inlineOpen = expandedInlineTaskId === item.id;
                const {
                  gmailUrl,
                  draftKey,
                  draft,
                  draftOpen,
                  availableDraftToneOptions,
                  draftTone,
                  draftToneMeta,
                  canDraft,
                } = getDraftUiForItem(item);
                const showRouteAction = Boolean(item.routeHref && item.routeHref !== "/fix-suggestions");
                const canCloseFromCard =
                  isCloseIntent(item.intent) && Boolean(item.applicationId || item.emailId);
                const actionMenuOpen = openActionMenuId === item.id;
                const primaryActionKind = getPrimaryActionKind({
                  inlineCleanupTask,
                  canCloseFromCard,
                  canDraft,
                  gmailUrl,
                  showRouteAction,
                  item,
                });
                const primaryActionLabel = getPrimaryActionLabel(primaryActionKind, item, draft, inlineOpen, draftOpen);
                const primaryActionHelper = getPrimaryActionHelper(primaryActionKind, item);
                const canMarkHandledFromCard =
                  isGmailHandledCandidate(item) && Boolean(item.logicalKey) && primaryActionKind !== "complete";
                const primaryActionDisabled =
                  primaryActionKind === "draft"
                    ? draftMutation.isPending
                    : primaryActionKind === "close" || primaryActionKind === "complete"
                      ? mutationBusy
                      : false;
                const hasSecondaryContextActions =
                  (canCloseFromCard && primaryActionKind !== "close")
                  || (canDraft && primaryActionKind !== "draft")
                  || Boolean(gmailUrl && primaryActionKind !== "gmail")
                  || Boolean(showRouteAction && primaryActionKind !== "route");
                const runDraftAction = () => toggleDraftForItem(item, draftTone);
                const runCompleteAction = (message?: string) => {
                  void completeQueueItem(item, message);
                };
                const runHandledAction = () => runCompleteAction("Removed from today's queue.");
                const runPrimaryAction = () => {
                  setOpenActionMenuId("");
                  if (primaryActionKind === "cleanup") {
                    setExpandedInlineTaskId((current) => (current === item.id ? "" : item.id));
                  } else if (primaryActionKind === "close") {
                    void closeQueueItem(item);
                  } else if (primaryActionKind === "draft") {
                    runDraftAction();
                  } else if (primaryActionKind === "gmail" && gmailUrl) {
                    window.open(gmailUrl, "_blank", "noopener,noreferrer");
                  } else if (primaryActionKind === "route") {
                    navigate(item.routeHref || "/");
                  } else if (primaryActionKind === "complete") {
                    runCompleteAction(
                      isGmailHandledCandidate(item) ? "Removed from today's queue." : undefined,
                    );
                  }
                };

                return (
                  <article
                    key={item.id}
                    className={`relative overflow-visible rounded-2xl border bg-gradient-to-br p-0 shadow-sm animate-fade-in ${sourceAccentClasses[item.source]}`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${sourceRailClasses[item.source]}`} />
                    <div className="p-4 sm:p-5">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="min-w-0 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyClasses[item.urgency]}`}>
                              {item.urgency.toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sourceClasses[item.source]}`}>
                              {item.sourceLabel}
                            </span>
                            {item.stageLabel ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground">
                                {item.stageLabel}
                              </span>
                            ) : null}
                            {item.intentLabel || item.actionType ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {item.intentLabel || (item.actionType ? actionTypeLabels[item.actionType] || item.actionType : "")}
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </p>
                            {item.status === "blocked" && (item.blockingReason || item.blockerTitles?.length) ? (
                              <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-warning">Blocked by</p>
                                <p className="mt-1 text-sm text-warning">
                                  {item.blockerTitles?.length
                                    ? item.blockerTitles.join(", ")
                                    : item.blockingReason || "A prerequisite action is still open."}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            {item.company ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1">
                                <Mail className="h-4 w-4" />
                                {item.company}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1">
                              <Clock3 className="h-4 w-4" />
                              {formatRelativeAge(item.daysAgo)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1">
                              <AlarmClock className="h-4 w-4" />
                              {item.estimatedTime}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">Why now</p>
                                {item.actionConfidence ? (
                                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {item.actionConfidence} confidence
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1.5 text-sm leading-6 text-foreground">
                                {item.whyNow || item.sourceDescription}
                              </p>
                              {item.source === "followup" ? (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  Already handled this in Gmail? Use <span className="font-medium text-foreground">Already handled</span> so it leaves your active queue.
                                </p>
                              ) : null}
                            </div>

                            <SourceCheckSection item={item} />

                            <CollapsibleQueueSection
                              title="How to handle it"
                              preview={item.playbook[0] || item.sourceDescription}
                              badge={item.sourceDescription}
                            >
                              <ol className="space-y-2 text-sm text-muted-foreground">
                                {item.playbook.map((tip, tipIndex) => (
                                  <li key={tip} className="flex gap-3">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                                      {tipIndex + 1}
                                    </span>
                                    <span className="leading-6">{tip}</span>
                                  </li>
                                ))}
                              </ol>
                            </CollapsibleQueueSection>
                          </div>
                        </div>

                        <aside className="rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm xl:sticky xl:top-4 xl:self-start">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best next move</p>
                              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{primaryActionHelper}</p>
                            </div>
                            <div className="relative">
                              <Button
                                variant={actionMenuOpen ? "secondary" : "ghost"}
                                size="icon-sm"
                                onClick={() => setOpenActionMenuId((current) => (current === item.id ? "" : item.id))}
                                aria-label="More actions"
                                aria-expanded={actionMenuOpen}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>

                              {actionMenuOpen ? (
                                <div className="absolute right-0 z-30 mt-2 w-[min(82vw,290px)] overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                                  <div className="border-b border-border/70 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Secondary actions
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Snooze, clear handled work, or jump to the source context.
                                    </p>
                                  </div>

                                  {hasSecondaryContextActions ? (
                                    <div className="p-2">
                                      {canCloseFromCard && primaryActionKind !== "close" ? (
                                        <button
                                          type="button"
                                          className={destructiveActionMenuItemClass}
                                          disabled={mutationBusy}
                                          onClick={() => {
                                            setOpenActionMenuId("");
                                            void closeQueueItem(item);
                                          }}
                                        >
                                          <XCircle className="h-4 w-4" />
                                          Close application
                                        </button>
                                      ) : null}
                                      {canDraft && primaryActionKind !== "draft" ? (
                                        <button
                                          type="button"
                                          className={actionMenuItemClass}
                                          disabled={draftMutation.isPending}
                                          onClick={() => {
                                            setOpenActionMenuId("");
                                            runDraftAction();
                                          }}
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                          {draft ? "Show copilot" : "Generate draft"}
                                        </button>
                                      ) : null}
                                      {gmailUrl && primaryActionKind !== "gmail" ? (
                                        <button
                                          type="button"
                                          className={actionMenuItemClass}
                                          onClick={() => {
                                            setOpenActionMenuId("");
                                            window.open(gmailUrl, "_blank", "noopener,noreferrer");
                                          }}
                                        >
                                          <ArrowUpRight className="h-4 w-4" />
                                          Open Gmail
                                        </button>
                                      ) : null}
                                      {showRouteAction && primaryActionKind !== "route" ? (
                                        <button
                                          type="button"
                                          className={actionMenuItemClass}
                                          onClick={() => {
                                            setOpenActionMenuId("");
                                            navigate(item.routeHref || "/");
                                          }}
                                        >
                                          <ArrowUpRight className="h-4 w-4" />
                                          {item.routeLabel || "Open"}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {item.logicalKey && item.dedupeKey ? (
                                    <div className={`${hasSecondaryContextActions ? "border-t border-border/70" : ""} p-2`}>
                                      <button
                                        type="button"
                                        className={actionMenuItemClass}
                                        disabled={mutationBusy}
                                        onClick={() => {
                                          setOpenActionMenuId("");
                                          void dismissQueueItem(item);
                                        }}
                                      >
                                        <PauseCircle className="h-4 w-4" />
                                        Snooze 1 day
                                      </button>
                                      {primaryActionKind !== "complete" ? (
                                        <button
                                          type="button"
                                          className={actionMenuItemClass}
                                          disabled={mutationBusy}
                                          onClick={() => {
                                            setOpenActionMenuId("");
                                            runCompleteAction(
                                              isGmailHandledCandidate(item) ? "Removed from today's queue." : undefined,
                                            );
                                          }}
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          {isGmailHandledCandidate(item) ? "Already handled" : "Mark done"}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            className="mt-3 w-full"
                            variant={primaryActionKind === "close" ? "destructive" : inlineOpen && primaryActionKind === "cleanup" ? "secondary" : "default"}
                            disabled={primaryActionDisabled}
                            onClick={runPrimaryAction}
                          >
                            {primaryActionKind === "close" ? (
                              <XCircle className="h-4 w-4" />
                            ) : primaryActionKind === "draft" ? (
                              <MessageSquare className="h-4 w-4" />
                            ) : primaryActionKind === "gmail" || primaryActionKind === "route" ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : primaryActionKind === "complete" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <CheckSquare className="h-4 w-4" />
                            )}
                            {primaryActionLabel}
                          </Button>

                          {canMarkHandledFromCard ? (
                            <Button
                              className="mt-2 w-full"
                              variant="outline"
                              disabled={mutationBusy}
                              onClick={runHandledAction}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Already handled
                            </Button>
                          ) : null}

                          <div className="mt-3 flex items-center gap-2 rounded-full bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Based on your source, never auto-sent
                          </div>
                        </aside>
                      </div>

                    {canDraft && draftOpen ? <div className="mt-4">{renderDraftPanel(item)}</div> : null}

                    {inlineCleanupTask && inlineOpen ? (
                      <CleanupTaskInlinePanel
                        task={item}
                        storedEmails={storedEmails}
                        onRefresh={() => invalidateSuggestionQueries(queryClient)}
                      />
                    ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Today's operating order</h2>
              </div>
              <div className="mt-3 space-y-2">
                {(queueView === "inbox"
                  ? [
                      ["1", "Handle urgent inbox moves", `${daqStats.highPriority} high-priority Gmail-grounded action(s).`],
                      ["2", "Act from the conversation", "Open Gmail before drafting, replying, or preparing."],
                      ["3", "Check the broader backlog", `${Math.max(combinedSuggestions.length - daqInboxSuggestions.length, 0)} non-inbox action(s) live under all actions.`],
                    ]
                  : [
                      ["1", "Clear blockers", `${sourceCounts.cleanup} cleanup task(s) that affect downstream accuracy.`],
                      ["2", "Handle ambiguity", `${sourceCounts.stale} role(s) need a check-in or close-out.`],
                      ["3", "Improve conversion", `${sourceCounts.followup + sourceCounts.apply_gate + sourceCounts.resume} fit, resume, or outreach action(s).`],
                    ]).map(([step, title, body]) => (
                  <div key={step} className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Upcoming outreach</h2>
              </div>
              {upcomingFollowupWindows.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  No upcoming outreach windows from your current applications.
                </p>
              ) : (
                <div className="mt-4">
                  <UpcomingFollowupWindowList windows={upcomingFollowupWindows.slice(0, 3)} compact />
                </div>
              )}
            </div>

          </aside>
        </div>

        <details className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Queue details</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Older, hidden, and completed actions live here so the main queue stays focused.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>

          <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-background/70 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Outreach diagnostics</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {outreachDiagnostics.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 bg-card/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {item.count}
                        </span>
                      </div>
                      {item.examples.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.examples.map((example) => (
                            <span key={example} className="rounded-full bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground">
                              {example}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/70 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Hidden right now</h2>
                </div>
                {queueQuery.isLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading action state...</p>
                ) : snoozedItems.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    No snoozed suggestions. Anything you snooze will come back here with its return time.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {snoozedItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/70 bg-card/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Resurfaces {formatSnoozedUntil(rankedQueue?.dismissed?.find((entry) => entry.dedupeKey === item.dedupeKey)?.dismissedUntil || null) || "later"}
                            </p>
                          </div>
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            Hidden
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-background/70 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Reliability rules</h2>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>Actions need clear source context, a why-now reason, and evidence before they appear.</p>
                  <p>Follow-up outcome analytics stay scoped to email suggestions, so cleanup and Apply Gate actions do not pollute response-rate comparisons.</p>
                </div>
                <div className="mt-4 rounded-2xl bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stats.completed}</p>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
};

export default FixSuggestions;
