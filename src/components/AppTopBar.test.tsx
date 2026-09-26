import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppTopBar } from "./AppTopBar";

const { fetchSyncStatus, startEmailSync, authState } = vi.hoisted(() => ({
  fetchSyncStatus: vi.fn(),
  startEmailSync: vi.fn(),
  authState: { user: { uid: "u1" } as { uid: string } | null, plan: "premium" as string | null },
}));

vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => <button type="button">Toggle Sidebar</button> }));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => authState }));
vi.mock("@/lib/emails", async () => ({ ...(await vi.importActual("@/lib/emails")), fetchSyncStatus, startEmailSync }));

function renderBar(path = "/strategy-alerts") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<AppTopBar />, { wrapper: wrap });
}

beforeEach(() => {
  authState.user = { uid: "u1" };
  authState.plan = "premium";
  fetchSyncStatus.mockReset();
  startEmailSync.mockReset();
  // Stale on purpose: the Dashboard would auto-sync on this; the top bar must not.
  fetchSyncStatus.mockResolvedValue({
    success: true,
    sync: { inProgress: false, lastRunAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    gmailAuth: { requiresReconnect: false },
  });
});

describe("AppTopBar", () => {
  test("shows inbox freshness and puts Apply Gate one click away on every premium page", async () => {
    renderBar();
    expect(await screen.findByText(/Inbox checked 3 hr ago/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sync now/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check a job/ })).toHaveAttribute("href", "/apply-gate");
  });

  test("never starts a sync by itself, even when the inbox is stale", async () => {
    renderBar();
    await screen.findByText(/Inbox checked/);
    await waitFor(() => expect(fetchSyncStatus).toHaveBeenCalled());
    expect(startEmailSync).not.toHaveBeenCalled();
  });

  test("does not offer Check a job on Apply Gate itself, and shows nothing extra to free users", async () => {
    const onApplyGate = renderBar("/apply-gate");
    await screen.findByText(/Inbox checked/);
    expect(screen.queryByRole("link", { name: /Check a job/ })).not.toBeInTheDocument();
    onApplyGate.unmount();

    authState.plan = "free";
    renderBar("/settings");
    expect(screen.queryByRole("button", { name: /Sync now/ })).toBeNull();
  });
});
