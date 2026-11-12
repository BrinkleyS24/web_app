import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import Resumes from "./Resumes";

const {
  useAuth,
  fetchLegacyResumeForReview,
  fetchResumeVariants,
  fetchResumeSubmissions,
  confirmSubmittedResume,
  fetchResumeHealth,
  fetchVariantScoreboard,
  fetchApplicationStats,
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  renameResumeVariant,
} = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchLegacyResumeForReview: vi.fn(),
  fetchResumeVariants: vi.fn(),
  fetchResumeSubmissions: vi.fn(),
  confirmSubmittedResume: vi.fn(),
  fetchResumeHealth: vi.fn(),
  fetchVariantScoreboard: vi.fn(),
  fetchApplicationStats: vi.fn(),
  createResumeVariant: vi.fn(),
  setDefaultResumeVariant: vi.fn(),
  archiveResumeVariant: vi.fn(),
  renameResumeVariant: vi.fn(),
}));

vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth }));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return {
    ...actual,
    fetchLegacyResumeForReview,
    fetchResumeVariants,
    fetchResumeSubmissions,
    confirmSubmittedResume,
    fetchResumeHealth,
    fetchVariantScoreboard,
    fetchApplicationStats,
    createResumeVariant,
    setDefaultResumeVariant,
    archiveResumeVariant,
    renameResumeVariant,
  };
});

function renderPage(entry = '/resumes?view=outcomes') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { queryClient, ...render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={queryClient}>
        <Resumes />
      </QueryClientProvider>
    </MemoryRouter>,
  ) };
}

test('a paused outcome response preserves the saved library and confirmation task without showing metrics', async () => {
  useAuth.mockReturnValue({ plan: 'premium', user: { uid: 'owner' } });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Saved QA', isDefault: true, charCount: 300 }] });
  fetchVariantScoreboard.mockRejectedValue(Object.assign(new Error('Resume outcomes are temporarily paused.'), { status: 503, payload: { code: 'resume_outcomes_paused' } }));
  renderPage();
  expect(await screen.findByText('Resume outcomes are temporarily paused')).toBeInTheDocument();
  expect(screen.getByText('Your saved resumes and submitted-version confirmations are still available.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Library' }));
  expect(screen.getByRole('button', { name: 'Open and edit' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Record which resume you submitted' }));
  expect(await screen.findByLabelText('Submitted resume for application 10')).toBeVisible();
  expect(screen.queryByText('Confirmed outcomes by version')).not.toBeInTheDocument();
});

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue({ plan: "premium", user: { uid: "owner" } });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
  confirmSubmittedResume.mockResolvedValue({ success: true });
  fetchLegacyResumeForReview.mockResolvedValue({ success: true, resumeText: null });
  fetchResumeHealth.mockResolvedValue({ success: true, resumes: [] });
  fetchResumeSubmissions.mockResolvedValue({ success: true, applications: [{ id: '10', company: 'Fictional Cedar', role: 'QA Engineer', outcomeLabel: 'pending', submission: null }], nextCursor: null });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { basis: "confirmed_application_outcomes", minSample: 5, perVariant: [] }, recommendation: null });
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

afterEach(() => { vi.clearAllMocks(); });

