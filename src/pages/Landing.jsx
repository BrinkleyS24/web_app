import React from "react";
import { Link } from "react-router-dom";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import { useAuth } from "../lib/AuthContext.jsx";

const CHROME_WEB_STORE_URL = (import.meta.env.VITE_CHROME_WEB_STORE_URL || "").trim();

const featureCards = [
  {
    title: "Inbox to application history",
    body:
      "Applendium reads the job-search messages you already receive and groups them into a cleaner application timeline.",
  },
  {
    title: "Sync without spreadsheet drift",
    body:
      "Statuses, companies, and roles stay attached to the thread instead of getting lost across tabs, notes, and manual trackers.",
  },
  {
    title: "Review what changed",
    body:
      "Use the companion dashboard to inspect outcomes, fix uncertain matches, and keep your record usable over a long search.",
  },
];

const workflowSteps = [
  {
    title: "Install the extension",
    detail:
      "Connect Applendium to the Gmail account you actually use for applications. Nothing starts until you sign in and grant access.",
  },
  {
    title: "Sync and classify",
    detail:
      "Applendium pulls relevant emails, identifies the company and role when possible, and organizes the results into application states.",
  },
  {
    title: "Review and act",
    detail:
      "Open the companion app to review grouped applications, follow up on edge cases, and keep your search history readable.",
  },
];

const trustPoints = [
  "Built around user-authorized Gmail access",
  "Privacy, support, and companion routes published on the main domain",
  "Designed for extension-first usage instead of a disconnected SaaS shell",
];

export default function Landing() {
  const { user, loading, plan } = useAuth();

  const signedIn = Boolean(user);
  const signedInTarget = signedIn
    ? (plan === "premium" ? "/dashboard" : "/upgrade")
    : "/app";

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGlow heroGlowOne" aria-hidden="true" />
        <div className="heroGlow heroGlowTwo" aria-hidden="true" />

        <div className="heroGrid">
          <div className="heroCopy">
            <p className="sectionEyebrow">Chrome extension for Gmail application tracking</p>
            <h1 className="heroTitle">
              Turn job-search email into a structured application record.
            </h1>
            <p className="heroLead">
              Applendium helps you track what happened, which company replied, and where each application stands without rebuilding your search history by hand.
            </p>

            <div className="heroActions">
              {CHROME_WEB_STORE_URL ? (
                <a
                  className="publicButton publicButtonPrimary"
                  href={CHROME_WEB_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Install the extension
                </a>
              ) : (
                <Link className="publicButton publicButtonPrimary" to="/app">
                  Open companion app
                </Link>
              )}

              <Link className="publicButton publicButtonSecondary" to="/privacy">
                Read privacy policy
              </Link>
            </div>

            <div className="statusStrip">
              <div className="statusCard">
                <span className="statusLabel">Current state</span>
                <strong>{loading ? "Checking session..." : signedIn ? "Signed in via extension" : "Public site live"}</strong>
              </div>
              <div className="statusCard">
                <span className="statusLabel">Best next step</span>
                <Link to={signedInTarget}>{signedIn ? "Open your app" : "Connect the extension"}</Link>
              </div>
            </div>
          </div>

          <div className="heroPanel glass-card">
            <p className="heroPanelEyebrow">Why people use it</p>
            <div className="heroPanelList">
              <article className="heroPanelItem">
                <span>01</span>
                <div>
                  <h2>Reduce inbox chaos</h2>
                  <p>
                    Keep interviews, rejections, offers, and follow-up threads visible as one search story instead of disconnected email fragments.
                  </p>
                </div>
              </article>
              <article className="heroPanelItem">
                <span>02</span>
                <div>
                  <h2>Stay grounded in the source</h2>
                  <p>
                    Application tracking starts from the email thread itself, which keeps the record closer to what actually happened.
                  </p>
                </div>
              </article>
              <article className="heroPanelItem">
                <span>03</span>
                <div>
                  <h2>Review edge cases deliberately</h2>
                  <p>
                    The companion app gives you a place to inspect questionable links, corrections, and lifecycle details before they become long-term data drift.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="publicSection">
        <div className="sectionHeading">
          <p className="sectionEyebrow">Core product</p>
          <h2>Built around a realistic application workflow</h2>
          <p>
            The product is extension-first, with the website acting as the public front door, legal surface, and companion workspace for deeper review.
          </p>
        </div>

        <div className="featureGrid">
          {featureCards.map((card) => (
            <article key={card.title} className="featureCard glass-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection publicSectionAlt">
        <div className="sectionHeading">
          <p className="sectionEyebrow">How it works</p>
          <h2>A short path from Gmail to reviewable application history</h2>
        </div>

        <div className="workflowGrid">
          {workflowSteps.map((step) => (
            <article key={step.title} className="workflowCard">
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection">
        <div className="trustPanel">
          <div>
            <p className="sectionEyebrow">Trust and operations</p>
            <h2>Public pages that match how the product actually works</h2>
            <p>
              This site exists to give users and reviewers a clear public surface: what Applendium does, how to get support, and how Gmail-derived data is handled.
            </p>
          </div>

          <ul className="trustList">
            {trustPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ctaSection">
        <div className="ctaCard">
          <div>
            <p className="sectionEyebrow">Next step</p>
            <h2>Start with the extension, then use the companion app when you need deeper review.</h2>
          </div>

          <div className="ctaActions">
            <Link className="publicButton publicButtonSecondary" to="/support">
              Get support
            </Link>
            <Link className="publicButton publicButtonPrimary" to={signedInTarget}>
              {signedIn ? "Open your workspace" : "Open companion app"}
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
