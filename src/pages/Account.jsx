import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

export default function Account() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyPortal, setBusyPortal] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const resp = await apiFetch("/api/subscriptions/status", { method: "GET" });
      setStatus(resp || null);
    } catch (e) {
      setError(e?.message || "Failed to load subscription status.");
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setError("");
    setBusyPortal(true);
    try {
      const resp = await apiFetch("/api/subscriptions/create-portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const url = resp?.url;
      if (!url) throw new Error("Backend did not return a portal URL.");
      window.location.assign(url);
    } catch (e) {
      setError(e?.message || "Failed to open customer portal.");
    } finally {
      setBusyPortal(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Account</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Subscription status + billing portal.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btnPrimary" onClick={openPortal} disabled={busyPortal}>
            {busyPortal ? "Opening…" : "Manage billing"}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <pre
        style={{
          marginTop: 12,
          background: "#0b1020",
          color: "#e5e7eb",
          padding: 12,
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        {JSON.stringify(status, null, 2)}
      </pre>
    </div>
  );
}

