import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Chrome, RefreshCw } from "lucide-react";
import PublicShell from "./PublicShell.jsx";
import { CHROME_WEB_STORE_URL } from "../../lib/publicSiteConfig.js";
import { premiumUpdatesHref } from "../../lib/premiumLaunchContent.js";

/**
 * What a signed-out visitor sees on a workspace URL such as /dashboard (2026-10-14). It used to be a
 * bare "Loading..." for 8-20 s and then a redirect to /upgrade. This renders in place, at the same
 * URL, so if the extension signs them in a moment later the page simply appears: nobody signed in
 * is ever redirected away mid-restore.
 */
export default function SignedOutWorkspace({ checking = false, upgradeHref = "/upgrade" }) {
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  return (
    <PublicShell>
      <main className="mx-auto max-w-[720px] px-4 py-14 sm:px-6 md:py-20" data-testid="signed-out-workspace">
        <p className="landingMono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0A7A55]">
          Sign in needed
        </p>
        <h1 className="landingDisplay mt-4 text-[30px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
          Your Applendium™ workspace opens from the extension.
        </h1>
        <p className="mt-5 text-[16px] leading-[1.65] text-[#5C6470]">
          Applendium™ is a free Chrome extension that reads your Gmail, read-only, and builds your job
          application tracker for you. This page is part of your workspace, so it needs you signed in.
        </p>

        <ol className="mt-8 grid gap-3">
          {[
            "Add Applendium™ to Chrome on your computer.",
            "Open the extension and sign in with Google.",
            "Come back to this page and reload it.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 rounded-[12px] border border-[#E5E7E3] bg-white px-4 py-3">
              <span className="landingMono text-[13px] font-bold text-[#0A7A55]">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-[15px] text-[#0B1220]">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={chromeHref}
            target="_blank"
            rel="noreferrer"
            className="landingButtonDark inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-[#0B1220] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A55]"
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Add to Chrome, free
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[#D8DAD3] bg-white px-5 text-sm font-semibold text-[#0B1220] transition-colors hover:border-[#0B1220]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            I'm signed in, reload
          </button>
          <Link
            to={upgradeHref}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 px-2 text-sm font-semibold text-[#0A7A55] hover:text-[#0B1220]"
          >
            See plans and Premium
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-6 text-[14px] leading-[1.6] text-[#5C6470]">
          On a phone? Chrome extensions install on a computer only. Open applendium.com there.
        </p>
        <p className="mt-2 min-h-[1.5em] text-[13px] text-[#5C6470]" role="status" aria-live="polite" data-testid="signed-out-checking">
          {checking ? "Checking for the Applendium™ extension in this browser..." : ""}
        </p>
      </main>
    </PublicShell>
  );
}
