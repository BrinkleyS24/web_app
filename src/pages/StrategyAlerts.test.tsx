import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import StrategyAlerts from "./StrategyAlerts";

const fetchStrategyAlerts = vi.hoisted(() => vi.fn());
const fetchResumeGaps = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  currentUser: { uid: "test-user" } as { uid: string } | null,
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => ({ user: authState.currentUser, loading: false }),
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return { ...actual, fetchStrategyAlerts, fetchResumeGaps };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <StrategyAlerts />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const lowMatch = {
  id: "fit-low-match-concentration",
  kind: "fit",
  severity: "high",
  title: "You are applying mostly to low-match roles",
  description: "3 of your last 4 acted-on Apply Gate decisions were risky or not recommended.",
  supporting_stat: "75.0% of recent screened applications were low-match",
  recommendation: "Shift the next batch toward good-fit or strong-fit roles before sending more applications.",
  timeframe_label: "Last 30 days",
};
const healthcare = {
  id: "focus-industry-conversion",
  kind: "focus",
  severity: "positive",
  title: "Roles in healthcare are converting better for you",
  description: "Healthcare roles have produced more responses than the overall baseline.",
  supporting_stat: "2 responses from 3 tracked applications",
  recommendation: "Bias the next outreach sprint toward healthcare companies or adjacent roles.",
  timeframe_label: "Last 180 days",
};
const floor = {
  id: "performance-coverage-gap",
  kind: "performance",
  severity: "low",
  title: "Not enough finished data yet",
  description: "Your read appears once 15 applications have an outcome. You're at 4.",
  recommendation: "",
  timeframe_label: "All time",
};

beforeEach(() => {
  authState.currentUser = { uid: "test-user" };
  fetchStrategyAlerts.mockResolvedValue({ success: true, alerts: [lowMatch, healthcare, floor] });
  fetchResumeGaps.mockResolvedValue({
    success: true,
    analyzedVerdicts: 3,
    distinctRolesEvaluated: 3,
    verdictsWithGapData: 3,
    gaps: [
      {
        skill: "Playwright",
        category: "required",
        label: "Required skill",
        occurrences: 2,
        examples: [{ company: "NewCo", position: "QA", date: null }, { company: "OtherCo", position: "SDET", date: null }],
      },
    ],
    outdatedVerdictsExcluded: 0,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StrategyAlerts", () => {
  test("each alert says what was noticed, the evidence, and what to do", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" })).toBeInTheDocument();
    expect(screen.getByText("3 of your last 4 acted-on Apply Gate decisions were risky or not recommended.")).toBeInTheDocument();
    expect(screen.getByText("75.0% of recent screened applications were low-match")).toBeInTheDocument();
    expect(screen.getByText("Shift the next batch toward good-fit or strong-fit roles before sending more applications.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check your next role/ })).toHaveAttribute("href", "/apply-gate");

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Working for you")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roles in healthcare are converting better for you" })).toBeInTheDocument();
  });

  test("shows no internal machinery: no placeholder cards, counters, categories or contract", async () => {
    // Founder review, 2026-09-25: "Working: 0", "Still gathering evidence", "Nothing to fix here",
    // "Alert categories" and "Confidence contract" read as a diagnostic page, not a product.
    renderPage();
    await screen.findByRole("heading", { name: "You are applying mostly to low-match roles" });

    expect(screen.queryByRole("heading", { name: "Not enough finished data yet" })).not.toBeInTheDocument();
    for (const text of [/Still gathering evidence/, /Confidence contract/, /Alert categories/, /Next strategic move/, /^Working$/, /^Learning$/]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  test("with no real pattern, says so honestly and names what it is waiting for", async () => {
    fetchStrategyAlerts.mockResolvedValue({ success: true, alerts: [floor] });
    renderPage();

    expect(await screen.findByText("No strong patterns yet")).toBeInTheDocument();
    expect(screen.getByText("Your read appears once 15 applications have an outcome. You're at 4.")).toBeInTheDocument();
  });

  test("skill gaps from Apply Gate checks live here now", async () => {
    renderPage();
    expect(await screen.findByText("Skills that keep coming up")).toBeInTheDocument();
    expect(screen.getByText("Playwright")).toBeInTheDocument();
    expect(screen.getByText("NewCo · QA; OtherCo · SDET")).toBeInTheDocument();
  });

  test("when older checks were left out of the gaps, it says why and where to fix it", async () => {
    fetchResumeGaps.mockResolvedValue({
      success: true, analyzedVerdicts: 4, distinctRolesEvaluated: 0, verdictsWithGapData: 0, gaps: [], outdatedVerdictsExcluded: 4,
    });
    renderPage();
    expect(await screen.findByText(/4 older checks were made before Apply Gate's Sep 24 update/)).toBeInTheDocument();
  });

  test("does not call the premium endpoint when signed out", async () => {
    authState.currentUser = null;
    renderPage();
    expect(await screen.findByRole("heading", { name: "Strategy Alerts" })).toBeInTheDocument();
    expect(fetchStrategyAlerts).not.toHaveBeenCalled();
  });
});