test('Library opens first without loading history or confirmations', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: '11111111-1111-4111-8111-111111111111', name: 'QA version', isDefault: true }] });
  renderPage('/resumes');
  expect(await screen.findByRole('button', { name: 'Open and edit' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
  expect(fetchVariantScoreboard).not.toHaveBeenCalled();
  expect(fetchResumeSubmissions).not.toHaveBeenCalled();
  expect(fetchApplicationStats).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Outcomes & submissions' }));
  expect(await screen.findByRole('button', { name: 'Review submitted resumes' })).toBeVisible();
  expect(fetchVariantScoreboard).toHaveBeenCalledTimes(1);
});

test('Apply Gate application-confirmation links open the panel on arrival', async () => {
  useAuth.mockReturnValue({ plan: 'premium', user: { uid: 'link-owner' } });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA version', isDefault: true }] });
  renderPage('/resumes#submitted-resumes');
  expect(await screen.findByRole('combobox', { name: 'Submitted resume for application 10' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Hide application confirmations' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: 'Submitted resume confirmations' })).toHaveFocus();
});

test('late outcome tables and archived history do not move ahead of the saved library', async () => {
  useAuth.mockReturnValue({ plan: 'premium', user: { uid: 'late-outcomes-owner' } });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [
    { id: '11111111-1111-4111-8111-111111111111', name: 'QA first', isDefault: true },
    { id: '22222222-2222-4222-8222-222222222222', name: 'QA second', isDefault: false },
  ] });
  let finish: (value: unknown) => void;
  fetchVariantScoreboard.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { container } = renderPage();
  await waitFor(() => expect(fetchVariantScoreboard).toHaveBeenCalled());
  await act(async () => finish!({ success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5,
    perVariant: [{ variantId: 'archived', name: 'Archived QA', sent: 1, matchedToOutcome: 1, interviewed: 1, offered: 0, rejected: 0,
      noResponse: 0, interviewRate: 100, sufficientSample: false }] }, recommendation: null }));
  expect(await screen.findByRole('heading', { name: 'Confirmed outcomes by version' })).toBeVisible();
  expect(screen.getByText('Confirmed outcomes for past versions')).toBeVisible();
  await userEvent.click(screen.getByRole('tab', { name: 'Library' }));
  expect(screen.getByRole('heading', { name: 'QA first' })).toBeVisible();
  expect(screen.getByText('Confirmed outcomes for past versions')).not.toBeVisible();
});

test('empty version outcomes point to application confirmation without requiring Apply Gate', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA version', isDefault: true }] });
  renderPage();
  await userEvent.click(await screen.findByText('Applications behind these outcomes'));
  expect(await screen.findByText(/No confirmed submissions for this version/)).toBeInTheDocument();
  expect(screen.queryByText(/pick it in Apply Gate when you apply/)).not.toBeInTheDocument();
});

test('a failed refresh hides cached outcome rates and does not claim zero submissions', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA A', isDefault: true }, { id: 'B', name: 'QA B', isDefault: false }] });
  fetchVariantScoreboard.mockResolvedValueOnce({ success: true, scoreboard: { basis: "confirmed_application_outcomes", minSample: 5, perVariant: [{ variantId: 'A', name: 'QA A', sent: 5, matchedToOutcome: 5, interviewed: 5, offered: 0, rejected: 0, noResponse: 0, interviewRate: 100, sufficientSample: true }] }, recommendation: null }).mockRejectedValue(new Error('Outage after initial data'));
  const { queryClient } = renderPage();
  expect(await screen.findByText('100%')).toBeInTheDocument();
  await act(async () => { await queryClient.invalidateQueries({ queryKey: ['variant-scoreboard'] }); });
  expect(await screen.findByText('Resume outcomes could not be loaded')).toBeInTheDocument();
  expect(screen.queryByText('100%')).not.toBeInTheDocument();
  expect(screen.queryByText(/No confirmed submissions for this version/)).not.toBeInTheDocument();
});

test('ambiguous attribution is explained instead of displaying inflated resume outcomes', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA', isDefault: true }] });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { basis: "confirmed_application_outcomes", minSample: 5, perVariant: [], ambiguousCohorts: 1 }, recommendation: null });
  renderPage();
  expect(await screen.findByText(/We cannot tell which resume to credit/)).toBeInTheDocument();
});

test('a legacy backend response is not relabeled as confirmed history, counts or a recommendation', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'Current version', isDefault: true }, { id: 'B', name: 'Other version', isDefault: false }] });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { basis: 'applied_verdict_vs_email_cohort_outcome', minSample: 5,
    perVariant: [{ variantId: 'old', name: 'Resume', sent: 12, matchedToOutcome: 5, interviewed: 1, interviewRate: 20 }] },
    recommendation: { variantId: 'old', name: 'Resume', interviewRate: 20 } });
  renderPage();
  expect(await screen.findByText('Resume outcomes could not be loaded')).toBeInTheDocument();
  expect(screen.getByText(/Past checks alone do not confirm which resume you submitted/)).toBeInTheDocument();
  expect(screen.queryByText('Confirmed outcomes for past versions')).not.toBeInTheDocument();
  expect(screen.queryByText('Confirmed outcomes by version')).not.toBeInTheDocument();
  expect(screen.queryByText(/12 confirmed/)).not.toBeInTheDocument();
  expect(screen.queryByText('20%')).not.toBeInTheDocument();
  expect(screen.queryByText(/No confirmed submissions for this version/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Library' }));
  expect(screen.getByRole('heading', { name: 'Current version' })).toBeVisible();
});

