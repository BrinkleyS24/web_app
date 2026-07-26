import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import Settings from "./Settings";

const { apiFetch, useAuth } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ResumePrompt", () => ({
  ResumePrompt: () => <div data-testid="resume-prompt" />,
}));

vi.mock("../lib/api.js", () => ({ apiFetch }));
vi.mock("../lib/AuthContext.jsx", () => ({ useAuth }));

function renderPage() {
  return render(
    <MemoryRouter>
      <Settings />
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
  useAuth.mockReturnValue({
    user: { uid: "u1", email: "premium@example.com" },
    plan: "premium",
    planLoading: false,
    logout: vi.fn(),
  });
});

afterEach(() => vi.clearAllMocks());

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

    await screen.findByTestId("resume-prompt");
    expect(screen.queryByTestId("coach-voice-settings")).toBeNull();
  });
});
