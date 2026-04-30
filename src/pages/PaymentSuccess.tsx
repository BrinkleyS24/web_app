import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Chrome, Clock3 } from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";

const MAX_STATUS_ATTEMPTS = 8;
const STATUS_POLL_MS = 1500;

export default function PaymentSuccess() {
  const { user, loading, plan, planLoading } = useAuth();
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  const [attempt, setAttempt] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Finalizing premium access...");
  const [statusError, setStatusError] = useState("");

  usePageMetadata({
    title: "Applendium | Payment Complete",
    description: "Applendium Premium Beta payment confirmation.",
  });

  useEffect(() => {
    if (loading || planLoading) return undefined;

    if (!user) {
      setStatusMessage("Sign in again to finish activating Premium Beta.");
      return undefined;
    }

    if (plan === "premium") {
      window.location.replace("/dashboard");
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    async function pollSubscription(nextAttempt: number) {
      setAttempt(nextAttempt);
      setStatusError("");

      try {
        const response = await apiFetch("/api/subscriptions/status", {
          method: "GET",
          timeoutMs: 30000,
        });
        const subscription = response?.subscription;
        const activePremium =
          subscription?.plan === "premium" &&
          (subscription?.status === "active" || subscription?.status === "trialing");

        if (cancelled) return;

        if (activePremium) {
          setStatusMessage("Premium Beta is active. Opening your dashboard...");
          window.setTimeout(() => window.location.replace("/dashboard"), 600);
          return;
        }
      } catch (error) {
        if (cancelled) return;
        setStatusError(error instanceof Error ? error.message : "Unable to verify payment yet.");
      }

      if (cancelled) return;

      if (nextAttempt >= MAX_STATUS_ATTEMPTS) {
        setStatusMessage("Payment was received, but premium access is still syncing.");
        return;
      }

      timeoutId = window.setTimeout(() => {
        void pollSubscription(nextAttempt + 1);
      }, STATUS_POLL_MS);
    }

    void pollSubscription(1);

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loading, plan, planLoading, user]);

  return (
    <div className="landingPage min-h-screen bg-[#fdfdfc] text-[#111111]">
      <header className="sticky top-0 z-50 w-full bg-[#fdfdfc]/85 backdrop-blur" data-testid="site-header">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
          <Link to="/" className="group flex items-center gap-2">
            <img src="/favicon.png" alt="Applendium" className="h-8 w-8 rounded-md bg-[#0B1220] p-0.5" />
            <span className="landingDisplay text-xl font-extrabold tracking-tight">applendium</span>
          </Link>
          <a
            href={chromeHref}
            target="_blank"
            rel="noreferrer"
            className="landingButtonDark inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#10B981]"
          >
            <Chrome className="h-4 w-4" />
            Install
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-32">
            <div className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
              {attempt >= MAX_STATUS_ATTEMPTS ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              Payment complete
            </div>
            <h1 className="landingDisplay mt-6 text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
              Activating Premium Beta.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">{statusMessage}</p>
            {statusError ? (
              <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {statusError}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="landingButtonDark inline-flex items-center justify-center rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white hover:bg-[#10B981]"
                to="/dashboard"
              >
                Open dashboard
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 font-bold text-[#111111] hover:border-[#111111]"
                to="/settings"
              >
                Open settings
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 font-bold text-[#111111] hover:border-[#111111]"
                to="/#support"
              >
                Contact support
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