test('a scoreboard arriving before the library does not identify every version as archived', async () => {
  fetchResumeVariants.mockReturnValue(new Promise(() => {}));
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5,
    perVariant: [{ variantId: 'A', name: 'Still loading', sent: 1, matchedToOutcome: 0, interviewed: 0, offered: 0,
      rejected: 0, noResponse: 0, interviewRate: null, sufficientSample: false }] }, recommendation: null });
  renderPage();
  await waitFor(() => expect(fetchVariantScoreboard).toHaveBeenCalled());
  expect(screen.queryByText('Confirmed outcomes for past versions')).not.toBeInTheDocument();
});

test('free users manage a default without making premium requests', async () => {
  useAuth.mockReturnValue({ plan: 'free', user: { uid: 'owner' } });
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA', isDefault: false }] });
  renderPage('/resumes');
  await userEvent.click(await screen.findByRole('button', { name: /Make default/ }));
  expect(setDefaultResumeVariant).toHaveBeenCalledWith('A', expect.anything());
  expect(fetchVariantScoreboard).not.toHaveBeenCalled();
  expect(fetchApplicationStats).not.toHaveBeenCalled();
});

test('the page uses the shared app width, not a narrower column of its own (2026-10-15)', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
  renderPage();
  const page = await screen.findByTestId('resumes-page');
  expect(page.className).not.toMatch(/max-w-/);
});

test('removing the default explains the consequence and waits for confirmation', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA', isDefault: true }] });
  renderPage('/resumes');
  await userEvent.click(await screen.findByRole('button', { name: /^Remove$/ }));
  expect(archiveResumeVariant).not.toHaveBeenCalled();
  expect(screen.getByText(/Extension checks will pause/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove resume' }));
  await waitFor(() => expect(archiveResumeVariant).toHaveBeenCalled());
});

test('a default mutation failure stays visible and leaves the document available', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA', isDefault: false }] });
  setDefaultResumeVariant.mockRejectedValueOnce(new Error('Try again later.'));
  renderPage('/resumes');
  await userEvent.click(await screen.findByRole('button', { name: /Make default/ }));
  expect(await screen.findByText('The default did not change')).toBeInTheDocument();
  expect(screen.getByText('QA')).toBeInTheDocument();
});

test('first upload visibly opts into a default and a retry keeps the same request ID', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
  createResumeVariant.mockRejectedValueOnce(new Error('Timed out'));
  renderPage('/resumes');
  await userEvent.click(await screen.findByRole('button', { name: /Add a resume/ }));
  expect(screen.getByLabelText('Use as my default for job checks')).toBeChecked();
  await userEvent.type(screen.getByPlaceholderText(/Paste your resume/), 'Software testing experience with Python and Playwright over five years.');
  await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  await screen.findByText('That version did not save');
  const first = createResumeVariant.mock.calls[0][0];
  await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  await waitFor(() => expect(createResumeVariant).toHaveBeenCalledTimes(2));
  expect(createResumeVariant.mock.calls[1][0].requestId).toBe(first.requestId);
  expect(first.defaultMode).toBe('if_empty');
});

