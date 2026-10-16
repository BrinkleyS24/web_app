import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import ApplyGate from "./ApplyGate";

vi.setConfig({ testTimeout: 20_000 });

const useAuth = vi.fn();
const { fetchApplyGateHistory, recheckApplyGateVerdict, fetchResume, fetchResumeVariants, fetchVariantScoreboard, fetchResumeHealth } = vi.hoisted(() => ({
  fetchApplyGateHistory: vi.fn(),
  recheckApplyGateVerdict: vi.fn(),
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
  return { ...actual, fetchApplyGateHistory, recheckApplyGateVerdict, fetchResume, fetchResumeVariants, fetchVariantScoreboard, fetchResumeHealth };
});

function renderAt(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={queryClient}>
        <ApplyGate />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const savedCheck = {
  id: "verdict-42",
  job_title: "Instructional Designer",
  company_name: "Brightwell Learning",
  verdict: "potential_fit",
  score: 70,
  reasons: "[]",
  fix_suggestion: null,
  user_action: null,
  created_at: "2026-10-15T12:00:00Z",
};

beforeEach(() => {
  useAuth.mockReturnValue({ user: { uid: "test-user" }, loading: false });
  fetchResume.mockResolvedValue({ success: true, resumeText: "resume text with enough length" });
  fetchApplyGateHistory.mockResolvedValue({ success: true, history: [savedCheck] });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: null });
  fetchResumeHealth.mockResolvedValue({ success: true, resumes: [] });
  recheckApplyGateVerdict.mockRejectedValue(new Error("stop here"));
});

afterEach(() => {
  vi.clearAllMocks();
});

// A Next Actions link used to open an empty form (2026-10-15). It now offers the saved check.
test("a Next Actions link opens its saved check with a one-tap re-check", async () => {
  renderAt("/apply-gate?verdict=verdict-42");
  const banner = await screen.findByTestId("apply-gate-linked-check");
  expect(banner).toHaveTextContent("From Next Actions: Instructional Designer at Brightwell Learning");
  await userEvent.click(screen.getByRole("button", { name: "Re-check this posting" }));
  expect(recheckApplyGateVerdict).toHaveBeenCalledWith("verdict-42");
});

test("a link to a check that is gone says so instead of an empty form", async () => {
  renderAt("/apply-gate?verdict=verdict-missing");
  expect(await screen.findByTestId("apply-gate-linked-check-missing")).toHaveTextContent("no longer in your history");
});
