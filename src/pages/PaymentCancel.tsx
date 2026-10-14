import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/landing/PublicShell.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import { trackFunnel } from "../lib/funnel.js";

export default function PaymentCancel() {
  useEffect(() => {
    trackFunnel("checkout_cancel");
  }, []);

  usePageMetadata({
    title: "Applendium™ | Checkout Canceled",
    description: "Applendium™ Premium checkout was canceled.",
  });

  return (
    <div className="landingPage min-h-screen bg-[#FAFAF8] text-[#111111]">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-32">
            <div className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#0A7A55]">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Checkout canceled
            </div>
            <h1 className="landingDisplay mt-6 text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
              No payment was completed.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">
              You can review Premium whenever you are ready. Your free
              tracker keeps working as before.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="landingButtonDark inline-flex items-center justify-center rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white hover:bg-[#10B981]"
                to="/upgrade?source=payment_cancel"
              >
                Return to Premium
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 font-bold text-[#111111] hover:border-[#111111]"
                to="/"
              >
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