describe("Resumes page", () => {
  test("lists variants and shows honest thin-data copy below minSample", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: { basis: "confirmed_application_outcomes",
        minSample: 5,
        perVariant: [{ variantId: "A", name: "QA-focused", sent: 2, matchedToOutcome: 2, interviewed: 1, offered: 0, rejected: 1, noResponse: 0, interviewRate: 50, sufficientSample: false }],
      },
      recommendation: null,
    });
    renderPage();

    await userEvent.click(await screen.findByText("Applications behind these outcomes"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "QA-focused", level: 3 })).toBeInTheDocument();
      expect(screen.getByText(/not enough to call it yet/i)).toBeInTheDocument();
    });
  });

  test("never shows a character count next to a resume", async () => {
    // Founder review, 2026-09-25: "(1200+ chars)" is a storage detail, not something a job seeker acts on.
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    renderPage('/resumes');
    await screen.findByText("QA-focused");
    expect(screen.queryByText(/chars/)).not.toBeInTheDocument();
  });

  test("shows the per-variant record once there is enough data", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: { basis: "confirmed_application_outcomes",
        minSample: 5,
        perVariant: [{ variantId: "A", name: "QA-focused", sent: 8, matchedToOutcome: 7, interviewed: 3, offered: 1, rejected: 3, noResponse: 0, interviewRate: 57.1, sufficientSample: true }],
      },
      recommendation: null,
    });
    renderPage();

    await userEvent.click(await screen.findByText("Applications behind these outcomes"));
    await waitFor(() => {
      expect(screen.getByText(/3 interview-stage outcomes/i)).toBeInTheDocument();
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
      scoreboard: { basis: "confirmed_application_outcomes",
        minSample: 5,
        perVariant: [{ variantId: "V1", name: "SWE-generic", sent: 2, matchedToOutcome: 1, interviewed: 1, offered: 0, rejected: 0, noResponse: 0, interviewRate: 100, sufficientSample: false }],
      },
      recommendation: null,
      breakdown: {
        V1: [
          { applicationId: "1", role: "QA Engineer", company: "Acme Corp", outcome: "interviewed" },
          { applicationId: "2", role: "Software Tester", company: "Beta Inc", outcome: "pending" },
        ],
      },
    });
    renderPage();

    await userEvent.click(await screen.findByText("Applications behind these outcomes"));
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

  test("compares versions side by side, with a rate only where the sample supports one", async () => {
    // Review 2026-09-26: the page promised "see which one gets interviews" and made the user compare
    // six stacked cards by eye.
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [
        { id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 },
        { id: "B", name: "Generic", isDefault: false, createdAt: "", charCount: 1300 },
      ],
    });
    fetchVariantScoreboard.mockResolvedValue({
      success: true,
      scoreboard: { basis: "confirmed_application_outcomes",
        minSample: 5,
        perVariant: [
          { variantId: "A", name: "QA-focused", sent: 20, matchedToOutcome: 20, interviewed: 17, offered: 1, rejected: 2, noResponse: 0, interviewRate: 90, sufficientSample: true },
          { variantId: "B", name: "Generic", sent: 3, matchedToOutcome: 0, interviewed: 0, offered: 0, rejected: 0, noResponse: 0, interviewRate: null, sufficientSample: false },
        ],
      },
      recommendation: { basis: 'confirmed_application_outcomes', variantId: "A", name: "QA-focused", interviewRate: 90, sampleSize: 20, kind: 'tracked' },
    });
    renderPage();

    expect(await screen.findByText("Confirmed outcomes by version")).toBeInTheDocument();
    expect(screen.getByText(/reached interview stage or offer in/)).toBeInTheDocument();
    expect(screen.getAllByText("90%")).toHaveLength(2); // the answer line and its row
    expect(screen.getByText("needs 5 more")).toBeInTheDocument();
    expect(screen.getByText("Tracked results")).toBeInTheDocument();
  });

  test("tablet layout: titles and headers never break per letter, actions sit under the title", async () => {
    // Mobile review 2026-10-14: at 768px the title rendered one letter per line, the actions
    // overlapped the icon and headers split mid-word ("SE NT", "OUTCOM E").
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [
        { id: "A", name: "Teacher K-12", isDefault: true, createdAt: "", charCount: 1200 },
        { id: "B", name: "Math Teacher 7-12", isDefault: false, createdAt: "", charCount: 1300 },
      ],
    });
    const { container } = renderPage();
    await screen.findByText("Confirmed outcomes by version");
    expect(container.innerHTML).not.toContain("overflow-wrap:anywhere");
    for (const header of container.querySelectorAll("thead th")) expect(header.className).toContain("whitespace-nowrap");
    // The count columns wait for lg, where the content column has room.
    expect(screen.getByRole("columnheader", { name: "Sent" }).className).toContain("lg:table-cell");
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    const title = await screen.findByRole("heading", { name: "Math Teacher 7-12" });
    const header = title.closest("article")!.firstElementChild!;
    expect(header.className).not.toMatch(/sm:flex-row|md:flex-row/);
    const actions = header.lastElementChild!;
    expect(actions.className).not.toContain("shrink-0");
    expect(actions.className).toContain("flex-wrap");
  });

  test("with one version there is nothing to compare, so no table", async () => {
    fetchResumeVariants.mockResolvedValue({
      success: true,
      variants: [{ id: "A", name: "QA-focused", isDefault: true, createdAt: "", charCount: 1200 }],
    });
    renderPage('/resumes');
    await screen.findByRole("heading", { name: "QA-focused" });
    expect(screen.queryByText("Confirmed outcomes by version")).not.toBeInTheDocument();
  });

  test("creates a new variant from pasted text", async () => {
    fetchResumeVariants.mockResolvedValue({ success: true, variants: [] });
    renderPage('/resumes');

    await userEvent.click(await screen.findByRole("button", { name: /Add a resume/i }));
    await userEvent.type(screen.getByPlaceholderText(/Name/i), "Generic");
    await userEvent.type(screen.getByPlaceholderText(/Paste your resume/i), "a valid resume body with software testing experience exceeding fifty characters");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(createResumeVariant).toHaveBeenCalled());
    const arg = createResumeVariant.mock.calls[0][0];
    expect(arg.name).toBe("Generic");
    expect(arg.text).toBe("a valid resume body with software testing experience exceeding fifty characters");
  });

  describe("second-variant nudge", () => {
    beforeEach(() => {
      fetchResumeVariants.mockResolvedValue({
        success: true,
        variants: [{ id: "A", name: "My resume", isDefault: true, createdAt: "", charCount: 1200 }],
      });
    });

    test("shows after a rejection when only one variant exists", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 3, interviewed: 0, offered: 0, rejected: 2, total: 3 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      expect(await screen.findByText(/You can compare another resume version/i)).toBeInTheDocument();
    });

    test("stays hidden with zero rejections", async () => {
      renderPage();

      await waitFor(() => expect(fetchApplicationStats).toHaveBeenCalled());
      expect(screen.queryByText(/Try a different resume next time/i)).not.toBeInTheDocument();
    });

    test("stays hidden once a second variant already exists", async () => {
      fetchResumeVariants.mockResolvedValue({
        success: true,
        variants: [
          { id: "A", name: "My resume", isDefault: true, createdAt: "", charCount: 1200 },
          { id: "B", name: "QA-focused", isDefault: false, createdAt: "", charCount: 1300 },
        ],
      });
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 3, interviewed: 0, offered: 0, rejected: 2, total: 3 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      await waitFor(() => expect(screen.getByRole("heading", { name: "My resume" })).toBeInTheDocument());
      expect(screen.queryByText(/Try a different resume next time/i)).not.toBeInTheDocument();
    });

    test("dismiss hides it and the dismissal survives a fresh mount", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 1, interviewed: 0, offered: 0, rejected: 1, total: 1 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      const nudge = await screen.findByText(/You can compare another resume version/i);
      expect(nudge).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
      expect(screen.queryByText(/Try a different resume next time/i)).not.toBeInTheDocument();

      renderPage();
      await waitFor(() => expect(fetchApplicationStats).toHaveBeenCalled());
      expect(screen.queryByText(/Try a different resume next time/i)).not.toBeInTheDocument();
    });

    test("clicking the nudge's CTA opens the add-variant form", async () => {
      fetchApplicationStats.mockResolvedValue({
        success: true,
        stats: { applications: { applied: 1, interviewed: 0, offered: 0, rejected: 1, total: 1 }, emails: { linked: 0, total: 0, ungrouped: 0 } },
      });
      renderPage();

      await screen.findByText(/You can compare another resume version/i);
      const [nudgeCta] = screen.getAllByRole("button", { name: /Add a resume version/i });
      await userEvent.click(nudgeCta);
      expect(screen.getByPlaceholderText(/Name/i)).toBeInTheDocument();
    });
  });
});


