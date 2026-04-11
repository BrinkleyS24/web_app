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
import { CleanupTaskInlinePanel } from "@/components/CleanupTaskInlinePanel";
import { Button } from "@/components/ui/button";
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
import {
  actionTypeLabels,
  buildCombinedSuggestionQueue,
  buildGmailThreadUrl,
  buildSnoozedSuggestionItems,
  buildSuggestionImpressionPayload,
  buildSuggestionQueueStats,
  formatRelativeAge,
  formatSnoozedUntil,
  sourceClasses,
  type QueueSource,
  urgencyClasses,
} from "@/lib/premiumTaskQueue";

type UrgencyFilter = "all" | "high" | "medium" | "low";
type SourceFilter = "all" | QueueSource;

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

  const snoozedItems = useMemo(() => buildSnoozedSuggestionItems(actionStates), [actionStates]);

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

    const impressionPayload = buildSuggestionImpressionPayload(combinedSuggestions);

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
                const gmailUrl =
                  item.source === "followup" ? buildGmailThreadUrl(item.threadId) : null;
                const mutationBusy =
                  completeMutation.isPending || snoozeMutation.isPending || undoMutation.isPending;
                const inlineCleanupTask =
                  item.actionType === "cleanup_structured_fields"
                  || item.actionType === "cleanup_application_links";
                const inlineOpen = expandedInlineTaskId === item.id;

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
                          {item.company ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="w-4 h-4" />
                              {item.company}
                            </span>
                          ) : null}
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
                        {inlineCleanupTask ? (
                          <Button
                            variant={inlineOpen ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setExpandedInlineTaskId((current) => (current === item.id ? "" : item.id));
                            }}
                          >
                            {inlineOpen ? "Hide inline fix" : "Resolve here"}
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

                    {inlineCleanupTask && inlineOpen ? (
                      <CleanupTaskInlinePanel
                        task={item}
                        storedEmails={storedEmails}
                        onRefresh={() => invalidateSuggestionQueries(queryClient)}
                      />
                    ) : null}
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
