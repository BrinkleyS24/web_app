import { expect, test, type Page } from "@playwright/test";

type RequirementStatus = "missing" | "satisfied" | "unclear";
type RequirementPriority = "hard" | "preferred";

type RequirementItem = {
  id: string;
  label: string;
  priority: RequirementPriority;
  candidateStatus: RequirementStatus;
  sourceSentence?: string;
  blocksApplication?: boolean;
};

type PersonaScenario = {
  key: string;
  resumeText: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  verdict: "strong_fit" | "potential_fit" | "risky" | "not_recommended";
  decision: "apply_now" | "apply_with_caveats" | "fix_first" | "skip";
  confidence: "high" | "medium" | "low";
  expectedHeading: string;
  expectedPrimaryAction: string;
  risk: number;
  riskSummary: string;
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  postingOccupation: { title: string; onetSoc?: string | null };
  profileOccupation: { title: string; onetSoc?: string | null };
  occupationScore: number;
  occupationAlignmentLabel: string;
  occupationConfidence: number;
  requirementItems?: RequirementItem[];
  expectRequirementCheck?: boolean;
};

const scenarios: PersonaScenario[] = [
  {
    key: "frontend-strong",
    resumeText:
      "Frontend Engineer with 5 years building React and TypeScript web applications, integrating REST APIs, and shipping Playwright-tested user flows.",
    jobTitle: "Frontend Engineer",
    companyName: "Northstar",
    jobDescription: `Frontend Engineer

Requirements:
- 3+ years of frontend engineering experience.
- React, TypeScript, HTML, and CSS.
- Experience building web applications that integrate with REST APIs.
- Git and automated testing experience.`,
    verdict: "strong_fit",
    decision: "apply_now",
    confidence: "high",
    expectedHeading: "Apply now",
    expectedPrimaryAction: "Apply now",
    risk: 18,
    riskSummary: "Overall fit score: low risk.",
    reasons: [
      "Core overlap includes react, typescript, rest api, git, and automated testing.",
      "Experience meets the stated minimum (5 years vs 3 required).",
    ],
    matchedSkills: ["react", "typescript", "rest api", "git", "automated testing"],
    missingSkills: [],
    postingOccupation: { title: "Software Developers", onetSoc: "15-1252.00" },
    profileOccupation: { title: "Software Developers", onetSoc: "15-1252.00" },
    occupationScore: 100,
    occupationAlignmentLabel: "same_occupation",
    occupationConfidence: 0.9,
  },
  {
    key: "support-potential",
    resumeText:
      "Support Engineer with 4 years troubleshooting SaaS products, handling customer escalations, writing enablement docs, and coordinating fixes with engineering.",
    jobTitle: "Support Engineer",
    companyName: "Lumos",
    jobDescription: `Support Engineer

Requirements:
- 3+ years of technical support or support engineering experience.
- Troubleshooting SaaS products and customer escalations.
- Clear communication and structured handoff to engineering.
Preferred:
- Experience with Qase or test case tooling.`,
    verdict: "potential_fit",
    decision: "apply_with_caveats",
    confidence: "medium",
    expectedHeading: "Apply with caveats",
    expectedPrimaryAction: "Apply with caveats",
    risk: 38,
    riskSummary: "Required evidence coverage: moderate risk.",
    reasons: [
      "Core overlap includes technical support, troubleshooting, customer escalations, and engineering handoff.",
      "Missing preferred skill: Qase.",
    ],
    matchedSkills: ["technical support", "troubleshooting", "customer escalations"],
    missingSkills: ["qase"],
    postingOccupation: { title: "Computer User Support Specialists", onetSoc: "15-1232.00" },
    profileOccupation: { title: "Computer User Support Specialists", onetSoc: "15-1232.00" },
    occupationScore: 100,
    occupationAlignmentLabel: "same_occupation",
    occupationConfidence: 0.84,
    expectRequirementCheck: false,
    requirementItems: [
      {
        id: "preferred_qase",
        label: "Qase",
        priority: "preferred",
        candidateStatus: "missing",
        sourceSentence: "Experience with Qase or test case tooling.",
      },
    ],
  },
  {
    key: "registered-nurse-strong",
    resumeText:
      "Registered Nurse with 5 years of bedside care, patient assessment, medication administration, BLS certification, and EHR documentation.",
    jobTitle: "Registered Nurse",
    companyName: "Northwell Health",
    jobDescription: `Registered Nurse

Requirements:
- Active RN license required.
- BLS certification required.
- 2+ years of bedside patient care, medication administration, and EHR documentation.`,
    verdict: "strong_fit",
    decision: "apply_now",
    confidence: "high",
    expectedHeading: "Apply now",
    expectedPrimaryAction: "Apply now",
    risk: 22,
    riskSummary: "Overall fit score: low risk.",
    reasons: [
      "Core overlap includes rn license, bls certification, bedside care, and ehr documentation.",
      "Experience meets the stated minimum (5 years vs 2 required).",
    ],
    matchedSkills: ["rn license", "bls certification", "bedside care", "ehr documentation"],
    missingSkills: [],
    postingOccupation: { title: "Registered Nurses", onetSoc: "29-1141.00" },
    profileOccupation: { title: "Registered Nurses", onetSoc: "29-1141.00" },
    occupationScore: 100,
    occupationAlignmentLabel: "same_occupation",
    occupationConfidence: 0.9,
  },
  {
    key: "warehouse-strong",
    resumeText:
      "Warehouse Associate with 4 years of shipping, receiving, inventory counts, order fulfillment, RF scanner use, and forklift operation.",
    jobTitle: "Warehouse Associate",
    companyName: "Summit Logistics",
    jobDescription: `Warehouse Associate

Requirements:
- Shipping and receiving experience.
- Order fulfillment, picking, packing, and inventory control.
- RF scanner use and ability to lift 50 pounds.
- Forklift certification preferred.`,
    verdict: "strong_fit",
    decision: "apply_now",
    confidence: "medium",
    expectedHeading: "Apply now",
    expectedPrimaryAction: "Apply now",
    risk: 26,
    riskSummary: "Overall fit score: low risk.",
    reasons: [
      "Core overlap includes shipping, receiving, inventory control, and order fulfillment.",
      "Physical and warehouse workflow evidence is present in the profile.",
    ],
    matchedSkills: ["shipping", "receiving", "inventory control", "order fulfillment"],
    missingSkills: [],
    postingOccupation: { title: "Stockers and Order Fillers", onetSoc: "53-7065.00" },
    profileOccupation: { title: "Stockers and Order Fillers", onetSoc: "53-7065.00" },
    occupationScore: 100,
    occupationAlignmentLabel: "same_occupation",
    occupationConfidence: 0.81,
  },
  {
    key: "designer-adjacent",
    resumeText:
      "Digital Marketing Specialist with 5 years of campaign management, content strategy, social media, A/B testing, and creative production in Adobe Creative Suite.",
    jobTitle: "Graphic Designer",
    companyName: "Canvas Studio",
    jobDescription: `Graphic Designer

Requirements:
- Adobe Creative Suite, Photoshop, Illustrator, and InDesign.
- Strong branding, layout, typography, and digital asset production.
- Experience partnering with marketing on campaigns.`,
    verdict: "potential_fit",
    decision: "apply_with_caveats",
    confidence: "medium",
    expectedHeading: "Apply with caveats",
    expectedPrimaryAction: "Apply with caveats",
    risk: 44,
    riskSummary: "Overall fit score: moderate risk.",
    reasons: [
      "This looks like an adjacent move based on design and campaign overlap.",
      "Missing required skill: InDesign.",
    ],
    matchedSkills: ["branding", "layout", "digital asset production"],
    missingSkills: ["indesign"],
    postingOccupation: { title: "Graphic Designers", onetSoc: "27-1024.00" },
    profileOccupation: { title: "Marketing Specialists", onetSoc: "13-1161.00" },
    occupationScore: 62,
    occupationAlignmentLabel: "adjacent_occupation_family",
    occupationConfidence: 0.74,
    expectRequirementCheck: true,
    requirementItems: [
      {
        id: "hard_indesign",
        label: "InDesign",
        priority: "hard",
        candidateStatus: "missing",
        sourceSentence: "Adobe Creative Suite, Photoshop, Illustrator, and InDesign.",
      },
    ],
  },
  {
    key: "ultrasound-mismatch",
    resumeText:
      "QA Engineer with Python, Selenium, Pytest, API testing, SQL validation, and CI/CD pipeline experience.",
    jobTitle: "Ultrasound Tech",
    companyName: "Northwell Health",
    jobDescription: `Ultrasound Tech

Requirements:
- Graduate of an accredited Ultrasound Technology program, required.
- Registered Diagnostic Medical Sonographer / ARDMS required.
- Performs ultrasound procedures and prepares patients for examination.`,
    verdict: "not_recommended",
    decision: "skip",
    confidence: "high",
    expectedHeading: "Skip this posting",
    expectedPrimaryAction: "Skip this role",
    risk: 95,
    riskSummary: "Non-negotiable requirement risk: severe risk.",
    reasons: [
      "Missing non-negotiable requirements: Ultrasound Technology program completion and ARDMS credential.",
      "Core discipline mismatch is high-risk for this posting.",
    ],
    matchedSkills: [],
    missingSkills: ["ultrasound technology program", "ardms"],
    postingOccupation: { title: "Diagnostic Medical Sonographers", onetSoc: "29-2032.00" },
    profileOccupation: { title: "Software Quality Assurance Analysts and Testers", onetSoc: "15-1253.00" },
    occupationScore: 20,
    occupationAlignmentLabel: "different_occupation_family",
    occupationConfidence: 0.68,
    expectRequirementCheck: true,
    requirementItems: [
      {
        id: "hard_ultrasound_program",
        label: "Ultrasound Technology program completion",
        priority: "hard",
        candidateStatus: "missing",
        sourceSentence: "Graduate of an accredited Ultrasound Technology program, required.",
        blocksApplication: true,
      },
      {
        id: "hard_ardms",
        label: "Diagnostic Medical Sonographer / ARDMS credential",
        priority: "hard",
        candidateStatus: "missing",
        sourceSentence: "Registered Diagnostic Medical Sonographer / ARDMS required.",
        blocksApplication: true,
      },
    ],
  },
];