test('keyboard view navigation preserves an unsaved new version and wording selection', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Saved QA', isDefault: true }] });
  renderPage('/resumes?action=original&version=task-version');
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Compare wording for Saved QA' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add a resume version' }));
  await userEvent.type(screen.getByPlaceholderText(/Name/), 'Draft in progress');
  await userEvent.type(screen.getByPlaceholderText(/Paste your resume/), 'Original fictional wording kept while reviewing outcomes.');
  const library = screen.getByRole('tab', { name: 'Library' });
  library.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Outcomes & submissions' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Outcomes & submissions' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByPlaceholderText(/Paste your resume/)).not.toBeVisible();
  await userEvent.keyboard('{Home}');
  expect(library).toHaveFocus();
  expect(screen.getByPlaceholderText(/Name/)).toHaveValue('Draft in progress');
  expect(screen.getByPlaceholderText(/Paste your resume/)).toHaveValue('Original fictional wording kept while reviewing outcomes.');
  expect(screen.getByLabelText('Compare wording for Saved QA')).toBeChecked();
  expect(createResumeVariant).not.toHaveBeenCalled();
});

test('switching views during a lost confirmation response preserves its choice and request identity', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'Saved QA', isDefault: true }] });
  let rejectSave: (error: Error) => void;
  confirmSubmittedResume.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  renderPage('/resumes#submitted-resumes');
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'A');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Library' }));
  await act(async () => rejectSave!(new Error('Acknowledgment lost. Retry safely.')));
  await userEvent.click(screen.getByRole('tab', { name: 'Outcomes & submissions' }));
  expect(screen.getByRole('combobox')).toHaveValue('A');
  await userEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  expect(confirmSubmittedResume.mock.calls[1]).toEqual(confirmSubmittedResume.mock.calls[0]);
});

