import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase.js";
import { signInFromExtensionBridge } from "./extensionBridge.js";
import { apiFetch } from "./api.js";

const AUTH_STATE_PUSH = "APPLENDIUM_AUTH_STATE_PUSH";
const EXTENSION_READY = "APPLENDIUM_EXTENSION_READY";

const AuthContext = createContext({
  user: null,
  loading: true,
  extensionDetected: false,
  plan: null,
  planLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * App-level auth provider.
 * The web app is an extension companion — it does NOT have its own sign-in.
 * Auth comes exclusively from the Chrome extension via the content-script bridge.
 *
 * 1. Attempts bridge sign-in on mount.
 * 2. Listens for real-time auth state pushes from the extension (sign-in / sign-out).
 * 3. Exposes { user, loading, extensionDetected } to all children.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bridgeDone, setBridgeDone] = useState(!firebaseConfigured);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Step 1: Listen for Firebase auth state changes (shared auth instance)
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Step 2: Attempt bridge sign-in from the extension
  useEffect(() => {
    if (!authReady || user || bridgeDone) return;

    let cancelled = false;

    (async () => {
      // Small initial delay to ensure the content script is injected and ready
      await new Promise((r) => setTimeout(r, 500));

      for (let i = 0; i < 4; i++) {
        if (cancelled || auth?.currentUser) break;
        try {
          console.log(`[Applendium] Bridge sign-in attempt ${i + 1}/4...`);
          const result = await signInFromExtensionBridge();
          if (result?.success) {
            console.log("[Applendium] Bridge sign-in succeeded!");
            setExtensionDetected(true);
            break;
          }
          // If the bridge responded (even with failure), the extension is there
          if (result?.error && !result.error.includes("timed out")) {
            console.log("[Applendium] Extension detected but sign-in failed:", result.error);
            setExtensionDetected(true);
          }
        } catch (e) {
          console.log("[Applendium] Bridge attempt error:", e?.message);
        }
        if (i < 3 && !cancelled) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!cancelled) setBridgeDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, bridgeDone]);

  // Step 3: Listen for auth state pushes from the extension (sign-out sync)
  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data) return;

      if (data.type === EXTENSION_READY) {
        setExtensionDetected(true);
        if (!auth?.currentUser) {
          // Extension is present → ensure we attempt the bridge again
          setBridgeDone(false);
        }
        return;
      }

      if (data.type !== AUTH_STATE_PUSH) return;

      setExtensionDetected(true);

      if (!data.loggedIn && auth?.currentUser) {
        // Extension signed out → sign out the web too
        signOut(auth).catch(() => {});
      } else if (data.loggedIn && !auth?.currentUser) {
        // Extension signed in → re-attempt bridge auth
        setBridgeDone(false);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Step 4: Fetch user plan from backend once authenticated
  useEffect(() => {
    if (!user) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);

    apiFetch("/api/user", { method: "POST", body: JSON.stringify({}) })
      .then((data) => {
        if (!cancelled) {
          setPlan(data?.plan || "free");
          setPlanLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Applendium] Failed to fetch user plan:", err);
        if (!cancelled) {
          setPlan("free"); // Default to free on error (fail-closed)
          setPlanLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  const loading = !authReady || (!user && !bridgeDone);

  return (
    <AuthContext.Provider value={{ user, loading, extensionDetected, plan, planLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

