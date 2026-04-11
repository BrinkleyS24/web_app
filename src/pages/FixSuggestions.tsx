import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Copy,
  Filter,
  FileSearch,
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
  type ApplyGateHistoryItem,
  type FollowupSuggestion,
  type StoredEmail,
  type SuggestionDraft,
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

function getPrimaryActionLabel(kind: PrimaryActionKind, item: QueueItem, draft: SuggestionDraft | undefined, inlineOpen: boolean) {
  if (kind === "cleanup") return getCleanupPrimaryLabel(item.actionType, inlineOpen);
  if (kind === "close") return "Close application";
  if (kind === "draft") return draft ? "Show draft" : "Generate draft";
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

function UpcomingFollowupWindowList({
  windows,
  compact = false,
}: {
  windows: UpcomingFollowupWindow[];
  compact?: boolean;
}) {
  if (windows.length === 0) return null;

  return (
    <div className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-2"}>
      {windows.map((window) => (
        <div key={window.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{window.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{window.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              {window.opensInDays <= 0 ? "due now" : `${window.opensInDays}d`}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-1">{window.company}</span>
            <span className="rounded-full bg-muted px-2 py-1">day {window.windowStartDay}-{window.windowEndDay}</span>
            <span className="rounded-full bg-muted px-2 py-1">{window.sourceDescription}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const draftToneOptions: Array<{ value: SuggestionDraftTone; label: string }> = [
  { value: "warm", label: "Warm follow-up" },
  { value: "concise", label: "Concise" },
  { value: "direct", label: "Direct status check" },
  { value: "post_interview", label: "Post-interview" },
  { value: "recruiter_went_cold", label: "Recruiter went cold" },
  { value: "referral", label: "Referral/networking" },
];

function defaultDraftTone(actionType?: string | null): SuggestionDraftTone {
  if (actionType === "thank_you" || actionType === "stale_interview_status_check") return "post_interview";
  if (actionType === "networking") return "referral";
  if (actionType === "close_stale_application" || actionType === "close_stale_interview") {
    return "recruiter_went_cold";
  }
  return "warm";
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
      const itemId = `${variables.threadId}:${variables.actionType}`;
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

  const copyDraft = async (draft: SuggestionDraft) => {
    try {
      await navigator.clipboard.writeText(draft.body);
      toast.success("Draft copied.");
    } catch {
      toast.error("Unable to copy draft.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-5 shadow-sm sm:p-6">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Premium action command center
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Daily Action Queue
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                One prioritized job-search queue grounded in Gmail timing, application state, Apply Gate signals, and cleanup blockers.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              {[
                ["Active", stats.active],
                ["High priority", stats.highPriority],
                ["To clear", `${stats.totalMinutes || 0}m`],
                ["Hidden", stats.snoozed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm backdrop-blur">
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="h-4 w-4 text-accent" />
                Focus the queue
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a lane when you need focus. Leave it on all when clearing the day.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(["all", "followup", "stale", "apply_gate", "resume", "cleanup"] as SourceFilter[]).map((value) => {
              const count = value === "all" ? combinedSuggestions.length : sourceCounts[value];
              const active = sourceFilter === value;

              return (
                <button
                  key={value}
                  type="button"
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                    active
                      ? "border-accent/50 bg-accent/10 shadow-sm"
                      : "border-border/70 bg-background/60 hover:border-accent/30 hover:bg-accent/5"
                  }`}
                  onClick={() => setSourceFilter(value)}
                >
                  <span className="block text-sm font-semibold text-foreground">{sourceFilterLabels[value]}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {count} active
                    {value === "followup" && upcomingFollowupWindows.length > 0
                      ? `, ${upcomingFollowupWindows.length} upcoming`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {filteredSuggestions.length === 0 ? (
              <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
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
              filteredSuggestions.map((item, index) => {
                const gmailUrl =
                  item.source === "followup" || item.source === "stale" ? buildGmailThreadUrl(item.threadId) : null;
                const mutationBusy =
                  completeMutation.isPending
                  || snoozeMutation.isPending
                  || undoMutation.isPending
                  || closeApplicationMutation.isPending;
                const inlineCleanupTask =
                  item.actionType === "cleanup_structured_fields"
                  || item.actionType === "cleanup_application_links";
                const inlineOpen = expandedInlineTaskId === item.id;
                const draftKey = buildActionKey(item.threadId, item.actionType);
                const draft = draftByTaskId[draftKey];
                const draftOpen = openDraftTaskId === draftKey;
                const draftTone = draftToneByTaskId[draftKey] || defaultDraftTone(item.actionType);
                const canDraft = Boolean(item.hasDraft && item.threadId && item.actionType);
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
                const primaryActionLabel = getPrimaryActionLabel(primaryActionKind, item, draft, inlineOpen);
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
                const runDraftAction = () => {
                  setOpenDraftTaskId((current) => (current === draftKey ? "" : draftKey));
                  if (!draft) {
                    draftMutation.mutate({
                      threadId: item.threadId || "",
                      actionType: item.actionType || "",
                      tone: draftTone,
                      emailId: item.emailId ?? null,
                      applicationId: item.applicationId ?? null,
                      suggestionSource: item.suggestionSource || item.source,
                    });
                  }
                };
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
                    className={`relative overflow-visible rounded-3xl border bg-gradient-to-br p-0 shadow-sm animate-fade-in ${sourceAccentClasses[item.source]}`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${sourceRailClasses[item.source]}`} />
                    <div className="p-5 sm:p-6">
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="min-w-0 space-y-5">
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
                            <h3 className="text-xl font-semibold tracking-tight text-foreground">{item.title}</h3>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
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

                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
                            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why now</p>
                                {item.actionConfidence ? (
                                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {item.actionConfidence} confidence
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-foreground">
                                {item.whyNow || item.sourceDescription}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                              {item.evidence?.length ? (
                                <div className="mt-2 space-y-2">
                                  {item.evidence.slice(0, 3).map((entry) => (
                                    <p key={entry} className="truncate rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground" title={entry}>
                                      {entry}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Grounded by the latest tracked signal.</p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-foreground">Recommended steps</p>
                              <span className="text-xs text-muted-foreground">{item.sourceDescription}</span>
                            </div>
                            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {item.playbook.map((tip, tipIndex) => (
                                <li key={tip} className="flex gap-3">
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                                    {tipIndex + 1}
                                  </span>
                                  <span className="leading-6">{tip}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>

                        <aside className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best next move</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{primaryActionHelper}</p>
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
                                          {draft ? "Show draft" : "Generate draft"}
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
                            className="mt-4 w-full"
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

                          <div className="mt-4 flex items-center gap-2 rounded-full bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Evidence-backed recommendation
                          </div>
                        </aside>
                      </div>

                    {canDraft && draftOpen ? (
                      <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-accent" />
                              <p className="text-sm font-semibold text-foreground">Copyable outreach draft</p>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Drafted from this tracked thread. Verify the recipient before sending.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <select
                              className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                              value={draftTone}
                              onChange={(event) => {
                                const nextTone = event.target.value as SuggestionDraftTone;
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
                            >
                              {draftToneOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {draft ? (
                              <Button variant="outline" size="sm" onClick={() => copyDraft(draft)}>
                                <Copy className="w-4 h-4" />
                                Copy
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {draftMutation.isPending && openDraftTaskId === draftKey ? (
                          <p className="mt-4 text-sm text-muted-foreground">Generating draft...</p>
                        ) : draft ? (
                          <div className="mt-4 space-y-3">
                            <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                              <p className="mt-1 text-sm text-foreground">{draft.subject}</p>
                            </div>
                            {draft.warning ? (
                              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                                {draft.warning}
                              </div>
                            ) : null}
                            <textarea
                              className="min-h-[220px] w-full rounded-lg border border-border bg-background/90 p-3 text-sm text-foreground outline-none focus:border-accent"
                              readOnly
                              value={draft.body}
                            />
                            {draft.evidence?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {draft.evidence.map((entry) => (
                                  <span key={entry} className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                                    {entry}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">No draft generated yet.</p>
                        )}
                      </div>
                    ) : null}

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

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Today's operating order</h2>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["1", "Clear blockers", `${sourceCounts.cleanup} cleanup task(s) that affect downstream accuracy.`],
                  ["2", "Handle ambiguity", `${sourceCounts.stale} ghosting signal(s) to close or follow up.`],
                  ["3", "Improve conversion", `${sourceCounts.followup + sourceCounts.apply_gate + sourceCounts.resume} fit, resume, or outreach action(s).`],
                ].map(([step, title, body]) => (
                  <div key={step} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                    <div className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
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

            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Reliability contract</h2>
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

            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
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

            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Outreach diagnostics</h2>
              </div>
              <div className="mt-4 space-y-3">
                {outreachDiagnostics.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-3">
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

            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
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
                    <div key={`${item.thread_id}:${item.action_type}`} className="rounded-2xl border border-border/70 bg-background/70 p-3">
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
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FixSuggestions;
