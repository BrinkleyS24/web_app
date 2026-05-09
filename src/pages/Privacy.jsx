import React from "react";

export default function Privacy() {
  return (
    <main className="page page--legal">
      <section className="legal-shell">
        <h1>Privacy Policy</h1>
        <p className="muted">Effective date: May 8, 2026</p>

        <h2>What Applendium accesses</h2>
        <p>
          Applendium connects to Gmail only after you authorize access. The app reads email metadata
          and message content needed to identify job-search emails, classify application status,
          extract company and position details, and provide job-search workflow features.
        </p>

        <h2>How your data is used</h2>
        <p>
          Gmail data is used only to provide and improve user-facing job tracking features inside
          Applendium. We do not sell Gmail data, use it for advertising, or allow humans to read it
          except when required for security, abuse prevention, support you request, or legal compliance.
        </p>

        <h2>Google API Limited Use</h2>
        <p>
          Applendium's use and transfer of information received from Google APIs adheres to the
          Google API Services User Data Policy, including the Limited Use requirements.
        </p>

        <h2>Storage and protection</h2>
        <p>
          OAuth refresh tokens, Gmail subjects, senders, message bodies, misclassification report
          content, and resume text are encrypted before storage. Production secrets are stored in
          Google Secret Manager and are not committed to source control.
        </p>

        <h2>Deletion</h2>
        <p>
          You can request deletion of your account and stored application data from support. Authenticated
          account deletion is also supported by the backend. Deletion removes stored Gmail-derived
          records, application history, feedback, suggestions, reports, and your application user record.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy, security, or deletion requests, contact support through applendium.com/support
          or the Chrome Web Store support contact for Applendium.
        </p>
      </section>
    </main>
  );
}
