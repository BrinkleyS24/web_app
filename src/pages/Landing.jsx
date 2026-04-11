import React from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import {
  availableNowItems,
  getLaunchStatusItems,
  getRolloutSteps,
  heroFactItems,
  premiumFeatureCards,
  premiumUpdatesHref,
} from "../lib/premiumLaunchContent.js";
import {
  CHROME_EXTENSION_IS_LIVE,
  CHROME_STORE_CTA_LABEL,
  CHROME_STORE_STATUS_LABEL,
  CHROME_STORE_STATUS_SENTENCE,
  CHROME_WEB_STORE_URL,
} from "../lib/publicSiteConfig.js";

export default function Landing() {
  usePageMetadata({
    title: "Applendium | Gmail Job Tracker for Chrome",
    description:
      "Install Applendium from the Chrome Web Store to track job-application emails from Gmail with read-only access.",
  });

  const heroTitle = CHROME_EXTENSION_IS_LIVE
    ? "Track job applications from Gmail in one Chrome extension."
    : "A Gmail job tracker for Chrome, with the first release in review.";
  const heroLead = CHROME_EXTENSION_IS_LIVE
    ? "Applendium reads job-application emails with Gmail read-only access, groups them by stage inside the popup, and keeps the search record usable without a manual spreadsheet."
    : "The Chrome Web Store listing is in review. The first public release is the Chrome extension: Gmail read-only access, popup-based stage tracking, search, refresh, and application-history review without a manual spreadsheet.";
  const liveSectionTitle = CHROME_EXTENSION_IS_LIVE
    ? "The extension is the product today, and the site supports the install."
    : "The first release is the extension, and the site should set expectations clearly.";
  const liveCardTitle = CHROME_EXTENSION_IS_LIVE
    ? "What users get in the live extension"
    : "What ships in the first release";
  const ctaTitle = CHROME_EXTENSION_IS_LIVE
    ? "Install the extension now. Premium can wait until the dashboard is ready."
    : "Follow the Chrome Store listing now. Premium stays closed until the dashboard is ready.";
  const launchStatusItems = getLaunchStatusItems(CHROME_EXTENSION_IS_LIVE);
  const rolloutSteps = getRolloutSteps(CHROME_EXTENSION_IS_LIVE);
  const howItWorksTitle = CHROME_EXTENSION_IS_LIVE
    ? "Three steps from install to a cleaner job-search record"
    : "What happens once the first release is approved";
  const howItWorksLead = CHROME_EXTENSION_IS_LIVE
    ? "The product story should stay simple: install the extension, connect Gmail with read-only access, and review the pipeline from the popup."
    : "The product story should stay simple: watch the listing, install after approval, then use the popup to track applications from Gmail with read-only access.";

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGlow heroGlowOne" aria-hidden="true" />
        <div className="heroGlow heroGlowTwo" aria-hidden="true" />

        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              <Clock3 aria-hidden="true" />
              <span>{CHROME_STORE_STATUS_LABEL}</span>
            </div>
            <h1 className="heroTitle">{heroTitle}</h1>
            <p className="heroLead">{heroLead}</p>

            <div className="heroActions">
              {CHROME_WEB_STORE_URL ? (
                <a
                  className="publicButton publicButtonPrimary"
                  href={CHROME_WEB_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {CHROME_STORE_CTA_LABEL}
                </a>
              ) : (
                <a className="publicButton publicButtonPrimary" href={premiumUpdatesHref}>
                  Get launch updates
                </a>
              )}

              <a className="publicButton publicButtonSecondary" href="#how-it-works">
                See how it works
              </a>

              <Link className="publicButton publicButtonSecondary" to="/support">
                Get support
              </Link>
            </div>

            <div className="heroMetaGrid">
              {heroFactItems.map((item) => (
                <article key={item.label} className="launchMetricCard">
                  <span className="statusLabel">{item.label}</span>
                  <strong className="launchMetricValue">{item.value}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div
            className="heroPanel glass-card launchPanel animate-fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <p className="heroPanelEyebrow">What ships first</p>
            <div className="launchPanelList">
              {launchStatusItems.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="launchPanelItem">
                    <span className="launchPanelIcon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div>
                      <div className="launchPanelHeader">
                        <h2>{item.title}</h2>
                        <span
                          className={`launchStateTag ${item.state === "Coming soon" || item.state === "Closed for now" ? "launchStateTagSoon" : ""}`}
                        >
                          {item.state}
                        </span>
                      </div>
                      <p>{item.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="publicSection">
        <div className="sectionHeading">
          <p className="sectionEyebrow">What is available</p>
          <h2>{liveSectionTitle}</h2>
          <p>
            {CHROME_STORE_STATUS_SENTENCE} Applendium.com explains the read-only Gmail
            scope, what the popup is designed to do, and what is intentionally not
            public yet.
          </p>
        </div>

        <div className="launchColumns">
          <article className="checklistCard launchCard">
            <div className="launchCardHeader">
              <div>
                <p className="launchCardEyebrow">Extension-first</p>
                <h3>{liveCardTitle}</h3>
              </div>
              <span className="launchStateTag">Primary focus</span>
            </div>
            <ul className="launchCardList">
              {availableNowItems.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="checklistCard launchCard launchCardContrast">
            <div className="launchCardHeader">
              <div>
                <p className="launchCardEyebrow">Not public yet</p>
                <h3>What stays gated until premium is ready</h3>
              </div>
              <span className="launchStateTag launchStateTagSoon">Closed</span>
            </div>
            <ul className="launchCardList">
              <li>
                <strong>Paid dashboard access</strong>
                <p>Premium workspace routes stay gated until the review flow is release-ready.</p>
              </li>
              <li>
                <strong>Checkout and billing</strong>
                <p>Purchase flows stay disabled so users are not sold access to unfinished product surface.</p>
              </li>
              <li>
                <strong>Public web workspace access</strong>
                <p>The broader web workspace is not part of the public launch yet, so the site should not imply it is open today.</p>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="publicSection">
        <div className="sectionHeading">
          <p className="sectionEyebrow">How it works</p>
          <h2>{howItWorksTitle}</h2>
          <p>{howItWorksLead}</p>
        </div>

        <div className="timelineGrid">
          {rolloutSteps.map((step) => (
            <article key={step.step} className="timelineCard">
              <div className="timelineCardTop">
                <span className="timelineStep">{step.step}</span>
                <span className="launchStateTag">{step.phase}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection publicSectionAlt">
        <div className="sectionHeading">
          <p className="sectionEyebrow">Premium roadmap</p>
          <h2>Premium is a later layer, not the first thing users need to understand</h2>
          <p>
            The extension and public trust surface stand on their own. Premium stays
            below the fold as future depth, not as the headline for a web app that is not
            publicly open yet.
          </p>
        </div>

        <div className="featureGrid">
          {premiumFeatureCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="featureCard glass-card">
                <div className="featureCardHeader">
                  <span className="featureIcon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div>
                    <p className="launchCardEyebrow">Premium feature</p>
                    <h3>{card.title}</h3>
                  </div>
                </div>
                <p>{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ctaSection">
        <div className="ctaCard">
          <div>
            <p className="sectionEyebrow">
              {CHROME_EXTENSION_IS_LIVE ? "Ready to install?" : "Ready to follow the launch?"}
            </p>
            <h2>{ctaTitle}</h2>
            <p className="ctaNote">
              {CHROME_STORE_STATUS_SENTENCE} Support, privacy, and terms pages stay live
              here, and premium updates stay available without overselling unfinished
              dashboard workflows or a web workspace that is not public yet.
            </p>
          </div>

          <div className="ctaActions">
            <Link className="publicButton publicButtonSecondary" to="/support">
              Get support
            </Link>
            <Link className="publicButton publicButtonSecondary" to="/upgrade">
              Premium roadmap
            </Link>
            <a className="publicButton publicButtonSecondary" href={premiumUpdatesHref}>
              {CHROME_EXTENSION_IS_LIVE ? "Premium updates" : "Launch updates"}
            </a>
            {CHROME_WEB_STORE_URL ? (
              <a
                className="publicButton publicButtonPrimary"
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noreferrer"
              >
                {CHROME_STORE_CTA_LABEL}
              </a>
            ) : (
              <a className="publicButton publicButtonPrimary" href={premiumUpdatesHref}>
                Get launch updates
              </a>
            )}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
