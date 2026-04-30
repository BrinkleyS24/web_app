import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3 } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import usePageMetadata from "../lib/usePageMetadata.js";

const MAX_STATUS_ATTEMPTS = 8;
const STATUS_POLL_MS = 1500;

export default function PaymentSuccess() {
  const { user, loading, plan, planLoading } = useAuth();
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
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              {attempt >= MAX_STATUS_ATTEMPTS ? <Clock3 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              <span>Payment complete</span>
            </div>
            <h1 className="heroTitle">Activating Premium Beta.</h1>
            <p className="heroLead">{statusMessage}</p>
            {statusError ? (
              <p className="publicHeaderError" role="alert">
                {statusError}
              </p>
            ) : null}
            <div className="heroActions">
              <Link className="publicButton publicButtonPrimary" to="/dashboard">
                Open dashboard
              </Link>
              <Link className="publicButton publicButtonSecondary" to="/account">
                Check account
              </Link>
              <Link className="publicButton publicButtonSecondary" to="/support">
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
