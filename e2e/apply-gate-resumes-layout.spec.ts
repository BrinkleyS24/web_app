// Layout regressions from the 2026-10-14 persona reviews: at 390px the Apply Gate result made the
// page 429px wide (a non-wrapping history pill, verdict one word per line), and at 768px Resumes
// was 883px wide with a one-letter-per-line title. Synthetic data only; every API call is mocked.
import { expect, test, type Page } from "@playwright/test";

const shotDir = process.env.LAYOUT_SHOT_DIR || "";
const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", other = "22222222-3333-4444-8555-666666666666";
const REPEATED = "Focus on roles that match your classroom and curriculum experience.";
const teacher = "Jordan Ellis\nMiddle School Science Teacher\nTaught grades 6-8 science for nine years.\nManaged course content in Canvas LMS.";
const designer = "Jordan Ellis\nInstructional Designer\nTaught grades 6-8 science for nine years.\nBuilt two Articulate Rise sample modules.\nAdministered Canvas course shells and gradebook setup.";

const run = (runId: string, day: number) => ({
  id: runId,
  job_title: "Instructional Designer (K-12 Curriculum)",
  company_name: "Brightwell Learning",
  verdict: "risky",
  reasons: JSON.stringify(["Articulate 360 is not on your resume."]),
  explanation_payload: null,
  created_at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
});

const analyzeResult = {
  success: true,
  id: "verdict-layout",
  jobTitle: "Instructional Designer (K-12 Curriculum)",
  companyName: "Brightwell Learning",
  verdict: "not_recommended",
  confidence: "high",
  reasons: [REPEATED],
  matchedSkills: [],
  missingSkills: ["articulate 360"],
  scoringBreakdown: {
    totalScore: 38, riskFlags: [], hardBlocker: false, applicationRiskLabel: "moderate",
    riskBreakdown: { version: 1, score: 55, label: "moderate", basis: "deterministic_fit_components", calibration: "not_outcome_calibrated", summary: "Tool evidence: moderate risk.", components: [] },
  },
  explanation: {
    decision: "skip",
    primary_rejection_drivers: ["They require Articulate 360, and it isn't on your resume."],
    hard_blockers: [], missing_required: ["Articulate 360"], missing_preferred: [], fit_notes: [REPEATED],
    path_to_win: { strategy: [REPEATED] },
    action_plan: { quick_fixes: ["Build one short Articulate Rise sample module from a lesson you already teach."], not_fixable_for_this_posting: [REPEATED] },
    search_memory: {
      version: 1, mode: "descriptive", confidence: "weak", sampleSize: 4, noResponseWindowDays: 21, similarRoles: [], commonSkills: [],
      outcomeSummary: { similarRoleCount: 4, interviewed: 1, offered: 0, rejected: 1, noResponse: 2, interviewRate: 0.25, rejectionRate: 0.25, noResponseRate: 0.5, medianDaysToResponse: 9 },
      patternSignals: [],
    },
  },
};

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { success: true };
    if (path.endsWith("/profile/resume")) body = { success: true, resumeText: teacher };
    else if (path.endsWith("/apply-gate/history")) body = { success: true, history: [run("c", 14), run("b", 13), run("a", 12)] };
    else if (path.endsWith("/apply-gate/analyze")) body = analyzeResult;
    else if (path.endsWith("/resumes")) body = { success: true, variants: [
      { id, name: "Teacher K-12 with a long version name", isDefault: true, createdAt: "", charCount: teacher.length },
      { id: other, name: "Teacher to Instructional Designer (Maria test)", isDefault: false, createdAt: "", charCount: designer.length },
    ] };
    else if (path.endsWith(`/resumes/${id}`)) body = { success: true, document: { id, name: "Teacher K-12", text: teacher, fingerprint: "a".repeat(64) } };
    else if (path.endsWith(`/resumes/${other}`)) body = { success: true, document: { id: other, name: "Teacher to Instructional Designer", text: designer, fingerprint: "b".repeat(64) } };
    else if (path.endsWith("/resumes/health")) body = { success: true, resumes: [] };
    else if (path.endsWith("/resumes/scoreboard")) body = { success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: null, breakdown: {} };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

for (const width of [390, 768, 1440]) {
  test(`Apply Gate result fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto("/apply-gate");
    await page.getByLabel("Job title", { exact: true }).fill("Instructional Designer (K-12 Curriculum)");
    await page.getByLabel("Company (optional)").fill("Brightwell Learning");
    await page.getByLabel("Job description", { exact: true }).fill("Build K-12 courses in Articulate 360. Career changers from the classroom welcome.");
    await page.getByRole("button", { name: /Check this role/i }).click();
    const call = page.getByTestId("apply-gate-call");
    await expect(call).toBeVisible();
    expect(await pageWidth(page)).toBeLessThanOrEqual(width);
    // The verdict heading keeps a readable measure: not one word per line.
    const headingBox = await call.getByRole("heading", { level: 2 }).boundingBox();
    expect(headingBox!.width).toBeGreaterThan(Math.min(240, width - 120));
    await expect(page.getByTestId("risk-band")).toHaveAttribute("data-severity", "moderate");
    await expect(call.getByText("Checked 4 times")).toBeVisible();
    await page.getByTestId("apply-gate-details").locator("summary").click();
    expect(await pageWidth(page)).toBeLessThanOrEqual(width);
    if (shotDir) await page.screenshot({ path: `${shotDir}/apply-gate-${width}.png`, fullPage: true });
  });

  test(`Resumes fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto("/resumes");
    const title = page.getByRole("heading", { name: "Teacher to Instructional Designer (Maria test)" });
    await expect(title).toBeVisible();
    expect(await pageWidth(page)).toBeLessThanOrEqual(width);
    // One line or a few words per line, never one letter per line.
    expect((await title.boundingBox())!.width).toBeGreaterThan(120);
    await page.getByLabel("Compare Teacher K-12 with a long version name", { exact: true }).check();
    await page.getByLabel("Compare Teacher to Instructional Designer (Maria test)", { exact: true }).check();
    await expect(page.getByTestId("resume-lines-added").locator("[data-changed]")).toHaveCount(3);
    expect(await pageWidth(page)).toBeLessThanOrEqual(width);
    if (shotDir) await page.screenshot({ path: `${shotDir}/resumes-${width}.png`, fullPage: true });
  });
}
