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
  id: "123",
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
  },
  fixSuggestion: "Target adjacent automation roles first.",
  discipline_alignment_score: 53,
  discipline_transition_label: "Stretch",
  discipline_dimension_breakdown: {
    scope: 60,
    execution: 50,
    environment: 40,
    autonomy: 62,
  },
};

async function runAnalyze() {
  await userEvent.type(screen.getByLabelText("Job Title"), "Automation Engineer");
  await userEvent.type(screen.getByLabelText("Job Description"), "Requires PLC and controls experience.");
  await userEvent.click(screen.getByRole("button", { name: /Check Alignment/i }));
}

beforeEach(() => {
  fetchResume.mockResolvedValue({ success: true, resumeText: "resume text with enough length" });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [] });
  updateApplyGateAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ApplyGate discipline UI", () => {
  test("snapshot: verdict card renders discipline row when present", async () => {
    analyzeJobAlignment.mockResolvedValue({ ...baseResult, discipline_transition_label: "Adjacent", discipline_alignment_score: 84 });
    const { container } = renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Discipline Alignment")).toBeInTheDocument();
      expect(screen.getByText("84/100")).toBeInTheDocument();
      expect(screen.getByText(/transition: Adjacent/)).toBeInTheDocument();
    });

    expect(container).toMatchSnapshot();
  });

  test('interaction: "What we compared" reveals discipline dimension details', async () => {
    analyzeJobAlignment.mockResolvedValue(baseResult);
    renderPage();

    await runAnalyze();

    await waitFor(() => expect(screen.getByText("Discipline Alignment")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /What we compared/i }));

    expect(screen.getByText(/Discipline dimensions — scope 60, execution 50, environment 40, autonomy 62/i)).toBeInTheDocument();
  });

  test("integration: strong discipline alignment shows Adjacent label and score", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      verdict: "potential_fit",
      scoringBreakdown: { ...baseResult.scoringBreakdown, hardBlocker: false, riskFlags: [] },
      discipline_alignment_score: 88,
      discipline_transition_label: "Adjacent",
      discipline_dimension_breakdown: { scope: 90, execution: 85, environment: 84, autonomy: 93 },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Discipline Alignment")).toBeInTheDocument();
      expect(screen.getByText("88/100")).toBeInTheDocument();
      expect(screen.getByText(/transition: Adjacent/)).toBeInTheDocument();
    });
  });

  test("integration: mismatch + hard blocker shows Hard Blockers panel", async () => {
    analyzeJobAlignment.mockResolvedValue({
      ...baseResult,
      discipline_alignment_score: 32,
      discipline_transition_label: "Mismatch",
      scoringBreakdown: {
        ...baseResult.scoringBreakdown,
        hardBlocker: true,
        riskFlags: ["education_gap", "critical_skill_gap", "discipline_mismatch"],
      },
    });
    renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Hard Blockers")).toBeInTheDocument();
      expect(screen.getByText("Required education level is missing")).toBeInTheDocument();
      expect(screen.getByText("A required critical skill is missing")).toBeInTheDocument();
      expect(screen.getByText("Core discipline/environment mismatch is high-risk")).toBeInTheDocument();
    });
  });
});
