import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import Settings from "./Settings";

const { apiFetch, useAuth, fetchResumeVariants, fetchResume, saveResume } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  useAuth: vi.fn(),
  fetchResumeVariants: vi.fn(),
  fetchResume: vi.fn(),
  saveResume: vi.fn(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/emails", async () => ({ ...(await vi.importActual("@/lib/emails")), fetchResumeVariants, fetchResume, saveResume }));

vi.mock("../lib/api.js", () => ({ apiFetch }));
vi.mock("../lib/AuthContext.jsx", () => ({ useAuth }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Settings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Routes the two GETs Settings fires on mount, plus the coach POST. */
function mockApi({ coach }: { coach: Record<string, unknown> }) {
  apiFetch.mockImplementation(async (path: string, options: any = {}) => {
    if (path === "/api/user/coach-preference") {
      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        return { success: true, enabled: body.enabled, available: true, premium: true };
      }
      return { success: true, ...coach };
    }
    if (path === "/api/subscriptions/status") {
      return { subscription: { plan: "premium", status: "active" } };
    }
    throw new Error(`unexpected path ${path}`);
  });
}

beforeEach(() => {
  fetchResumeVariants.mockResolvedValue({
    success: true,
    variants: [
      { id: "a", name: "QA-focused", isDefault: true, createdAt: "", charCount: 2400 },
      { id: "b", name: "Generic", isDefault: false, createdAt: "", charCount: 2100 },
    ],
  });
  useAuth.mockReturnValue({
    user: { uid: "u1", email: "premium@example.com" },
    plan: "premium",
    planLoading: false,
    logout: vi.fn(),
  });
});

afterEach(() => { vi.clearAllMocks(); });

describe("Settings coach voice", () => {
  test("shows the coach as on for a premium user who has never chosen", async () => {
    mockApi({ coach: { enabled: true, available: true, premium: true } });
    renderPage();

    const toggle = await screen.findByRole("switch", { name: /coach voice/i });
    await waitFor(() => expect(toggle).toBeChecked());
  });

  test("opting out posts the choice and leaves the switch off", async () => {
    mockApi({ coach: { enabled: true, available: true, premium: true } });
    renderPage();

    const toggle = await screen.findByRole("switch", { name: /coach voice/i });
    await waitFor(() => expect(toggle).toBeChecked());

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/user/coach-preference",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ enabled: false }) }),
      ),
    );
    await waitFor(() => expect(toggle).not.toBeChecked());
  });

  test("says so when the choice is on but the server has not enabled it yet", async () => {
    mockApi({ coach: { enabled: true, available: false, premium: true } });
    renderPage();

    expect(await screen.findByText(/not running yet/i)).toBeInTheDocument();
  });

  test("hides the section entirely for a free user", async () => {
    useAuth.mockReturnValue({
      user: { uid: "u2", email: "free@example.com" },
      plan: "free",
      planLoading: false,
      logout: vi.fn(),
    });
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/user/coach-preference") {
        return { success: true, enabled: true, available: false, premium: false };
      }
      return { subscription: { plan: "free", status: "inactive" } };
    });

    renderPage();

    await screen.findByRole("button", { name: /Upgrade to Premium/ });
    expect(screen.queryByTestId("coach-voice-settings")).toBeNull();
    expect(fetchResumeVariants).toHaveBeenCalled();
  });
});

// 2026-10-05: this tile read "Emails checked: 1 of 100" for a free user with 30 applications on
// screen. The limit counts applications (500 in a rolling 30 days on Free, none on Premium).
describe("Settings plan usage", () => {
  test("a free user sees applications this period against the 500 limit", async () => {
    useAuth.mockReturnValue({ user: { uid: "u2", email: "free@example.com" }, plan: "free", planLoading: false, logout: vi.fn() });
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/user/coach-preference") return { success: true, enabled: false, available: false, premium: false };
      return {
        subscription: { plan: "free", status: "inactive" },
        quotaData: { unit: "applications", trackedApplications: 30, monthlyProcessed: 30, limit: 500, windowDays: 30 },
      };
    });

    renderPage();

    expect(await screen.findByText("Applications this period")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("of 500 in the last 30 days")).toBeInTheDocument();
    expect(screen.queryByText("Emails checked")).toBeNull();
  });

  test("a premium user sees applications tracked and no limit", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/user/coach-preference") return { success: true, enabled: true, available: true, premium: true };
      return {
        subscription: { plan: "premium", status: "active" },
        quotaData: { unit: "applications", trackedApplications: 496, monthlyProcessed: 496, limit: null, windowDays: null },
      };
    });

    renderPage();

    expect(await screen.findByText("Applications tracked")).toBeInTheDocument();
    expect(screen.getByText("496")).toBeInTheDocument();
    expect(screen.getByText("No limit on Premium.")).toBeInTheDocument();
  });
});

