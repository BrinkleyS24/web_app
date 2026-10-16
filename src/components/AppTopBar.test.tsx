import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppTopBar } from "./AppTopBar";
import { SYNC_WAIT_CAP_MS, describeSyncLine, resolveWait } from "@/hooks/useInboxSync";

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

// Engineer review, 2026-10-15: web "Sync now" sat on "Checking your inbox…" for 110+ s.
describe("Sync now ends in a clear state", () => {
  const idle = (lastRunAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) => ({
    success: true, sync: { inProgress: false, state: "idle", lastRunAt, pollAfterSeconds: null }, gmailAuth: { requiresReconnect: false },
  });

  test("after a finished sync it says what changed", async () => {
    startEmailSync.mockResolvedValue({ success: true, newEmailsCount: 3, sync: { outcome: "finished", state: "idle" } });
    renderBar();
    await screen.findByText(/Inbox checked 3 hr ago/);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("3 new emails · checked just now")).toBeInTheDocument();

    startEmailSync.mockResolvedValue({ success: true, newEmailsCount: 0, sync: { outcome: "finished", state: "idle" } });
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("No new emails · checked just now")).toBeInTheDocument();
  });

  test("an older backend without an outcome still reports the count it sent", async () => {
    startEmailSync.mockResolvedValue({ success: true, newEmailsCount: 1 });
    renderBar();
    await screen.findByText(/Inbox checked/);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("1 new email · checked just now")).toBeInTheDocument();
  });

  test("when another sync is already running it waits on the server, then finishes", async () => {
    startEmailSync.mockResolvedValue({ success: true, newEmailsCount: 0, sync: { outcome: "already_running", state: "running" } });
    renderBar();
    await screen.findByText(/Inbox checked/);
    fetchSyncStatus.mockResolvedValue({ success: true, sync: { inProgress: true, state: "running", pollAfterSeconds: 5 }, gmailAuth: { requiresReconnect: false } });
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("A sync is already running. Waiting for it…")).toBeInTheDocument();
    fetchSyncStatus.mockResolvedValue(idle(new Date().toISOString()));
    expect(await screen.findByText("Inbox checked just now", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sync now/ })).toBeEnabled();
  }, 12000);

  test("a failed request says so and offers a retry; a reconnect need is named", async () => {
    startEmailSync.mockRejectedValue(new Error("Server error"));
    renderBar();
    await screen.findByText(/Inbox checked/);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("Sync failed. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeEnabled();
  });

  test("a stalled or stale lock never spins forever", () => {
    const now = Date.now();
    const stalled = { success: true, sync: { inProgress: true, state: "stalled" as const, runningForSeconds: 240 } };
    expect(describeSyncLine({ phase: { kind: "idle" }, status: stalled, now }).text).toBe("A sync is taking longer than usual. It continues in the background.");
    // An older backend's lock from 10 minutes ago is not shown as running.
    const legacy = { success: true, sync: { inProgress: true, startedAt: new Date(now - 10 * 60_000).toISOString(), lastRunAt: new Date(now - 60 * 60_000).toISOString() } };
    expect(describeSyncLine({ phase: { kind: "idle" }, status: legacy, now }).text).toBe("Inbox checked 1 hr ago");
    // Waiting stops at the cap and says the sync continues in the background.
    const running = { success: true, sync: { inProgress: true, state: "running" as const } };
    const waiting = { kind: "waiting" as const, since: now - SYNC_WAIT_CAP_MS, alreadyRunning: false };
    expect(resolveWait(waiting, running, now)).toEqual({ kind: "background", at: now });
    expect(resolveWait({ ...waiting, since: now }, running, now)).toBeNull();
    expect(resolveWait(waiting, { success: true, sync: { inProgress: false, state: "needs_reconnect" } }, now)).toEqual({ kind: "reconnect", at: now });
    expect(describeSyncLine({ phase: { kind: "reconnect", at: now }, status: undefined, now })).toEqual({ text: "Reconnect Gmail in the extension to sync.", tone: "risk" });
  });

  test("a request timeout keeps watching the server instead of failing", async () => {
    startEmailSync.mockRejectedValue(new Error("Request timed out after 45000ms."));
    renderBar();
    await screen.findByText(/Inbox checked/);
    fetchSyncStatus.mockResolvedValue({ success: true, sync: { inProgress: true, state: "running", pollAfterSeconds: 5 }, gmailAuth: { requiresReconnect: false } });
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(await screen.findByText("Checking your inbox…")).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).toBeNull();
  });
});
