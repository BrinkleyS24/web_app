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
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  await page.route("**/api/emails/profile/resume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        resumeText: "QA engineer with Python, Selenium, Pytest, API testing, CI/CD, k6, JMeter, and test automation experience.",
      }),
    });
  });

  await page.route("**/api/emails/apply-gate/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, history: [] }),
    });
  });

  await page.route("**/api/emails/apply-gate/analyze", async (route) => {
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
          display_decision: {
            version: 1,
            action: "APPLY",
            label: "Apply now",
            headline: "Apply now",
            subtext: "This role is worth applying to.",
            renderMode: "EXPANDED",
            legacyDecision: "apply_now",
            status: "strong",
            source: "TEST",
            diagnostics: { hardBlocker: false },
          },
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

  await page.goto("/apply-gate", { waitUntil: "domcontentloaded" });

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
  await expect(resultPanel.getByText("Why this recommendation")).toBeVisible();
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
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);

  await page.screenshot({ path: "test-results/apply-gate-onebrief.png", fullPage: true });
});

test("Apply Gate keeps the decision visible when saving the action fails", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    const isExpectedSaveFailure =
      text.includes("/api/emails/apply-gate/save-failure-verdict/action") ||
      text.includes("500 (Internal Server Error)");
    if (msg.type() === "error" && !isExpectedSaveFailure) consoleErrors.push(text);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/emails/profile/resume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        resumeText: "QA engineer with Python, Cypress, Playwright, API testing, SQL, and CI/CD experience.",
      }),
    });
  });

  await page.route("**/api/emails/apply-gate/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, history: [] }),
    });
  });

  await page.route("**/api/emails/apply-gate/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        id: "save-failure-verdict",
        jobTitle: "Automation Engineer",
        companyName: "Acme Robotics",
        verdict: "risky",
        confidence: "medium",
        reasons: ["Missing stronger role-specific automation proof."],
        matchedSkills: ["python", "api testing"],
        missingSkills: ["robotics"],
        jobReqs: {
          detectedSeniority: "mid",
          requiredYears: 2,
          requiredEducation: null,
          hardSkills: ["python", "api testing", "robotics"],
          preferredSkills: [],
        },
        userProfile: {
          inferredSeniority: "mid",
          estimatedYears: 3,
          education: "certificate",
        },
        explanation: {
          decision: "fix_first",
          display_decision: {
            version: 1,
            action: "FIX_THEN_APPLY",
            label: "Fix before applying",
            headline: "Fix first before applying",
            subtext: "Add the missing robotics proof before applying.",
            renderMode: "EXPANDED",
            legacyDecision: "fix_first",
            status: "risky",
            source: "TEST",
            diagnostics: { hardBlocker: false },
          },
          primary_rejection_drivers: ["Missing stronger role-specific automation proof."],
          action_plan: {
            quick_fixes: ["Add one bullet that ties automation testing to robotics or hardware workflows."],
          },
          hard_blockers: [],
          missing_required: ["robotics"],
          missing_preferred: [],
          assessment_confidence: "medium",
          uncertainty_notes: [],
        },
        scoringBreakdown: {
          experienceScore: 70,
          skillScore: 45,
          skillsScore: 45,
          seniorityScore: 80,
          educationScore: 70,
          surfaceScore: 62,
          platformScore: 62,
          totalScore: 58,
          riskFlags: ["critical_skill_gap"],
          hardBlocker: false,
          applicationRiskScore: 54,
          applicationRiskLabel: "elevated",
          applicationRiskSummary: "Missing role-specific proof.",
          applicationRiskBasis: "deterministic_fit_components",
          riskBreakdown: {
            version: 1,
            score: 54,
            label: "elevated",
            basis: "deterministic_fit_components",
            calibration: "not_outcome_calibrated",
            summary: "Missing role-specific proof.",
            components: [
              {
                key: "required_evidence_coverage",
                label: "Required evidence coverage",
                score: 54,
                impact: "elevated",
                evidence: "Required-skill proof is thin.",
              },
            ],
          },
        },
        fixSuggestion: "Add one robotics-adjacent automation proof point before applying.",
      }),
    });
  });

  await page.route("**/api/emails/apply-gate/save-failure-verdict/action", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "Save failed" }),
    });
  });

  await page.goto("/apply-gate", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Job Title").fill("Automation Engineer");
  await page.getByLabel("Company Name (optional)").fill("Acme Robotics");
  await page.getByLabel("Job Description").fill("Requires Python automation and robotics validation.");
  await page.getByRole("button", { name: "Get decision" }).click();

  await expect(page.getByRole("heading", { name: "Fix first before applying" })).toBeVisible();
  await page.getByRole("button", { name: "I'll fix first" }).click();

  await expect(page.getByRole("alert")).toContainText("Choice not saved. Try again.");
  await expect(page.getByRole("heading", { name: "Fix first before applying" })).toBeVisible();
  await expect(page.getByText("Automation Engineer")).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