function riskLabel(risk: number) {
  if (risk <= 30) return "low";
  if (risk <= 65) return "moderate";
  return "high";
}

function buildRequirementLedger(items: RequirementItem[] = []) {
  const hardItems = items.filter((item) => item.priority === "hard");
  const preferredItems = items.filter((item) => item.priority === "preferred");
  return {
    version: 1,
    source: "playwright_fixture",
    summary: {
      hard_total: hardItems.length,
      hard_missing: hardItems.filter((item) => item.candidateStatus === "missing").length,
      hard_unclear: hardItems.filter((item) => item.candidateStatus === "unclear").length,
      preferred_total: preferredItems.length,
      preferred_missing: preferredItems.filter((item) => item.candidateStatus === "missing").length,
      blocking_labels: hardItems.filter((item) => item.blocksApplication).map((item) => item.label),
    },
    items: items.map((item) => ({
      id: item.id,
      type: item.priority === "hard" ? "hard_skill" : "preferred_skill",
      label: item.label,
      priority: item.priority,
      source_sentence: item.sourceSentence || item.label,
      evidence_needed: [item.label.toLowerCase()],
      candidate_status: item.candidateStatus,
      candidate_evidence: item.candidateStatus === "satisfied" ? "matched candidate evidence" : null,
      confidence: "medium",
      blocks_application: Boolean(item.blocksApplication),
    })),
  };
}

