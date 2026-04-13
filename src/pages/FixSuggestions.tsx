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
import { useAuth } from "@/lib/AuthContext.jsx";
import {
  closeApplication,
  completeSuggestionAction,
  fetchApplyGateHistory,
  fetchFollowupSuggestions,
  fetchStoredEmails,
  fetchSuggestionActionStates,
  generateSuggestionDraft,
  recordSuggestionImpressions,
  recordSuggestionDraftFeedback,
  type ApplyGateHistoryItem,
  type FollowupSuggestion,
  type StoredEmail,
  type SuggestionDraft,
  type SuggestionDraftFeedbackLabel,
  type SuggestionDraftTone,
  type SuggestionActionState,
  snoozeSuggestionAction,
  undoSuggestionAction,
} from "@/lib/emails";
import {
  actionTypeLabels,
  buildActionKey,
  buildCombinedSuggestionQueue,
  buildGmailThreadUrl,
  buildOutreachDiagnostics,
  buildSnoozedSuggestionItems,
  buildSuggestionImpressionPayload,
  buildSuggestionQueueStats,
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
  followup: "Outreach",
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

function isCloseAction(actionType?: string | null) {
  return actionType === "close_stale_application" || actionType === "close_stale_interview";
}

function getCleanupPrimaryLabel(actionType?: string | null, inlineOpen = false) {
  if (inlineOpen) return "Hide repair panel";
  if (actionType === "cleanup_application_links") return "Link applications";
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
  if (params.canCloseFromCard && isCloseAction(params.item.actionType)) return "close";
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
  if (kind === "cleanup") return getCleanupPrimaryLabel(item.actionType, inlineOpen);
  if (kind === "close") return "Close application";
  if (kind === "draft") return draftOpen ? "Hide copilot" : draft ? "Show copilot" : "Generate draft";
  if (kind === "gmail") return "Open Gmail thread";
  if (kind === "route") return item.routeLabel || "Open workspace";
  if (kind === "complete") return "Mark done";
  return "Review action";
}

function getPrimaryActionHelper(kind: PrimaryActionKind, item: QueueItem) {
  if (kind === "cleanup") {
    return item.actionType === "cleanup_application_links"
      ? "Repair application links before trusting pipeline metrics."
      : "Fix extracted company and role fields so recommendations stop drifting.";
  }
  if (kind === "close") return "Stop letting a stale opportunity consume active search attention.";
  if (kind === "draft") return "Create a grounded message from the tracked thread before you send anything.";
  if (kind === "gmail") return "Open the source thread and act from the original context.";
  if (kind === "route") return "Jump into the workspace that can resolve this recommendation.";
  if (kind === "complete") return "Use this when the action is already handled outside Applendium.";
  return item.sourceDescription;
}

function buildDisplayQueueEntries(queue: QueueItem[]): DisplayQueueEntry[] {
  const groupedStaleCloseouts = queue.filter(
    (item) => item.source === "stale" && item.urgency === "low" && isCloseAction(item.actionType),
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
    description: "Short version for threads that already carry enough context.",
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

function getDraftToneOptionsForAction(actionType?: string | null): DraftToneOption[] {
  switch (actionType) {
    case "thank_you":
      return draftToneOptions.filter((option) => ["post_interview", "warm", "concise"].includes(option.value));
    case "networking":
      return draftToneOptions.filter((option) => ["referral", "warm", "concise"].includes(option.value));
    case "status_check":
      return draftToneOptions.filter((option) => ["direct", "warm", "concise"].includes(option.value));
    case "stale_interview_status_check":
      return draftToneOptions.filter((option) =>
        ["post_interview", "recruiter_went_cold", "direct", "concise"].includes(option.value),
      );
    case "stale_application_status_check":
    case "close_stale_application":
    case "close_stale_interview":
      return draftToneOptions.filter((option) =>
        ["recruiter_went_cold", "direct", "concise"].includes(option.value),
      );
    case "follow_up":
    default:
      return draftToneOptions.filter((option) => ["warm", "concise", "direct"].includes(option.value));
  }
}

function getDraftToneMeta(tone?: SuggestionDraftTone | string | null) {
  return tone ? draftToneOptionByValue.get(tone as SuggestionDraftTone) || null : null;
}

function defaultDraftTone(actionType?: string | null): SuggestionDraftTone {
  if (actionType === "thank_you" || actionType === "stale_interview_status_check") return "post_interview";
  if (actionType === "networking") return "referral";
  if (
    actionType === "close_stale_application"
    || actionType === "close_stale_interview"
    || actionType === "stale_application_status_check"
  ) {
    return "recruiter_went_cold";
  }
  if (actionType === "status_check") return "direct";
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
                  Open Gmail thread
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
                  Latest sender in reply thread: {draft.latestSender}
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
    queryClient.invalidateQueries({ queryKey: ["followup-suggestions"] }),
    queryClient.invalidateQueries({ queryKey: ["strategy-alerts", "followup"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "followup"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "states"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "apply-gate"] }),
    queryClient.invalidateQueries({ queryKey: ["fix-suggestions", "stored-emails"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard", "followup-suggestions"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard", "suggestion-states"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard", "apply-gate-history"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stored-emails"] }),
  ]);
}

const FixSuggestions = () => {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedInlineTaskId, setExpandedInlineTaskId] = useState<string>("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string>("");
  const [openDraftTaskId, setOpenDraftTaskId] = useState<string>("");
  const [draftToneByTaskId, setDraftToneByTaskId] = useState<Record<string, SuggestionDraftTone>>({});
  const [draftByTaskId, setDraftByTaskId] = useState<Record<string, SuggestionDraft>>({});
  const [draftFeedbackByTaskId, setDraftFeedbackByTaskId] = useState<Record<string, SuggestionDraftFeedbackLabel>>({});

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

  const closeApplicationMutation = useMutation({
    mutationFn: async (item: QueueItem) => {
      await closeApplication({
        applicationId: item.applicationId ?? null,
        emailId: item.emailId ?? null,
        reason: `Closed from Daily Action Queue ghosting signal: ${item.title}`,
      });

      if (item.threadId && item.actionType) {
        await completeSuggestionAction({
          threadId: item.threadId,
          actionType: item.actionType,
          emailId: item.emailId ?? null,
          applicationId: item.applicationId ?? null,
          suggestionSource: item.suggestionSource || item.source,
        });
      }
    },
    onSuccess: async () => {
      await invalidateSuggestionQueries(queryClient);
      toast.success("Application closed and removed from active focus.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to close application.");
    },
  });

  const activeFollowupSuggestions = (followupQuery.data?.suggestions || []) as FollowupSuggestion[];
  const actionStates = (statesQuery.data?.actions || []) as SuggestionActionState[];
  const applyGateHistory = (applyGateQuery.data?.history || []) as ApplyGateHistoryItem[];
  const storedEmails = (storedEmailsQuery.data?.emails || []) as StoredEmail[];

  const combinedSuggestions = useMemo(() => {
    return buildCombinedSuggestionQueue({
      followupSuggestions: activeFollowupSuggestions,
      applyGateHistory,
      storedEmails,
      actionStates,
    });
  }, [actionStates, activeFollowupSuggestions, applyGateHistory, storedEmails]);

  const filteredSuggestions = useMemo(() => {
    return combinedSuggestions.filter((item) => {
      const urgencyMatch = urgencyFilter === "all" || item.urgency === urgencyFilter;
      const sourceMatch = sourceFilter === "all" || item.source === sourceFilter;
      return urgencyMatch && sourceMatch;
    });
  }, [combinedSuggestions, sourceFilter, urgencyFilter]);

  const stats = useMemo(
    () => buildSuggestionQueueStats(combinedSuggestions, actionStates),
    [actionStates, combinedSuggestions],
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
    return combinedSuggestions.reduce<Record<QueueSource, number>>(
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
  }, [combinedSuggestions]);

  const snoozedItems = useMemo(() => buildSnoozedSuggestionItems(actionStates), [actionStates]);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading your action queue...";
    if (!isAuthed) return "Sign in to see next-best actions.";
    if ((followupQuery.data as { error?: string } | undefined)?.error?.includes("Premium feature required")) {
      return "Upgrade to Premium to unlock the daily action queue.";
    }
    if (followupQuery.isLoading || applyGateQuery.isLoading || storedEmailsQuery.isLoading) {
      return "Building your action queue...";
    }
    if (combinedSuggestions.length === 0) return "No active next-best actions right now.";
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

    const impressionPayload = buildSuggestionImpressionPayload(combinedSuggestions);

    if (impressionPayload.length === 0) return;

    recordSuggestionImpressions({ suggestions: impressionPayload }).catch(() => undefined);
  }, [combinedSuggestions, isAuthed]);

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
    const availableDraftToneOptions = getDraftToneOptionsForAction(item.actionType);
    const preferredDraftTone = (draftToneByTaskId[draftKey] || defaultDraftTone(item.actionType)) as SuggestionDraftTone;
    const draftTone = availableDraftToneOptions.some((option) => option.value === preferredDraftTone)
      ? preferredDraftTone
      : availableDraftToneOptions[0]?.value || defaultDraftTone(item.actionType);
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
                One prioritized job-search queue grounded in Gmail timing, application state, Apply Gate signals, and cleanup blockers.
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
                Pick a lane when you need focus. Leave it on all when clearing the day.
              </p>
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

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(["all", "followup", "stale", "apply_gate", "resume", "cleanup"] as SourceFilter[]).map((value) => {
              const count = value === "all" ? combinedSuggestions.length : sourceCounts[value];
              const active = sourceFilter === value;

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
                  <span className="text-sm font-semibold text-foreground">{sourceFilterLabels[value]}</span>
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
                  {sourceFilter === "followup" && followupSuppressionReason === "dev_bypass_auth"
                    ? "Outreach is suppressed in local bypass mode"
                    : sourceFilter === "followup" && upcomingFollowupWindows.length > 0
                    ? hasDueFollowupWindow
                      ? "Outreach window detected"
                      : "No outreach is due yet"
                    : "No active actions"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {sourceFilter === "followup" && followupSuppressionReason === "dev_bypass_auth"
                    ? followupQuery.data?.meta?.message || "The backend returned no outreach cards because this session is using local bypass auth."
                    : sourceFilter === "followup" && upcomingFollowupWindows.length > 0
                    ? hasDueFollowupWindow
                      ? "The stored email timing says an outreach window is open, but no active card is visible. It may be hidden, snoozed, completed, or waiting on the latest sync."
                      : "Your tracked applications are between action windows. Nothing is broken; the queue is waiting until a follow-up would be useful instead of noisy."
                    : emptyMessage}
                </p>
                {sourceFilter === "followup" && upcomingFollowupWindows.length > 0 ? (
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
                            Ghosting signal
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
                            These low-urgency ghosting signals are all in close-out territory. Review them once, send a final note only if a role still matters, and close the rest without letting them consume the whole queue.
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
                            const mutationBusy =
                              completeMutation.isPending
                              || snoozeMutation.isPending
                              || undoMutation.isPending
                              || closeApplicationMutation.isPending;
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
                                      onClick={() => closeApplicationMutation.mutate(item)}
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
                const mutationBusy =
                  completeMutation.isPending
                  || snoozeMutation.isPending
                  || undoMutation.isPending
                  || closeApplicationMutation.isPending;
                const inlineCleanupTask =
                  item.actionType === "cleanup_structured_fields"
                  || item.actionType === "cleanup_application_links";
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
                const canCloseFromCard = item.source === "stale" && Boolean(item.applicationId || item.emailId);
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
                const runCompleteAction = () => completeMutation.mutate({
                  threadId: item.threadId || "",
                  actionType: item.actionType || "",
                  emailId: item.emailId ?? null,
                  applicationId: item.applicationId ?? null,
                  suggestionSource: item.suggestionSource || item.source,
                });
                const runPrimaryAction = () => {
                  setOpenActionMenuId("");
                  if (primaryActionKind === "cleanup") {
                    setExpandedInlineTaskId((current) => (current === item.id ? "" : item.id));
                  } else if (primaryActionKind === "close") {
                    closeApplicationMutation.mutate(item);
                  } else if (primaryActionKind === "draft") {
                    runDraftAction();
                  } else if (primaryActionKind === "gmail" && gmailUrl) {
                    window.open(gmailUrl, "_blank", "noopener,noreferrer");
                  } else if (primaryActionKind === "route") {
                    navigate(item.routeHref || "/");
                  } else if (primaryActionKind === "complete") {
                    runCompleteAction();
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
                            {item.actionType ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {actionTypeLabels[item.actionType] || item.actionType}
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </p>
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
                            </div>

                            <CollapsibleQueueSection
                              title="Evidence"
                              preview={item.evidence?.[0] || "Grounded by the latest tracked signal."}
                              badge={
                                item.evidence?.length
                                  ? `${Math.min(item.evidence.length, 3)} signal${item.evidence.length === 1 ? "" : "s"}`
                                  : null
                              }
                            >
                              {item.evidence?.length ? (
                                <div className="space-y-2">
                                  {item.evidence.slice(0, 3).map((entry) => (
                                    <p
                                      key={entry}
                                      className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-sm leading-6 text-muted-foreground"
                                      title={entry}
                                    >
                                      {entry}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                  <p className="text-sm text-muted-foreground">Grounded by the latest tracked signal.</p>
                                </div>
                              )}
                            </CollapsibleQueueSection>

                            <CollapsibleQueueSection
                              title="Recommended steps"
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
                                      Snooze, mark done, or jump to the source context.
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
                                            closeApplicationMutation.mutate(item);
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
                                          Open Gmail thread
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

                                  {item.threadId && item.actionType ? (
                                    <div className={`${hasSecondaryContextActions ? "border-t border-border/70" : ""} p-2`}>
                                      <button
                                        type="button"
                                        className={actionMenuItemClass}
                                        disabled={mutationBusy}
                                        onClick={() => {
                                          setOpenActionMenuId("");
                                          snoozeMutation.mutate({
                                            threadId: item.threadId || "",
                                            actionType: item.actionType || "",
                                            snoozeDuration: 24,
                                            emailId: item.emailId ?? null,
                                            applicationId: item.applicationId ?? null,
                                            suggestionSource: item.suggestionSource || item.source,
                                          });
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
                                            runCompleteAction();
                                          }}
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          Mark done
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

                          <div className="mt-3 flex items-center gap-2 rounded-full bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Evidence-backed recommendation
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
                {[
                  ["1", "Clear blockers", `${sourceCounts.cleanup} cleanup task(s) that affect downstream accuracy.`],
                  ["2", "Handle ambiguity", `${sourceCounts.stale} ghosting signal(s) to close or follow up.`],
                  ["3", "Improve conversion", `${sourceCounts.followup + sourceCounts.apply_gate + sourceCounts.resume} fit, resume, or outreach action(s).`],
                ].map(([step, title, body]) => (
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
                  No upcoming outreach windows from the currently tracked applications.
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
                Diagnostics, reliability rules, and hidden-state management live here instead of the main queue.
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
                {statesQuery.isLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading action state...</p>
                ) : snoozedItems.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    No snoozed suggestions. Anything you snooze will come back here with its return time.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {snoozedItems.map((item) => (
                      <div key={`${item.thread_id}:${item.action_type}`} className="rounded-2xl border border-border/70 bg-card/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {actionTypeLabels[item.action_type] || item.action_type}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
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

            <div className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-background/70 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">Reliability rules</h2>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>Actions need a source signal, a why-now reason, and evidence before they appear.</p>
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
