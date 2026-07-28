import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import Resumes from "./Resumes";

const {
  fetchResumeVariants,
  fetchVariantScoreboard,
  fetchApplicationStats,
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  renameResumeVariant,
} = vi.hoisted(() => ({
  fetchResumeVariants: vi.fn(),
  fetchVariantScoreboard: vi.fn(),
  fetchApplicationStats: vi.fn(),
  createResumeVariant: vi.fn(),
  setDefaultResumeVariant: vi.fn(),
  archiveResumeVariant: vi.fn(),
  renameResumeVariant: vi.fn(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    fetchResumeVariants,
    fetchVariantScoreboard,
    fetchApplicationStats,
    createResumeVariant,
    setDefaultResumeVariant,
    archiveResumeVariant,
    renameResumeVariant,
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Resumes />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: null });
  fetchApplicationStats.mockResolvedValue({
    success: true,
    stats: { applications: { applied: 0, interviewed: 0, offered: 0, rejected: 0, total: 0 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
  });
  createResumeVariant.mockResolvedValue({ success: true, id: "new-1" });
  setDefaultResumeVariant.mockResolvedValue({ success: true });
  archiveResumeVariant.mockResolvedValue({ success: true });
  renameResumeVariant.mockResolvedValue({ success: true });
  localStorage.clear();
});

afterEach(() => vi.clearAllMocks());

describe("Résumés page", () => {
  test("lists variants and shows honest thin-data copy below minSample", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: {
        minSample: 5,
        perVariant: [{ variantId: "A", name: "QA-focused", sent: 2, matchedToOutcome: 2, interviewed: 1, offered: 0, rejected: 1, noResponse: 0, interviewRate: 50, sufficientSample: false }],
      },
      recommendation: null,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("QA-focused")).toBeInTheDocument();
      expect(screen.getByText(/not enough to call it yet/i)).toBeInTheDocument();
    });
  });

  test("shows the per-variant record once there is enough data", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: {
        minSample: 5,
        perVariant: [{ variantId: "A", name: "QA-focused", sent: 8, matchedToOutcome: 7, interviewed: 3, offered: 1, rejected: 2, noResponse: 1, interviewRate: 57.1, sufficientSample: true }],
      },
      recommendation: null,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/3 interviews/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/not enough to call it yet/i)).not.toBeInTheDocument();
  });

  test("drill-down renders both rows and labels pending correctly", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "V1", name: "SWE-generic", isDefault: true, createdAt: "", charCount: 2000 }],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: {
        minSample: 5,
        perVariant: [{ variantId: "V1", name: "SWE-generic", sent: 2, matchedToOutcome: 1, interviewed: 1, offered: 0, rejected: 0, noResponse: 0, interviewRate: null, sufficientSample: false }],
      },
      recommendation: null,
      breakdown: {
        V1: [
          { role: "QA Engineer", company: "Acme Corp", outcome: "interviewed" },
          { role: "Software Tester", company: "Beta Inc", outcome: "pending" },
        ],
      },
    });
    renderPage();

    // Expand the drill-down
    const toggle = await screen.findByRole("button", { name: /Show 2 applications/i });
    await userEvent.click(toggle);

    // Both rows should now be visible
    expect(screen.getByText("QA Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Interviewed")).toBeInTheDocument();

    expect(screen.getByText("Software Tester")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    // Pending caption present
    expect(screen.getByText(/Pending applications aren't counted in the rate/i)).toBeInTheDocument();
  });

  test("creates a new variant from pasted text", async () => {
    fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Add a résumé/i }));
    await userEvent.type(screen.getByPlaceholderText(/Name/i), "Generic");
    await userEvent.type(screen.getByPlaceholderText(/Paste your résumé/i), "a valid resume body well over twenty characters long");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(createResumeVariant).toHaveBeenCalled());
    const arg = createResumeVariant.mock.calls[0][0];
    expect(arg.name).toBe("Generic");
    expect(arg.text).toBe("a valid resume body well over twenty characters long");
  });

  describe("second-variant nudge", () => {
    beforeEach(() => {
      fetchResumeVariants.mockResolvedValue({
        success: true,
        variants: [{ id: "A", name: "My résumé", isDefault: true, createdAt: "", charCount: 1200 }],
      });
    });

    test("shows after a rejection when only one variant exists", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 3, interviewed: 0, offered: 0, rejected: 2, total: 3 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      expect(await screen.findByText(/You've had 2 rejections\. Try a different résumé next time\./i)).toBeInTheDocument();
    });

    test("stays hidden with zero rejections", async () => {
      renderPage();

      await waitFor(() => expect(screen.getByText("My résumé")).toBeInTheDocument());
      expect(screen.queryByText(/Try a different résumé next time/i)).not.toBeInTheDocument();
    });

    test("stays hidden once a second variant already exists", async () => {
      fetchResumeVariants.mockResolvedValue({
        success: true,
        variants: [
          { id: "A", name: "My résumé", isDefault: true, createdAt: "", charCount: 1200 },
          { id: "B", name: "QA-focused", isDefault: false, createdAt: "", charCount: 1300 },
        ],
      });
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 3, interviewed: 0, offered: 0, rejected: 2, total: 3 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      await waitFor(() => expect(screen.getByText("My résumé")).toBeInTheDocument());
      expect(screen.queryByText(/Try a different résumé next time/i)).not.toBeInTheDocument();
    });

    test("dismiss hides it and the dismissal survives a fresh mount", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 1, interviewed: 0, offered: 0, rejected: 1, total: 1 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      const nudge = await screen.findByText(/You've had a rejection\. Try a different résumé next time\./i);
      expect(nudge).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
      expect(screen.queryByText(/Try a different résumé next time/i)).not.toBeInTheDocument();

      renderPage();
      await waitFor(() => expect(screen.getByText("My résumé")).toBeInTheDocument());
      expect(screen.queryByText(/Try a different résumé next time/i)).not.toBeInTheDocument();
    });

    test("clicking the nudge's CTA opens the add-variant form", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 1, interviewed: 0, offered: 0, rejected: 1, total: 1 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      await screen.findByText(/You've had a rejection\. Try a different résumé next time\./i);
      const [nudgeCta] = screen.getAllByRole("button", { name: /Add a résumé version/i });
      await userEvent.click(nudgeCta);
      expect(screen.getByPlaceholderText(/Name/i)).toBeInTheDocument();
    });
  });
});
