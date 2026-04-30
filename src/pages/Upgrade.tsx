import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import { apiFetch } from "../lib/api.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";
import {
  CHROME_STORE_CTA_LABEL,
  CHROME_WEB_STORE_URL,
} from "../lib/publicSiteConfig.js";

const Upgrade = () => {
  const { user, loading: authLoading, plan, planLoading, adminEmail } = useAuth();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  usePageMetadata({
    title: "Applendium | Premium Beta",
    description:
      "Start Applendium Premium Beta for Apply Gate decisions and a weekly search-health summary.",
  });

  if (!authLoading && !planLoading && user && adminEmail) {
    return <Navigate to="/admin/review" replace />;
  }

  if (!authLoading && !planLoading && user && plan === "premium") {
    return <Navigate to="/dashboard" replace />;
  }

  const sessionLabel = authLoading
    ? "Checking session..."
    : user?.email || "Not signed in";
  const checkoutDisabled = checkoutBusy || authLoading || planLoading || !user;

  async function startCheckout() {
    if (!user) {
      setCheckoutError("Sign in before starting Premium Beta.");
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError("");

    try {
      const response = await apiFetch("/api/subscriptions/create-checkout-session", {
        method: "POST",
        body: { plan: "premium" },
        timeoutMs: 30000,
      });

      if (!response?.url) {
        throw new Error("Checkout did not return a payment link.");
      }

      window.location.assign(response.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
      setCheckoutBusy(false);
    }
  }

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGlow heroGlowOne" aria-hidden="true" />
        <div className="heroGlow heroGlowTwo" aria-hidden="true" />

        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              <Clock3 aria-hidden="true" />
              <span>Premium Beta</span>
            </div>
            <h1 className="heroTitle">Apply smarter before you spend another hour applying.</h1>
            <p className="heroLead">
              Premium Beta starts with Apply Gate and a weekly search-health summary:
              paste a job, see whether to apply, tailor first, or skip, then review how
              your search is moving over the last week.
            </p>

            <div className="heroActions">
              {user ? (
                <button
                  type="button"
                  className="publicButton publicButtonPrimary"
                  onClick={startCheckout}
                  disabled={checkoutDisabled}
                >
                  {checkoutBusy ? "Opening checkout..." : "Start Premium Beta"}
                </button>
              ) : (
                <Link className="publicButton publicButtonPrimary" to="/app">
                  Sign in to start beta
                </Link>
              )}
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
                  {CHROME_STORE_CTA_LABEL}
                </a>
              ) : (
                <Link className="publicButton publicButtonPrimary" to="/support">
                  Contact support
                </Link>
              )}
            </div>
            {checkoutError ? (
              <p className="publicHeaderError" role="alert">
                {checkoutError}
              </p>
            ) : null}

            <div className="heroMetaGrid">
              <article className="launchMetricCard">
                <span className="statusLabel">Session</span>
                <strong className="launchMetricValue">{sessionLabel}</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Beta focus</span>
                <strong className="launchMetricValue">Apply Gate</strong>
              </article>
              <article className="launchMetricCard">
                <span className="statusLabel">Summary</span>
                <strong className="launchMetricValue">Weekly health</strong>
              </article>
            </div>
          </div>

          <div
            className="heroPanel glass-card launchPanel animate-fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <p className="heroPanelEyebrow">What beta includes now</p>
            <div className="launchPanelList">
              {[
                {
                  icon: ShieldCheck,
                  title: "Apply Gate",
                  body:
                    "Paste a role and get a direct apply, tailor-first, or skip decision with the main risks and proof gaps.",
                },
                {
                  icon: FileText,
                  title: "Weekly Search Summary",
                  body:
                    "Review the last 7 days of applications, callbacks, interviews, and response-rate signals in one place.",
                },
                {
                  icon: CheckCircle2,
                  title: "Beta dashboard access",
                  body:
                    "Premium also opens the dashboard workspace while newer action-queue and outcome features continue to mature.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="launchPanelItem">
                    <span className="launchPanelIcon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div>
                      <div className="launchPanelHeader">
                        <h2>{item.title}</h2>
                        <span className="launchStateTag launchStateTagSoon">Beta</span>
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
          <p className="sectionEyebrow">Premium Beta scope</p>
          <h2>Pay for the decisions that are ready, not a vague future dashboard.</h2>
          <p>
            The beta promise is intentionally narrow: better apply/skip decisions and a
            clear weekly view of search health. The broader advisor system will grow from
            there.
          </p>
        </div>

        <div className="featureGrid">
          {[
            {
              icon: ShieldCheck,
              title: "Apply Gate",
              body:
                "Use before applying to avoid weak-fit roles, identify fixable gaps, and decide whether the role deserves your time.",
            },
            {
              icon: FileText,
              title: "Weekly Search Summary",
              body:
                "See how many applications, callbacks, and interviews happened this week, plus the basic rates that show momentum.",
            },
            {
              icon: ArrowRight,
              title: "Growing beta workspace",
              body:
                "Daily actions, outcome memory, strategy alerts, and outreach drafts are part of the beta workspace and will keep improving.",
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="featureCard glass-card">
                <div className="featureCardHeader">
                  <span className="featureIcon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div>
                    <p className="launchCardEyebrow">Premium Beta</p>
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
            <p className="sectionEyebrow">Ready to try it</p>
            <h2>Start with the narrow beta and judge it on Apply Gate quality.</h2>
            <p className="ctaNote">
              Checkout shows the current beta price before purchase. Cancel from account
              settings if the beta is not useful for your search.
            </p>
          </div>

          <div className="ctaActions">
            {user ? (
              <button
                type="button"
                className="publicButton publicButtonPrimary"
                onClick={startCheckout}
                disabled={checkoutDisabled}
              >
                {checkoutBusy ? "Opening checkout..." : "Start Premium Beta"}
              </button>
            ) : (
              <Link className="publicButton publicButtonPrimary" to="/app">
                Sign in to start beta
              </Link>
            )}
            <Link className="publicButton publicButtonSecondary" to="/support">
              Ask a question
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
};

export default Upgrade;
