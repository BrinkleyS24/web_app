import React from "react";
import { Link, Navigate } from "react-router-dom";
import { Clock3 } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  premiumFeatureCards,
  premiumUpdatesHref,
  upgradeStatusCards,
} from "../lib/premiumLaunchContent.js";

const CHROME_WEB_STORE_URL = (import.meta.env.VITE_CHROME_WEB_STORE_URL || "").trim();

const Upgrade = () => {
  const { user, loading: authLoading, plan, planLoading } = useAuth();

  if (!authLoading && !planLoading && plan === "premium") {
    return <Navigate to="/dashboard" replace />;
  }

  const sessionLabel = authLoading
    ? "Checking session..."
    : user?.email || "Not signed in";

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGlow heroGlowOne" aria-hidden="true" />
        <div className="heroGlow heroGlowTwo" aria-hidden="true" />

        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              <Clock3 aria-hidden="true" />
              <span>Premium purchase flow: temporarily closed</span>
            </div>
            <h1 className="heroTitle">The premium dashboard is still in build.</h1>
            <p className="heroLead">
              Billing is intentionally disabled while the premium workspace is being
              finished. The extension and public support surface stay available, but
              nobody should be sent through checkout for an unfinished dashboard.
            </p>

            <div className="heroActions">
              <Link className="publicButton publicButtonSecondary" to="/support">
                Contact support
              </Link>
              <a className="publicButton publicButtonSecondary" href={premiumUpdatesHref}>
                Premium updates
              </a>
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
            </div>

            <div className="heroMetaGrid">
              <article className="launchMetricCard">
                <span className="statusLabel">Session</span>
                <strong className="launchMetricValue">{sessionLabel}</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Billing</span>
                <strong className="launchMetricValue">Closed for now</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Dashboard</span>
                <strong className="launchMetricValue">Coming soon</strong>
              </article>
            </div>
          </div>

          <div
            className="heroPanel glass-card launchPanel animate-fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <p className="heroPanelEyebrow">Current premium status</p>
            <div className="launchPanelList">
              {upgradeStatusCards.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="launchPanelItem">
                    <span className="launchPanelIcon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div>
                      <div className="launchPanelHeader">
                        <h2>{item.title}</h2>
                        <span className="launchStateTag launchStateTagSoon">Status</span>
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

      <section className="publicSection publicSectionAlt">
        <div className="sectionHeading">
          <p className="sectionEyebrow">What premium includes</p>
          <h2>The feature set stays visible, but access waits for the dashboard launch</h2>
          <p>
            This page now explains the premium intent without pretending the paid
            experience can be used today.
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
                    <p className="launchCardEyebrow">Coming soon</p>
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
            <p className="sectionEyebrow">Until premium opens</p>
            <h2>Use the extension, keep the messaging honest, and point users here for status.</h2>
            <p className="ctaNote">
              This route now works as a launch-status page instead of a checkout page, so
              signed-in users do not get sold an unfinished dashboard.
            </p>
          </div>

          <div className="ctaActions">
            <Link className="publicButton publicButtonSecondary" to="/">
              Back to home
            </Link>
            <Link className="publicButton publicButtonSecondary" to="/privacy">
              Privacy policy
            </Link>
            <Link className="publicButton publicButtonPrimary" to="/support">
              Support
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
};

export default Upgrade;