test('a failed library refresh retains the confirmation selection but disables unverified choices', async () => {
  fetchResumeVariants.mockResolvedValueOnce({ success: true, variants: [{ id: 'A', name: 'Saved QA', isDefault: true }] }).mockRejectedValue(new Error('Library unavailable'));
  const { queryClient } = renderPage('/resumes#submitted-resumes');
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'A');
  await act(async () => { await queryClient.invalidateQueries({ queryKey: ['resume-variants'] }); });
  expect(screen.getByRole('combobox')).toHaveValue('A');
  await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
  expect(screen.getByText(/Your selection is retained/)).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Confirmed outcomes by version' })).not.toBeInTheDocument();
});

test('a failed health refresh withholds cached clean labels without removing saved documents', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'Saved QA', isDefault: true }] });
  fetchResumeHealth.mockResolvedValueOnce({ success: true, resumes: [{ variantId: 'A', document: { variantId: 'A', fingerprint: 'abc', characters: 500 }, findings: [] }] }).mockRejectedValue(new Error('Checks unavailable'));
  const { queryClient } = renderPage('/resumes');
  expect(await screen.findByText('Nothing flagged on this version.')).toBeVisible();
  await act(async () => { await queryClient.invalidateQueries({ queryKey: ['resume-health'] }); });
  await waitFor(() => expect(screen.queryByText('Nothing flagged on this version.')).not.toBeInTheDocument());
  expect(screen.getByText('Resume checks are unavailable for this version.')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Saved QA' })).toBeVisible();
});

test('legacy profile text from another account or the old global cache is never offered', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['legacy-resume-review'], { success: true, resumeText: 'Foreign global cached text' });
  client.setQueryData(['legacy-resume-review', 'previous-owner'], { success: true, resumeText: 'Foreign owner cached text' });
  let finish: (value: unknown) => void;
  fetchLegacyResumeForReview.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter><QueryClientProvider client={client}><Resumes /></QueryClientProvider></MemoryRouter>);
  await waitFor(() => expect(fetchLegacyResumeForReview).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Review previous resume' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Foreign/)).not.toBeInTheDocument();
  expect(client.getQueryState(['legacy-resume-review', 'owner'])?.status).toBe('pending');
  await act(async () => finish!({ success: true, resumeText: null }));
  expect(screen.queryByRole('button', { name: 'Review previous resume' })).not.toBeInTheDocument();
});
