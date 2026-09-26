import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useNavCounts } from "./useNavCounts";

const { fetchRankedActionQueue, fetchStrategyAlerts } = vi.hoisted(() => ({
  fetchRankedActionQueue: vi.fn(),
  fetchStrategyAlerts: vi.fn(),
}));
vi.mock("@/lib/emails", async () => ({
  ...(await vi.importActual("@/lib/emails")),
  fetchRankedActionQueue,
  fetchStrategyAlerts,
}));

const action = (id: string) => ({
  id,
  logicalKey: `k-${id}`,
  dedupeKey: `k-${id}:v1`,
  primaryEntityId: id,
  actionType: "follow_up",
  actionCategory: "communication",
  intent: "FOLLOW_UP_THREAD",
  intentLabel: "Follow-up",
  sourceLabel: "Outreach task",
  stageLabel: "Applied",
  routeHref: "/next-actions",
  routeLabel: "Open",
  draftEligible: true,
  title: `Follow up ${id}`,
  urgencyLevel: "high",
  confidenceLevel: "strong",
  status: "open",
  effectiveStatus: "open",
  queueSource: "followup",
  createdAt: "2026-09-26T08:00:00.000Z",
  evidence: [],
  playbook: [],
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchRankedActionQueue.mockReset();
  fetchStrategyAlerts.mockReset();
  fetchRankedActionQueue.mockResolvedValue({
    success: true,
    queue: { doToday: [action("a"), action("b"), action("c"), action("d")], thisWeek: [action("e")], later: [], blocked: [] },
  });
  fetchStrategyAlerts.mockResolvedValue({
    success: true,
    alerts: [
      { id: "commitment-upcoming", kind: "commitment", severity: "high", title: "Interview today", description: "" },
      { id: "performance-activity-down", kind: "performance", severity: "medium", title: "Fewer applications", description: "" },
      { id: "performance-coverage-gap", kind: "performance", severity: "low", title: "Not enough yet", description: "" },
      { id: "focus-industry", kind: "focus", severity: "positive", title: "Healthcare converts", description: "" },
    ],
  });
});

describe("useNavCounts", () => {
  test("counts Today and the alerts that need attention, never floors or good news", async () => {
    const { result } = renderHook(() => useNavCounts(true), { wrapper });
    await waitFor(() => expect(result.current["/next-actions"]).toBe(4));
    await waitFor(() => expect(result.current["/strategy-alerts"]).toBe(2));
  });

  test("a malformed queue means no badge, not a broken page", async () => {
    fetchRankedActionQueue.mockResolvedValue({ success: true, queue: { doToday: [{ id: "bad" }], thisWeek: [], later: [], blocked: [] } });
    const { result } = renderHook(() => useNavCounts(true), { wrapper });
    await waitFor(() => expect(fetchRankedActionQueue).toHaveBeenCalled());
    await waitFor(() => expect(result.current["/strategy-alerts"]).toBe(2));
    expect(result.current["/next-actions"]).toBe(0);
  });

  test("fetches nothing for a free user", () => {
    const { result } = renderHook(() => useNavCounts(false), { wrapper });
    expect(result.current["/next-actions"]).toBe(0);
    expect(fetchRankedActionQueue).not.toHaveBeenCalled();
    expect(fetchStrategyAlerts).not.toHaveBeenCalled();
  });
});
