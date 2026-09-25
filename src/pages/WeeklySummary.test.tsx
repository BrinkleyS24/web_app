import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import WeeklySummary from "./WeeklySummary";

const fetchWeeklyHighlights = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => ({ user: { uid: "u1" }, loading: false }) }));
vi.mock("@/lib/emails", async () => ({ ...(await vi.importActual("@/lib/emails")), fetchWeeklyHighlights }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <WeeklySummary />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchWeeklyHighlights.mockResolvedValue({
    success: true,
    timeframe: "last_7_days",
    windowStart: null,
    windowEnd: null,
    counts: { applications: 7, callbacks: 1, interviews: 1, offers: 0, rejections: 10 },
    priorCounts: { applications: 12, callbacks: 2, interviews: 2, offers: 0, rejections: 3 },
    readout: {
      confidence: "normal",
      headline: "1 interview move this week, alongside 7 new applications.",
      sections: {
        whatChanged: [{ text: "Applications: 7 this week vs 12 the week before (-5).", direction: "down" }],
        whatWorked: [{ text: "Reached the interview stage this week." }],
        whatDidnt: [{ text: "10 rejections this week." }],
        emergingPattern: null,
        nextWeek: [
          { text: "Finish the CodeSignal assessment if the link still works, or close it out.", priority: "high" },
          { text: "Follow up with MTA — silent 29 days after applying.", priority: "high" },
        ],
      },
    },
    highlights: {
      newApplications: [],
      newCallbacks: [{ id: 1, company: null, position: null, subject: "Stacey Brinkley: 30 min meeting", date: new Date().toISOString() }],
      newOffers: [],
      newRejections: [{ id: 2, company: "Counsel Health", position: "Software Engineer", subject: "Thank you", date: new Date().toISOString() }],
      silentThreads: [
        { id: 3, company: "CodeSignal", position: "Global Support Engineer", subject: "CodeSignal | Missing your Skills-Based Assessment", date: null, stage: "interviewed", daysSilent: 28, waitingOn: "you" },
        { id: 4, company: "MTA", position: "Computer Associate", subject: "Your Application", date: null, stage: "applied", daysSilent: 29, waitingOn: "them" },
      ],
      topRejectionTheme: null,
    },
  });
});

describe("WeeklySummary", () => {
  test("leads with the week's read and what to do next", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "1 interview move this week, alongside 7 new applications." })).toBeInTheDocument();
    expect(screen.getByText("Finish the CodeSignal assessment if the link still works, or close it out.")).toBeInTheDocument();
    expect(screen.getByText("12 last week")).toBeInTheDocument();
  });

  test("a pending assessment is waiting on the user; an ordinary silence is just quiet", async () => {
    renderPage();
    expect(await screen.findByText("Waiting on you")).toBeInTheDocument();
    expect(screen.getByText(/no submission has reached your inbox/)).toBeInTheDocument();
    expect(screen.getByText(/No reply for 29 days since the application/)).toBeInTheDocument();
  });

  test("never says Unknown company: an email with no company is named by its subject", async () => {
    renderPage();
    expect(await screen.findByText("“Stacey Brinkley: 30 min meeting”")).toBeInTheDocument();
    expect(screen.queryByText(/Unknown company/)).not.toBeInTheDocument();
  });
});
