import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
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

function renderPage(options: {client?: QueryClient; path?: string} = {}) {
  const queryClient = options.client || new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[options.path || "/strategy-alerts"]}>
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
    success: true, basis: "current_default_resume_checks", resume: {variantId: "resume-a", name: "QA default"},
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
  test("strategy recovery withholds cached findings and explains what remains available", async () => {
    fetchStrategyAlerts.mockRejectedValue(Object.assign(new Error("Paused"),{payload:{code:"strategy_alerts_paused"}}));
    renderPage();
    expect(await screen.findByText("Strategy alerts are temporarily paused")).toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:lowMatch.title})).not.toBeInTheDocument();
    expect(screen.getByText(/Next Actions, Apply Gate, and your saved resumes remain available/)).toBeInTheDocument();
    expect(await screen.findByText("Requirements that keep coming up")).toBeInTheDocument();
  });
  test("a failed gap read remains retryable while the alert finding stays available", async () => {
    fetchResumeGaps.mockRejectedValueOnce(new Error("Temporary database outage"));
    renderPage();
    expect(await screen.findByText("Your resume patterns did not load")).toBeInTheDocument();
    expect(screen.getByRole("heading", {name: lowMatch.title})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: /Try again/i}));
    expect(await screen.findByText("Requirements that keep coming up")).toBeInTheDocument();
    expect(screen.queryByText("Your resume patterns did not load")).not.toBeInTheDocument();
  });

  test("an obsolete backend response cannot masquerade as current resume gaps", async () => {
    fetchResumeGaps.mockResolvedValue({success:true,analyzedVerdicts:2,distinctRolesEvaluated:2,gaps:[{skill:"Wrong-old-gap",category:"required",occurrences:2,examples:[]}]});
    renderPage();
    expect(await screen.findByText("Your resume patterns did not load")).toBeInTheDocument();
    expect(screen.queryByText("Wrong-old-gap")).not.toBeInTheDocument();
  });

  test("changing accounts does not display cached findings from the previous owner", async () => {
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    client.setQueryData(["strategy-alerts","alerts","first-owner"],{success:true,alerts:[{...lowMatch,title:"Private first-owner finding"}]});
    authState.currentUser={uid:"second-owner"};
    let finish: (value: unknown) => void;
    fetchStrategyAlerts.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    renderPage({client});
    expect(screen.queryByText("Private first-owner finding")).not.toBeInTheDocument();
    finish!({success:true,alerts:[healthcare]});
    expect(await screen.findByRole("heading",{name:healthcare.title})).toBeInTheDocument();
    expect(screen.queryByText("Private first-owner finding")).not.toBeInTheDocument();
    client.clear();
  });

  test("malformed URL fragments do not crash the feature", async () => {
    renderPage({path:"/strategy-alerts#%E0%A4%A"});
    expect(await screen.findByRole("heading",{name:lowMatch.title})).toBeInTheDocument();
  });

  test("gap scope identifies the default version and changed wording", async () => {
    fetchResumeGaps.mockResolvedValue({success:true,basis:"current_default_resume_checks",resume:{variantId:"resume-a",name:"Career switch"},analyzedVerdicts:0,distinctRolesEvaluated:0,gaps:[],changedResumeVerdictsExcluded:2});
    renderPage();
    expect(await screen.findByRole("link",{name:"View or change your resume"})).toHaveAttribute("href","/resumes#resume-resume-a");
    expect(screen.getByText(/2 checks need a fresh Apply Gate check/)).toBeInTheDocument();
    expect(screen.getByText(/Other resume versions are kept separate/)).toBeInTheDocument();
  });
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
    expect(await screen.findByText("Requirements that keep coming up")).toBeInTheDocument();
    expect(screen.getByText("Playwright")).toBeInTheDocument();
    expect(screen.getByText("NewCo · QA; OtherCo · SDET")).toBeInTheDocument();
  });

  test("when older checks were left out of the gaps, it says why and where to fix it", async () => {
    fetchResumeGaps.mockResolvedValue({
      success: true, basis: "current_default_resume_checks", resume: {variantId: "resume-a", name: "QA default"}, analyzedVerdicts: 4, distinctRolesEvaluated: 0, verdictsWithGapData: 0, gaps: [], outdatedVerdictsExcluded: 4,
    });
    renderPage();
    expect(await screen.findByText(/4 checks need a fresh Apply Gate check/)).toBeInTheDocument();
  });

  test("does not call the premium endpoint when signed out", async () => {
    authState.currentUser = null;
    renderPage();
    expect(await screen.findByRole("heading", { name: "Strategy Alerts" })).toBeInTheDocument();
    expect(fetchStrategyAlerts).not.toHaveBeenCalled();
  });

  test("a finding offers one change to try, and how starting it works", async () => {
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [{
        id: "performance-rejection-velocity-auto_screen",
        kind: "performance",
        severity: "high",
        title: "Several rejections arrived soon after you applied",
        description: "6 of 6 timed rejections arrived within 3 days of applying.",
        recommendation: "Before your next application, check screening questions.",
        supporting_stat: "100% of your timed rejections arrived this way",
        experiment: {
          key: "screening-questions",
          ask: "For your next 5 applications, read the screening questions as carefully as the posting before you submit.",
          howItWorks: "Mark \"Try it: screening questions first on your next 5 applications\" done in Next Actions when you start.",
          withinDays: 3,
          status: "not_started",
        },
      }],
    });
    renderPage();
    const offer = await screen.findByTestId("experiment-offer");
    expect(offer).toHaveTextContent("Try it and see");
    expect(offer).toHaveTextContent("For your next 5 applications");
    expect(screen.getByRole("link", { name: "Start in Next Actions" })).toHaveAttribute("href", "/next-actions");
  });

  test("a running experiment leads the page in its own section, with its progress", async () => {
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [lowMatch, {
        id: "experiment-screening-questions",
        kind: "experiment",
        severity: "low",
        title: "Your experiment: screening questions first",
        description: "You started on Sep 24. The result appears once 5 applications sent since then are at least 3 days old.",
        recommendation: "For your next 5 applications, read the screening questions as carefully as the posting before you submit.",
        supporting_stat: "2 of 5 applications so far",
        timeframe_label: "Started Sep 24",
        experiment: { key: "screening-questions", status: "running" },
      }],
    });
    renderPage();
    const section = await screen.findByRole("region", { name: "Your experiments" });
    expect(section).toHaveTextContent("Your experiment: screening questions first");
    expect(section).toHaveTextContent("2 of 5 applications so far");
    expect(section).toHaveTextContent("Experiment running");
    // Not mixed into the findings that need attention.
    expect(screen.getByRole("region", { name: "Needs attention" })).not.toHaveTextContent("Your experiment");
  });

  // The debrief card appeared word for word here and on the Dashboard (persona review, 2026-10-14).
  test("the interview debrief is one link to the Dashboard, not a second copy of the card", async () => {
    fetchStrategyAlerts.mockResolvedValue({
      success: true,
      alerts: [lowMatch, {
        id: "performance-interview-debrief",
        kind: "performance",
        severity: "medium",
        title: "You have reached 6 interviews. I know the decision on only 2 of them.",
        description: "4 went quiet after the interview.",
        debrief: { kind: "interview_outcome", total: 4, items: [{ key: "a", emailId: 7, label: "Quillstone Learning" }] },
      }],
    });
    renderPage();
    const link = await screen.findByTestId("debrief-link");
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(link).toHaveTextContent("4 interviews need your answer");
    expect(screen.queryByText(/I know the decision on only 2/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Never heard back" })).not.toBeInTheDocument();
  });
});
