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

describe("ApplyGate current UI", () => {
  test("snapshot: risky verdict renders the current card layout", async () => {
    analyzeJobAlignment.mockResolvedValue(baseResult);
    const { container } = renderPage();

    await runAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Automation Engineer")).toBeInTheDocument();
      expect(screen.getByText("High-risk application")).toBeInTheDocument();
      expect(screen.getByText("Fix First")).toBeInTheDocument();
    });

    expect(container).toMatchSnapshot();
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
        jobUrl: "",
      });
      expect(screen.getByText("Acme Robotics")).toBeInTheDocument();
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
