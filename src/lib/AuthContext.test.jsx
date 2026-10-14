import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
import { signInFromExtensionBridge } from "./extensionBridge.js";

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

describe("AuthProvider extension bridge (2026-10-14: signed-out decision speed)", () => {
  function BridgeProbe({ renders }) {
    const { user, bridgeDone, extensionDetected, loading } = useAuth();
    renders.push({ user: Boolean(user), bridgeDone, extensionDetected, loading });
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    authState.callback = null;
    delete window.__applendiumExtensionReady;
  });
  afterEach(() => {
    vi.useRealTimers();
    signInFromExtensionBridge.mockReset().mockImplementation(() => new Promise(() => {}));
    delete window.__applendiumExtensionReady;
  });

  test("with no extension answering, it gives up after one attempt instead of four", async () => {
    signInFromExtensionBridge.mockResolvedValue({ success: false, error: "Extension token request timed out." });
    const renders = [];
    render(<AuthProvider><BridgeProbe renders={renders} /></AuthProvider>);
    await act(async () => { authState.callback(null); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(signInFromExtensionBridge).toHaveBeenCalledTimes(1);
    expect(renders.at(-1)).toEqual(expect.objectContaining({ user: false, bridgeDone: true }));
  });

  test("an extension that says nobody is signed in settles it on the first answer", async () => {
    signInFromExtensionBridge.mockResolvedValue({ success: false, loggedIn: false, error: "User not authenticated" });
    const renders = [];
    render(<AuthProvider><BridgeProbe renders={renders} /></AuthProvider>);
    await act(async () => { authState.callback(null); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(signInFromExtensionBridge).toHaveBeenCalledTimes(1);
    expect(renders.at(-1)).toEqual(expect.objectContaining({ bridgeDone: true, extensionDetected: true }));
  });

  test("an installed extension with a passing error still gets its retries", async () => {
    signInFromExtensionBridge.mockResolvedValue({ success: false, error: "Failed to create web auth token." });
    render(<AuthProvider><BridgeProbe renders={[]} /></AuthProvider>);
    await act(async () => { authState.callback(null); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(signInFromExtensionBridge).toHaveBeenCalledTimes(4);
  });

  test("an early 'not signed in' announcement from the extension needs no bridge round trip", async () => {
    window.__applendiumExtensionReady = { loggedIn: false };
    const renders = [];
    render(<AuthProvider><BridgeProbe renders={renders} /></AuthProvider>);
    await act(async () => { authState.callback(null); });
    expect(renders.at(-1)).toEqual(expect.objectContaining({ bridgeDone: true, extensionDetected: true, loading: false }));
    expect(signInFromExtensionBridge).not.toHaveBeenCalled();
  });
});
