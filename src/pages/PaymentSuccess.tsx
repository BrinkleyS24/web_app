import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { PublicFooter, PublicHeader } from "../components/landing/PublicShell.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import { trackFunnel } from "../lib/funnel.js";

const MAX_STATUS_ATTEMPTS = 8;
const STATUS_POLL_MS = 1500;

export default function PaymentSuccess() {
  useEffect(() => {
    trackFunnel("checkout_success");
  }, []);
  const { user, loading, plan, planLoading } = useAuth();
  const [statusMessage, setStatusMessage] = useState("Checking your Premium access...");
  const [statusError, setStatusError] = useState("");
  const ownerId = user?.uid ?? null;

  usePageMetadata({
    title: "Applendium™ | Confirming Premium Access",
    description: "Check your current Applendium™ Premium access.",
  });

  useEffect(() => {
    setStatusMessage("Checking your Premium access...");
    setStatusError("");
    if (loading || planLoading) return undefined;

    if (!ownerId) {
      setStatusMessage("Sign in again to check your Premium access.");
      return undefined;
    }

    if (plan === "premium") {
      window.location.replace("/dashboard");
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const controller = new AbortController();

    async function pollSubscription(nextAttempt: number) {
      setStatusError("");

      try {
        const response = await apiFetch("/api/subscriptions/status", {
          method: "GET",
          timeoutMs: 30000,
          signal: controller.signal,
        });
        const subscription = response?.subscription;
        const activePremium =
          response?.success === true && subscription?.plan === "premium" &&
          (subscription?.status === "active" || subscription?.status === "trialing");

        if (cancelled) return;

        if (activePremium) {
          setStatusMessage("Premium is active. Opening your dashboard...");
          timeoutId = window.setTimeout(() => {
            if (!cancelled) window.location.replace("/dashboard");
          }, 600);
          return;
        }
      } catch (error) {
        if (cancelled) return;
        setStatusError(error instanceof Error ? error.message : "Unable to verify Premium access yet.");
      }

      if (cancelled) return;

      if (nextAttempt >= MAX_STATUS_ATTEMPTS) {
        setStatusMessage("We couldn't confirm Premium access yet. Open Settings to check your billing status, or contact support if you completed checkout.");
        return;
      }

      timeoutId = window.setTimeout(() => {
        void pollSubscription(nextAttempt + 1);
      }, STATUS_POLL_MS);
    }

    void pollSubscription(1);

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loading, plan, planLoading, ownerId]);

  return (
    <div className="landingPage min-h-screen bg-[#FAFAF8] text-[#111111]">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-32">
            <div className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#0A7A55]">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Confirming access
            </div>
            <h1 className="landingDisplay mt-6 text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
              Checking Premium.
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
      <PublicFooter />
    </div>
  );
}
