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
  };
  dataCompleteness?: {
    syncComplete: boolean;
    oldestEmailDate: string | null;
    oldestSyncedDate: string | null;
    lastSyncAt: string | null;
    progressPercentage: number;
  };
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
  educationBlock?: boolean;
  skillBlock?: boolean;
  totalScore: number;
};

export type ApplyGateResult = {
  success: boolean;
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
    role_core_gaps?: string[];
    missing_required: string[];
    missing_preferred: string[];
    evidence_gaps?: string[];
    capability_gaps?: string[];
    primary_rejection_drivers?: string[];
    decision?: "apply_now" | "apply_with_caveats" | "fix_first" | "skip";
    assessment_confidence?: "high" | "medium" | "low";
    uncertainty_notes?: string[];
    action_plan?: {
      quick_fixes?: string[];
      resume_proof_improvements?: string[];
      long_term_gaps?: string[];
      not_fixable_for_this_posting?: string[];
    };
    fit_notes: string[];
  };
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
};

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
}): Promise<ApplyGateResult> {
  return apiFetch("/api/emails/apply-gate/analyze", {
    method: "POST",
    body: JSON.stringify(params),
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
