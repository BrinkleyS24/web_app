import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase.js";
import { signInFromExtensionBridge } from "./extensionBridge.js";
import { apiFetch } from "./api.js";

const AUTH_STATE_PUSH = "APPLENDIUM_AUTH_STATE_PUSH";
const EXTENSION_READY = "APPLENDIUM_EXTENSION_READY";
const DEV_AUTH_BYPASS_ENABLED =
  import.meta.env.DEV
  && String(import.meta.env.VITE_DEV_AUTH_BYPASS || "").trim().toLowerCase() === "true";
const DEV_AUTH_BYPASS_EMAIL =
  String(import.meta.env.VITE_DEV_AUTH_EMAIL || "").trim() || "dev@example.test";
const DEV_AUTH_BYPASS_UID =
  String(import.meta.env.VITE_DEV_AUTH_UID || "").trim() || "local-dev-user";

function buildDevBypassUser() {
  return {
    uid: DEV_AUTH_BYPASS_UID,
    email: DEV_AUTH_BYPASS_EMAIL,
    displayName: DEV_AUTH_BYPASS_EMAIL,
    isBypass: true,
  };
}

const AuthContext = createContext({
  user: null,
  loading: true,
  extensionDetected: false,
  plan: null,
  planLoading: true,
  planError: "",
  adminEmail: false,
  debugRoutesEnabled: false,
  debugAdminAccess: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * App-level auth provider.
 * The web app is an extension companion; it does NOT have its own sign-in.
 * Auth comes exclusively from the Chrome extension via the content-script bridge.
 */
export function AuthProvider({ children }) {
  const isLocalDevBypass =
    DEV_AUTH_BYPASS_ENABLED
    && typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const [user, setUser] = useState(isLocalDevBypass ? buildDevBypassUser() : null);
  const [authReady, setAuthReady] = useState(isLocalDevBypass || false);
  const [bridgeDone, setBridgeDone] = useState(isLocalDevBypass || !firebaseConfigured);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionAuthResolved, setExtensionAuthResolved] = useState(isLocalDevBypass || !firebaseConfigured);
  const [plan, setPlan] = useState(isLocalDevBypass ? "premium" : null);
  const [planLoading, setPlanLoading] = useState(!isLocalDevBypass);
  const [planError, setPlanError] = useState("");
  const [adminEmail, setAdminEmail] = useState(isLocalDevBypass);
  const [debugRoutesEnabled, setDebugRoutesEnabled] = useState(isLocalDevBypass);
  const [debugAdminAccess, setDebugAdminAccess] = useState(isLocalDevBypass);

  useEffect(() => {
    if (isLocalDevBypass) {
      setUser(buildDevBypassUser());
      setAuthReady(true);
      setBridgeDone(true);
      setExtensionAuthResolved(true);
      return undefined;
    }
    if (!auth) {
      setAuthReady(true);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [isLocalDevBypass]);

  useEffect(() => {
    if (isLocalDevBypass) return undefined;
    if (!authReady || user || bridgeDone) return undefined;

    let cancelled = false;

    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      for (let i = 0; i < 4; i += 1) {
        if (cancelled || auth?.currentUser) break;
        try {
          console.log(`[Applendium] Bridge sign-in attempt ${i + 1}/4...`);
          const result = await signInFromExtensionBridge();
          if (result?.success) {
            console.log("[Applendium] Bridge sign-in succeeded!");
            setExtensionDetected(true);
            setExtensionAuthResolved(true);
            break;
          }
          if (result?.error && !result.error.includes("timed out")) {
            console.log("[Applendium] Extension detected but sign-in failed:", result.error);
            setExtensionDetected(true);
            setExtensionAuthResolved(true);
          }
        } catch (error) {
          console.log("[Applendium] Bridge attempt error:", error?.message);
        }

        if (i < 3 && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!cancelled) {
        setBridgeDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, bridgeDone, isLocalDevBypass]);

  useEffect(() => {
    if (isLocalDevBypass) return undefined;
    function onMessage(event) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data) return;

      if (data.type === EXTENSION_READY) {
        setExtensionDetected(true);
        setExtensionAuthResolved(true);

        if (data.loggedIn === false) {
          setBridgeDone(true);
          if (auth?.currentUser) {
            signOut(auth).catch(() => {});
          }
          return;
        }

        if (data.loggedIn && !auth?.currentUser) {
          setBridgeDone(false);
        }
        return;
      }

      if (data.type !== AUTH_STATE_PUSH) return;

      setExtensionDetected(true);
      setExtensionAuthResolved(true);

      if (!data.loggedIn && auth?.currentUser) {
        signOut(auth).catch(() => {});
      } else if (data.loggedIn && !auth?.currentUser) {
        setBridgeDone(false);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isLocalDevBypass]);

  useEffect(() => {
    if (isLocalDevBypass) {
      setPlan("premium");
      setPlanLoading(false);
      setPlanError("");
      setAdminEmail(true);
      setDebugRoutesEnabled(true);
      setDebugAdminAccess(true);
      return undefined;
    }

    if (!user) {
      setPlan(null);
      setPlanLoading(false);
      setPlanError("");
      setAdminEmail(false);
      setDebugRoutesEnabled(false);
      setDebugAdminAccess(false);
      return undefined;
    }

    let cancelled = false;
    setPlanLoading(true);
    setPlanError("");

    apiFetch("/api/user", { method: "POST", body: JSON.stringify({}) })
      .then((data) => {
        if (cancelled) return;
        if (data?.plan) {
          setPlan(data.plan);
        }
        setAdminEmail(Boolean(data?.adminEmail));
        setDebugRoutesEnabled(Boolean(data?.debugRoutesEnabled));
        setDebugAdminAccess(Boolean(data?.debugAdminAccess));
        setPlanLoading(false);
        setPlanError("");
      })
      .catch((error) => {
        console.error("[Applendium] Failed to fetch user plan:", error);
        if (cancelled) return;
        setPlanLoading(false);
        setPlanError(error instanceof Error ? error.message : "Failed to load user plan.");
        setAdminEmail(false);
        setDebugRoutesEnabled(false);
        setDebugAdminAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isLocalDevBypass]);

  const loading = !authReady || (extensionDetected && !extensionAuthResolved) || (!user && !bridgeDone);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      extensionDetected,
      plan,
      planLoading,
      planError,
      adminEmail,
      debugRoutesEnabled,
      debugAdminAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
