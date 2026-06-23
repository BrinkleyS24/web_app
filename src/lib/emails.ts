import { apiFetch } from "@/lib/api";

export type StoredEmail = {
  id: string;
  email_id?: string | null;
  thread_id?: string | null;
  subject?: string | null;
  from?: string | null;
  date?: string | null;
  body?: string | null;
  category?: string | null;
  confidence?: number | null;
  is_read?: boolean | null;
  is_starred?: boolean | null;
  company_name?: string | null;
  company_name_corrected?: boolean | null;
  position?: string | null;
  position_corrected?: boolean | null;
  extraction_method?: string | null;
  applicationId?: string | null;
  isClosed?: boolean | null;
  isUserClosed?: boolean | null;
};

export type StoredEmailsResponse = {
  success: boolean;
  emails?: StoredEmail[];
  categorizedEmails?: Record<string, StoredEmail[]>;
  totalCount?: number;
  totalRelevantCount?: number;
  categoryTotals?: Record<string, number>;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  returnedCount?: number;
};

export type MetricsResponse = {
  success: boolean;
  timeframe: string;
  metrics: {
    totalApplications: number;
    totalInterviewed: number;
    totalOffers: number;
    totalRejected: number;
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    rejectionRate: number;
    totalEmails: number;
    windowMisaligned?: boolean;
  };
  // Canonical, honest, all-time job-search metrics computed from the emails table
  // (one entry per distinct application cohort). These are the cross-page-consistent
  // numbers the UI should headline; the windowed `metrics` block above is secondary.
  cohortMetrics?: {
    applicationsSent: number;
    reachedInterview: number;
    reachedOffer: number;
    rejectedCohorts: number;
    interviewRate: number;
    offerRate: number;
    rejectionRate: number;
    basis: string;
    ungroupableEmails: number;
  };
  dataCompleteness?: {
    syncComplete: boolean;
    oldestEmailDate: string | null;
    oldestSyncedDate: string | null;
    lastSyncAt: string | null;
    progressPercentage: number;
  };
};

// DAQ Inbox Intelligence coach response surfaced alongside each suggestion when
// the user has the LLM coach feature enabled. The backend attaches this from
// daq_coach_response rows that have validation_status='ok'.
export type CoachResponseContent = {
  headline: string;
  body: string;
  suggested_action: {
    label: string;
    intent: string;
  };
  draft_followup: string | null;
  cited_evidence_keys: string[];
};

export type CoachResponse = {
  signal_type: string;
  evidence_hash: string;
  content: CoachResponseContent;
  model: string;
  generated_at: string;
};

export type FollowupSuggestion = {
  id?: string | number | null;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  threadId?: string | null;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  company?: string | null;
  actionType?: string | null;
  suggestionSource?: string | null;
  urgency?: "low" | "medium" | "high" | null;
  daysAgo?: number | null;
  estimatedTime?: string | null;
  category?: string | null;
  whyNow?: string | null;
  evidence?: string[] | null;
  actionConfidence?: "low" | "medium" | "high" | null;
  draftAvailable?: boolean | null;
  coachResponse?: CoachResponse | null;
};

export type FollowupSuggestionsResponse = {
  success: boolean;
  suggestions?: FollowupSuggestion[];
  meta?: {
    suppressed?: boolean;
    suppressionReason?: string | null;
    message?: string | null;
  };
};

export type StrategyAlert = {
  id: string;
  kind: "performance" | "fit" | "focus" | "execution";
  severity: "high" | "medium" | "low" | "positive";
  title: string;
  description: string;
  recommendation?: string | null;
  supporting_stat?: string | null;
  timeframe_label?: string | null;
};

export type StrategyAlertsResponse = {
  success: boolean;
  alerts?: StrategyAlert[];
};

export type SuggestionOutcomeAnalyticsResponse = {
  success: boolean;
  analytics?: {
    followup: {
      summary: {
        shownApplications: number;
        completedApplications: number;
        completedRate: number;
        positiveOutcomeApplications: number;
        positiveOutcomeRate: number;
        averageDisplaysPerApplication: number;
      };
      outcomes: {
        completed: {
          applications: number;
          positiveOutcomes: number;
          positiveRate: number;
        };
        ignored: {
          applications: number;
          positiveOutcomes: number;
          positiveRate: number;
        };
        observedLift: number;
      };
      byActionType: Array<{
        actionType: string;
        shown: number;
        completed: number;
        positiveOutcomes: number;
        completionRate: number;
        positiveOutcomeRate: number;
      }>;
    };
    nonFollowup: {
      summary: {
        shownSuggestions: number;
        completedSuggestions: number;
        snoozedSuggestions: number;
        activeSuggestions: number;
        completionRate: number;
      };
      bySource: Array<{
        source: string;
        shown: number;
        completed: number;
        snoozed: number;
        active: number;
        completionRate: number;
      }>;
    };
  };
};

export type SuggestionActionState = {
  thread_id: string;
  action_type: string;
  state: "active" | "completed" | "snoozed";
  email_id?: number | null;
  application_id?: number | null;
  suggestion_source?: string | null;
  displayed_at?: string | null;
  last_displayed_at?: string | null;
  display_count?: number | null;
  completed_at?: string | null;
  dismissed_at?: string | null;
  snoozed_until?: string | null;
  outcome_label?: "interviewed" | "offered" | "rejected" | "withdrawn" | "no_response" | null;
  outcome_recorded_at?: string | null;
  outcome_source?: string | null;
  actioned_at?: string | null;
  updated_at?: string | null;
};

export type SuggestionActionStatesResponse = {
  success: boolean;
  actions?: SuggestionActionState[];
};

