import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const authState = vi.hoisted(() => ({ callback: null }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    authState.callback = cb;
    return () => {};
  },
  signOut: vi.fn(),
}));
vi.mock("./firebase.js", () => ({ auth: { currentUser: null }, firebaseConfigured: true }));
vi.mock("./extensionBridge.js", () => ({
  signInFromExtensionBridge: vi.fn(() => new Promise(() => {})),
  signOutFromExtensionBridge: vi.fn(),
}));
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("./api.js", () => ({ apiFetch }));

import { AuthProvider, useAuth } from "./AuthContext.jsx";

function Probe({ renders }) {
  const { user, loading, planLoading, plan, planError } = useAuth();
  renders.push({ user: Boolean(user), loading, planLoading, plan, planError });
  return null;
}

describe("AuthProvider plan loading", () => {
  beforeEach(() => {
    authState.callback = null;
    apiFetch.mockReset();
  });

  // Found 2026-09-25: a refresh or bookmark of any premium page bounced a premium user to
  // /upgrade. The plan effect ran on mount with no user and marked the plan "loaded"; when
  // Firebase then restored the session, one render had a signed-in user, planLoading=false and
  // plan=null — and RequirePremiumUser redirected before the plan request even started.
  test("a restored session is never reported as settled before its plan arrives", async () => {
    let resolvePlan;
    apiFetch.mockReturnValue(new Promise((resolve) => { resolvePlan = resolve; }));
    const renders = [];
    render(<AuthProvider><Probe renders={renders} /></AuthProvider>);

    await act(async () => { authState.callback({ uid: "u1", email: "a@b.c" }); });

    const settledWithoutPlan = renders.filter(
      (r) => r.user && !r.loading && !r.planLoading && r.plan !== "premium" && !r.planError,
    );
    expect(settledWithoutPlan).toEqual([]);

    await act(async () => { resolvePlan({ plan: "premium" }); });
    expect(renders.at(-1)).toEqual(expect.objectContaining({ user: true, planLoading: false, plan: "premium" }));
  });

  test("a failed plan request settles into an error, not an endless spinner", async () => {
    apiFetch.mockRejectedValue(new Error("network down"));
    const renders = [];
    render(<AuthProvider><Probe renders={renders} /></AuthProvider>);
    await act(async () => { authState.callback({ uid: "u1", email: "a@b.c" }); });
    expect(renders.at(-1)).toEqual(expect.objectContaining({ planLoading: false, planError: "network down" }));
  });

  test("a signed-out visitor settles with no plan", async () => {
    const renders = [];
    render(<AuthProvider><Probe renders={renders} /></AuthProvider>);
    await act(async () => { authState.callback(null); });
    expect(renders.at(-1)).toEqual(expect.objectContaining({ user: false, planLoading: false, plan: null }));
  });
});
