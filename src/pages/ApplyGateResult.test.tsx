// The three-block Apply Gate result (persona reviews, 2026-10-14). Kept apart from
// ApplyGate.test.tsx so these run without the sibling backend/extension checkouts that file imports.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import ApplyGate, {
  createSentenceFilter,
  groupHistoryItems,
  normalizeSentence,
  riskSeverityForLabel,
  riskSeverityForPercent,
} from "./ApplyGate";

// These tests type into the form; under a full parallel run 5 s is too tight.
vi.setConfig({ testTimeout: 20_000 });

const useAuth = vi.fn();

const {
  analyzeJobAlignment,
  fetchApplyGateHistory,
  updateApplyGateAction,
  fetchResume,
  fetchResumeVariants,
  fetchVariantScoreboard,
  fetchResumeHealth,
} = vi.hoisted(() => ({
  analyzeJobAlignment: vi.fn(),
  fetchApplyGateHistory: vi.fn(),
  updateApplyGateAction: vi.fn(),
  fetchResume: vi.fn(),
  fetchResumeVariants: vi.fn(),
  fetchVariantScoreboard: vi.fn(),
  fetchResumeHealth: vi.fn(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { uid: "test-user" } } }));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => useAuth() }));
vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    analyzeJobAlignment,
    fetchApplyGateHistory,
    updateApplyGateAction,
    fetchResume,
    fetchResumeVariants,
    fetchVariantScoreboard,
    fetchResumeHealth,
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/apply-gate"]}>
      <QueryClientProvider client={queryClient}>
        <ApplyGate />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function runAnalyze(jobTitle = "Instructional Designer") {
  await userEvent.type(screen.getByLabelText("Job title"), jobTitle);
  await userEvent.type(screen.getByLabelText("Company (optional)"), "Brightwell Learning");
  await userEvent.type(screen.getByLabelText("Job description"), "Build K-12 courses in Articulate 360. Career changers from the classroom welcome.");
  await userEvent.click(screen.getByRole("button", { name: /Check this role/i }));
}

const REPEATED = "Focus on roles that match your classroom and curriculum experience.";

// A SKIP read whose path_to_win strategy is word for word its not-fixable text, the bug the
// teacher, mobile and engineer personas all hit.
const skipResult = {
  success: true,
  id: "verdict-skip",
  verdict: "not_recommended",
  confidence: "high",
  jobTitle: "Instructional Designer",
  companyName: "Brightwell Learning",
  reasons: [REPEATED, "They require Articulate 360, and it isn't on your resume."],
  matchedSkills: [],
  missingSkills: ["articulate 360"],
  scoringBreakdown: {
    totalScore: 38,
    riskFlags: [],
    hardBlocker: false,
    applicationRiskLabel: "moderate",
    riskBreakdown: {
      version: 1,
      score: 55,
      label: "moderate",
      basis: "deterministic_fit_components",
      calibration: "not_outcome_calibrated",
      summary: "Tool evidence: moderate risk.",
      components: [{ key: "tools", label: "Tool evidence", score: 55, impact: "moderate", evidence: "Articulate 360 is not on your resume." }],
    },
  },
  explanation: {
    decision: "skip",
    primary_rejection_drivers: ["They require Articulate 360, and it isn't on your resume."],
    hard_blockers: [],
    missing_required: ["Articulate 360"],
    missing_preferred: [],
    fit_notes: [REPEATED],
    path_to_win: { strategy: [REPEATED] },
    action_plan: {
      quick_fixes: ["Build one short Articulate Rise sample module from a lesson you already teach."],
      resume_proof_improvements: [],
      long_term_gaps: [],
      not_fixable_for_this_posting: [REPEATED, `  ${REPEATED.toUpperCase()}  `],
    },
    requirement_ledger: {
      items: [{ id: "req-1", type: "tool", label: "Articulate 360", priority: "required", candidate_status: "missing", source_sentence: "Build K-12 courses in Articulate 360." }],
    },
    decision_confidence: "medium",
  },
};