export type RankedAction = {
  id: string;
  logicalKey: string;
  dedupeKey: string;
  primaryEntityId: string;
  evidenceVersion: string;
  actionType: string;
  actionCategory: "communication" | "application" | "optimization" | "system";
  title: string;
  whyNow: string;
  targetOutcome: string;
  effortMinutes: number;
  urgencyLevel: "high" | "medium" | "low";
  confidenceLevel: "strong" | "moderate" | "weak";
  expiresAt?: string | null;
  blockedByLogicalKeys?: string[];
  blockingReason?: string | null;
  source: "followup_engine" | "apply_gate" | "strategy_pattern" | "user";
  status: "open" | "blocked" | "done" | "dismissed" | "expired";
  refreshCondition?: Record<string, unknown> | null;
  dismissedUntil?: string | null;
  dismissedAt?: string | null;
  lastShownAt?: string | null;
  timesShown?: number;
  createdAt?: string | null;
  evidence?: string[];
  rankScore?: number;
  effectiveStatus?: "open" | "blocked" | "done" | "dismissed" | "expired";
  stateReason?: string | null;
  unresolvedBlockedBy?: string[];
  threadId?: string | null;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  legacyActionType?: string | null;
  suggestionSource?: string | null;
  queueSource?: "followup" | "stale" | "apply_gate" | "resume" | "cleanup";
  intent?:
    | "SEND_THANK_YOU"
    | "FOLLOW_UP_THREAD"
    | "STATUS_CHECK"
    | "NETWORKING_OUTREACH"
    | "APPLY_TO_ROLE"
    | "TAILOR_RESUME"
    | "FIX_TARGETING"
    | "PREP_INTERVIEW"
    | "CLEANUP_STRUCTURED_FIELDS"
    | "LINK_APPLICATIONS"
    | "CLOSE_STALE_ROLE"
    | "CLEANUP_DATA";
  intentLabel?: string | null;
  playbook?: string[];
  sourceLabel?: string | null;
  draftEligible?: boolean;
  routeHref?: string | null;
  routeLabel?: string | null;
  stageLabel?: string | null;
  company?: string | null;
  lastMessageSnippet?: string | null;
};

export type RankedActionQueue = {
  now: string;
  doToday: RankedAction[];
  thisWeek: RankedAction[];
  later: RankedAction[];
  blocked: RankedAction[];
  dismissed: RankedAction[];
  expired: RankedAction[];
  done: RankedAction[];
  emptyState?: {
    title: string;
    nextSteps: string[];
  } | null;
  resolvedActions?: RankedAction[];
};

export type RankedActionQueueResponse = {
  success: boolean;
  queue: RankedActionQueue;
};

export type QueueActionMutationResponse = {
  success: boolean;
  state: "active" | "completed" | "snoozed";
  logicalKey: string;
  dedupeKey: string;
  wasStale: boolean;
  displayCount?: number;
  snoozedUntil?: string | null;
  stale?: boolean;
  requiresRefresh?: boolean;
  currentDedupeKey?: string;
};

export type SuggestionDraftTone =
  | "warm"
  | "concise"
  | "direct"
  | "post_interview"
  | "recruiter_went_cold"
  | "referral";

export type SuggestionDraftFeedbackLabel =
  | "helpful"
  | "too_generic"
  | "wrong_recipient"
  | "wrong_grounding"
  | "wrong_tone";

export type SuggestionDraft = {
  subject: string;
  body: string;
  context: SuggestionDraftTone | string;
  contextLabel?: string | null;
  contextDescription?: string | null;
  recipient?: string | null;
  recipientName?: string | null;
  latestSender?: string | null;
  company?: string | null;
  role?: string | null;
  actionType: string;
  confidence: "low" | "medium" | "high";
  warning?: string | null;
  evidence?: string[];
  threadPreview?: string | null;
  coachingPoints?: string[];
  sendStrategy?: string | null;
  sendStrategyLabel?: string | null;
  sendStrategyDescription?: string | null;
};

export type ApplicationStatsResponse = {
  success: boolean;
  stats?: {
    applications: {
      applied: number;
      interviewed: number;
      offered: number;
      rejected: number;
      total: number;
    };
    emails: {
      linked: number;
      total: number;
      ungrouped: number;
    };
  };
};

