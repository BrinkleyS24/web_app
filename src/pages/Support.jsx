import React from "react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";

const helpCards = [
  {
    title: "Installation and sign-in",
    body:
      "Install the Chrome extension, sign in from the popup, then open the companion app if you need a larger workspace for review.",
  },
  {
    title: "Sync and classification issues",
    body:
      "If emails look incomplete or misgrouped, include the company, role, approximate sync time, and any screenshots when you contact support.",
  },
  {
    title: "Billing and access",
    body:
      "Questions about premium access, plan changes, or account state should be sent from the same email tied to your Applendium account.",
  },
];

const faqItems = [
  {
    title: "The extension is installed, but the web app says I am not signed in.",
    body:
      "Open the extension popup first and confirm you are signed in there. The companion app relies on the extension bridge and shared auth state rather than a separate web-only login.",
  },
  {
    title: "A company or role was linked incorrectly.",
    body:
      "Use the correction features in the product when available, then email support if the issue persists or the wrong grouping keeps returning after a fresh sync.",
  },
  {
    title: "My sync looks stuck or incomplete.",
    body:
      "Wait a minute for the current sync to finish, then refresh. If it still fails, send support the time it happened, the email address on the account, and any console or screenshot evidence you have.",
  },
  {
    title: "How do I request data deletion or a privacy review?",
    body:
      "Email privacy@applendium.com from the address associated with your account and describe the request clearly. General help requests should go to support@applendium.com.",
  },
];

export default function Support() {
  return (
    <PublicSiteLayout>
      <section className="legalHero">
        <p className="sectionEyebrow">Support</p>
        <h1>Help for installation, sync issues, billing, and privacy requests</h1>
        <p>
          Applendium support is handled by email right now. The fastest path is to send a concise report with your account email, what you expected to happen, and what actually happened.
        </p>
      </section>

      <section className="publicSection">
        <div className="featureGrid">
          {helpCards.map((card) => (
            <article key={card.title} className="featureCard glass-card">
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection publicSectionAlt">
        <div className="supportContactGrid">
          <article className="supportContactCard">
            <p className="sectionEyebrow">General support</p>
            <h2>support@applendium.com</h2>
            <p>
              Use this for extension problems, sync issues, billing questions, or account troubleshooting.
            </p>
            <a className="publicButton publicButtonPrimary" href="mailto:support@applendium.com?subject=Applendium%20Support">
              Email support
            </a>
          </article>

          <article className="supportContactCard">
            <p className="sectionEyebrow">Privacy and data requests</p>
            <h2>privacy@applendium.com</h2>
            <p>
              Use this for data deletion requests, Gmail-access questions, or privacy-specific concerns.
            </p>
            <a className="publicButton publicButtonSecondary" href="mailto:privacy@applendium.com?subject=Applendium%20Privacy%20Request">
              Contact privacy
            </a>
          </article>
        </div>
      </section>

      <section className="publicSection">
        <div className="sectionHeading">
          <p className="sectionEyebrow">Before you email</p>
          <h2>Include enough context to make the issue reproducible</h2>
        </div>

        <div className="checklistCard">
          <ul>
            <li>The email address tied to your Applendium account</li>
            <li>Your Chrome version and extension version if available</li>
            <li>The approximate time the issue happened</li>
            <li>A screenshot or exact error message when possible</li>
            <li>The company name, role, or application affected by the problem</li>
          </ul>
        </div>
      </section>

      <section className="publicSection publicSectionAlt">
        <div className="sectionHeading">
          <p className="sectionEyebrow">FAQ</p>
          <h2>Common questions</h2>
        </div>

        <div className="faqList">
          {faqItems.map((item) => (
            <article key={item.title} className="faqCard">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteLayout>
  );
}
