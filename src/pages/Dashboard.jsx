import React from "react";

export default function Dashboard() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Premium Dashboard</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Next: add your analytics + insights UI here, gated by plan=premium.
      </p>

      <div className="row" style={{ marginTop: 12 }}>
        <span className="pill">Interview rate</span>
        <span className="pill">Offer rate</span>
        <span className="pill">Follow-up suggestions</span>
      </div>
    </div>
  );
}