function buildAnalyzeResponse(scenario: PersonaScenario) {
  const requirementItems = scenario.requirementItems || [];
  const requirementLedger = buildRequirementLedger(requirementItems);
  const lowScore = Math.max(0, scenario.risk - 4);
  const secondaryScore = Math.min(99, scenario.risk + 3);

  return {
    success: true,
    id: `persona-${scenario.key}`,
    jobTitle: scenario.jobTitle,
    companyName: scenario.companyName,
    verdict: scenario.verdict,
    confidence: scenario.confidence,
    reasons: scenario.reasons,
    matchedSkills: scenario.matchedSkills,
    missingSkills: scenario.missingSkills,
    jobReqs: {
      detectedSeniority: "mid",
      requiredYears: 3,
      requiredEducation: null,
      hardSkills: scenario.matchedSkills,
      preferredSkills: scenario.missingSkills,
    },
    userProfile: {
      inferredSeniority: "mid",
      estimatedYears: 5,
      education: "bachelors",
    },
    explanation: {
      hard_blockers: requirementItems.filter((item) => item.blocksApplication).map((item) => item.label),
      missing_required: requirementItems.filter((item) => item.priority === "hard" && item.candidateStatus === "missing").map((item) => item.label),
      missing_preferred: requirementItems.filter((item) => item.priority === "preferred" && item.candidateStatus === "missing").map((item) => item.label),
      fit_notes: scenario.reasons,
      decision: scenario.decision,
      assessment_confidence: scenario.confidence,
      uncertainty_notes: [],
      requirement_ledger: requirementLedger,
      application_risk_score: scenario.risk,
    },
    scoringBreakdown: {
      experienceScore: Math.max(40, 100 - scenario.risk),
      skillScore: Math.max(35, 100 - scenario.risk),
      skillsScore: Math.max(35, 100 - scenario.risk),
      seniorityScore: Math.max(50, 96 - scenario.risk),
      educationScore: scenario.verdict === "not_recommended" ? 25 : 72,
      surfaceScore: Math.max(30, 90 - scenario.risk),
      platformScore: Math.max(30, 88 - scenario.risk),
      totalScore: Math.max(5, 100 - scenario.risk),
      riskFlags: requirementItems.some((item) => item.blocksApplication) ? ["universal_hard_constraint_gap"] : [],
      hardBlocker: requirementItems.some((item) => item.blocksApplication),
      applicationRiskScore: scenario.risk,
      applicationRiskLabel: riskLabel(scenario.risk),
      applicationRiskSummary: scenario.riskSummary,
      applicationRiskBasis: "playwright_fixture",
      riskBreakdown: {
        version: 1,
        score: scenario.risk,
        label: riskLabel(scenario.risk),
        basis: "playwright_fixture",
        calibration: "not_outcome_calibrated",
        summary: scenario.riskSummary,
        components: [
          {
            key: "fit_score",
            label: "Overall fit score",
            score: lowScore,
            impact: scenario.risk <= 30 ? "low" : scenario.risk <= 65 ? "moderate" : "high",
            evidence: `Backend fit score is ${Math.max(5, 100 - scenario.risk)}/100.`,
          },
          {
            key: "required_evidence_coverage",
            label: "Required evidence coverage",
            score: secondaryScore,
            impact: scenario.risk <= 30 ? "low" : scenario.risk <= 65 ? "moderate" : "high",
            evidence: `Required-skill evidence score is ${Math.max(5, 100 - secondaryScore)}/100.`,
          },
        ],
      },
      occupationGrounding: {
        version: "playwright_fixture_v1",
        source: "playwright_fixture",
        job: {
          id: `${scenario.key}-job`,
          title: scenario.postingOccupation.title,
          family: "fixture",
          onetSoc: scenario.postingOccupation.onetSoc || null,
          score: 90,
          matchedSignals: [],
        },
        candidate: {
          id: `${scenario.key}-candidate`,
          title: scenario.profileOccupation.title,
          family: "fixture",
          onetSoc: scenario.profileOccupation.onetSoc || null,
          score: 90,
          matchedSignals: [],
        },
        alignmentScore: scenario.occupationScore,
        alignmentLabel: scenario.occupationAlignmentLabel,
        confidence: scenario.occupationConfidence,
        matchedFamilies: [],
      },
    },
    fixSuggestion: scenario.reasons[0],
  };
}

