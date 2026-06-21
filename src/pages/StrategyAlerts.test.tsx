import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import StrategyAlerts from "./StrategyAlerts";

const fetchStrategyAlerts = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  currentUser: { uid: "test-user" } as { uid: string } | null,
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb(authState.currentUser);
    return () => {};
  },
}));

vi.mock("@/lib/firebase", () => ({
  auth: authState,
}));

vi.mock("@/lib/AuthContext.jsx", () => ({
  useAuth: () => ({ user: authState.currentUser, loading: false }),
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    fetchStrategyAlerts,
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
        <StrategyAlerts />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.currentUser = { uid: "test-user" };
  fetchStrategyAlerts.mockResolvedValue({
    success: true,
    alerts: [
      {
        id: "fit-low-match-concentration",
        kind: "fit",
        severity: "high",
        title: "You are applying mostly to low-match roles",
        description: "3 of your last 4 acted-on Apply Gate decisions were risky or not recommended.",
        supporting_stat: "75.0% of recent screened applications were low-match",
        recommendation: "Shift the next batch toward good-fit or strong-fit roles before sending more applications.",
        timeframe_label: "Last 30 days",
      },
      {
        id: "focus-industry-conversion",
        kind: "focus",
        severity: "positive",
        title: "Roles in healthcare are converting better for you",
        description: "Healthcare roles have produced more responses than the overall baseline.",
        supporting_stat: "2 responses from 3 tracked applications",
        recommendation: "Bias the next outreach sprint toward healthcare companies or adjacent roles.",
        timeframe_label: "Last 180 days",
      },
      {
        id: "execution-coverage-gap",
        kind: "execution",
        severity: "low",
        title: "Not enough resolved suggestion history to measure observed lift yet",
        description: "Strategy Alerts needs more completed and ignored suggestion history before comparing outcomes.",
        recommendation: "Let Fix Suggestions run for a bit longer and keep marking actions completed or snoozed.",
        timeframe_label: "Suggestions shown at least 14 days ago",
      },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StrategyAlerts", () => {
  test("renders action-first strategy lanes from backend alerts", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Strategy Alerts" })).toBeInTheDocument();
    expect(screen.getByText("High-confidence only")).toBeInTheDocument();
    expect(await screen.findByText("Next strategic move")).toBeInTheDocument();
    expect(screen.getAllByText("You are applying mostly to low-match roles").length).toBeGreaterThan(0);

    const summary = screen.getByText("Actionable").closest("div");
    expect(summary).toBeTruthy();
    expect(within(summary as HTMLElement).getByText("1")).toBeInTheDocument();

    expect(screen.getByText("Act or watch now")).toBeInTheDocument();
    expect(screen.getByText("Keep doing this")).toBeInTheDocument();
    expect(screen.getByText("Still gathering evidence")).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /Review Apply Gate/i })[0]).toHaveAttribute("href", "/apply-gate");
    expect(screen.getAllByText("Confidence contract").length).toBeGreaterThan(0);
    expect(screen.getByText("Low-priority alerts are not failures. They tell you what data is still missing.")).toBeInTheDocument();
  });

  test("renders signed-out state without calling the premium endpoint", async () => {
    authState.currentUser = null;

    renderPage();

    expect(await screen.findByText("Sign in to see strategy alerts.")).toBeInTheDocument();
    expect(fetchStrategyAlerts).not.toHaveBeenCalled();
  });
});
