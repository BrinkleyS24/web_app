import React from "react";
import { Link } from "react-router-dom";
import { Clock3, Chrome } from "lucide-react";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";

export default function PaymentCancel() {
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;

  usePageMetadata({
    title: "Applendium | Checkout Canceled",
    description: "Applendium Premium Beta checkout was canceled.",
  });

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
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Checkout canceled
            </div>
            <h1 className="landingDisplay mt-6 text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
              No payment was completed.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">
              You can review Premium Beta whenever you are ready. The beta starts with
              Apply Gate and a weekly search-health summary.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="landingButtonDark inline-flex items-center justify-center rounded-md bg-[#111111] px-6 py-3.5 font-bold text-white hover:bg-[#10B981]"
                to="/upgrade"
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
    </div>
  );
}