export async function fetchStoredEmails(params: {
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<StoredEmailsResponse> {
  return apiFetch("/api/emails/stored-emails", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchEmailMetrics(timeframe = "last_30_days"): Promise<MetricsResponse> {
  const encoded = encodeURIComponent(timeframe);
  return apiFetch(`/api/emails/metrics?timeframe=${encoded}`, { method: "GET" });
}

export interface RejectionInsightExample {
  subject: string | null;
  company: string | null;
  position: string | null;
  date: string | null;
}

export interface RejectionInsightPattern {
  category: "skill" | "domain" | "years" | "requirement";
  label: string;
  phrase: string;
  occurrences: number;
  examples: RejectionInsightExample[];
}

export interface RejectionInsightsResponse {
  success: boolean;
  analyzedRejections: number;
  patterns: RejectionInsightPattern[];
}

export async function fetchRejectionInsights(limit = 100): Promise<RejectionInsightsResponse> {
  const encoded = encodeURIComponent(String(limit));
  return apiFetch(`/api/emails/rejection-insights?limit=${encoded}`, { method: "GET" });
}

export interface ResumeGapExample {
  company: string | null;
  position: string | null;
  date: string | null;
}

export interface ResumeGap {
  skill: string;
  category: "required" | "evidence" | "preferred";
  label: string;
  occurrences: number;
  examples: ResumeGapExample[];
}

export interface ResumeGapInsightsResponse {
  success: boolean;
  analyzedVerdicts: number;
  distinctRolesEvaluated: number;
  verdictsWithGapData: number;
  gaps: ResumeGap[];
}

export async function fetchResumeGaps(): Promise<ResumeGapInsightsResponse> {
  return apiFetch(`/api/emails/resume-gaps`, { method: "GET" });
}

export interface WeeklyHighlightEmail {
  id: number | null;
  company: string | null;
  position: string | null;
  subject: string | null;
  date: string | null;
}

export interface WeeklyHighlightSilent extends WeeklyHighlightEmail {
  stage: "applied" | "interviewed";
  daysSilent: number;
}

export interface WeeklyReadoutItem {
  text: string;
  direction?: "up" | "down" | "flat";
  priority?: "high" | "normal";
}

export interface WeeklyReadout {
  confidence: "quiet" | "thin" | "normal";
  headline: string;
  sections: {
    whatChanged: WeeklyReadoutItem[];
    whatWorked: WeeklyReadoutItem[];
    whatDidnt: WeeklyReadoutItem[];
    emergingPattern: WeeklyReadoutItem | null;
    nextWeek: WeeklyReadoutItem[];
  };
}

export interface WeeklyHighlightsResponse {
  success: boolean;
  timeframe: string;
  windowStart: string | null;
  windowEnd: string | null;
  counts: {
    applications: number;
    callbacks: number;
    interviews: number;
    offers: number;
    rejections: number;
  };
  readout?: WeeklyReadout;
  highlights: {
    newApplications: WeeklyHighlightEmail[];
    newCallbacks: WeeklyHighlightEmail[];
    newOffers: WeeklyHighlightEmail[];
    newRejections: WeeklyHighlightEmail[];
    silentThreads: WeeklyHighlightSilent[];
    topRejectionTheme: {
      phrase: string;
      label: string;
      occurrences: number;
      category: string;
    } | null;
  };
}

export async function fetchWeeklyHighlights(
  timeframe: "last_7_days" | "last_14_days" | "last_30_days" = "last_7_days",
): Promise<WeeklyHighlightsResponse> {
  const encoded = encodeURIComponent(timeframe);
  return apiFetch(`/api/emails/weekly-highlights?timeframe=${encoded}`, { method: "GET" });
}

export async function fetchFollowupSuggestions(): Promise<FollowupSuggestionsResponse> {
  return apiFetch("/api/emails/followup-needed", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updateEmailCompany(params: {
  emailId: string | number;
  companyName: string;
}): Promise<{ success: boolean; email?: StoredEmail; message?: string }> {
  return apiFetch(`/api/emails/${encodeURIComponent(String(params.emailId))}/company`, {
    method: "PATCH",
    body: {
      companyName: params.companyName,
    },
  });
}

export async function updateEmailPosition(params: {
  emailId: string | number;
  position: string;
}): Promise<{ success: boolean; email?: StoredEmail; message?: string }> {
  return apiFetch(`/api/emails/${encodeURIComponent(String(params.emailId))}/position`, {
    method: "PATCH",
    body: {
      position: params.position,
    },
  });
}

export async function linkRoleEmails(params: {
  emailId: string | number;
}): Promise<{
  success: boolean;
  matched?: number;
  relinked?: number;
  failed?: number;
  applicationId?: string | number | null;
}> {
  return apiFetch("/api/emails/applications/link-role", {
    method: "POST",
    body: {
      emailId: params.emailId,
    },
  });
}

export async function fetchStrategyAlerts(): Promise<StrategyAlertsResponse> {
  return apiFetch("/api/suggestions/strategy-alerts", { method: "GET" });
}

export async function fetchSuggestionOutcomeAnalytics(): Promise<SuggestionOutcomeAnalyticsResponse> {
  return apiFetch("/api/suggestions/analytics", { method: "GET" });
}

export async function fetchSuggestionActionStates(): Promise<SuggestionActionStatesResponse> {
  return apiFetch("/api/suggestions/states", { method: "GET" });
}

export async function fetchRankedActionQueue(): Promise<RankedActionQueueResponse> {
  return apiFetch("/api/suggestions/queue", { method: "GET" });
}

export async function recordQueueActionImpression(params: {
  logicalKey: string;
  dedupeKey?: string;
}): Promise<QueueActionMutationResponse> {
  return apiFetch("/api/suggestions/queue/actions/impression", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function completeQueueAction(params: {
  logicalKey: string;
  dedupeKey?: string;
}): Promise<QueueActionMutationResponse> {
  return apiFetch("/api/suggestions/queue/actions/complete", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function dismissQueueAction(params: {
  logicalKey: string;
  dedupeKey: string;
}): Promise<QueueActionMutationResponse> {
  return apiFetch("/api/suggestions/queue/actions/dismiss", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function recordSuggestionImpressions(params: {
  suggestions: Array<{
    threadId: string;
    actionType: string;
    emailId?: string | number | null;
    applicationId?: string | number | null;
    suggestionSource?: string | null;
  }>;
}): Promise<{ success: boolean; recorded: number }> {
  return apiFetch("/api/suggestions/impressions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function completeSuggestionAction(params: {
  threadId: string;
  actionType: string;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  suggestionSource?: string | null;
}): Promise<{ success: boolean; state: "completed" }> {
  return apiFetch("/api/suggestions/action", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function snoozeSuggestionAction(params: {
  threadId: string;
  actionType: string;
  snoozeDuration?: number;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  suggestionSource?: string | null;
}): Promise<{ success: boolean; state: "snoozed"; snoozedUntil: string }> {
  return apiFetch("/api/suggestions/snooze", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function undoSuggestionAction(params: {
  threadId: string;
  actionType: string;
}): Promise<{ success: boolean; message: string }> {
  return apiFetch("/api/suggestions/action", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

export async function generateSuggestionDraft(params: {
  threadId: string;
  actionType: string;
  tone?: SuggestionDraftTone;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  suggestionSource?: string | null;
}): Promise<{ success: boolean; draft: SuggestionDraft }> {
  return apiFetch("/api/suggestions/draft", {
    method: "POST",
    body: JSON.stringify(params),
    timeoutMs: 20_000,
  });
}

export async function recordSuggestionDraftFeedback(params: {
  threadId: string;
  actionType: string;
  feedbackLabel: SuggestionDraftFeedbackLabel;
  tone?: SuggestionDraftTone;
  emailId?: string | number | null;
  applicationId?: string | number | null;
  suggestionSource?: string | null;
  draft?: {
    subject: string;
    body: string;
    context: string;
    confidence?: "low" | "medium" | "high";
    sendStrategy?: string | null;
    sendStrategyLabel?: string | null;
    recipient?: string | null;
    recipientName?: string | null;
    latestSender?: string | null;
    warning?: string | null;
    evidence?: string[];
    threadPreview?: string | null;
  };
  feedback?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  return apiFetch("/api/suggestions/feedback", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function closeApplication(params: {
  applicationId?: string | number | null;
  emailId?: string | number | null;
  reason?: string | null;
}): Promise<{ success: boolean; application?: unknown; message?: string }> {
  const payload = {
    ...(params.reason ? { reason: params.reason } : {}),
    ...(params.emailId ? { emailId: params.emailId } : {}),
  };

  if (params.applicationId) {
    return apiFetch(`/api/emails/applications/${encodeURIComponent(String(params.applicationId))}/close`, {
      method: "POST",
      body: payload,
    });
  }

  if (params.emailId) {
    return apiFetch("/api/emails/applications/close-by-email", {
      method: "POST",
      body: payload,
    });
  }

  throw new Error("Application or email id is required to close an application.");
}

export async function fetchApplicationStats(): Promise<ApplicationStatsResponse> {
  return apiFetch("/api/emails/applications/stats", { method: "GET" });
}

export async function startEmailSync(options: {
  fullRefresh?: boolean;
  fetchOnlyQuota?: boolean;
} = {}): Promise<{ success: boolean }> {
  return apiFetch("/api/emails", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

// ── Apply Gate ────────────────────────────────────────────────────────

export type ApplyGateVerdict = "strong_fit" | "good_fit" | "potential_fit" | "risky" | "not_recommended";
export type ApplyGateConfidence = "high" | "medium" | "low";

export type ApplyGateUniversalConstraint = {
  key: string;
  type: string;
  label: string;
  priority: string;
  statement: string;
  status: string | null;
  evidence: string | null;
  blocksApplication: boolean;
  evidenceExpected: boolean;
};

export type ApplyGateRequirementLedgerItem = {
  id: string;
  source_key?: string | null;
  type: string;
  requirement_type?: string | null;
  requirementType?: string | null;
  label: string;
  priority: "hard" | "preferred" | string;
  source_sentence: string;
  evidence_needed: string[];
  candidate_status: "satisfied" | "missing" | "unclear";
  candidate_evidence: string | null;
  confidence: "high" | "medium" | "low" | string;
  blocks_application: boolean;
};

export type ApplyGateRequirementLedger = {
  version: number;
  source: string;
  summary?: {
    hard_total?: number;
    hard_missing?: number;
    hard_unclear?: number;
    preferred_total?: number;
    preferred_missing?: number;
    blocking_labels?: string[];
  };
  items: ApplyGateRequirementLedgerItem[];
};

export type ApplyGateRiskComponent = {
  key: string;
  label: string;
  score: number;
  impact: "low" | "moderate" | "elevated" | "high" | "severe" | string;
  evidence: string | null;
};

export type ApplyGateRiskBreakdown = {
  version: number;
  score: number;
  label: "low" | "moderate" | "elevated" | "high" | "severe" | string;
  basis: string;
  calibration?: string;
  summary: string;
  components: ApplyGateRiskComponent[];
};

export type ApplyGateOccupationMatch = {
  id: string;
  title: string;
  family: string;
  onetSoc?: string | null;
  score: number;
  matchedSignals?: string[];
};

export type ApplyGateOccupationGrounding = {
  version: string;
  source: string;
  job: ApplyGateOccupationMatch | null;
  candidate: ApplyGateOccupationMatch | null;
  alignmentScore: number;
  alignmentLabel: string;
  confidence: number;
  matchedFamilies?: string[];
};

export type ApplyGateStrategicDecision = "APPLY" | "APPLY_WITH_STRATEGY" | "FIX_THEN_APPLY" | "SKIP";
export type ApplyGateDisplayDecision = {
  version: number;
  action: ApplyGateStrategicDecision;
  label: string;
  headline: string;
  subtext: string;
  renderMode: "COMPRESSED" | "EXPANDED";
  legacyDecision?: "apply_now" | "apply_with_caveats" | "fix_first" | "skip";
  status?: "strong" | "potential" | "risky" | "not-recommended";
  source?: string | null;
  diagnostics?: {
    arbitrationSource?: string | null;
    aiConstraint?: null | {
      type?: string | null;
      severity?: string | null;
      reason?: string | null;
    };
    subtextSuppressed?: boolean;
    hardBlocker?: boolean;
    legacy?: {
      strategicDecision?: ApplyGateStrategicDecision | null;
      finalVerdict?: ApplyGateVerdict | string | null;
      legacyDecision?: "apply_now" | "apply_with_caveats" | "fix_first" | "skip" | null;
    };
  } | null;
};
export type ApplyGateOutcomeBand = "Low" | "Medium" | "High";
export type ApplyGateDecisionConfidence = ApplyGateOutcomeBand;
export type ApplyGateConfidenceType = "CLEAR_SIGNAL" | "WEAK_SIGNAL" | "CONFLICTED_SIGNAL";
export type ApplyGateCompanyType = "startup" | "enterprise" | "regulated" | "gov_regulated" | "unknown";
export type ApplyGateRiskTolerance = "conservative" | "balanced" | "aggressive";
export type ApplyGateCareerTrackType = "OPEN_MARKET" | "STRUCTURED" | "LICENSED";
export type ApplyGateDomainAlignment = {
  level: "STRONG_MATCH" | "ADJACENT" | "BRIDGEABLE" | "HARD_MISMATCH";
  isMismatch?: boolean;
  type?: string | null;
  careerTrackType?: ApplyGateCareerTrackType | string | null;
  bridgeable?: boolean;
  alignmentScore?: number | null;
  confidence?: number | null;
  alignmentLabel?: string | null;
  jobFamily?: string | null;
  candidateFamily?: string | null;
  jobDomain?: string | null;
  candidateDomain?: string | null;
  reason?: string | null;
};
export type ApplyGateEvidenceStrength = {
  level: "STRONG" | "MODERATE" | "WEAK";
  score: number;
  ownershipScore?: number;
  roleSpecificProofScore?: number;
  projectComplexityScore?: number;
  outcomeEvidenceScore?: number;
  recencyScore?: number;
  roleSpecificProofTerms?: string[];
  basis?: string;
  reason?: string | null;
};

export type ApplyGateRequirementClassification = {
  id: string;
  type: string;
  label: string;
  classification: "hard" | "semi-hard" | "soft";
  enforcementLikelihood: number;
  source?: string;
};

export type ApplyGatePathToWin = {
  referralRequired: boolean;
  resumeOptimizationRequired: boolean;
  estimatedBypassDifficulty: "low" | "medium" | "high";
  recommendedChannel?: string | null;
  keyRisks?: string[];
  companyType?: ApplyGateCompanyType | string | null;
  riskTolerance?: ApplyGateRiskTolerance;
  strategy: string[];
};

export type ApplyGateCalibrationBucket = {
  version: number;
  domainAlignment?: ApplyGateDomainAlignment["level"] | null;
  evidenceStrength?: ApplyGateEvidenceStrength["level"] | null;
  strategicDecision?: ApplyGateStrategicDecision | null;
  riskTolerance?: ApplyGateRiskTolerance | null;
  atsPass?: ApplyGateOutcomeBand | null;
  humanWin?: ApplyGateOutcomeBand | null;
  decisionConfidence?: ApplyGateDecisionConfidence | null;
};

export type ApplyGateDecisionConfidenceDetails = {
  level: ApplyGateDecisionConfidence;
  score?: number;
  sampleSize?: number;
  conflictCount?: number;
  confidenceType?: ApplyGateConfidenceType;
  drivers?: ApplyGateConfidenceDrivers;
  confidenceFlags?: string[];
  factors?: string[];
};

export type ApplyGateConfidenceDrivers = {
  primaryDriver?: string | null;
  secondaryDriver?: string | null;
  conflictDriver?: string | null;
};

export type ApplyGateCalibrationDiagnostics = {
  bucket?: {
    domainAlignment?: ApplyGateDomainAlignment["level"] | null;
    evidenceStrength?: ApplyGateEvidenceStrength["level"] | null;
    decisionConfidence?: ApplyGateDecisionConfidence | null;
    riskTolerance?: ApplyGateRiskTolerance | null;
  };
  totalDecisions: number;
  totalApplied: number;
  interviews: number;
  offers: number;
  rejections: number;
  ghosted: number;
  successRate?: number | null;
  failureRate?: number | null;
  actualSuccessRate?: number | null;
  predictedConfidenceLevel?: ApplyGateDecisionConfidence | null;
  predictedConfidenceRange?: { min: number; max: number } | null;
  confidenceError?: number | null;
  confidenceCalibrationStatus?: "CALIBRATED" | "OVERCONFIDENT" | "UNDERCONFIDENT" | "INSUFFICIENT_DATA";
  decisionReliability?: "STABLE" | "UNSTABLE" | "UNKNOWN";
  avgDecisionConfidence?: number | null;
  overconfidenceScore?: number;
  underconfidenceScore?: number;
  overrideRate?: number | null;
  successRate_when_followed?: number | null;
  successRate_when_overridden?: number | null;
  overrideApplied?: number;
  overrideSuccessRate?: number | null;
  nonOverrideApplied?: number;
  nonOverrideSuccessRate?: number | null;
  overrideEffectiveness?: "USERS_RIGHT" | "SYSTEM_RIGHT" | "INCONCLUSIVE";
  overrideInsight?: string | null;
  drift?: {
    driftDetected: boolean;
    reason?: string | null;
    successRateDelta?: number | null;
    overrideRateDelta?: number | null;
    confidenceStatusChanged?: boolean;
  };
  shadowCalibration?: {
    evaluatedDecisions: number;
    relaxedWouldImprove: number;
    strictWouldImprove: number;
    betterDecisionCounts?: Record<string, number>;
  };
  userTrustProfile?: {
    agreementRate?: number | null;
    overrideRate?: number | null;
    overrideSuccessRate?: number | null;
    highConfidenceFollowRate?: number | null;
    lowConfidenceOverrideRate?: number | null;
    confidenceBehaviorAlignment?: {
      highConfidenceKnown: number;
      lowConfidenceKnown: number;
    };
  } | null;
  systemHealthReport?: {
    calibrationHealth?: Record<string, number>;
    overconfidenceZones?: unknown[];
    underconfidenceZones?: unknown[];
    highOverrideZones?: unknown[];
    unstableDecisionZones?: unknown[];
    driftFlags?: unknown[];
  } | null;
  calibrationPolicy?: {
    mode: "passive";
    autoDecisionChangesAllowed: boolean;
    thresholdChangesRequireExplicitVersion: boolean;
  };
};

export type ApplyGateOpportunityCost = {
  alternativeQualityScore: number;
  message: string;
  basis?: string;
};

export type ApplyGateSignalSeparation = {
  signalLeakage: boolean;
  overlapRatio: number;
  overlappingSignals: string[];
  threshold: number;
  matchSignalCount?: number;
  proofSignalCount?: number;
};

export type ApplyGateDecisionDiagnostics = {
  consistencyFlag?: string;
  confidenceFlags?: string[];
  confidenceCalibrationStatus?: ApplyGateCalibrationDiagnostics["confidenceCalibrationStatus"];
  decisionReliability?: ApplyGateCalibrationDiagnostics["decisionReliability"];
  overrideEffectiveness?: ApplyGateCalibrationDiagnostics["overrideEffectiveness"];
  driftDetected?: boolean;
  calibrationDiagnostics?: ApplyGateCalibrationDiagnostics;
  shadowCalibration?: ApplyGateCalibrationDiagnostics["shadowCalibration"];
  userTrustProfile?: ApplyGateCalibrationDiagnostics["userTrustProfile"];
  systemHealthReport?: ApplyGateCalibrationDiagnostics["systemHealthReport"];
  calibrationPolicy?: ApplyGateCalibrationDiagnostics["calibrationPolicy"];
  explanationTruthStatus?: "COMPLETE" | "REWRITTEN" | "HIERARCHICAL";
  primaryNarrativeDriver?: string;
  suppressedSignals?: string[];
};

export type ApplyGateDecisionSystem = {
  decision?: ApplyGateStrategicDecision | null;
  displayDecision?: ApplyGateDisplayDecision | null;
  decisionLabel?: string | null;
  decisionConfidence?: ApplyGateDecisionConfidence | null;
  confidenceType?: ApplyGateConfidenceType | null;
  domainAlignment?: ApplyGateDomainAlignment["level"] | null;
  evidenceStrength?: ApplyGateEvidenceStrength["level"] | null;
  atsScore?: number | null;
  humanScore?: number | null;
  explanation?: ApplyGateConfidenceDrivers | null;
  opportunityCost?: ApplyGateOpportunityCost | null;
  overrideInsight?: string | null;
  calibrationBucket?: ApplyGateCalibrationBucket | null;
  signalLeakage?: boolean;
  diagnostics?: ApplyGateDecisionDiagnostics | null;
};

export type ApplyGateSearchMemory = {
  version: number;
  mode: "descriptive";
  confidence: "low" | "weak" | "meaningful";
  sampleSize: number;
  noResponseWindowDays?: number;
  unavailable?: boolean;
  commonSkills: string[];
  similarRoles: Array<{
    id?: string | number | null;
    role: string;
    company?: string | null;
    outcome?: string | null;
    responseOutcome?: string | null;
    noResponse?: boolean;
    daysToResponse?: number | null;
    daysToLatest?: number | null;
    similarity: number;
    matchedSignals?: string[];
  }>;
  outcomeSummary: {
    similarRoleCount: number;
    interviewed: number;
    offered: number;
    rejected: number;
    noResponse: number;
    interviewRate: number;
    rejectionRate: number;
    noResponseRate: number;
    medianDaysToResponse?: number | null;
    medianDaysToInterview?: number | null;
    medianDaysToRejection?: number | null;
  };
  patternSignals: string[];
};

export type ApplyGateScoringBreakdown = {
  experienceScore: number;
  skillScore: number;
  skillsScore?: number;
  seniorityScore: number;
  educationScore: number;
  surfaceScore: number;
  platformScore?: number;
  disciplineScore?: number;
  weightedBreakdown?: {
    experienceWeight: number;
    skillsWeight: number;
    educationWeight: number;
    seniorityWeight: number;
    platformWeight: number;
  };
  riskFlags?: string[];
  hardBlocker?: boolean;
  atsScore?: number;
  humanScore?: number;
  atsPass?: ApplyGateOutcomeBand;
  humanWin?: ApplyGateOutcomeBand;
  requirementClassification?: ApplyGateRequirementClassification[];
  trueHardBlockers?: string[];
  payoffWeight?: number;
  frictionCost?: number;
  expectedValueScore?: number;
  companyType?: ApplyGateCompanyType | string;
  pathToWin?: ApplyGatePathToWin | null;
  strategicDecision?: ApplyGateStrategicDecision;
  decision?: ApplyGateStrategicDecision;
  decisionLabel?: string | null;
  primaryDriver?: {
    type?: string | null;
    label?: string | null;
    reason?: string | null;
    priority?: number | null;
    requirementType?: string | null;
  } | null;
  rawStrategicDecision?: ApplyGateStrategicDecision;
  decisionConsistency?: {
    decision?: ApplyGateStrategicDecision | null;
    decisionLabel?: string | null;
    originalDecision?: ApplyGateStrategicDecision | string | null;
    consistencyFlag?: string | null;
    changed?: boolean;
    reason?: string | null;
  };
  signalSeparation?: ApplyGateSignalSeparation | null;
  signalLeakage?: boolean;
  domainAlignment?: ApplyGateDomainAlignment | null;
  domainMismatch?: ApplyGateDomainAlignment | null;
  evidenceStrength?: ApplyGateEvidenceStrength | null;
  careerTrackType?: ApplyGateCareerTrackType | string | null;
  careerTrackAssessment?: {
    careerTrackType?: ApplyGateCareerTrackType | string | null;
    credentialPathMissing?: boolean;
    blockingLabels?: string[];
    reason?: string | null;
  } | null;
  riskTolerance?: ApplyGateRiskTolerance;
  applicationRiskScore?: number;
  applicationRiskLabel?: string;
  applicationRiskSummary?: string;
  applicationRiskBasis?: string;
  riskBreakdown?: ApplyGateRiskBreakdown | null;
  occupationGrounding?: ApplyGateOccupationGrounding | null;
  educationBlock?: boolean;
  skillBlock?: boolean;
  certificationBlock?: boolean;
  onsiteEligibilityBlock?: boolean;
  universalConstraintBlock?: boolean;
  universalConstraintFit?: {
    block: boolean;
    scoreCap: number;
    constraints: ApplyGateUniversalConstraint[];
    blockingConstraints: ApplyGateUniversalConstraint[];
    unclearHardConstraints: ApplyGateUniversalConstraint[];
    riskFlags: string[];
    summaryLabels: string[];
  };
  requirementLedger?: ApplyGateRequirementLedger | null;
  totalScore: number;
};

export type ApplyGateResult = {
  success: boolean;
  /**
   * Set when the backend had no usable profile (no résumé text + no history) and
   * refused to render a verdict. The UI shows an honest "add your résumé" state
   * instead of a (meaningless) decision. See applyGateService.hasEvaluableProfile.
   */
  insufficientProfile?: boolean;
  insufficientProfileMessage?: string;
  id?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  jobUrl?: string | null;
  extractionMeta?: {
    attempted: boolean;
    host?: string | null;
    canonical_url?: string | null;
    source_url?: string | null;
    source_type?: string | null;
    source_label?: string | null;
    raw_chars?: number;
    normalized_chars?: number;
    raw_job_score?: number;
    normalized_job_score?: number;
    anchors_found?: string[];
    partial_tail_detected?: boolean;
    confidence?: "high" | "medium" | "low" | "failed" | null;
    warnings?: string[];
    failure_reason?: string | null;
    title?: string | null;
    candidate_sources?: Array<{ source: string; score: number; chars: number }>;
  } | null;
  verdict: ApplyGateVerdict;
  confidence: ApplyGateConfidence;
  reasons: string[];
  explanation?: {
    hard_blockers: string[];
    display_decision?: ApplyGateDisplayDecision | null;
    application_risk_score?: number | null;
    risk_breakdown?: ApplyGateRiskBreakdown | null;
    strategic_decision?: ApplyGateStrategicDecision | null;
    ats_pass?: ApplyGateOutcomeBand | null;
    human_win?: ApplyGateOutcomeBand | null;
    ats_score?: number | null;
    human_score?: number | null;
    expected_value_score?: number | null;
    payoff_weight?: number | null;
    friction_cost?: number | null;
    company_type?: ApplyGateCompanyType | string | null;
    path_to_win?: ApplyGatePathToWin | null;
    domain_alignment?: ApplyGateDomainAlignment | null;
    domain_mismatch?: ApplyGateDomainAlignment | null;
    evidence_strength?: ApplyGateEvidenceStrength | null;
    career_track_type?: ApplyGateCareerTrackType | string | null;
    career_track_assessment?: {
      careerTrackType?: ApplyGateCareerTrackType | string | null;
      credentialPathMissing?: boolean;
      blockingLabels?: string[];
      reason?: string | null;
    } | null;
    primary_driver?: string | null;
    primary_driver_detail?: {
      type?: string | null;
      label?: string | null;
      reason?: string | null;
      priority?: number | null;
      requirementType?: string | null;
    } | null;
    decision_label?: string | null;
    primary_reason?: string | null;
    suppressed_signals?: string[];
    risk_tolerance?: ApplyGateRiskTolerance | null;
    calibration_bucket?: ApplyGateCalibrationBucket | null;
    calibration_diagnostics?: ApplyGateCalibrationDiagnostics | null;
    confidence_type?: ApplyGateConfidenceType | null;
    confidence_drivers?: ApplyGateConfidenceDrivers | null;
    override_insight?: string | null;
    opportunity_cost?: ApplyGateOpportunityCost | null;
    signal_leakage?: ApplyGateSignalSeparation | null;
    diagnostics?: ApplyGateDecisionDiagnostics | null;
    decision_system?: ApplyGateDecisionSystem | null;
    decision_confidence?: ApplyGateDecisionConfidence | null;
    decision_confidence_details?: ApplyGateDecisionConfidenceDetails | null;
    search_memory?: ApplyGateSearchMemory | null;
    requirement_classification?: ApplyGateRequirementClassification[];
    role_core_gaps?: string[];
    missing_required: string[];
    missing_preferred: string[];
    evidence_gaps?: string[];
    capability_gaps?: string[];
    primary_rejection_drivers?: string[];
    decision?: "apply_now" | "apply_with_caveats" | "fix_first" | "skip";
    assessment_confidence?: "high" | "medium" | "low";
    uncertainty_notes?: string[];
    requirement_ledger?: ApplyGateRequirementLedger | null;
    action_plan?: {
      quick_fixes?: string[];
      resume_proof_improvements?: string[];
      long_term_gaps?: string[];
      not_fixable_for_this_posting?: string[];
    };
    fit_notes: string[];
  };
  displayDecision?: ApplyGateDisplayDecision | null;
  decisionConfidence?: ApplyGateDecisionConfidence | null;
  confidenceType?: ApplyGateConfidenceType | null;
  decisionSystem?: ApplyGateDecisionSystem | null;
  opportunityCost?: ApplyGateOpportunityCost | null;
  overrideInsight?: string | null;
  calibrationBucket?: ApplyGateCalibrationBucket | null;
  signalLeakage?: boolean;
  diagnostics?: ApplyGateDecisionDiagnostics | null;
  searchMemory?: ApplyGateSearchMemory | null;
  matchedSkills: string[];
  missingSkills: string[];
  jobReqs: {
    detectedSeniority: string | null;
    requiredYears: number | null;
    requiredEducation: string | null;
    hardSkills?: string[];
    preferredSkills?: string[];
  };
  userProfile: {
    inferredSeniority: string | null;
    estimatedYears: number | null;
    education: string | null;
  };
  scoringBreakdown: ApplyGateScoringBreakdown;
  fixSuggestion: string | null;
  riskTolerance?: ApplyGateRiskTolerance;
  discipline_alignment_score?: number;
  discipline_transition_label?: "Adjacent" | "Stretch" | "Mismatch";
  discipline_dimension_breakdown?: {
    scope: number;
    execution: number;
    environment: number;
    autonomy: number;
  };
  strategicFit?: {
    label: "aligned" | "adjacent" | "stretch";
    alignmentScore: number;
    gaps: string[];
    rationale: string;
  };
  priorHistory?: ApplyGatePriorHistory | null;
};

export interface ApplyGatePriorHistoryExample {
  company: string | null;
  position: string | null;
  subject: string | null;
  date: string | null;
}

export interface ApplyGatePriorHistory {
  headline: string;
  recommendation: "skip" | "fix_first" | "proceed_with_confidence" | null;
  rejectionCount: number;
  sameCompanyRejectionCount?: number;
  similarRolesEvaluated: number;
  verdictBreakdown: { skip: number; fix: number; apply: number; total: number };
  recurringTheme: string | null;
  recurringThemeOccurrences: number;
  examples: ApplyGatePriorHistoryExample[];
}

export type ApplyGateHistoryItem = {
  id: string;
  job_title: string;
  company_name?: string | null;
  job_url?: string | null;
  verdict: ApplyGateVerdict;
  score: number;
  hard_blocker?: boolean | null;
  reasons: string;
  explanation_payload?: ApplyGateResult["explanation"] | null;
  extraction_meta?: ApplyGateResult["extractionMeta"] | null;
  fix_suggestion: string | null;
  user_action: string | null;
  user_action_at?: string | null;
  outcome_label?: string | null;
  outcome_recorded_at?: string | null;
  feedback_payload?: Record<string, unknown> | null;
  created_at: string;
};

export type ApplyGateOutcome = "interviewed" | "offered" | "rejected" | "withdrawn" | "no_response";

export async function analyzeJobAlignment(params: {
  jobTitle: string;
  jobDescription: string;
  companyName?: string;
  jobUrl?: string;
  riskTolerance?: ApplyGateRiskTolerance;
  variantId?: string;
}): Promise<ApplyGateResult> {
  return apiFetch("/api/emails/apply-gate/analyze", {
    method: "POST",
    body: JSON.stringify(params),
    // The premium verdict runs a full LLM pass over the resume + JD, which takes
    // ~30s end-to-end. The default 15s client timeout aborts mid-flight while the
    // backend keeps running and still persists a verdict — surfacing a false
    // "timed out" error to the user (and stacking duplicate verdicts on retry).
    // Give the request enough headroom for the real AI latency plus scoring.
    timeoutMs: 45_000,
  });
}

export async function fetchApplyGateHistory(): Promise<{
  success: boolean;
  history: ApplyGateHistoryItem[];
}> {
  return apiFetch("/api/emails/apply-gate/history", { method: "GET" });
}

export async function updateApplyGateAction(
  verdictId: string,
  action: "applied" | "fixed" | "skipped",
  options?: {
    outcome?: ApplyGateOutcome;
    outcomeRecordedAt?: string;
    feedback?: Record<string, unknown>;
  }
): Promise<{ success: boolean }> {
  const payload = {
    action,
    ...(options?.outcome ? { outcome: options.outcome } : {}),
    ...(options?.outcomeRecordedAt ? { outcomeRecordedAt: options.outcomeRecordedAt } : {}),
    ...(options?.feedback ? { feedback: options.feedback } : {}),
  };

  return apiFetch(`/api/emails/apply-gate/${verdictId}/action`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ─── Pre-jection: HR Screening Risk Simulator ────────────────────────

export type PrejectionSeverity = "very_high" | "high" | "moderate" | "medium" | "low";
export type PrejectionOverall = "clear" | "very_high" | "high" | "moderate" | "medium" | "low";

export type PrejectionRisk = {
  category: string;
  risk: string;
  severity: PrejectionSeverity;
};

export type PrejectionResult = {
  id?: string | null;
  rejectionRisk?: number;
  riskLevel?: "low" | "moderate" | "high" | "very_high";
  breakdown?: {
    atsRisk: number;
    recruiterRisk: number;
    hiringManagerRisk: number;
    marketRisk?: number;
  };
  primaryRejectionReasons?: string[];
  stageMostLikelyToReject?: "ATS" | "Recruiter Screen" | "Hiring Manager Screen" | string;
  mitigationPlan?: string;
  competitivePositioning?: "weak" | "average" | "strong";

  // Legacy compatibility fields
  overall?: PrejectionOverall;
  risks?: PrejectionRisk[];
  suggestedMove?: string;
  profile?: {
    seniority?: { level: number; label: string };
    topSkills?: string[];
    industries?: string[];
    hasEnoughData?: boolean;
    hasResume?: boolean;
  };
};

export type PrejectionHistoryItem = {
  id: string;
  job_title: string;
  // Legacy fields
  overall_risk?: PrejectionOverall;
  risks?: string; // JSON stringified
  suggested_move?: string;

  // New fields
  risk_level?: "low" | "moderate" | "high" | "very_high";
  rejection_risk?: number;
  breakdown?: string;
  primary_reasons?: string;
  stage_most_likely?: string;
  mitigation_plan?: string;
  competitive_positioning?: "weak" | "average" | "strong";
  created_at: string;
};

export type PrejectionPatterns = {
  recurringRiskCodes: string[];
  dominantRejectionStage: string;
  averageRiskScore: number;
  patternInsight: string;
};

export async function analyzePrejection(params: {
  jobTitle: string;
  jobDescription: string;
}): Promise<{ success: boolean; result: PrejectionResult }> {
  return apiFetch("/api/emails/prejection/analyze", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchPrejectionHistory(): Promise<{
  success: boolean;
  history: PrejectionHistoryItem[];
}> {
  return apiFetch("/api/emails/prejection/history", { method: "GET" });
}

export async function fetchPrejectionPatterns(): Promise<{
  success: boolean;
  patterns: PrejectionPatterns;
}> {
  return apiFetch("/api/emails/prejection/patterns", { method: "GET" });
}

// ─── Resume / Profile ────────────────────────────────────────────────

export async function saveResume(
  resumeText: string
): Promise<{ success: boolean }> {
  return apiFetch("/api/emails/profile/resume", {
    method: "PUT",
    body: JSON.stringify({ resumeText }),
  });
}

export async function fetchResume(): Promise<{
  success: boolean;
  resumeText: string | null;
}> {
  return apiFetch("/api/emails/profile/resume", { method: "GET" });
}

export async function deleteResume(): Promise<{ success: boolean }> {
  return apiFetch("/api/emails/profile/resume", { method: "DELETE" });
}

// ── Résumé variants + outcome scoreboard ─────────────────────────────
export type ResumeVariant = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  charCount: number;
};

export type VariantScoreRow = {
  variantId: string;
  name: string;
  sent: number;
  matchedToOutcome: number;
  interviewed: number;
  offered: number;
  rejected: number;
  noResponse: number;
  interviewRate: number | null;
  sufficientSample: boolean;
};

export type VariantScoreboard = { perVariant: VariantScoreRow[]; minSample: number };
export type VariantRecommendation = { variantId: string; name: string; interviewRate: number } | null;

export async function fetchResumeVariants(): Promise<{ success: boolean; variants: ResumeVariant[] }> {
  return apiFetch("/api/resumes", { method: "GET" });
}

export async function createResumeVariant(body: { name: string; text: string }): Promise<{ success: boolean; id?: string; error?: string }> {
  return apiFetch("/api/resumes", { method: "POST", body: JSON.stringify(body) });
}

export async function renameResumeVariant(id: string, name: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/resumes/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function setDefaultResumeVariant(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/resumes/${id}`, { method: "PATCH", body: JSON.stringify({ makeDefault: true }) });
}

export async function archiveResumeVariant(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/resumes/${id}`, { method: "DELETE" });
}

export async function fetchVariantScoreboard(title?: string): Promise<{ success: boolean; scoreboard: VariantScoreboard; recommendation: VariantRecommendation }> {
  const qs = title ? `?title=${encodeURIComponent(title)}` : "";
  return apiFetch(`/api/resumes/scoreboard${qs}`, { method: "GET" });
}
