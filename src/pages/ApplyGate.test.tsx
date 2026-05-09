import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import ApplyGate from "./ApplyGate";

const {
  analyzeJobAlignment,
  fetchApplyGateHistory,
  updateApplyGateAction,
  fetchResume,
} = vi.hoisted(() => ({
  analyzeJobAlignment: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  updateApplyGateAction: vi.fn(),
  fetchResume: vi.fn(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb({ uid: "test-user" });
    return () => {};
  },
}));

vi.mock("@/lib/firebase", () => ({
  auth: { currentUser: { uid: "test-user" } },
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    analyzeJobAlignment,
    fetchApplyGateHistory,
    updateApplyGateAction,
    fetchResume,
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ApplyGate />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const baseResult = {
  success: true,
  id: "verdict-123",
  verdict: "risky",
  confidence: "high",
  reasons: ["Missing required: plc programming.", "Education gap."],
  matchedSkills: ["automation", "api"],
  missingSkills: ["allen-bradley", "mitsubishi", "plc"],
  jobReqs: {
    detectedSeniority: "mid",
    requiredYears: 3,
    requiredEducation: "bachelors",
    hardSkills: ["automation", "plc"],
    preferredSkills: ["sql"],
  },
  userProfile: {
    inferredSeniority: "mid",
    estimatedYears: 4,
    education: "certificate",
  },
  scoringBreakdown: {
    experienceScore: 90,
    skillScore: 20,
    skillsScore: 20,
    seniorityScore: 85,
    educationScore: 30,
    surfaceScore: 62,
    platformScore: 62,
    totalScore: 44,
    riskFlags: ["education_gap", "critical_skill_gap"],
    hardBlocker: true,
    applicationRiskScore: 92,
    applicationRiskLabel: "severe",
    applicationRiskSummary: "Education or training fit: severe risk.",
    applicationRiskBasis: "deterministic_fit_components",
    riskBreakdown: {
      version: 1,
      score: 92,
      label: "severe",
      basis: "deterministic_fit_components",
      calibration: "not_outcome_calibrated",
      summary: "Education or training fit: severe risk.",
      components: [
        {
          key: "education_alignment",
          label: "Education or training fit",
          score: 92,
          impact: "severe",
          evidence: "Education score is 30/100.",
        },
        {
          key: "required_evidence_coverage",
          label: "Required evidence coverage",
          score: 80,
          impact: "high",
          evidence: "Required-skill evidence score is 20/100.",
        },
      ],
    },
  },
  fixSuggestion: "Target adjacent automation roles first.",
};

async function runAnalyze(options?: { companyName?: string; jobTitle?: string; jobDescription?: string }) {
  await userEvent.type(screen.getByLabelText("Job Title"), options?.jobTitle || "Automation Engineer");
  if (options?.companyName) {
    await userEvent.type(screen.getByLabelText("Company Name (optional)"), options.companyName);
  }
  await userEvent.type(
    screen.getByLabelText("Job Description"),
    options?.jobDescription || "Requires PLC and controls experience.",
  );
  await userEvent.click(screen.getByRole("button", { name: /Get decision/i }));
}

beforeEach(() => {
  fetchResume.mockResolvedValue({ success: true, resumeText: "resume text with enough length" });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });
  updateApplyGateAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("ApplyGate current UI", () => {
  test("uses pasted job descriptions as the active input path", async () => {
    renderPage();

    expect(screen.queryByLabelText(/Job URL/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Get decision/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Job Description"), "Requires PLC and controls experience.");

    expect(screen.getByRole("button", { name: /Get decision/i })).toBeEnabled();
  });

  test("snapshot: risky verdict renders the current card layout", async () => {
    analyzeJobAlignment.mockResolvedValue(baseResult);
    const { container } = renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Automation Engineer")).toBeInTheDocument();
      expect(screen.getByText("Fix first before applying")).toBeInTheDocument();
      expect(screen.getByText("I'll fix first")).toBeInTheDocument();
    });

    expect(container).toMatchSnapshot();
  });

  test("uses displayDecision as the single visible decision when the contract flag is enabled", async () => {
    vi.stubEnv("VITE_APPLY_GATE_DISPLAY_DECISION_V1", "true");
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "not_recommended",
      explanation: {
        decision: "skip",
        display_decision: {
          version: 1,
          action: "FIX_THEN_APPLY",
          label: "Fix before applying",
          headline: "Fix first before applying",
          subtext: "This is an aligned role, but the shown tenure needs clearer proof before applying.",
          renderMode: "EXPANDED",
          legacyDecision: "fix_first",
          status: "risky",
          source: "STRONG_MATCH_FLOOR",
          diagnostics: {
            arbitrationSource: "STRONG_MATCH_FLOOR",
            aiConstraint: null,
            subtextSuppressed: false,
            hardBlocker: false,
            legacy: {
              strategicDecision: "SKIP",
              finalVerdict: "not_recommended",
              legacyDecision: "skip",
            },
          },
        },
      },
      displayDecision: {
        version: 1,
        action: "FIX_THEN_APPLY",
        label: "Fix before applying",
        headline: "Fix first before applying",
        subtext: "This is an aligned role, but the shown tenure needs clearer proof before applying.",
        renderMode: "EXPANDED",
        legacyDecision: "fix_first",
        status: "risky",
        source: "STRONG_MATCH_FLOOR",
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "Software Engineer in Test (SDET)", companyName: "NAVA" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Fix first before applying" })).toBeInTheDocument();
      expect(screen.getByText("Recommended move: Fix before applying")).toBeInTheDocument();
      expect(screen.getByText("This is an aligned role, but the shown tenure needs clearer proof before applying.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "I'll fix first" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Recommended move: Skip this posting")).not.toBeInTheDocument();
  });

  test("uses a safe degraded state when displayDecision is missing behind the contract flag", async () => {
    vi.stubEnv("VITE_APPLY_GATE_DISPLAY_DECISION_V1", "true");
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "strong_fit",
      explanation: {
        decision: "apply_now",
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "QA Automation Engineer" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Decision unavailable" })).toBeInTheDocument();
      expect(screen.getByText("Fit label: Decision unavailable")).toBeInTheDocument();
      expect(screen.getByText("Apply Gate could not produce a consistent decision for this role. Review it manually before acting.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Recommended move: Apply now")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply now" })).not.toBeInTheDocument();
  });

  test("leads with skip when backend marks a risky hard-gate role as skip", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      jobTitle: "Patient Care Technician",
      explanation: {
        decision: "skip",
        hard_blockers: [
          "This posting has hard eligibility requirements not shown in your resume: Nurse's Aide experience, phlebotomy program completion, and BCLS / Basic Cardiac Life Support certification.",
        ],
        assessment_confidence: "high",
        decision_confidence: "High",
        decision_confidence_details: {
          level: "High",
          sampleSize: 0,
          conflictCount: 0,
          factors: ["A true hard blocker gives the recommendation a clearer boundary."],
        },
        uncertainty_notes: [],
        requirement_ledger: {
          version: 1,
          source: "deterministic",
          summary: {
            hard_total: 3,
            hard_missing: 3,
            hard_unclear: 0,
            blocking_labels: ["Nurse's Aide experience", "phlebotomy program completion", "BCLS / Basic Cardiac Life Support certification"],
          },
          items: [
            {
              id: "prior_role_nurse_aide",
              type: "prior_role_experience",
              label: "Nurse's Aide experience",
              priority: "hard",
              source_sentence: "Qualified candidates must have experience as a Nurse's Aide or an equivalent role.",
              evidence_needed: ["nurse", "aide"],
              candidate_status: "missing",
              candidate_evidence: null,
              confidence: "high",
              blocks_application: true,
            },
          ],
        },
        action_plan: {
          quick_fixes: [],
          resume_proof_improvements: [
            "If you already have Nurse's Aide experience, phlebotomy program completion, and BCLS / Basic Cardiac Life Support certification, add that evidence explicitly before applying.",
          ],
          long_term_gaps: [
            "For similar roles, earn or document the required credential, training, or prior-role evidence first: Nurse's Aide experience, phlebotomy program completion, and BCLS / Basic Cardiac Life Support certification.",
          ],
          not_fixable_for_this_posting: [
            "Do not apply unless you already have these requirements: Nurse's Aide experience, phlebotomy program completion, and BCLS / Basic Cardiac Life Support certification.",
          ],
        },
      },
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        hardBlocker: true,
        riskFlags: ["universal_hard_constraint_gap", "required_prior_role_gap", "required_program_completion_gap", "license_credential_gap"],
        totalScore: 36,
        universalConstraintBlock: true,
        universalConstraintFit: {
          block: true,
          scoreCap: 39,
          constraints: [],
          blockingConstraints: [
            {
              key: "prior_role:nurse_aide",
              type: "prior_role_experience",
              label: "Nurse's Aide experience",
              priority: "hard",
              statement: "Qualified candidates must have experience as a Nurse's Aide or an equivalent role.",
              status: "missing",
              evidence: null,
              blocksApplication: true,
              evidenceExpected: true,
            },
            {
              key: "program_completion:phlebotomy",
              type: "program_completion",
              label: "phlebotomy program completion",
              priority: "hard",
              statement: "Completion of an approved phlebotomy program is required.",
              status: "missing",
              evidence: null,
              blocksApplication: true,
              evidenceExpected: true,
            },
            {
              key: "bcls",
              type: "certification",
              label: "BCLS / Basic Cardiac Life Support certification",
              priority: "hard",
              statement: "BCLS certification is required.",
              status: "missing",
              evidence: null,
              blocksApplication: true,
              evidenceExpected: true,
            },
          ],
          unclearHardConstraints: [],
          riskFlags: ["universal_hard_constraint_gap"],
          summaryLabels: ["Nurse's Aide experience", "phlebotomy program completion", "BCLS / Basic Cardiac Life Support certification"],
        },
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "Patient Care Technician" });

    await waitFor(() => {
      expect(screen.getAllByText("Skip this role").length).toBeGreaterThan(0);
      expect(screen.queryByText("I'll fix first")).not.toBeInTheDocument();
      expect(screen.getByText(/Missing non-negotiable requirements/i)).toBeInTheDocument();
      expect(screen.getByText("Requirement check")).toBeInTheDocument();
      expect(screen.getByText("Nurse's Aide experience")).toBeInTheDocument();
      expect(screen.getByText(/Apply anyway only if you already meet these requirements/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Decision confidence:/i).length).toBeGreaterThan(0);
    });
  });

  test("compresses high-confidence clear mismatches to one primary reason", async () => {
    const primaryReason = "This role requires commercial construction site supervision. Your background is software QA, so this is a different career track.";
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "risky",
      jobTitle: "Construction Site Supervisor",
      companyName: "Gregor Industries",
      reasons: [
        "Missing OSHA 30 certification.",
        "Missing commercial construction supervisory experience.",
      ],
      explanation: {
        decision: "skip",
        decision_label: "CLEAR_MISMATCH",
        decision_confidence: "High",
        primary_reason: primaryReason,
        primary_driver_detail: {
          type: "HARD_DOMAIN_MISMATCH_WITH_REQUIRED_DOMAIN_EXPERIENCE_NOT_SHOWN",
          label: "Commercial construction in a Supervisory role",
          reason: primaryReason,
          priority: 2,
          requirementType: "DOMAIN_EXPERIENCE",
        },
        requirement_ledger: {
          version: 1,
          source: "deterministic",
          summary: {
            hard_total: 2,
            hard_missing: 2,
            hard_unclear: 0,
            blocking_labels: ["Commercial construction in a Supervisory role", "OSHA 30 certification"],
          },
          items: [
            {
              id: "domain_experience:construction_supervisor",
              type: "domain_experience",
              requirement_type: "DOMAIN_EXPERIENCE",
              label: "Commercial construction in a Supervisory role",
              priority: "hard",
              source_sentence: "Minimum 3+ years experience in Commercial construction in a Supervisory role.",
              candidate_status: "missing",
              confidence: "high",
              blocks_application: true,
            },
            {
              id: "certification:osha_30",
              type: "certification",
              requirement_type: "CERTIFICATION",
              label: "OSHA 30 certification",
              priority: "hard",
              source_sentence: "OSHA 30 required.",
              candidate_status: "missing",
              confidence: "high",
              blocks_application: true,
            },
          ],
        },
        action_plan: {
          quick_fixes: ["Do not apply unless this proof is missing from the resume."],
          resume_proof_improvements: ["Add construction supervision evidence only if you already have it."],
          long_term_gaps: ["Build construction field supervision evidence first."],
          not_fixable_for_this_posting: ["This is not a quick tailoring issue."],
        },
      },
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        decisionLabel: "CLEAR_MISMATCH",
        primaryDriver: {
          type: "HARD_DOMAIN_MISMATCH_WITH_REQUIRED_DOMAIN_EXPERIENCE_NOT_SHOWN",
          label: "Commercial construction in a Supervisory role",
          reason: primaryReason,
          priority: 2,
          requirementType: "DOMAIN_EXPERIENCE",
        },
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "Construction Site Supervisor" });

    await waitFor(() => {
      expect(screen.getAllByText(primaryReason)).toHaveLength(1);
    });
    expect(screen.queryByText("Why this recommendation")).not.toBeInTheDocument();
    expect(screen.queryByText("Requirement check")).not.toBeInTheDocument();
    expect(screen.queryByText("How to improve your odds")).not.toBeInTheDocument();
  });

  test("compresses aligned stretch decisions to the seniority driver", async () => {
    const primaryReason = "This is an aligned role, but it is calibrated above your shown tenure: 6+ years requested vs ~1.6 years shown.";
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "potential_fit",
      jobTitle: "Software Development Engineer in Test (SDET)",
      companyName: "Foodsmart",
      missingSkills: ["appium"],
      reasons: [
        "Missing required skills: appium.",
        "Experience appears below the stated minimum.",
      ],
      explanation: {
        decision: "apply_now",
        decision_label: "STRETCH",
        decision_confidence: "Medium",
        primary_reason: primaryReason,
        primary_driver_detail: {
          type: "SENIORITY_GAP",
          label: "6+ years experience",
          reason: primaryReason,
          priority: 5.5,
        },
        requirement_ledger: {
          version: 1,
          source: "deterministic",
          summary: {
            hard_total: 3,
            hard_missing: 1,
            hard_unclear: 0,
            blocking_labels: ["Appium"],
          },
          items: [
            {
              id: "tool:appium",
              type: "tool",
              requirement_type: "TOOL",
              label: "Appium",
              priority: "hard",
              source_sentence: "Experience with Selenium, Cypress, Appium, TestNG, JUnit, Protractor, and playwright.",
              candidate_status: "missing",
              confidence: "medium",
              blocks_application: false,
            },
          ],
        },
      },
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        hardBlocker: false,
        decisionLabel: "STRETCH",
        applicationRiskScore: 42,
        primaryDriver: {
          type: "SENIORITY_GAP",
          label: "6+ years experience",
          reason: primaryReason,
          priority: 5.5,
        },
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "Software Development Engineer in Test (SDET)", companyName: "Foodsmart" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Apply, but tailor first" })).toBeInTheDocument();
      expect(screen.getByText(primaryReason)).toBeInTheDocument();
      expect(screen.getByText("Fit label: Stretch aligned")).toBeInTheDocument();
      expect(screen.getByText("Recommended move: Apply, but tailor first")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apply, tailored" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Requirement check")).not.toBeInTheDocument();
    expect(screen.queryByText("How to improve your odds")).not.toBeInTheDocument();
    expect(screen.queryByText(/Missing required skills/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Recommended move: Apply now")).not.toBeInTheDocument();
  });

  test("does not render empty search memory response time", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      explanation: {
        search_memory: {
          version: 1,
          mode: "descriptive",
          confidence: "low",
          sampleSize: 0,
          noResponseWindowDays: 21,
          similarRoles: [],
          commonSkills: [],
          outcomeSummary: {
            similarRoleCount: 0,
            interviewed: 0,
            offered: 0,
            rejected: 0,
            noResponse: 0,
            interviewRate: 0,
            rejectionRate: 0,
            noResponseRate: 0,
            medianDaysToResponse: "",
            medianDaysToInterview: null,
            medianDaysToRejection: null,
          },
          patternSignals: ["No similar tracked roles were found yet."],
        },
      },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Search memory")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Median response time:/i)).not.toBeInTheDocument();
  });

  test("leads skip results with a memory-backed behavioral warning", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "not_recommended",
      explanation: {
        decision: "skip",
        search_memory: {
          version: 1,
          mode: "descriptive",
          confidence: "weak",
          sampleSize: 8,
          noResponseWindowDays: 21,
          similarRoles: [],
          commonSkills: [],
          outcomeSummary: {
            similarRoleCount: 8,
            interviewed: 0,
            offered: 0,
            rejected: 0,
            noResponse: 8,
            interviewRate: 0,
            rejectionRate: 0,
            noResponseRate: 1,
            medianDaysToResponse: "",
            medianDaysToInterview: null,
            medianDaysToRejection: null,
          },
          patternSignals: ["Similar tracked roles have not received responses yet."],
        },
      },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Skip this. You've tried 8 similar roles and 8 got no response.")).toBeInTheDocument();
      expect(screen.getByText("Search memory: 8 similar roles - 8 no responses")).toBeInTheDocument();
    });
  });

  test("translates hard-blocker flags into the warning banner", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        riskFlags: ["education_gap", "critical_skill_gap", "discipline_mismatch"],
      },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Likely rejection driver: Required education level is missing")).toBeInTheDocument();
      expect(screen.queryByText("Company unavailable")).not.toBeInTheDocument();
    });
  });

  test("passes optional company name and renders it for pasted descriptions", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      companyName: "Acme Robotics",
    });
    renderPage();

    await runAnalyze({ companyName: "Acme Robotics" });

    await waitFor(() => {
      expect(analyzeJobAlignment).toHaveBeenCalledWith({
        jobTitle: "Automation Engineer",
        companyName: "Acme Robotics",
        jobDescription: "Requires PLC and controls experience.",
        riskTolerance: "balanced",
      });
      expect(screen.getByText("Acme Robotics")).toBeInTheDocument();
    });
  });

  test("passes selected apply style as risk tolerance", async () => {
    analyzeJobAlignment.mockResolvedValue(baseResult);
    renderPage();

    await userEvent.selectOptions(screen.getByLabelText("Apply style"), "aggressive");
    await runAnalyze();

    await waitFor(() => {
      expect(analyzeJobAlignment).toHaveBeenCalledWith({
        jobTitle: "Automation Engineer",
        companyName: "",
        jobDescription: "Requires PLC and controls experience.",
        riskTolerance: "aggressive",
      });
    });
  });

  test("renders occupation grounding when backend provides it", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        occupationGrounding: {
          version: "onet-bls-seed-v1",
          source: "seeded_onet_bls_retrieval",
          alignmentScore: 20,
          alignmentLabel: "different_occupation_family",
          confidence: 0.72,
          matchedFamilies: ["clinical_imaging", "software_quality"],
          job: {
            id: "diagnostic_medical_sonographers",
            title: "Diagnostic Medical Sonographers",
            family: "clinical_imaging",
            onetSoc: "29-2032.00",
            score: 82,
            matchedSignals: ["ultrasound", "ardms"],
          },
          candidate: {
            id: "software_qa_analysts_testers",
            title: "Software Quality Assurance Analysts and Testers",
            family: "software_quality",
            onetSoc: "15-1253.00",
            score: 90,
            matchedSignals: ["test automation", "selenium"],
          },
        },
      },
    });
    renderPage();

    await runAnalyze({ jobTitle: "Ultrasound Tech", jobDescription: "ARDMS and ultrasound technology program required." });

    await waitFor(() => {
      expect(screen.getByText("Occupation grounding")).toBeInTheDocument();
      expect(screen.getByText("Diagnostic Medical Sonographers")).toBeInTheDocument();
      expect(screen.getByText("Software Quality Assurance Analysts and Testers")).toBeInTheDocument();
      expect(screen.getByText(/Different occupation family/i)).toBeInTheDocument();
    });
  });

  test("does not show preferred-only gaps in the requirement check", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "strong_fit",
      reasons: ["Core automation evidence is strong."],
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        hardBlocker: false,
        totalScore: 82,
        riskFlags: [],
        applicationRiskScore: 18,
        applicationRiskLabel: "low",
        applicationRiskSummary: "Overall fit score: low risk.",
        riskBreakdown: {
          version: 1,
          score: 18,
          label: "low",
          basis: "deterministic_fit_components",
          calibration: "not_outcome_calibrated",
          summary: "Overall fit score: low risk.",
          components: [
            {
              key: "fit_score",
              label: "Overall fit score",
              score: 18,
              impact: "low",
              evidence: "Backend fit score is 82/100.",
            },
          ],
        },
      },
      explanation: {
        decision: "apply_now",
        hard_blockers: [],
        missing_required: [],
        missing_preferred: [],
        fit_notes: ["Core automation evidence is strong."],
        assessment_confidence: "medium",
        uncertainty_notes: [],
        requirement_ledger: {
          version: 1,
          source: "deterministic",
          summary: {
            hard_total: 1,
            hard_missing: 0,
            hard_unclear: 0,
            preferred_total: 1,
            preferred_missing: 1,
            blocking_labels: [],
          },
          items: [
            {
              id: "preferred_observability",
              type: "preferred_skill",
              label: "observability stacks like Grafana, Kibana, or Prometheus",
              priority: "preferred",
              source_sentence: "Familiarity with observability stacks like Grafana, Kibana, or Prometheus.",
              evidence_needed: ["grafana", "kibana", "prometheus"],
              candidate_status: "missing",
              candidate_evidence: null,
              confidence: "medium",
              blocks_application: false,
            },
          ],
        },
      },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Apply now" })).toBeInTheDocument();
      expect(screen.queryByText("Requirement check")).not.toBeInTheDocument();
      expect(screen.queryByText(/observability stacks like Grafana/i)).not.toBeInTheDocument();
    });
  });

  test("records the current decision with feedback for downstream memory", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      jobTitle: "Automation Engineer",
      companyName: "Acme Robotics",
    });
    renderPage();

    await runAnalyze({ companyName: "Acme Robotics" });
    await userEvent.click(await screen.findByRole("button", { name: "I'll fix first" }));

    await waitFor(() => {
      expect(updateApplyGateAction).toHaveBeenCalledWith(
        "verdict-123",
        "fixed",
        {
          feedback: expect.objectContaining({
            surface: "current_result",
            action_label: "fixed",
            recommended_action: "fixed",
            recommendation_override: false,
            override_type: null,
            status: "risky",
            recommendation: "Fix before applying",
            risk_percent: 92,
            role: "Automation Engineer",
            company: "Acme Robotics",
            verdict: "risky",
            score: 44,
            decision: null,
            hard_blocker: true,
          }),
        },
      );
    });
  });

  test("marks recommendation overrides when the user applies against a skip decision", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      explanation: {
        decision: "skip",
        decision_confidence: "Low",
        calibration_bucket: {
          version: 1,
          domainAlignment: "ADJACENT",
          evidenceStrength: "WEAK",
          strategicDecision: "SKIP",
          riskTolerance: "balanced",
          atsPass: "Low",
          humanWin: "Medium",
          decisionConfidence: "Low",
        },
      },
    });
    renderPage();

    await runAnalyze();
    await userEvent.click(await screen.findByRole("button", { name: "Apply anyway" }));

    await waitFor(() => {
      expect(updateApplyGateAction).toHaveBeenCalledWith(
        "verdict-123",
        "applied",
        {
          feedback: expect.objectContaining({
            action_label: "applied",
            recommendation: "Skip this posting",
            recommended_action: "skipped",
            recommendation_override: true,
            override_type: "expected_skipped_user_applied",
            calibration_bucket: expect.objectContaining({
              strategicDecision: "SKIP",
              decisionConfidence: "Low",
            }),
          }),
        },
      );
    });
  });

  test("shows persisted company names in history and hides unresolved placeholders", async () => {
    fetchApplyGateHistory.mockResolvedValue({
      success: true,
      history: [
        {
          id: "history-1",
          job_title: "QA Engineer",
          company_name: "Beta Systems",
          job_url: null,
          verdict: "potential_fit",
          score: 67,
          hard_blocker: false,
          reasons: JSON.stringify(["Some missing preferred skills."]),
          explanation_payload: null,
          fix_suggestion: "Tailor the resume.",
          user_action: null,
          created_at: "2026-04-09T10:00:00.000Z",
        },
        {
          id: "history-2",
          job_title: "SDET",
          company_name: null,
          job_url: null,
          verdict: "risky",
          score: 42,
          hard_blocker: true,
          reasons: JSON.stringify(["Missing required skills."]),
          explanation_payload: null,
          fix_suggestion: "Fix first.",
          user_action: null,
          created_at: "2026-04-08T10:00:00.000Z",
        },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("QA Engineer")).toBeInTheDocument();
      expect(screen.getByText("Beta Systems")).toBeInTheDocument();
      expect(screen.getByText("SDET")).toBeInTheDocument();
      expect(screen.queryByText("Company unavailable")).not.toBeInTheDocument();
    });
  });
});