function occurrences(haystack: string, needle: string) {
  return normalizeSentence(haystack).split(normalizeSentence(needle)).length - 1;
}

beforeEach(() => {
  vi.stubEnv("VITE_APPLY_GATE_DISPLAY_DECISION_V1", "false");
  useAuth.mockReturnValue({ user: { uid: "test-user" }, loading: false });
  fetchResume.mockResolvedValue({ success: true, resumeText: "resume text with enough length" });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });
  updateApplyGateAction.mockResolvedValue({ success: true });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: null });
  fetchResumeHealth.mockResolvedValue({ success: true, resumes: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("sentence dedupe", () => {
  test("case, spacing and punctuation do not make a sentence new", () => {
    const keep = createSentenceFilter();
    expect(keep(REPEATED)).toBe(true);
    expect(keep(`• ${REPEATED.toUpperCase()}`)).toBe(false);
    expect(keep("   ")).toBe(false);
    expect(keep("Build one sample module.")).toBe(true);
  });

  test("a SKIP result whose path to win equals its not-fixable text prints that sentence once", async () => {
    analyzeJobAlignment.mockResolvedValue(skipResult);
    renderPage();
    await runAnalyze();
    const card = await screen.findByTestId("apply-gate-current-result");
    expect(occurrences(card.textContent || "", REPEATED)).toBe(1);
    // The whole page, not just the card: history and details included.
    expect(occurrences(document.body.textContent || "", REPEATED)).toBe(1);
    // The learnable gap is a step in the visible checklist, labeled for the call: under a Skip it
    // is "Before you send", never "Fix first" (2026-10-15: step labels follow the verdict).
    const steps = within(screen.getByTestId("apply-gate-steps"));
    expect(steps.getByText(/Build one short Articulate Rise sample module/)).toBeInTheDocument();
    expect(steps.getAllByText(/^Before you send:/).length).toBeGreaterThan(0);
    expect(steps.queryByText(/^Fix first:/)).not.toBeInTheDocument();
    // No empty sections: nothing survives under "Hard requirement", so it is not rendered.
    expect(screen.queryByText(/^Hard requirement:/)).not.toBeInTheDocument();
  });
});

describe("risk pill", () => {
  test("maps every backend band to a severity", () => {
    expect(riskSeverityForLabel("Low")).toBe("low");
    expect(riskSeverityForLabel("moderate")).toBe("moderate");
    expect(riskSeverityForLabel("Elevated")).toBe("moderate");
    expect(riskSeverityForLabel("high")).toBe("high");
    expect(riskSeverityForLabel("Severe")).toBe("high");
    expect(riskSeverityForPercent(20)).toBe("low");
    expect(riskSeverityForPercent(50)).toBe("moderate");
    expect(riskSeverityForPercent(80)).toBe("high");
  });

  test("Moderate renders as an amber, non-interactive, wrapping chip", async () => {
    analyzeJobAlignment.mockResolvedValue(skipResult);
    renderPage();
    await runAnalyze();
    const pill = await screen.findByTestId("risk-band");
    expect(pill).toHaveAttribute("data-severity", "moderate");
    expect(pill.className).toContain("risk-pill-moderate");
    expect(pill.className).toContain("bg-warning/10");
    expect(pill.className).not.toMatch(/success|emerald/);
    expect(pill.tagName).toBe("SPAN");
    expect(pill).not.toHaveAttribute("role");
    // The old 78px-tall nowrap pill pushed a 390px page to 429px.
    expect(pill.className).not.toContain("whitespace-nowrap");
    expect(pill.className).toContain("max-w-full");
    expect(pill).toHaveTextContent("Moderate rejection risk");
  });

  test("Severe renders red", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...skipResult,
      scoringBreakdown: { ...skipResult.scoringBreakdown, applicationRiskLabel: "severe" },
    });
    renderPage();
    await runAnalyze();
    const pill = await screen.findByTestId("risk-band");
    expect(pill).toHaveAttribute("data-severity", "high");
    expect(pill.className).toContain("bg-destructive/10");
  });
});

