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
  company_name_corrected?: string | null;
  position?: string | null;
  position_corrected?: string | null;
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
  threadId?: string | null;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  company?: string | null;
  actionType?: string | null;
  urgency?: "low" | "medium" | "high" | null;
  daysAgo?: number | null;
  estimatedTime?: string | null;
  category?: string | null;
};

export type FollowupSuggestionsResponse = {
  success: boolean;
  suggestions?: FollowupSuggestion[];
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
