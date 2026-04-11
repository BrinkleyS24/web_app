import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthButton from "../components/AuthButton.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { firebaseConfigured } from "../lib/firebase.js";
import { WEB_WORKSPACE_IS_PUBLIC } from "../lib/publicSiteConfig.js";

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
  const isLocalDevWorkspace =
    import.meta.env.DEV
    && typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

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

    if (planError && !plan) {
      return;
    }

    navigate("/upgrade", { replace: true });
  }, [user, authLoading, planLoading, adminEmail, plan, planError, navigate]);

  const hideInternalWorkspaceDetails = !WEB_WORKSPACE_IS_PUBLIC && !user && !isLocalDevWorkspace;

  if (hideInternalWorkspaceDetails) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <p className="sectionEyebrow" style={{ marginBottom: 10 }}>Web workspace</p>
        <h2 style={{ marginTop: 0 }}>This web workspace is not public yet</h2>

        <div className="card" style={{ marginTop: 12, background: "rgba(255,255,255,0.65)" }}>
          <p className="muted" style={{ margin: 0 }}>
            The public launch is centered on the Chrome extension. This route remains
            reserved for internal testing and staged rollout work, and should not be
            presented as a public product surface yet.
          </p>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <a className="btn btnPrimary" href="/">
            Go back to applendium.com
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
      <p className="sectionEyebrow" style={{ marginBottom: 10 }}>
        {WEB_WORKSPACE_IS_PUBLIC ? "Web workspace" : "Internal workspace"}
      </p>
      <h2 style={{ marginTop: 0 }}>
        {WEB_WORKSPACE_IS_PUBLIC
          ? "Open your Applendium workspace"
          : "This web workspace is not public yet"}
      </h2>

      {!WEB_WORKSPACE_IS_PUBLIC ? (
        <div className="card" style={{ marginTop: 12, background: "rgba(255,255,255,0.65)" }}>
          <p className="muted" style={{ margin: 0 }}>
            The public launch is centered on the Chrome extension. This route remains
            available for internal testing and staged rollout work, but it should not be
            presented as a public product surface yet.
          </p>
        </div>
      ) : null}

      {!firebaseConfigured && !user ? (
        <div className="error">
          The web workspace is not configured yet. Set the VITE_FIREBASE_* build environment variables for this deployment.
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
