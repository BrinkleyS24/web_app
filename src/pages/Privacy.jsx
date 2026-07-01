import React from "react";

export default function Privacy() {
  return (
    <main className="page page--legal">
      <section className="legal-shell">
        <h1>Privacy Policy</h1>
        <p className="muted">Effective date: June 30, 2026</p>

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

        <h2>Service providers</h2>
        <p>
          Applendium relies on a small set of vetted service providers to operate, and shares data with
          them only as needed to provide the features you use. Providers that may process your data, or
          information derived from it, include:
        </p>
        <ul>
          <li><strong>Google Cloud</strong> — hosting, secret storage, and background task processing.</li>
          <li><strong>Supabase</strong> — encrypted database storage of your application data.</li>
          <li><strong>Firebase Authentication</strong> (Google) — account sign-in.</li>
          <li>
            <strong>OpenAI</strong> — powers AI features. It processes job-search content you provide
            (such as job postings and your résumé for Apply Gate) and information derived from your emails
            (for inbox coaching). Data sent through OpenAI's API is used only to generate results for you
            and is not used to train OpenAI's models.
          </li>
          <li><strong>Stripe</strong> — payment processing for premium subscriptions. No Gmail data is shared with Stripe.</li>
        </ul>
        <p>
          These providers act as our processors and are bound by their own terms and security commitments.
          We do not transfer your Google user data to any party for advertising, resale, or AI model training.
        </p>

        <h2>Data retention</h2>
        <p>
          We retain your data only while your account is active and as needed to provide the service. When
          you delete your account, Gmail-derived records are removed from our live systems promptly; residual
          copies in encrypted backups are purged within our standard backup-retention window. You can request
          deletion at any time.
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