async function mockApplyGate(page: Page, scenario: PersonaScenario) {
  let analyzeRequestBody: Record<string, unknown> | null = null;

  await page.route("http://127.0.0.1:4010/api/emails/profile/resume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        resumeText: scenario.resumeText,
      }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/emails/apply-gate/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, history: [] }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/emails/apply-gate/analyze", async (route) => {
    analyzeRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildAnalyzeResponse(scenario)),
    });
  });

  return {
    getAnalyzeRequestBody: () => analyzeRequestBody,
  };
}

test.describe("Apply Gate persona matrix", () => {
  for (const scenario of scenarios) {
    test(`renders ${scenario.key}`, async ({ page }) => {
      const mocked = await mockApplyGate(page, scenario);

      await page.goto("/apply-gate");

      await expect(page.getByRole("heading", { name: "Apply Gate" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Get decision" })).toBeDisabled();

      await page.getByLabel("Job Title").fill(scenario.jobTitle);
      await page.getByLabel("Company Name (optional)").fill(scenario.companyName);
      await page.getByLabel("Job Description").fill(scenario.jobDescription);
      await page.getByRole("button", { name: "Get decision" }).click();

      const resultPanel = page.locator(".glass-card").filter({
        has: page.getByRole("heading", { name: scenario.expectedHeading }),
      });

      await expect(resultPanel.getByText("Application risk:")).toBeVisible();
      await expect(resultPanel.getByText(`${scenario.risk}%`)).toBeVisible();
      await expect(resultPanel.getByText("Risk breakdown")).toBeVisible();
      await expect(resultPanel.getByText("Occupation grounding")).toBeVisible();
      await expect(resultPanel.getByText(`${scenario.occupationScore}/100`)).toBeVisible();
      if (scenario.postingOccupation.title === scenario.profileOccupation.title) {
        await expect(resultPanel.getByText(scenario.postingOccupation.title)).toHaveCount(2);
      } else {
        await expect(resultPanel.getByText(scenario.postingOccupation.title)).toBeVisible();
        await expect(resultPanel.getByText(scenario.profileOccupation.title)).toBeVisible();
      }
      await expect(resultPanel.getByRole("button", { name: scenario.expectedPrimaryAction })).toBeVisible();

      if (scenario.expectRequirementCheck) {
        await expect(resultPanel.getByText("Requirement check")).toBeVisible();
        for (const item of scenario.requirementItems || []) {
          await expect(resultPanel.getByText(item.label, { exact: true }).first()).toBeVisible();
        }
      } else {
        await expect(resultPanel.getByText("Requirement check")).toHaveCount(0);
      }

      expect(mocked.getAnalyzeRequestBody()).toEqual(
        expect.objectContaining({
          jobTitle: scenario.jobTitle,
          companyName: scenario.companyName,
          jobDescription: scenario.jobDescription,
        }),
      );

      await page.screenshot({ path: `test-results/apply-gate-${scenario.key}.png`, fullPage: true });
    });
  }
});
