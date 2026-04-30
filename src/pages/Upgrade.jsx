import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Chrome,
  Clock3,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AuthButton from "../components/AuthButton.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
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
  const { user, loading, plan, planLoading } = useAuth();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const isPremium = plan === "premium";

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

  const authReady = !loading && !planLoading;

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
