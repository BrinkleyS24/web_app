import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { firebaseConfigured } from "../lib/firebase.js";

export default function Home() {
  const { user, loading: authLoading, extensionDetected } = useAuth();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  // Once authenticated, fetch plan and redirect
  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    setChecking(true);

    (async () => {
      try {
        const resp = await apiFetch("/api/user", { method: "POST", body: "{}" });
        if (cancelled) return;
        const plan = resp?.plan ?? "free";
        if (plan === "premium") {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/upgrade", { replace: true });
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load user plan.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>Welcome to MorrowFold</h2>

      {!firebaseConfigured ? (
        <div className="error">
          Firebase isn't configured yet. Set VITE_FIREBASE_* in frontend/web/.env.local.
        </div>
      ) : authLoading ? (
        <p className="muted" style={{ marginTop: 4 }}>Connecting to extension...</p>
      ) : checking ? (
        <p className="muted" style={{ marginTop: 4 }}>Checking your plan...</p>
      ) : user ? (
        <p className="muted" style={{ marginTop: 4 }}>
          Signed in as <strong>{user.email}</strong>. Redirecting...
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p className="muted">
            {extensionDetected
              ? "You're not signed into the MorrowFold extension. Open the extension popup and sign in, then refresh this page."
              : "This page works with the MorrowFold Chrome extension. Make sure the extension is installed and you're signed in, then refresh this page."}
          </p>
        </div>
      )}

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
