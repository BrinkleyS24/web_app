import React from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";

const sections = [
  {
    title: "Using Applendium",
    items: [
      "Applendium helps users track job applications by connecting to Gmail with user-authorized, read-only access.",
      "You are responsible for keeping your Google account, browser profile, and Applendium account access secure.",
      "You may use Applendium only if you can legally agree to these terms and comply with applicable laws.",
    ],
  },
  {
    title: "Google and Gmail access",
    items: [
      "Applendium requests Gmail read-only access so it can identify, classify, and display job-application-related emails.",
      "Applendium does not need permission to send, delete, or modify Gmail messages for the current extension workflow.",
      "You can revoke Applendium's Google access from your Google Account permissions at any time.",
    ],
  },
  {
    title: "Classification accuracy",
    items: [
      "Applendium uses automated classification to group emails by application stage, including applied, interview, offer, rejected, and irrelevant.",
      "Automated classification may be incomplete or incorrect, so you should review important emails directly in Gmail before making job-search decisions.",
      "Correction and support workflows may be used to improve product quality, investigate issues, and reduce future misclassification risk.",
    ],
  },
  {
    title: "Accounts and acceptable use",
    items: [
      "Do not misuse the service, interfere with its operation, attempt unauthorized access, or use Applendium to process data you do not have rights to access.",
      "Applendium may limit or suspend access if an account creates security, abuse, operational, or legal risk.",
      "If you want account deletion or data removal, contact the support or privacy address listed below.",
    ],
  },
  {
    title: "Premium and billing",
    items: [
      "The Chrome extension is the public product today. Premium dashboard and billing workflows may remain limited, gated, or unavailable until they are ready.",
      "If paid plans become available, pricing, renewal, cancellation, and refund details will be shown before purchase.",
      "Payment details, when applicable, are handled by the payment processor rather than stored directly by Applendium.",
    ],
  },
  {
    title: "Data and privacy",
    items: [
      "Applendium's data practices are described in the Privacy Policy, including Gmail-derived data, retention, support, and deletion requests.",
      "Applendium does not sell Gmail data or personal information.",
      "Service providers may process data only as needed to operate authentication, hosting, database, support, analytics, or billing infrastructure.",
    ],
  },
  {
    title: "Service changes",
    items: [
      "Applendium may update, limit, suspend, or discontinue features as the product evolves.",
      "These terms may be updated from time to time. Material changes will be posted on this page with a revised effective date.",
      "Continued use of Applendium after updated terms are posted means you accept the updated terms.",
    ],
  },
  {
    title: "Disclaimers and liability",
    items: [
      "Applendium is provided as a productivity tool and does not guarantee job outcomes, interview outcomes, employer responses, or uninterrupted service.",
      "To the fullest extent permitted by law, Applendium is not liable for indirect, incidental, special, consequential, or punitive damages.",
      "Nothing in these terms limits rights that cannot be limited under applicable law.",
    ],
  },
];

export default function Terms() {
  usePageMetadata({
    title: "Applendium | Terms of Service",
    description:
      "Read the Applendium Terms of Service for the Chrome extension, Gmail read-only access, account use, classification limitations, support, and premium status.",
  });

  return (
    <PublicSiteLayout>
      <section className="legalHero">
        <p className="sectionEyebrow">Terms of Service</p>
        <h1>Terms for using Applendium</h1>
        <p>
          Effective date: April 11, 2026. These terms explain how you may use
          Applendium, what the Gmail-connected extension does, and what limits apply to
          automated classification and future premium features.
        </p>
      </section>

      <section className="legalSection">
        <div className="legalIntro">
          <p>
            By using Applendium, you agree to these terms and to the{" "}
            <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use
            the extension or related Applendium services.
          </p>
          <p>
            Applendium is currently centered on the Chrome extension. The extension helps
            users find and organize job-application-related emails from Gmail with
            read-only access.
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
          <h2>Support and deletion requests</h2>
          <p>
            For account support, email{" "}
            <a href="mailto:support@applendium.com">support@applendium.com</a>.
            For privacy, data access, or deletion requests, email{" "}
            <a href="mailto:privacy@applendium.com">privacy@applendium.com</a>.
          </p>
        </div>

        <div className="legalCard">
          <h2>Questions</h2>
          <p>
            If you have questions about these terms before using Applendium, contact{" "}
            <a href="mailto:support@applendium.com">support@applendium.com</a>.
          </p>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
