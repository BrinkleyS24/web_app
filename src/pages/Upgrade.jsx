import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Chrome, RefreshCw } from "lucide-react";
import AuthButton from "../components/AuthButton.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { getApiBaseUrl } from "../lib/api.js";
import { startPremiumCheckout, fetchPremiumPrice, formatPremiumPrice } from "../lib/premiumCheckout.js";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";

const FREE_FEATURES = [
  "Pipeline by stage, live from Gmail",
  "Search companies & roles",
  "Thread-linked statuses",
  "Read-only scope, always",
];

const PREMIUM_FEATURES = [
  "Everything in Free",
  "Apply Gate pre-apply briefs",
  "Daily Action Queue with reasons",
  "Outcome Memory & Strategy Alerts",
  "Weekly search-health summary",
];

function BrandHeader() {
  return (
    <header className="border-b border-[#E9EAE5]" data-testid="site-header">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#0B1220]">
            <img src="/logo-transparent.png" alt="Applendium" className="block h-[22px] w-[22px]" />
          </div>
          <span className="landingDisplay text-lg font-bold tracking-[-0.02em]">applendium</span>
        </Link>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="landingButtonDark inline-flex items-center gap-2 rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0E8C63]"
        >
          <Chrome className="h-4 w-4" />
          Add to Chrome
        </a>
      </div>
    </header>
  );
}