describe("three blocks", () => {
  test("the call and what to do come first; details are collapsed by default", async () => {
    analyzeJobAlignment.mockResolvedValue(skipResult);
    renderPage();
    await runAnalyze();
    const card = await screen.findByTestId("apply-gate-current-result");
    const call = within(card).getByTestId("apply-gate-call");
    const todo = within(card).getByTestId("apply-gate-todo");
    const details = within(card).getByTestId("apply-gate-details");
    // Reading order: call, then what to do, then details.
    expect(call.compareDocumentPosition(todo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(todo.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(call).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(details.tagName).toBe("DETAILS");
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Requirement check")).not.toBeVisible();
    await userEvent.click(within(details).getByText(/^Details/));
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText("Requirement check")).toBeVisible();
  });

  test("the progress panel scrolls into view and promises an honest wait", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    analyzeJobAlignment.mockReturnValue(new Promise(() => {}));
    renderPage();
    await runAnalyze();
    const progress = await screen.findByTestId("apply-gate-progress");
    expect(progress).toHaveTextContent("usually takes 10-20 seconds");
    expect(progress).not.toHaveTextContent(/half a minute/);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances[0]).toBe(progress);
  });

  test("the job title example is not a tech-only role", () => {
    renderPage();
    expect(screen.getByLabelText("Job title")).not.toHaveAttribute("placeholder", expect.stringMatching(/QA|engineer|developer/i));
  });
});

describe("history keeps every run", () => {
  const run = (id: string, day: number, verdict = "risky") => ({
    id,
    job_title: "Instructional Designer (K-12 Curriculum)",
    company_name: "Brightwell Learning",
    verdict,
    reasons: JSON.stringify(["Some reason."]),
    explanation_payload: null,
    created_at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
  });

  test("groups repeated checks of one posting without dropping the earlier ones", () => {
    const grouped = groupHistoryItems([run("c", 14), run("b", 13), { ...run("x", 12), job_title: "Math Teacher" }, run("a", 12)]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].id).toBe("c");
    expect(grouped[0]._checkCount).toBe(3);
    expect(grouped[0]._earlierChecks.map((item) => item.id)).toEqual(["b", "a"]);
    expect(grouped[1]._checkCount).toBe(1);
  });

  test("a posting checked three times shows the latest and says Checked 3 times", async () => {
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [run("c", 14, "not_recommended"), run("b", 13), run("a", 12)] });
    renderPage();
    const card = await screen.findByTestId("apply-gate-history-c");
    expect(within(card).getByText("Checked 3 times")).toBeInTheDocument();
    expect(screen.queryByTestId("apply-gate-history-b")).not.toBeInTheDocument();
    await userEvent.click(within(card).getByText("Show earlier checks (2)"));
    expect(within(card).getByText(/Oct 13, 2026/)).toBeVisible();
    expect(within(card).getByText(/Oct 12, 2026/)).toBeVisible();
  });

  test("re-running a posting on screen counts the earlier runs on the current result", async () => {
    fetchApplyGateHistory.mockResolvedValue({ success: true, history: [run("b", 13), run("a", 12)] });
    analyzeJobAlignment.mockResolvedValue({ ...skipResult, jobTitle: "Instructional Designer (K-12 Curriculum)" });
    renderPage();
    await runAnalyze("Instructional Designer (K-12 Curriculum)");
    const call = await screen.findByTestId("apply-gate-call");
    await waitFor(() => expect(within(call).getByText("Checked 3 times")).toBeInTheDocument());
    expect(within(screen.getByTestId("apply-gate-details")).getByText("Earlier checks of this posting")).toBeInTheDocument();
  });
});
