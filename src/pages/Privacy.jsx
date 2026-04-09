import React from "react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";

const sections = [
  {
    title: "Information Applendium collects",
    items: [
      "Account identifiers such as your email address, Firebase-authenticated user ID, and extension-linked session details.",
      "Gmail data you explicitly authorize Applendium to access, including message metadata and email content needed to identify application-related threads.",
      "Application tracking data derived from those threads, such as company names, role names, lifecycle state, timestamps, and user-made corrections.",
      "Subscription and billing state for paid plans. Payment card details are handled by the payment processor rather than stored directly by Applendium.",
      "Operational and diagnostic data needed to keep the service running, such as request logs, sync status, and error telemetry.",
    ],
  },
  {
    title: "How Applendium uses that information",
    items: [
      "To authenticate you across the extension and any enabled Applendium web surfaces.",
      "To sync Gmail application emails, group them into application records, and surface them in the dashboard and extension UI.",
      "To support features such as lifecycle tracking, corrections, follow-up workflows, and subscription enforcement.",
      "To debug reliability issues, investigate support requests, and improve classification quality and product safety.",
    ],
  },
  {
    title: "How data is shared",
    items: [
      "With infrastructure and service providers that help deliver the product, such as authentication, hosting, database, and payment vendors.",
      "With Google APIs only as necessary to provide the Gmail-connected features you requested.",
      "Applendium does not sell your personal information or Gmail data.",
    ],
  },
  {
    title: "Retention and control",
    items: [
      "Data is retained while your account is active and as needed to operate the service, resolve support issues, and meet legal obligations.",
      "You can revoke Gmail access from your Google account permissions and can request account or data deletion by contacting support.",
      "Some backups and operational logs may persist for a limited period before normal deletion cycles complete.",
    ],
  },
  {
    title: "Security",
    items: [
      "Applendium uses reasonable administrative, technical, and organizational safeguards to protect account data and Gmail-derived records.",
      "No internet-connected system can guarantee absolute security, so users should also secure their Google account and browser profile.",
    ],
  },
];

export default function Privacy() {
  usePageMetadata({
    title: "Applendium | Privacy Policy",
    description:
      "Read how Applendium handles Gmail-derived data, account information, retention, and privacy requests for the Chrome extension and related support surfaces.",
  });

  return (
    <PublicSiteLayout>
      <section className="legalHero">
        <p className="sectionEyebrow">Privacy Policy</p>
        <h1>How Applendium handles user and Gmail-derived data</h1>
        <p>
          Effective date: March 24, 2026. This policy describes the information Applendium processes, why it is used, and how users can request help or privacy-related changes.
        </p>
      </section>

      <section className="legalSection">
        <div className="legalIntro">
          <p>
            Applendium is a Gmail-connected job application tracking product. The extension and related account or support surfaces process only the information needed to authenticate users, sync relevant application emails, and present that information back to the user as a structured application record.
          </p>
          <p>
            If this policy changes in a material way, the updated version will be posted on this page with a revised effective date.
          </p>
        </div>

        <div className="legalGrid">
          {sections.map((section) => (
            <article key={section.title} className="legalCard">
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="legalSection legalSectionCompact">
        <div className="legalCard">
          <h2>Children's privacy</h2>
          <p>
            Applendium is intended for people managing their own job search and is not directed to children under 13.
          </p>
        </div>

        <div className="legalCard">
          <h2>Contact</h2>
          <p>
            For privacy questions, data requests, or account deletion requests, email{" "}
            <a href="mailto:privacy@applendium.com">privacy@applendium.com</a>.
          </p>
          <p>
            For general product support, email{" "}
            <a href="mailto:support@applendium.com">support@applendium.com</a>.
          </p>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
