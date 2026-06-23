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
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  renameResumeVariant,
} = vi.hoisted(() => ({
  fetchResumeVariants: vi.fn(),
  fetchVariantScoreboard: vi.fn(),
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
  createResumeVariant.mockResolvedValue({ success: true, id: "new-1" });
  setDefaultResumeVariant.mockResolvedValue({ success: true });
  archiveResumeVariant.mockResolvedValue({ success: true });
  renameResumeVariant.mockResolvedValue({ success: true });
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
});