export default function Upgrade() {
  const { user, loading, plan, planLoading, planError, accountStatus, logout } = useAuth();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPremiumPrice().then((price) => {
      if (active) setPremiumPrice(price);
    });
    return () => {
      active = false;
    };
  }, []);
  const formattedPrice = formatPremiumPrice(premiumPrice);
  const isPremium = plan === "premium";
  const authReady = !loading && !planLoading;
  const isLocalDevWorkspace =
    import.meta.env.DEV
    && typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const showLocalPremiumDiagnostic = isLocalDevWorkspace && authReady && user && !isPremium;
  const signedInEmail = accountStatus?.authenticatedEmail || user?.email || "unknown";
  const apiBaseUrl = getApiBaseUrl() || "(not configured)";
  const signedInEmailNormalized = String(signedInEmail || "").trim().toLowerCase();
  const permanentPremiumEmail = "brinkleystacey12@gmail.com";
  const localPremiumAccountMismatch =
    showLocalPremiumDiagnostic
    && signedInEmailNormalized !== permanentPremiumEmail;
  const shouldBlockLocalCheckout =
    showLocalPremiumDiagnostic
    && (
      Boolean(planError)
      || accountStatus?.planSource === "verification_failed"
      || accountStatus?.permanentPremium
      || signedInEmailNormalized === permanentPremiumEmail
    );
  const localNoticeTitle = localPremiumAccountMismatch
    ? "This account does not have Premium access."
    : "Premium access could not be confirmed.";
  const localNoticeBody = localPremiumAccountMismatch
    ? `You are signed in as ${signedInEmail}. Sign out and choose ${permanentPremiumEmail} to use the local Premium workspace.`
    : "The app could not confirm Premium against the local backend. Retry the check after the backend is running with the latest changes.";

  usePageMetadata({
    title: "Applendium | Premium Beta",
    description: "Applendium Premium Beta unlocks Apply Gate and the weekly search-health summary.",
  });

  async function handleCheckout() {
    setCheckoutError("");
    setCheckoutBusy(true);
    try {
      await startPremiumCheckout();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
      setCheckoutBusy(false);
    }
  }

  async function handleLocalSignOut() {
    setSignOutBusy(true);
    setCheckoutError("");
    try {
      await logout();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setSignOutBusy(false);
    }
  }

  function handleRetryPlanCheck() {
    window.location.reload();
  }

  const premiumCtaClass =
    "landingButtonDark inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0E8C63] px-6 py-[13px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#10B981] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="landingPage min-h-screen bg-[#FAFAF8] text-[#0B1220]">
      <BrandHeader />

      <main>
        <section className="mx-auto max-w-[980px] px-6 pb-24 pt-20 md:px-8">
          <div className="text-center">
            <p className="landingMono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0E8C63]">
              Premium beta
            </p>
            <h1 className="landingDisplay mx-auto mt-5 max-w-[20ch] text-[38px] font-bold leading-[1.04] tracking-[-0.035em] md:text-[52px]">
              One plan. Every judgment feature.
            </h1>
            <p className="mx-auto mt-5 max-w-[50ch] text-[17px] leading-[1.65] text-[#5C6470]">
              The tracker stays free forever. Premium adds the decision layer on top of your inbox
              &mdash; in beta now, at a beta price.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-[18px] border border-[#E9EAE5] bg-white p-8">
              <h2 className="text-lg font-bold">Free</h2>
              <p className="mt-3.5 text-[38px] font-bold tracking-[-0.03em]">$0</p>
              <p className="mt-1 text-[13px] text-[#9AA0A6]">forever</p>
              <div className="mt-6 grid gap-3 border-t border-[#EEF0EC] pt-[22px]">
                {FREE_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E8C63]" />
                    <span className="text-sm text-[#3D4450]">{feature}</span>
                  </div>
                ))}
              </div>
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex w-full items-center justify-center rounded-[10px] border border-[#D8DAD3] bg-white px-6 py-[13px] text-[14.5px] font-semibold text-[#0B1220] transition-colors hover:border-[#0B1220]"
              >
                Add to Chrome
              </a>
            </div>

            <div className="relative overflow-hidden rounded-[18px] bg-[#0B1220] p-8">
              <div className="landingMono absolute right-0 top-0 rounded-bl-[10px] bg-[#0E8C63] px-3.5 py-1.5 text-[9px] font-bold tracking-[0.14em] text-white">
                BETA
              </div>
              <h2 className="text-lg font-bold text-white">Premium</h2>
              {formattedPrice ? (
                <p className="mt-3.5 text-[38px] font-bold tracking-[-0.03em] text-white">
                  {formattedPrice.amount}
                  {formattedPrice.suffix ? (
                    <span className="ml-1 text-base font-semibold text-[#98A1B3]">{formattedPrice.suffix}</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-3.5 text-[28px] font-bold tracking-[-0.03em] text-white">
                  Beta price
                  <span className="ml-2 text-base font-semibold text-[#98A1B3]">at checkout</span>
                </p>
              )}
              <p className="mt-1 text-[13px] text-[#98A1B3]">
                cancel anytime &middot; price locked for beta users
              </p>
              <div className="mt-6 grid gap-3 border-t border-[#1C2A42] pt-[22px]">
                {PREMIUM_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2FBE8F]" />
                    <span className="text-sm text-[#C9D0DC]">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                {!authReady ? (
                  <button type="button" className={premiumCtaClass} disabled>
                    Checking account...
                  </button>
                ) : isPremium ? (
                  <Link to="/dashboard" className={premiumCtaClass}>
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : user && shouldBlockLocalCheckout ? (
                  <button type="button" className={premiumCtaClass} disabled>
                    Premium access unavailable
                  </button>
                ) : user ? (
                  <button
                    type="button"
                    className={premiumCtaClass}
                    onClick={handleCheckout}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy ? "Opening checkout..." : "Start Premium beta"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="rounded-[10px] border border-[#1C2A42] bg-[#0E1726] p-4">
                    <p className="mb-3 text-sm font-medium text-[#C9D0DC]">
                      Sign in first so checkout can attach Premium to your account.
                    </p>
                    <AuthButton />
                  </div>
                )}
              </div>
            </div>
          </div>

          {checkoutError ? (
            <p
              className="mt-5 rounded-[10px] border border-[#F3C9C5] bg-[#FBEAE8] px-4 py-3 text-sm font-medium text-[#B3261E]"
              role="alert"
            >
              {checkoutError}
            </p>
          ) : null}

          {showLocalPremiumDiagnostic ? (
            <div
              className="mt-5 rounded-[14px] border border-[#E9EAE5] bg-white px-4 py-4 text-sm text-[#3D4450]"
              role="status"
            >
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBF3E4] text-[#B45309]">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0B1220]">{localNoticeTitle}</p>
                  <p className="mt-1 leading-6 text-[#5C6470]">{localNoticeBody}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D8DAD3] bg-white px-3 py-2 text-xs font-bold text-[#0B1220] transition-colors hover:border-[#0B1220] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleRetryPlanCheck}
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Retry check
                    </button>
                    <button
                      type="button"
                      className="landingButtonDark inline-flex items-center justify-center rounded-lg bg-[#0B1220] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0E8C63] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleLocalSignOut}
                      disabled={signOutBusy}
                    >
                      {signOutBusy ? "Signing out..." : "Sign out"}
                    </button>
                  </div>

                  <details className="mt-4 rounded-lg border border-[#E9EAE5] bg-[#FCFCFB] px-3 py-2 text-xs text-[#5C6470]">
                    <summary className="cursor-pointer font-bold text-[#3D4450]">
                      Developer details
                    </summary>
                    <dl className="mt-2 grid gap-1 sm:grid-cols-[140px_1fr]">
                      <dt className="font-semibold">Signed in as</dt>
                      <dd className="break-all">{signedInEmail}</dd>
                      <dt className="font-semibold">API base</dt>
                      <dd className="break-all">{apiBaseUrl}</dd>
                      <dt className="font-semibold">Backend plan</dt>
                      <dd>{plan || "unknown"}</dd>
                      <dt className="font-semibold">Plan source</dt>
                      <dd>{accountStatus?.planSource || "unknown"}</dd>
                      <dt className="font-semibold">Permanent premium</dt>
                      <dd>{accountStatus?.permanentPremium ? "yes" : "no"}</dd>
                      {accountStatus?.requestId ? (
                        <>
                          <dt className="font-semibold">Request ID</dt>
                          <dd className="break-all">{accountStatus.requestId}</dd>
                        </>
                      ) : null}
                      {planError ? (
                        <>
                          <dt className="font-semibold">Verification error</dt>
                          <dd className="break-all">{planError}</dd>
                        </>
                      ) : null}
                    </dl>
                  </details>
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-8 text-center text-[13px] text-[#9AA0A6]">
            Questions?{" "}
            <a
              href="mailto:support@applendium.com?subject=Applendium%20Premium"
              className="font-semibold text-[#0B1220] transition-colors hover:text-[#0E8C63]"
            >
              support@applendium.com
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
