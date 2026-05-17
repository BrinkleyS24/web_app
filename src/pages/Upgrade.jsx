import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Chrome,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AuthButton from "../components/AuthButton.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { getApiBaseUrl } from "../lib/api.js";
import { startPremiumCheckout } from "../lib/premiumCheckout.js";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";

const BETA_FEATURES = [
  {
    title: "Apply Gate",
    body:
      "Run one pre-apply decision brief before you spend time on a role: apply, tailor first, or skip.",
    icon: ShieldCheck,
  },
  {
    title: "Weekly Search Summary",
    body:
      "Review the week in one place: recent momentum, stale threads, and where attention should go next.",
    icon: FileText,
  },
  {
    title: "Beta workspace access",
    body:
      "Use the premium dashboard while Daily Actions, Outcome Memory, and Strategy Alerts keep maturing.",
    icon: Sparkles,
  },
];

function BrandHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#fdfdfc]/85 backdrop-blur" data-testid="site-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
        <Link to="/" className="group flex items-center gap-2">
          <img src="/favicon.png" alt="Applendium" className="h-8 w-8 rounded-md bg-[#0B1220] p-0.5" />
          <span className="landingDisplay text-xl font-extrabold tracking-tight">applendium</span>
        </Link>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="landingButtonDark inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#10B981]"
        >
          <Chrome className="h-4 w-4" />
          Install
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

  return (
    <div className="landingPage min-h-screen bg-[#fdfdfc] text-[#111111]">
      <BrandHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <div className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Premium Beta
              </div>

              <h1 className="landingDisplay mt-6 text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
                Better apply decisions before you lose another hour.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">
                Premium Beta starts with Apply Gate and the weekly search-health summary.
                The broader advisor workspace is included as beta access while it matures.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {!authReady ? (
                  <button
                    type="button"
                    className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white"
                    disabled
                  >
                    Checking account...
                  </button>
                ) : isPremium ? (
                  <Link
                    to="/dashboard"
                    className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white hover:bg-[#10B981]"
                  >
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : user && shouldBlockLocalCheckout ? (
                  <button
                    type="button"
                    className="landingButtonDark inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white opacity-70"
                    disabled
                  >
                    Premium access unavailable
                  </button>
                ) : user ? (
                  <button
                    type="button"
                    className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white hover:bg-[#10B981] disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={handleCheckout}
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy ? "Opening checkout..." : "Start Premium Beta"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="rounded-md border border-gray-200 bg-white p-4">
                    <p className="mb-3 text-sm font-medium text-gray-700">
                      Sign in first so checkout can attach Premium to your account.
                    </p>
                    <AuthButton />
                  </div>
                )}

                <Link
                  to="/#premium"
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 font-bold text-[#111111] hover:border-[#111111]"
                >
                  Review beta scope
                </Link>
              </div>

              {checkoutError ? (
                <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                  {checkoutError}
                </p>
              ) : null}

              {showLocalPremiumDiagnostic ? (
                <div className="mt-5 max-w-2xl rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm text-gray-700 shadow-sm" role="status">
                  <div className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C]">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#111111]">{localNoticeTitle}</p>
                      <p className="mt-1 leading-6 text-gray-600">{localNoticeBody}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#111111] transition hover:border-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleRetryPlanCheck}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Retry check
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md bg-[#111111] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#10B981] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleLocalSignOut}
                          disabled={signOutBusy}
                        >
                          {signOutBusy ? "Signing out..." : "Sign out"}
                        </button>
                      </div>

                      <details className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <summary className="cursor-pointer font-bold text-gray-700">Developer details</summary>
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
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_24px_56px_-34px_rgba(17,17,17,0.35)]">
                <p className="landingMono text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
                  What checkout unlocks
                </p>

                <div className="mt-5 grid gap-4">
                  {BETA_FEATURES.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex gap-3 rounded-2xl border border-gray-200 bg-[#FCFCFB] p-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-[#0B1220]">{title}</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-500">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-[#BDE7D3] bg-[#F4FBF7] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0E8C63]" />
                    <p className="text-sm leading-6 text-gray-600">
                      The Chrome extension stays free. Premium is for the web workspace
                      that helps decide what to do next.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
