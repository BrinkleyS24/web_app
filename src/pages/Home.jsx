import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthButton from "../components/AuthButton.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { firebaseConfigured } from "../lib/firebase.js";

export default function Home() {
  const {
    user,
    loading: authLoading,
    extensionDetected,
    plan,
    planLoading,
    planError,
    adminEmail,
  } = useAuth();
  const navigate = useNavigate();

  // Once authenticated, fetch plan and redirect
  useEffect(() => {
    if (authLoading || planLoading || !user) return;

    if (adminEmail) {
      navigate("/admin/review", { replace: true });
      return;
    }

    if (plan === "premium") {
      navigate("/dashboard", { replace: true });
      return;
    }

    navigate("/upgrade", { replace: true });
  }, [user, authLoading, planLoading, adminEmail, plan, navigate]);

  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <p className="sectionEyebrow" style={{ marginBottom: 10 }}>Companion app</p>
      <h2 style={{ marginTop: 0 }}>Open your Applendium workspace</h2>

      {!firebaseConfigured && !user ? (
        <div className="error">
          The companion app is not configured yet. Set the VITE_FIREBASE_* build environment variables for this deployment.
        </div>
      ) : authLoading ? (
        <p className="muted" style={{ marginTop: 4 }}>Connecting to extension...</p>
      ) : user && planLoading ? (
        <p className="muted" style={{ marginTop: 4 }}>Checking your plan...</p>
      ) : user ? (
        <p className="muted" style={{ marginTop: 4 }}>
          Signed in as <strong>{user.email}</strong>. Redirecting...
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p className="muted">
            {extensionDetected
              ? "You're not signed into the Applendium extension. Open the extension popup and sign in, then refresh this page."
              : "This page works with the Applendium Chrome extension. Make sure the extension is installed and you're signed in, then refresh this page."}
          </p>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(148, 163, 184, 0.2)" }}>
            <p className="muted" style={{ marginBottom: 10 }}>
              For admin or internal debugging, you can also sign in directly on the web with Google.
            </p>
            <AuthButton />
          </div>
        </div>
      )}

      {planError ? <div className="error" style={{ marginTop: 12 }}>{planError}</div> : null}

      <p className="muted" style={{ marginTop: 16 }}>
        Looking for the public site? <a href="/">Go back to applendium.com</a>.
      </p>
    </div>
  );
}
