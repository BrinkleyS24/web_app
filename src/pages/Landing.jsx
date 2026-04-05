import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  availableNowItems,
  launchStatusItems,
  premiumFeatureCards,
  premiumUpdatesHref,
  rolloutSteps,
} from "../lib/premiumLaunchContent.js";

const CHROME_WEB_STORE_URL = (import.meta.env.VITE_CHROME_WEB_STORE_URL || "").trim();

export default function Landing() {
  const { user, loading, plan, adminEmail } = useAuth();

  const signedIn = Boolean(user);
  const signedInTarget = signedIn
    ? (adminEmail ? "/admin/debug" : plan === "premium" ? "/dashboard" : "/upgrade")
    : "/app";
  const premiumTarget = signedIn && plan === "premium" ? "/dashboard" : "/upgrade";
  const sessionLabel = loading
    ? "Checking session..."
    : signedIn
      ? "Signed in"
      : "Public visitor";
  const nextStepLabel = signedIn
    ? (plan === "premium" ? "Open premium dashboard" : "View premium launch status")
    : (CHROME_WEB_STORE_URL ? "Install the extension" : "Open companion app");

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGlow heroGlowOne" aria-hidden="true" />
        <div className="heroGlow heroGlowTwo" aria-hidden="true" />

        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              <Clock3 aria-hidden="true" />
              <span>Premium dashboard status: coming soon</span>
            </div>
            <h1 className="heroTitle">
              Applendium Premium is coming soon. The extension launches first.
            </h1>
            <p className="heroLead">
              Applendium.com now sets the expectation directly: the Gmail extension and
              public support pages are live, while premium dashboard workflows stay closed
              until the experience is ready to ship.
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
                <Link className="publicButton publicButtonPrimary" to={signedInTarget}>
                  {signedIn ? "Open your workspace" : "Open companion app"}
                </Link>
              )}

              <Link className="publicButton publicButtonSecondary" to={premiumTarget}>
                View premium status
              </Link>

              <a className="publicButton publicButtonSecondary" href={premiumUpdatesHref}>
                Request launch updates
              </a>
            </div>

            <div className="heroMetaGrid">
              <article className="launchMetricCard">
                <span className="statusLabel">Session</span>
                <strong className="launchMetricValue">{sessionLabel}</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Premium availability</span>
                <strong className="launchMetricValue">In active build</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Best next step</span>
                <Link className="launchMetricLink" to={signedInTarget}>
                  <span>{nextStepLabel}</span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>

          <div
            className="heroPanel glass-card launchPanel animate-fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <p className="heroPanelEyebrow">Release snapshot</p>
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
                          className={`launchStateTag ${item.state === "Coming soon" ? "launchStateTagSoon" : ""}`}
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
          <p className="sectionEyebrow">Release clarity</p>
          <h2>What users can use now, and what is deliberately still behind the curtain</h2>
          <p>
            The site now says the quiet part out loud: ship the extension and public
            trust pages now, and only open paid dashboard workflows when they are
            actually ready.
          </p>
        </div>

        <div className="launchColumns">
          <article className="checklistCard launchCard">
            <div className="launchCardHeader">
              <div>
                <p className="launchCardEyebrow">Available now</p>
                <h3>What ships with the extension rollout</h3>
              </div>
              <span className="launchStateTag">Live</span>
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
                <p className="launchCardEyebrow">Coming soon</p>
                <h3>What stays closed until premium is ready</h3>
              </div>
              <span className="launchStateTag launchStateTagSoon">In build</span>
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
                <strong>Advanced premium intelligence</strong>
                <p>Strategy layers, deeper review tools, and premium summaries open later as one coherent release.</p>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="publicSection publicSectionAlt">
        <div className="sectionHeading">
          <p className="sectionEyebrow">Premium roadmap</p>
          <h2>What premium will unlock when the dashboard opens</h2>
          <p>
            The premium layer is still the destination. It just is not being presented
            as live before the dashboard can support it properly.
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

      <section className="publicSection">
        <div className="sectionHeading">
          <p className="sectionEyebrow">Rollout plan</p>
          <h2>A cleaner staged launch for applendium.com</h2>
        </div>

        <div className="timelineGrid">
          {rolloutSteps.map((step) => (
            <article key={step.step} className="timelineCard">
              <div className="timelineCardTop">
                <span className="timelineStep">{step.step}</span>
                <span className={`launchStateTag ${step.phase === "Soon" ? "launchStateTagSoon" : ""}`}>
                  {step.phase}
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ctaSection">
        <div className="ctaCard">
          <div>
            <p className="sectionEyebrow">Need help?</p>
            <h2>Use the extension now, and we will announce premium when the dashboard is actually ready.</h2>
            <p className="ctaNote">
              If you want launch updates or need support during the staged rollout, use
              the links below instead of guessing what is live.
            </p>
          </div>

          <div className="ctaActions">
            <Link className="publicButton publicButtonSecondary" to="/support">
              Get support
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
              <Link className="publicButton publicButtonPrimary" to={signedInTarget}>
                {signedIn ? "Open your workspace" : "Open companion app"}
              </Link>
            )}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
