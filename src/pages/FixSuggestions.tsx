import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ArrowUpRight,
  Check,
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
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/DashboardLayout";
import { CleanupTaskInlinePanel } from "@/components/CleanupTaskInlinePanel";
import { ActionCtaButton, ActionIcon, actionVisual } from "@/components/premium/ActionPieces";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  SectionLabel,
  ToneChip,
} from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES } from "@/components/premium/tone";
import { describeActionIdentity, describeActionKind, resolveActionCta } from "@/lib/actionPresentation";
import { cn } from "@/lib/utils";
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
  buildDashboardMoveQueue,
  buildQueueItemsFromRankedQueue,
  buildRankedQueueStats,
  buildGmailThreadUrl,
  buildOutreachDiagnostics,
  buildUpcomingFollowupWindows,
  describeQueueCount,
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

// Compact, squared mono urgency pill matching the redesign queue rows.
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
  if (params.item.logicalKey || (params.item.threadId && params.item.actionType)) return "complete";
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
  return "";
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
  if (kind === "complete") {
    return isGmailHandledCandidate(item)
      ? "Use this when you already handled the action in Gmail."
      : "Mark this done after you handle it outside the queue.";
  }
  return "Review the details below before deciding what to do next.";
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
      recommendation ? { label: "Role-specific issue", value: recommendation } : null,
      nextStep ? { label: "Before applying", value: nextStep } : null,
    ].filter((row): row is { label: string; value: string } => Boolean(row));
  }

  if (item.source === "resume") {
    const proofGap = getReadableSourceValue(item.description, item.whyNow, item.playbook?.[0], item.sourceDescription);
    const nextStep = getReadableSourceValue(item.playbook?.[0], item.playbook?.[1], item.routeLabel);
    return [
      proofGap ? { label: "Repeated gap", value: proofGap } : null,
      nextStep ? { label: "Best resume fix", value: nextStep } : null,
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
  if (item.source === "apply_gate") return "Apply Gate context";
  if (item.source === "resume") return "Why this resume gap matters";
  if (item.source === "cleanup") return "Data to fix";
  return "Source check";
}

function getSourceCheckPurpose(item: QueueItem) {
  const actionType = normalizeActionType(item.actionType);

  if (item.source === "apply_gate") {
    return "This is tied to one role. Use it to confirm the specific blocker before you spend time applying.";
  }

  if (item.source === "resume") {
    return "This is not about one job. It is a pattern from roles you keep targeting, so one resume update can help across several applications.";
  }

  if (item.source === "cleanup") {
    return isInlineCleanupIntent(item.intent)
      ? "Fix the missing company or role right here in the card — no need to dig through the original email or the extension."
      : "Use this to fix missing company or role details so the queue stays accurate.";
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
  if (item.source === "apply_gate") return "Specific role";
  if (item.source === "resume") return "Across roles";
  if (item.source === "cleanup") return "Missing data";
  if (actionType === "prep_interview" || actionType === "prepare_interview") return "Interview source";
  if (isOutreachQueueItem(item)) return "Gmail conversation";
  return "Source context";
}

function getSourceCheckChecklist(item: QueueItem) {
  const actionType = normalizeActionType(item.actionType);

  if (item.source === "apply_gate") {
    return [
      "Open Apply Gate and confirm this exact role still looks worth the effort.",
      "Fix the strongest blocker before applying.",
      "If you already applied, mark this handled so it leaves the queue.",
    ];
  }

  if (item.source === "resume") {
    return [
      "Add proof that directly matches the repeated pattern.",
      "Move the strongest role-relevant bullet higher on the resume.",
      "Re-run Apply Gate after the resume update.",
    ];
  }

  if (item.source === "cleanup") {
    return isInlineCleanupIntent(item.intent)
      ? [
          "Open the repair panel below and correct the company and role in place.",
          "Hit Save and relink — it re-checks the application journey for you.",
          "No need to open the original email or hunt through the extension.",
        ]
      : [
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
  // Promote a "Role: …" evidence entry to its own structured row instead of
  // letting it land in the generic fallback list.
  const roleFromEvidence = parsed.other
    .map((value) => value.match(/^role:\s*(.+)$/i)?.[1]?.trim())
    .find((value): value is string => Boolean(value));
  const rows = decisionRows.length
    ? decisionRows
    : [
        parsed.subject ? { label: "Thread", value: parsed.subject } : null,
        parsed.sender ? { label: "Contact", value: parsed.sender } : null,
        item.company ? { label: "Company", value: item.company } : null,
        roleFromEvidence ? { label: "Role", value: roleFromEvidence } : null,
        parsed.timing ? { label: "Timing", value: parsed.timing } : null,
      ].filter((row): row is { label: string; value: string } => Boolean(row));
  // Fallback "Source detail" rows only fill genuinely empty space (e.g. strategy
  // cards whose evidence is the alert detail). Drop entries that merely echo a
  // structured row already shown ("Company: Hopper" when COMPANY is shown), and
  // strip the redundant "Label:" prefix from whatever remains.
  const shownValues = new Set(rows.map((row) => row.value.trim().toLowerCase()));
  const stripEvidenceLabel = (value: string) =>
    value.replace(/^(company|role|subject|sender|thread|contact)\s*:\s*/i, "").trim();
  const fallbackRows = decisionRows.length
    ? []
    : parsed.other
        .filter((value) => !looksLikeBrokenSerializedEvidence(value))
        .map((value) => stripEvidenceLabel(value))
        .filter((value) => Boolean(value) && !shownValues.has(value.toLowerCase()))
        .slice(0, Math.max(0, 3 - rows.length));
  const checklist = getSourceCheckChecklist(item);
  const fallbackLabel =
    item.source === "apply_gate"
      ? "Apply Gate note"
      : item.source === "resume"
      ? "Resume gap"
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

        {item.lastMessageSnippet ? (
          <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest message</p>
            <p className="mt-1 text-sm leading-5 text-foreground">“{item.lastMessageSnippet}”</p>
          </div>
        ) : null}

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
    <div className="rounded-2xl border border-primary/20 bg-accent/5 p-4 shadow-sm">
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How to send</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {draft.sendStrategyLabel || "Review recipient"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {draft.sendStrategyDescription || "Double-check who this goes to before you act."}
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Based on</p>
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
  // All actions, in the backend's ranked order. The old default was an inbox-only lane that hid
  // Apply Gate, résumé and close-out work behind a toggle.
  const [queueView, setQueueView] = useState<QueueView>("all");
  const [moreFilter, setMoreFilter] = useState<MoreFilter>("all");
  const [expandedDetailsId, setExpandedDetailsId] = useState<string>("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedInlineTaskId, setExpandedInlineTaskId] = useState<string>("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string>("");
  // A menu that only the trigger can close traps keyboard users and lingers over the list.
  useEffect(() => {
    if (!openActionMenuId) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpenActionMenuId("");
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-action-menu]")) setOpenActionMenuId("");
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [openActionMenuId]);
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
  // The same list the Dashboard counts: open, not blocked, one row per action. Blocked rows were
  // "Apply to X" waiting on "Tailor résumé for X", which is already its own row, so each role
  // appeared twice (founder's queue, 2026-09-25: 7 blocked rows, one role duplicated) and this page
  // said "22 more" where the Dashboard said "14 more". A blocked step appears once its blocker is done.
  const combinedSuggestions = useMemo(
    () => suppressAlreadyHandledGmailActions(
      buildDashboardMoveQueue(buildQueueItemsFromRankedQueue(rankedQueue)),
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

  // Repeat actions the backend capped. Suppressed once the user narrows by urgency or source: a
  // filter already explains a short list, and saying "more are waiting" there would credit the
  // coach for the user's own choice. The inbox/all lane toggle is not a filter in that sense —
  // these are held back in either lane — so it does not suppress the line.
  const showHeldBack = effectiveSourceFilter === "all" && urgencyFilter === "all";
  const heldBackGroups = showHeldBack ? rankedQueue?.heldBackSimilarActions || [] : [];
  const heldBackTotal = heldBackGroups.reduce((sum, group) => sum + group.count, 0);
  const heldBackHeadline = `${heldBackTotal} more ${heldBackTotal === 1 ? "action is" : "actions are"} waiting behind these.`;
  const heldBackBreakdown = heldBackGroups
    .map((group) => `${group.count} ${group.intentLabel.toLowerCase()}`)
    .join(", ");

  const allStats = useMemo(() => buildRankedQueueStats(rankedQueue), [rankedQueue]);
  const allVisibleStats = useMemo(() => buildQueueItemStats(combinedSuggestions, urgencyFilter), [combinedSuggestions, urgencyFilter]);
  const daqStats = useMemo(() => buildQueueItemStats(daqInboxSuggestions, urgencyFilter), [daqInboxSuggestions, urgencyFilter]);
  const stats = queueView === "inbox" ? daqStats : urgencyFilter === "all" ? allStats : allVisibleStats;
  // The whole queue, counted by the SAME function the Dashboard's "Next moves" badge uses, so the
  // two pages can never print different totals for it. buildRankedQueueStats also counts blocked
  // items and does not dedupe; it matched the Dashboard on 2026-09-24 only because this account had
  // nothing blocked and no duplicates.
  const queueTotal = useMemo(
    () => buildDashboardMoveQueue(buildQueueItemsFromRankedQueue(rankedQueue)).length,
    [rankedQueue],
  );

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
      return "No urgent inbox actions are due right now. Switch to all actions for Apply Gate, resume gaps, cleanup, and stale-role work.";
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
        // Mark the queue action done first. The complete endpoint re-derives the
        // queue to validate, so it must run before closeApplication removes the
        // underlying email from the open-tracked set.
        await completeQueueAction({
          logicalKey: item.logicalKey,
          dedupeKey: item.dedupeKey,
        });
        await closeApplication({
          applicationId: item.applicationId ?? null,
          emailId: item.emailId ?? null,
          // Lead with "No response" so the close is classified as a neutral
          // ghosting close-out, NOT a rejection (this queue only closes stale /
          // ghosted roles — see isCloseIntent). Counting employer silence as a
          // rejection inflated the rejection rate. See classifyManualCloseOutcome.
          reason: `No response - ghosted, closed from Next Actions: ${item.title}`,
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

  // ── Presentation ─────────────────────────────────────────────────────────────────────────
  // Founder review, 2026-09-25: "Today" is the three most useful actions; everything else is
  // under More. Every card names its application and carries the one button that fits the task.
  const todayItems = filteredSuggestions.slice(0, 3);
  // Held-back repeats are NOT in this list at all, so the note sits at its end rather than under
  // Today, where "11 more are waiting behind these" read as a third count of the same list.
  const heldBackNote = heldBackTotal > 0 ? (
    <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
      {heldBackTotal} similar {heldBackTotal === 1 ? "action is" : "actions are"} held back so this list does not
      repeat itself ({heldBackBreakdown}). As you clear one, the next takes its place.
    </p>
  ) : null;
  const moreItems = filteredSuggestions.slice(3);
  const moreFiltered = useMemo(
    () => (moreFilter === "all" ? moreItems : moreItems.filter((item) => moreFilterGroup(item) === moreFilter)),
    [moreFilter, moreItems],
  );
  const moreFilterCounts = useMemo(() => {
    const counts: Record<MoreFilter, number> = { all: moreItems.length, outreach: 0, interviews: 0, closeouts: 0, tools: 0, data: 0 };
    for (const item of moreItems) counts[moreFilterGroup(item)] += 1;
    return counts;
  }, [moreItems]);
  const moreEntries = useMemo(() => buildDisplayQueueEntries(moreFiltered), [moreFiltered]);

  // Deep links from the Dashboard (/next-actions#<id>) land on the card and open what the button
  // promised: the draft for a follow-up, the plan for interview prep.
  const location = useLocation();
  const [handledHash, setHandledHash] = useState("");
  useEffect(() => {
    const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id || id === handledHash || combinedSuggestions.length === 0) return;
    const target = combinedSuggestions.find((item) => item.id === id);
    if (!target) return;
    setHandledHash(id);
    const cta = resolveActionCta(target, getDraftUiForItem(target).gmailUrl);
    if (cta.kind === "draft") toggleDraftForItem(target, getDraftUiForItem(target).draftTone);
    else setExpandedDetailsId(id);
    window.requestAnimationFrame(() => {
      document.getElementById(`action-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, combinedSuggestions]);

  const queueError = (queueQuery.data as { error?: string } | undefined)?.error || null;

  const renderCard = (item: QueueItem, variant: "today" | "more") => {
    const mutationBusy = Boolean(item.logicalKey && pendingLogicalKeys[item.logicalKey]);
    const inlineOpen = expandedInlineTaskId === item.id;
    const { gmailUrl, draft, draftOpen, draftTone, canDraft } = getDraftUiForItem(item);
    const canCloseFromCard = isCloseIntent(item.intent) && Boolean(item.applicationId || item.emailId);
    let cta = resolveActionCta(item, gmailUrl);
    // A close-out with nothing to close, or a draft with nothing to draft from, falls back honestly.
    if ((cta.kind === "close" && !canCloseFromCard) || (cta.kind === "draft" && !canDraft)) {
      cta = gmailUrl ? { kind: "gmail", label: "Open in Gmail", href: gmailUrl } : { kind: "complete", label: "Mark done" };
    }
    const identity = describeActionIdentity(item);
    const { kind } = actionVisual(item);
    const detailsOpen = expandedDetailsId === item.id;
    const menuOpen = openActionMenuId === item.id;
    const reason = item.whyNow || item.sourceDescription || item.description || "";
    const isHandledInGmail = isGmailHandledCandidate(item);

    const runCta = () => {
      setOpenActionMenuId("");
      if (cta.kind === "draft") toggleDraftForItem(item, draftTone);
      else if (cta.kind === "prep") setExpandedDetailsId((current) => (current === item.id ? "" : item.id));
      else if (cta.kind === "close") void closeQueueItem(item);
      else if (cta.kind === "cleanup") setExpandedInlineTaskId((current) => (current === item.id ? "" : item.id));
      else if (cta.kind === "complete") void completeQueueItem(item, isHandledInGmail ? "Removed from today's list." : undefined);
    };

    const ctaLabel =
      cta.kind === "draft" && draftOpen ? "Hide draft"
        : cta.kind === "draft" && draft ? "Show draft"
          : cta.kind === "prep" && detailsOpen ? "Hide prep plan"
            : cta.kind === "cleanup" && inlineOpen ? "Hide repair"
              : cta.label;
    // One button look for every action. Close-out used to be red, which on the dark Today button was
    // red-on-ink (hard to read) and framed the recommended move for a long-quiet thread as a warning.
    const ctaClass = cn(variant === "today" ? BUTTON.primary : BUTTON.secondary, "shrink-0");
    const ctaDisabled = cta.kind === "draft" ? draftMutation.isPending : (cta.kind === "close" || cta.kind === "complete") ? mutationBusy : false;

    return (
      <article
        key={item.id}
        id={`action-${item.id}`}
        className={cn(
          "scroll-mt-24",
          variant === "today" ? cn(CARD, "px-5 py-4") : "px-1 py-3.5",
        )}
      >
        {/* On a phone the text takes the whole row and the buttons drop below it; side by side they
            squeezed the title into a ~60px column and overlapped it (390px walk, 2026-09-25). */}
        <div className="flex flex-wrap items-start gap-x-3.5 gap-y-3 sm:flex-nowrap">
          <ActionIcon item={item} />
          <div className="min-w-0 grow basis-[calc(100%-52px)] sm:basis-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={cn("font-semibold leading-snug tracking-[-0.01em] text-foreground", variant === "today" ? "text-[15px]" : "text-[14px]")}>
                {item.title}
              </h3>
              {item.urgency === "high" ? <ToneChip tone="attention">Do today</ToneChip> : null}
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              <span className="font-medium text-foreground/70">{kind}</span>
              {identity ? ` · ${identity}` : ""}
              {item.daysAgo != null ? ` · ${formatRelativeAge(item.daysAgo)}` : ""}
              {item.estimatedTime ? ` · ${item.estimatedTime}` : ""}
            </p>
            {reason && variant === "today" ? (
              <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-foreground/80">{reason}</p>
            ) : null}
          </div>
          <div className="ml-[50px] flex shrink-0 items-center gap-1 sm:ml-0">
            {cta.kind === "external" || cta.kind === "gmail" || cta.kind === "route" ? (
              <ActionCtaButton item={item} cta={cta} className={ctaClass} />
            ) : (
              <button type="button" onClick={runCta} disabled={ctaDisabled} className={ctaClass}>
                {ctaLabel}
              </button>
            )}
            {item.logicalKey && cta.kind !== "complete" ? (
              <button
                type="button"
                onClick={() => void completeQueueItem(item, isHandledInGmail ? "Removed from today's list." : undefined)}
                disabled={mutationBusy}
                className={cn(BUTTON.ghost, "px-2")}
                aria-label={isHandledInGmail ? "Already handled — remove from list" : "Mark done"}
                title={isHandledInGmail ? "Already handled" : "Mark done"}
              >
                <Check className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <div className="relative" data-action-menu>
              <button
                type="button"
                onClick={() => setOpenActionMenuId((current) => (current === item.id ? "" : item.id))}
                className={cn(BUTTON.ghost, "px-2")}
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg" role="menu">
                  <button type="button" role="menuitem" className={actionMenuItemClass} onClick={() => { setOpenActionMenuId(""); setExpandedDetailsId((c) => (c === item.id ? "" : item.id)); }}>
                    <FileSearch className="h-4 w-4" aria-hidden />
                    {detailsOpen ? "Hide details" : "Why this, and how"}
                  </button>
                  {gmailUrl && cta.kind !== "gmail" ? (
                    <a role="menuitem" className={actionMenuItemClass} href={gmailUrl} target="_blank" rel="noreferrer" onClick={() => setOpenActionMenuId("")}>
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                      Open in Gmail
                    </a>
                  ) : null}
                  {canDraft && cta.kind !== "draft" ? (
                    <button type="button" role="menuitem" className={actionMenuItemClass} disabled={draftMutation.isPending} onClick={() => { setOpenActionMenuId(""); toggleDraftForItem(item, draftTone); }}>
                      <MessageSquare className="h-4 w-4" aria-hidden />
                      {draft ? "Show draft" : "Draft an email"}
                    </button>
                  ) : null}
                  {item.logicalKey && item.dedupeKey ? (
                    <button type="button" role="menuitem" className={actionMenuItemClass} disabled={mutationBusy} onClick={() => { setOpenActionMenuId(""); void dismissQueueItem(item); }}>
                      <PauseCircle className="h-4 w-4" aria-hidden />
                      Snooze for a day
                    </button>
                  ) : null}
                  {canCloseFromCard && cta.kind !== "close" ? (
                    <button type="button" role="menuitem" className={destructiveActionMenuItemClass} disabled={mutationBusy} onClick={() => { setOpenActionMenuId(""); void closeQueueItem(item); }}>
                      <XCircle className="h-4 w-4" aria-hidden />
                      Close this application
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {detailsOpen ? (
          <div className={cn("mt-3 space-y-3", variant === "today" ? "pl-[50px]" : "pl-[50px]")}>
            {reason && variant === "more" ? <p className="text-[13px] leading-relaxed text-foreground/80">{reason}</p> : null}
            {item.description && item.description.trim().toLowerCase() !== reason.trim().toLowerCase() ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
            ) : null}
            {item.status === "blocked" && (item.blockingReason || item.blockerTitles?.length) ? (
              <div className="rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[13px] text-foreground/85">
                <span className="font-semibold">Waiting on: </span>
                {item.blockerTitles?.length ? item.blockerTitles.join(", ") : item.blockingReason}
              </div>
            ) : null}
            {item.playbook.length ? (
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                <p className={EYEBROW}>{cta.kind === "prep" ? "Your prep plan" : "How to handle it"}</p>
                <ol className="mt-2 space-y-2">
                  {item.playbook.map((tip, tipIndex) => (
                    <li key={tip} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground/85">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                        {tipIndex + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <SourceCheckSection item={item} />
          </div>
        ) : null}

        {canDraft && draftOpen ? <div className="mt-4">{renderDraftPanel(item)}</div> : null}
        {isInlineCleanupIntent(item.intent) && inlineOpen ? (
          <div className="mt-3">
            <CleanupTaskInlinePanel task={item} storedEmails={storedEmails} onRefresh={() => invalidateSuggestionQueries(queryClient)} />
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Ranked for today"
          title="Next Actions"
          description="What to do next in your search, most useful first. Each action opens the email, draft or tool it needs — nothing is ever sent for you."
          actions={
            !queueQuery.isLoading && filteredSuggestions.length > 0 ? (
              <span className="text-[12.5px] text-muted-foreground">
                {todayItems.length} for today{moreItems.length ? ` · ${moreItems.length} more` : ""}
              </span>
            ) : null
          }
        />

        <section aria-labelledby="today-heading" className="space-y-3">
          <SectionLabel>
            <span id="today-heading">Today</span>
          </SectionLabel>
          {queueQuery.isLoading ? (
            <div className={cn(CARD, "px-5 py-5")}>
              <LoadingRows rows={3} />
            </div>
          ) : queueError ? (
            <ErrorState title="Your actions did not load" detail={queueError} onRetry={() => void queueQuery.refetch()} />
          ) : todayItems.length === 0 ? (
            <div className={cn(CARD, "p-5")}>
              <EmptyState
                icon={CheckCircle2}
                title={rankedQueue?.emptyState?.title || "You're caught up"}
                body={
                  upcomingFollowupWindows.length > 0
                    ? "Nothing needs you today. The follow-ups below open soon."
                    : "New actions appear as replies, interviews and outcomes arrive in your inbox."
                }
              />
            </div>
          ) : (
            <div className="space-y-3">{todayItems.map((item) => renderCard(item, "today"))}</div>
          )}
          {/* Repeats held back on purpose. Without this line a short list reads as "it didn't find my
              other applications" — the more damaging reading of the same screen. */}
          {moreItems.length === 0 ? heldBackNote : null}
        </section>

        {moreItems.length > 0 ? (
          <Panel
            title="More"
            description="Worth doing this week, in order."
            meta={<span className="text-[12px] text-muted-foreground">{moreItems.length}</span>}
          >
            <div className="-mx-1 mb-1 flex flex-wrap gap-1.5" role="group" aria-label="Filter actions">
              {MORE_FILTERS.filter((option) => option.value === "all" || moreFilterCounts[option.value] > 0).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMoreFilter(option.value)}
                  aria-pressed={moreFilter === option.value}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                    moreFilter === option.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                >
                  {option.label}
                  <span className="ml-1.5 opacity-70">{moreFilterCounts[option.value]}</span>
                </button>
              ))}
            </div>
            <div className="divide-y divide-border">
              {moreEntries.map((entry) =>
                entry.type === "item" ? (
                  renderCard(entry.item, "more")
                ) : (
                  <details key={entry.key} className="group px-1 py-3.5">
                    <summary className="flex cursor-pointer list-none items-center gap-3.5 [&::-webkit-details-marker]:hidden">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES.done.icon)}>
                        <Layers3 className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-foreground">
                          Close out {entry.items.length} quiet applications
                        </span>
                        <span className="block text-[12.5px] text-muted-foreground">
                          No reply in a long time. Clear them in one pass so they stop crowding the list.
                        </span>
                      </span>
                      <span className={cn(BUTTON.secondary, "px-3 py-1.5 text-[12.5px]")}>
                        <span className="group-open:hidden">Review</span>
                        <span className="hidden group-open:inline">Hide</span>
                      </span>
                    </summary>
                    <div className="mt-2 divide-y divide-border pl-[50px]">
                      {entry.items.map((item) => renderCard(item, "more"))}
                    </div>
                  </details>
                ),
              )}
            </div>
            {heldBackNote ? <div className="mt-3 border-t border-border pt-3">{heldBackNote}</div> : null}
          </Panel>
        ) : null}

        {upcomingFollowupWindows.length > 0 ? (
          <Panel icon={Clock3} tone="upcoming" title="Coming up" description="Follow-ups that open in the next few days.">
            <UpcomingFollowupWindowList windows={upcomingFollowupWindows.slice(0, 5)} compact />
          </Panel>
        ) : null}

        {snoozedItems.length > 0 ? (
          <Panel icon={PauseCircle} tone="done" title="Snoozed" description="These come back on their own.">
            <ul className="divide-y divide-border">
              {snoozedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-foreground">{item.title}</p>
                    {describeActionIdentity(item) ? (
                      <p className="truncate text-[12px] text-muted-foreground">{describeActionIdentity(item)}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    Back {formatSnoozedUntil(rankedQueue?.dismissed?.find((entry) => entry.dedupeKey === item.dedupeKey)?.dismissedUntil || null) || "later"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

type MoreFilter = "all" | "outreach" | "interviews" | "closeouts" | "tools" | "data";

const MORE_FILTERS: Array<{ value: MoreFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "outreach", label: "Outreach" },
  { value: "interviews", label: "Interviews" },
  { value: "closeouts", label: "Close-outs" },
  { value: "tools", label: "Résumé & Apply Gate" },
  { value: "data", label: "Data fixes" },
];

function moreFilterGroup(item: QueueItem): Exclude<MoreFilter, "all"> {
  const kind = describeActionKind(item);
  if (kind === "Interview prep" || kind === "Assessment") return "interviews";
  if (kind === "Close-out") return "closeouts";
  if (kind === "Résumé" || kind === "Apply Gate") return "tools";
  if (kind === "Data fix") return "data";
  return "outreach";
}

export default FixSuggestions;
