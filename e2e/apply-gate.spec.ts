import { expect, test } from "@playwright/test";

const onebriefJobDescription = `Software Development Engineer in Test

What We Look For:
Required:
2+ years of experience building and maintaining test automation at multiple layers (integration, end-to-end) for complex applications, using modern languages such as C++/C#, GD Script, or Python.
Strong technical foundation in release management, automation frameworks, and CI/CD systems.
Hands-on experience with performance, resilience, and security testing, including integration of those checks into CI/CD pipelines and observability systems.
Strong understanding of API quality, including contract validation and dependency testing in distributed systems.

Nice to haves:
Experience maintaining or building declarative CI/CD pipelines (e.g., Azure Pipelines, GitHub Actions).
Familiarity with visual regression testing, performance tooling (k6, JMeter, Artillery), or distributed system fault injection.
Containerization and orchestration experience (Docker, Kubernetes).
Familiarity with observability stacks like Grafana, Kibana, or Prometheus.`;

test("Apply Gate pasted JD flow hides preferred-only gaps from requirement check", async ({ page }) => {
  let analyzeRequestBody: Record<string, unknown> | null = null;

  await page.route("http://127.0.0.1:4010/api/emails/profile/resume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        resumeText: "QA engineer with Python, Selenium, Pytest, API testing, CI/CD, k6, JMeter, and test automation experience.",
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
      body: JSON.stringify({
        success: true,
        id: "onebrief-verdict",
        jobTitle: "Software Development Engineer in Test",
        companyName: "Onebrief",
        verdict: "strong_fit",
        confidence: "medium",
        reasons: [
          "Core overlap includes automation, ci/cd, test automation, python, api.",
          "Experience meets the stated minimum (4 years vs 2 required).",
        ],
        matchedSkills: ["automation", "ci/cd", "test automation", "python", "api"],
        missingSkills: [],
        jobReqs: {
          detectedSeniority: "mid",
          requiredYears: 2,
          requiredEducation: null,
          hardSkills: ["automation", "ci/cd", "test automation", "python", "api"],
          preferredSkills: ["grafana", "kibana", "prometheus"],
        },
        userProfile: {
          inferredSeniority: "mid",
          estimatedYears: 4,
          education: "certificate",
        },
        explanation: {
          hard_blockers: [],
          missing_required: [],
          missing_preferred: ["grafana", "kibana", "prometheus"],
          fit_notes: [
            "Core overlap includes automation, ci/cd, test automation, python, api.",
            "Alternative requirement satisfied (c++ or c# or python) via python.",
          ],
          decision: "apply_now",
          assessment_confidence: "medium",
          uncertainty_notes: [],
          requirement_ledger: {
            version: 1,
            source: "deterministic",
            summary: {
              hard_total: 4,
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
        scoringBreakdown: {
          experienceScore: 90,
          skillScore: 82,
          skillsScore: 82,
          seniorityScore: 85,
          educationScore: 70,
          surfaceScore: 62,
          platformScore: 62,
          totalScore: 82,
          riskFlags: [],
          hardBlocker: false,
          applicationRiskScore: 18,
          applicationRiskLabel: "low",
          applicationRiskSummary: "Overall fit score: low risk.",
          applicationRiskBasis: "deterministic_fit_components",
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
              {
                key: "required_evidence_coverage",
                label: "Required evidence coverage",
                score: 18,
                impact: "low",
                evidence: "Required-skill evidence score is 82/100.",
              },
            ],
          },
        },
        fixSuggestion: "Keep the application focused on release integrity, automation, and CI/CD quality evidence.",
      }),
    });
  });

  await page.goto("/apply-gate");

  await expect(page.getByRole("heading", { name: "Apply Gate" })).toBeVisible();
  await expect(page.getByLabel("Job URL")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Get decision" })).toBeDisabled();

  await page.getByLabel("Job Title").fill("Software Development Engineer in Test");
  await page.getByLabel("Company Name (optional)").fill("Onebrief");
  await page.getByLabel("Job Description").fill(onebriefJobDescription);
  await page.getByRole("button", { name: "Get decision" }).click();

  await expect(page.getByRole("heading", { name: "Apply now" })).toBeVisible();
  const resultPanel = page.locator(".glass-card").filter({
    has: page.getByRole("heading", { name: "Apply now" }),
  });
  await expect(resultPanel.getByText("Application risk:")).toBeVisible();
  await expect(resultPanel.getByText("Risk breakdown")).toBeVisible();
  await expect(resultPanel.getByText("Requirement check")).toHaveCount(0);
  await expect(resultPanel.getByText(/observability stacks like Grafana/i)).toHaveCount(0);

  expect(analyzeRequestBody).toEqual(
    expect.objectContaining({
      jobTitle: "Software Development Engineer in Test",
      companyName: "Onebrief",
      jobDescription: onebriefJobDescription,
    }),
  );
  expect(analyzeRequestBody).not.toHaveProperty("jobUrl");

  await page.screenshot({ path: "test-results/apply-gate-onebrief.png", fullPage: true });
});
