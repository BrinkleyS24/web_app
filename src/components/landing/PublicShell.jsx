import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Chrome, Menu, X } from "lucide-react";
import { CHROME_WEB_STORE_URL } from "../../lib/publicSiteConfig.js";
import { premiumUpdatesHref } from "../../lib/premiumLaunchContent.js";

// One header and footer for every public page that is not the landing page itself
// (privacy, terms, goodbye, upgrade, payment results, 404, signed-out workspace).
// Added 2026-10-14: /privacy had no header, nav or footer at all, so it was a dead end.
const NAV = [
  { to: "/#features", label: "Features" },
  { to: "/upgrade?source=site_nav", label: "Premium" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/#support", label: "Support" },
];

export function BrandMark({ boxClass = "h-7 w-7 rounded-[7px]", imgClass = "h-[22px] w-[22px]" }) {
  return (
    <div className={`${boxClass} grid shrink-0 place-items-center bg-[#0B1220]`}>
      <img src="/logo-transparent.png" alt="" className={`${imgClass} block`} />
    </div>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-[#E9EAE5] bg-[#FAFAF8]/90 backdrop-blur-md"
      data-testid="site-header"
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6 md:px-8">
        <Link to="/" className="flex min-h-[44px] items-center gap-2.5" data-testid="logo-link" aria-label="Applendium home">
          <BrandMark />
          <span className="landingDisplay text-lg font-bold tracking-[-0.02em] text-[#0B1220]">Applendium™</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-sm font-medium text-[#5C6470] transition-colors hover:text-[#0B1220]"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={chromeHref}
            target="_blank"
            rel="noreferrer"
            className="landingButtonDark inline-flex items-center gap-2 rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A55]"
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Add to Chrome
          </a>
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[#E9EAE5] bg-[#FAFAF8] md:hidden">
          <div className="mx-auto flex max-w-[1180px] flex-col px-4 py-3 sm:px-6">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex min-h-[44px] items-center text-base font-medium text-[#0B1220]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  const year = new Date().getFullYear();
  const linkClass = "inline-flex min-h-[44px] items-center text-[13px] text-[#5C6470] transition-colors hover:text-[#0B1220]";
  return (
    <footer className="border-t border-[#E9EAE5] bg-[#FAFAF8]" data-testid="site-footer">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 sm:px-6 md:px-8">
        <div className="flex items-center gap-2">
          <BrandMark boxClass="h-5 w-5 rounded-[5px]" imgClass="h-[15px] w-[15px]" />
          <span className="text-[13px] text-[#5C6470]">&copy; {year} Applendium™. Made for the inbox.</span>
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Link to="/privacy" className={linkClass} data-testid="footer-privacy-link">Privacy</Link>
          <Link to="/terms" className={linkClass} data-testid="footer-terms-link">Terms</Link>
          <Link to="/#support" className={linkClass} data-testid="footer-support-link">Support</Link>
          <Link to="/upgrade?source=site_footer" className={linkClass} data-testid="footer-premium-link">Premium</Link>
          <a href={chromeHref} target="_blank" rel="noreferrer" className={linkClass} data-testid="footer-chrome-link">
            Chrome Web Store
          </a>
          <a
            href="mailto:support@applendium.com"
            className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[#0B1220] transition-colors hover:text-[#0A7A55]"
            data-testid="footer-email-cta"
          >
            support@applendium.com
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function PublicShell({ children, className = "" }) {
  return (
    <div className={`landingPage flex min-h-screen flex-col bg-[#FAFAF8] text-[#0B1220] ${className}`}>
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