describe("Settings resumes", () => {
  test("points at the Resumes page instead of a second editor, and names the version Apply Gate uses", async () => {
    // The old box wrote to a legacy field while reading back the default version, so edits there
    // appeared to vanish once any version existed.
    mockApi({ coach: { enabled: true, available: true, premium: true } });
    renderPage();

    expect(await screen.findByText("QA-focused")).toBeInTheDocument();
    expect(screen.getByText(/your default of 2 saved versions/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage resumes/ })).toHaveAttribute("href", "/resumes");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/Pre-jection/)).toBeNull();
  });
});

describe("Settings resume for free users", () => {
  test("free users can reach the shared resume management page", async () => {
    useAuth.mockReturnValue({ user: { uid: "u2", email: "free@example.com" }, plan: "free", planLoading: false, logout: vi.fn() });
    mockApi({ coach: { enabled: true, available: false, premium: false } });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Manage resumes' })).toHaveAttribute('href', '/resumes');
    expect(screen.queryByLabelText('Resume text')).toBeNull();
    expect(saveResume).not.toHaveBeenCalled();
  });

  test("premium users manage resumes on the Resumes page, not here", async () => {
    mockApi({ coach: { enabled: true, available: true, premium: true } });
    renderPage();
    await screen.findByText("QA-focused");
    expect(screen.queryByText("Your resume")).toBeNull();
    expect(fetchResume).not.toHaveBeenCalled();
  });
});

// "Billing details did not load: BLOCKED_BY_QA_HARNESS" reached the screen (persona review, 2026-10-14).
describe("Settings errors", () => {
  test("an unavailable billing read does not claim active billing or the absence of a portal", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/subscriptions/status") throw new Error("Fictional provider timeout");
      return { success: true, enabled: false, available: true, premium: true };
    });
    renderPage();await screen.findByText("Billing details did not load");
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing for this account is not managed through Stripe/)).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
  test("a past-due customer can manage the existing subscription without being directed to buy another", async () => {
    apiFetch.mockImplementation(async (path: string) => path === "/api/subscriptions/status"
      ? { subscription: { plan: "free", status: "past_due", billingPortalAvailable: true, billingSource: "stripe" } }
      : { success: true, enabled: false, available: false, premium: false });
    renderPage();await screen.findByText("Payment due");
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upgrade to Premium" })).not.toBeInTheDocument();
  });
  test("an unread coach preference remains unknown and disabled instead of pretending opt-in is confirmed", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/user/coach-preference") throw new Error("Fictional preference unavailable");
      return { subscription: { plan: "premium", status: "active" } };
    });
    renderPage();await screen.findByText(/Fictional preference unavailable/);
    expect(screen.getByRole("switch", { name: "Coach voice" })).toBeDisabled();
    expect(screen.getByText(/could not confirm your coach setting/i)).toBeInTheDocument();
  });
  test("an old account's late billing response cannot replace the current account's state", async () => {
    let resolveOld!: (value: unknown) => void;
    const pending = new Promise(resolve => { resolveOld = resolve; });
    let billingReads=0;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/subscriptions/status") return ++billingReads===1 ? pending : { subscription: { plan:"free",status:"inactive" } };
      return { success:true,enabled:false,available:false,premium:false };
    });
    const view=renderPage();await waitFor(()=>expect(billingReads).toBe(1));
    useAuth.mockReturnValue({ user:{uid:"different-owner",email:"different@example.invalid"},plan:"free",planLoading:false,logout:vi.fn() });
    view.rerender(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Settings /></QueryClientProvider></MemoryRouter>);
    await screen.findByText("Not active");
    await act(async()=>resolveOld({subscription:{plan:"premium",status:"active",current_period_end:"2031-01-01"}}));
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("coach-voice-settings")).not.toBeInTheDocument();
  });
  test("a raw backend code is never shown; a sentence is", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/subscriptions/status") throw Object.assign(new Error("BLOCKED_BY_QA_HARNESS"), { status: 403 });
      return { success: true, enabled: true, available: true, premium: true };
    });
    renderPage();
    expect(await screen.findByText("Billing details did not load")).toBeInTheDocument();
    expect(screen.queryByText(/BLOCKED_BY_QA_HARNESS/)).not.toBeInTheDocument();
    expect(screen.getByText(/not available for your account right now/)).toBeInTheDocument();
  });

  test("Settings has a Your data section", async () => {
    mockApi({ coach: { enabled: true, available: true, premium: true } });
    renderPage();
    expect(await screen.findByRole("button", { name: "Delete my account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export my data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect Gmail" })).toBeInTheDocument();
  });
});
