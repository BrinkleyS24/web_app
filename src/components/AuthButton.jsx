import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseConfigured, signInWithGoogle } from "../lib/firebase.js";
import { useAuth } from "../lib/AuthContext.jsx";

export default function AuthButton() {
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e?.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      setError(e?.message || "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseConfigured) {
    return <span className="pill">Auth not configured</span>;
  }

  if (!user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn btnPrimary" onClick={handleSignIn} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <button className="btn" onClick={handleSignOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
