import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Chrome, Menu, X } from "lucide-react";
import LandingHero from "../components/landing/LandingHero.jsx";
import LandingDemoVideo from "../components/landing/LandingDemoVideo.jsx";
import TiltCard from "../components/landing/TiltCard.jsx";
import Reveal from "../components/landing/Reveal.jsx";
import Magnetic from "../components/landing/Magnetic.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { fetchPremiumPrice, formatPremiumPrice } from "../lib/premiumCheckout.js";

const NAV_LINKS = [
  { href: "#demo", label: "Demo" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#premium", label: "Premium" },
  { href: "#privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
];

const OLD_WAY_ROWS = [
  { company: "Stripe", role: "Sr. Engineer", status: "reply?", statusTone: "warn" },
  { company: "???", role: "forgot to log", status: "—", rowTone: "faded" },
  { company: "Vercel", role: "Design Eng", status: "applied" },
  { company: "Notion", role: "duplicate??", status: "???", statusTone: "danger" },
  { company: "Figma", role: "Designer…?", status: "ghosted", statusTone: "faded" },
];

const PROBLEM_FAILURES = [
  {
    number: "01",
    title: "Duplicate applications",
    body: "The row went stale, the thread moved, and now you're not sure whether you already applied.",
  },
  {
    number: "02",
    title: "Missed replies",
    body: "Interview invites and recruiter nudges disappear into the inbox before the sheet catches up.",
  },
  {
    number: "03",
    title: "Zero trust",
    body: "By week three nobody believes the tracker, because it only updates when you remember to babysit it.",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Install the extension",
    body: "Add Applendium to Chrome from the Web Store. One click — no account-setup theatrics.",
  },
  {
    step: "02",
    title: "Connect Gmail, read-only",
    body: "Sign in with Google. We ask for read-only scope, so we can never send, delete, or modify a single email.",
  },
  {
    step: "03",
    title: "Review from the popup",
    body: "Every application grouped by stage. Search, refresh, open any thread to see the full story.",
  },
];

const FREE_FEATURES = [
  {
    tag: "SYNC",
    title: "Pipeline by stage",
    body: "Applied, Interviews, Offers, Rejected — surfaced from the real email trail. One glance, one column each.",
  },
  {
    tag: "FIND",
    title: "Search companies & roles",
    body: "Type once to jump to a thread. Refresh from the popup. Open the email in Gmail when you need context.",
  },
  {
    tag: "LINK",
    title: "Every status stays attached",
    body: "Each stage links back to the exact conversation that created it. No more rebuilding context from rows.",
  },
  {
    tag: "SAFE",
    title: "Read-only, always",
    body: "Applendium cannot send, delete, or modify email. The scope is reviewable in your Google account at any time.",
  },
];

const PREMIUM_FEATURES = [
  {
    title: "Apply Gate",
    body: "One pre-apply brief combining fit review, rejection risks, and fix-first guidance — before you spend an hour applying.",
  },
  {
    title: "Daily Action Queue",
    body: "The next follow-ups, ghosting checks, and resume fixes, prioritized — with the reason behind every move.",
  },
  {
    title: "Outcome Memory",
    body: "Repeated misses and evidence gaps tracked across applications, so the same mistake stops happening twice.",
  },
  {
    title: "Strategy Alerts",
    body: "High-confidence warnings when your search pattern looks weak, noisy, stalled, or off-target.",
  },
  {
    title: "Weekly Summary",
    body: "A digest of what changed this week and what deserves attention next — in your inbox, naturally.",
  },
];

const PRIVACY_CARDS = [
  { label: "Scope", value: "Read-only Gmail OAuth" },
  { label: "Write access", value: "No send / delete / modify" },
  { label: "Storage", value: "Data stays on your device" },
  { label: "Control", value: "Revoke anytime in Google" },
];

function BrandMark({ boxClass = "h-7 w-7 rounded-[7px]", imgClass = "h-[22px] w-[22px]" }) {
  return (
    <div className={`${boxClass} grid shrink-0 place-items-center bg-[#0B1220]`}>
      <img src="/logo-transparent.png" alt="Applendium" className={`${imgClass} block`} />
    </div>
  );
}

function Eyebrow({ children, className = "text-[#9AA0A6]" }) {
  return (
    <p
      className={`landingMono text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`}
    >
      {children}
    </p>
  );
}

function HeaderLink({ href, label, onClick }) {
  if (href?.startsWith("/")) {
    return (
      <Link
        to={href}
        className="text-sm font-medium text-[#5C6470] transition-colors hover:text-[#0B1220]"
        onClick={onClick}
      >
        {label}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className="text-sm font-medium text-[#5C6470] transition-colors hover:text-[#0B1220]"
      onClick={onClick}
    >
      {label}
    </a>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState(null);
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    fetchPremiumPrice()
      .then((price) => {
        if (!cancelled) setPremiumPrice(price);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const priceLabel = formatPremiumPrice(premiumPrice);

  useEffect(() => {
    if (!window.location.hash) return;

    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  }, []);

  usePageMetadata({
    title: "Applendium | Gmail Job Tracker for Chrome",
    description:
      "Applendium reads Gmail in read-only mode, groups applications by stage, and replaces the spreadsheet with a cleaner Chrome extension workflow.",
  });

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="landingPage min-h-screen bg-[#FAFAF8] text-[#0B1220]">
      <header
        className="sticky top-0 z-50 w-full border-b border-[#E9EAE5] bg-[#FAFAF8]/90 backdrop-blur-md"
        data-testid="site-header"
      >
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 md:px-8">
          <a
            href="#top"
            className="flex items-center gap-2.5"
            data-testid="logo-link"
            onClick={closeMobileMenu}
          >
            <BrandMark />
            <span className="landingDisplay text-lg font-bold tracking-[-0.02em]">applendium</span>
          </a>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {NAV_LINKS.map((nav) => (
              <HeaderLink key={nav.label} href={nav.href || nav.to} label={nav.label} />
            ))}
            <a
              href="#support"
              className="text-sm font-medium text-[#5C6470] transition-colors hover:text-[#0B1220]"
              data-testid="nav-support"
            >
              Support
            </a>
            <Link
              to="/upgrade"
              className="text-sm font-semibold text-[#0B1220] transition-colors hover:text-[#0E8C63]"
            >
              Sign in
            </Link>
            <a
              href={chromeHref}
              target="_blank"
              rel="noreferrer"
              className="landingButtonDark inline-flex items-center gap-2 rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0E8C63]"
              data-testid="header-install-button"
            >
              <Chrome className="h-4 w-4" />
              Add to Chrome
            </a>
          </nav>

          <button
            type="button"
            className="p-2 md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-[#E9EAE5] bg-[#FAFAF8]/95 backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-6 py-5">
              {NAV_LINKS.map((nav) =>
                nav.to ? (
                  <Link
                    key={nav.label}
                    to={nav.to}
                    className="text-base font-medium text-[#0B1220]"
                    onClick={closeMobileMenu}
                  >
                    {nav.label}
                  </Link>
                ) : (
                  <a
                    key={nav.label}
                    href={nav.href}
                    className="text-base font-medium text-[#0B1220]"
                    onClick={closeMobileMenu}
                  >
                    {nav.label}
                  </a>
                ),
              )}
              <a
                href="#support"
                className="text-base font-medium text-[#0B1220]"
                onClick={closeMobileMenu}
              >
                Support
              </a>
              <Link
                to="/upgrade"
                className="text-base font-semibold text-[#0B1220]"
                onClick={closeMobileMenu}
              >
                Sign in
              </Link>
              <a
                href={chromeHref}
                target="_blank"
                rel="noreferrer"
                className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white"
                onClick={closeMobileMenu}
              >
                <Chrome className="h-4 w-4" />
                Add to Chrome
              </a>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <LandingHero chromeHref={chromeHref} />

        <section className="mx-auto max-w-[1180px] px-6 pb-[88px] pt-14 md:px-8">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="landingDisplay mt-4 max-w-[22ch] text-[32px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
              The spreadsheet was stale the day you made it.
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
            <div className="overflow-hidden rounded-[14px] border border-[#E5E7E3] bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF0EC] bg-[#FCFCFB] px-4 py-3">
                <span className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#9AA0A6]">
                  job_search_FINAL_v3.xlsx
                </span>
                <span className="landingMono ml-auto rounded-full bg-[#FBF3E4] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                  last edited 12 days ago
                </span>
              </div>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F6F7F4]">
                    {["Company", "Role", "Status"].map((heading) => (
                      <th
                        key={heading}
                        className="landingMono px-4 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#9AA0A6]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OLD_WAY_ROWS.map((row) => (
                    <tr key={`${row.company}-${row.role}`} className="border-t border-[#EEF0EC]">
                      <td
                        className={`px-4 py-2.5 font-medium ${row.rowTone === "faded" ? "text-[#9AA0A6]" : "text-[#0B1220]"}`}
                      >
                        {row.company}
                      </td>
                      <td
                        className={`px-4 py-2.5 ${row.rowTone === "faded" || row.role.includes("?") ? "italic text-[#9AA0A6]" : "text-[#5C6470]"}`}
                      >
                        {row.role}
                      </td>
                      <td
                        className={`px-4 py-2.5 ${
                          row.statusTone === "warn"
                            ? "text-[#B45309]"
                            : row.statusTone === "danger"
                              ? "text-[#B3261E]"
                              : row.statusTone === "faded" || row.rowTone === "faded"
                                ? "text-[#9AA0A6]"
                                : "text-[#5C6470]"
                        }`}
                      >
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              {PROBLEM_FAILURES.map((item, index) => (
                <div
                  key={item.title}
                  className={`border-t border-[#E9EAE5] py-[22px] ${index === PROBLEM_FAILURES.length - 1 ? "border-b" : ""}`}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="landingMono text-xs font-bold text-[#0E8C63]">
                      {item.number}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold tracking-[-0.01em]">{item.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-[1.6] text-[#5C6470]">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingDemoVideo />

        <section id="how-it-works" className="border-t border-[#E9EAE5] bg-[#F4F5F1]">
          <div className="mx-auto max-w-[1180px] px-6 py-[88px] md:px-8">
            <Reveal>
              <Eyebrow>How it works</Eyebrow>
              <h2 className="landingDisplay mt-4 max-w-[20ch] text-[32px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
                Three steps. Zero data entry.
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <article
                  key={step.step}
                  className="rounded-2xl border border-[#E5E7E3] bg-white p-7"
                >
                  <span className="landingMono text-[13px] font-bold text-[#0E8C63]">
                    {step.step}
                  </span>
                  <h3 className="mt-3.5 text-[19px] font-bold tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-[#5C6470]">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1180px] px-6 py-[88px] md:px-8">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:sticky lg:top-24">
              <Reveal>
                <Eyebrow>Free, today</Eyebrow>
                <h2 className="landingDisplay mt-4 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
                  Everything the spreadsheet promised, without the babysitting.
                </h2>
                <p className="mt-5 max-w-[42ch] text-base leading-[1.65] text-[#5C6470]">
                  The free extension is the complete tracker. Premium adds judgment on top &mdash;
                  not table stakes behind a paywall.
                </p>
              </Reveal>
            </div>
            <div>
              {FREE_FEATURES.map((feature, index) => (
                <div
                  key={feature.tag}
                  className={`flex gap-[18px] border-t border-[#E9EAE5] py-[26px] ${index === FREE_FEATURES.length - 1 ? "border-b" : ""}`}
                >
                  <span className="landingMono h-fit shrink-0 rounded-md bg-[#EAF5F0] px-2 py-[5px] text-[10px] font-bold tracking-[0.1em] text-[#0E8C63]">
                    {feature.tag}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold tracking-[-0.01em]">{feature.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-[#5C6470]">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="premium" className="relative overflow-hidden bg-[#0B1220]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute right-[-8%] top-[-12%] h-[460px] w-[460px] rounded-full bg-[#0E8C63] opacity-[0.18] blur-[140px]" />
            <div className="absolute left-[-8%] bottom-[-14%] h-[420px] w-[420px] rounded-full bg-[#2FBE8F] opacity-[0.10] blur-[140px]" />
          </div>
          <div className="relative mx-auto max-w-[1180px] px-6 py-24 md:px-8">
            <Reveal className="flex flex-wrap items-end justify-between gap-8">
              <div>
                <Eyebrow className="text-[#2FBE8F]">Premium</Eyebrow>
                <h2 className="landingDisplay mt-4 max-w-[18ch] text-[34px] font-bold leading-[1.06] tracking-[-0.03em] text-white md:text-[44px]">
                  Tracking is free. Judgment is Premium.
                </h2>
                <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-[#98A1B3]">
                  Premium reads the same threads and tells you what to do next: which roles are
                  worth your time, which follow-ups matter today, and what keeps costing you
                  interviews.
                </p>
              </div>
              <Magnetic className="inline-block shrink-0">
                <Link
                  to="/upgrade"
                  className="inline-flex items-center gap-2.5 rounded-[12px] bg-gradient-to-b from-[#16A874] to-[#0E8C63] px-6 py-[15px] text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(14,140,99,0.8)] ring-1 ring-inset ring-white/15"
                >
                  Explore Premium
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnetic>
            </Reveal>

            <Reveal delay={0.08} className="mt-14 [perspective:1400px]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[170px]">
                {/* Flagship — Apply Gate */}
                <TiltCard className="h-full rounded-2xl sm:col-span-2 lg:col-span-3 lg:row-span-2">
                  <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#0E1726]/70 p-7 backdrop-blur-sm">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#2FBE8F]">
                          {PREMIUM_FEATURES[0].title}
                        </span>
                        <span className="landingMono rounded-full bg-[#2FBE8F]/[0.12] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#5FD9AE] ring-1 ring-[#2FBE8F]/25">
                          flagship
                        </span>
                      </div>
                      <p className="mt-3 max-w-[36ch] text-[16px] leading-[1.55] text-white/90">
                        {PREMIUM_FEATURES[0].body}
                      </p>
                    </div>
                    <div className="mt-6 rounded-xl border border-white/10 bg-[#0B1220]/70 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                          <span className="h-2 w-2 rounded-full bg-[#34E3A8] shadow-[0_0_10px_2px_rgba(52,227,168,0.55)]" />
                          Apply, but tailor first
                        </span>
                        <span className="landingMono text-[11px] text-[#5FD9AE]">fit 72%</span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#2FBE8F] to-[#34E3A8]" />
                      </div>
                    </div>
                  </div>
                </TiltCard>

                {/* Price */}
                <TiltCard className="h-full rounded-2xl sm:col-span-2 lg:col-span-3">
                  <div className="flex h-full flex-col justify-center gap-4 rounded-2xl border border-white/10 bg-[#0E1726]/70 p-7 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="landingDisplay text-[34px] font-bold leading-none tracking-[-0.02em] text-white">
                        {priceLabel ? priceLabel.amount : "Premium"}
                        <span className="text-[15px] font-semibold text-[#98A1B3]">
                          {priceLabel ? priceLabel.suffix : ""}
                        </span>
                      </p>
                      <p className="landingMono mt-2 text-[11px] leading-[1.7] text-[#5C6B85]">
                        one plan · all features · cancel anytime
                      </p>
                    </div>
                    <Magnetic className="shrink-0">
                      <Link
                        to="/upgrade"
                        className="inline-flex items-center gap-2 rounded-[11px] bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1220] transition-colors hover:bg-[#E9FBF3]"
                      >
                        Start Premium
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Magnetic>
                  </div>
                </TiltCard>

                {/* Daily Action Queue */}
                <TiltCard className="h-full rounded-2xl sm:col-span-2 lg:col-span-3">
                  <div className="flex h-full flex-col justify-center rounded-2xl border border-white/10 bg-[#0E1726]/70 p-6 backdrop-blur-sm">
                    <span className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#2FBE8F]">
                      {PREMIUM_FEATURES[1].title}
                    </span>
                    <p className="mt-2.5 text-[14px] leading-[1.55] text-[#98A1B3]">
                      {PREMIUM_FEATURES[1].body}
                    </p>
                  </div>
                </TiltCard>

                {/* Outcome Memory / Strategy Alerts / Weekly Summary */}
                {[2, 3, 4].map((i) => (
                  <TiltCard key={PREMIUM_FEATURES[i].title} className="h-full rounded-2xl lg:col-span-2">
                    <div className="flex h-full flex-col justify-center rounded-2xl border border-white/10 bg-[#0E1726]/70 p-6 backdrop-blur-sm">
                      <span className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#2FBE8F]">
                        {PREMIUM_FEATURES[i].title}
                      </span>
                      <p className="mt-2.5 text-[13.5px] leading-[1.5] text-[#98A1B3]">
                        {PREMIUM_FEATURES[i].body}
                      </p>
                    </div>
                  </TiltCard>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="privacy"
          className="mx-auto max-w-[1180px] px-6 py-[88px] md:px-8"
          data-testid="privacy-section"
        >
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>Privacy</Eyebrow>
              <h2 className="landingDisplay mt-4 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
                Read-only is not a feature. It's the architecture.
              </h2>
              <p className="mt-5 max-w-[46ch] text-base leading-[1.65] text-[#5C6470]">
                The OAuth scope we request physically cannot send, delete, or modify email. It
                never sells, shares, or trains models on your data. You can verify it &mdash; and
                revoke it &mdash; in your Google account at any time.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PRIVACY_CARDS.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[14px] border border-[#E5E7E3] bg-white p-[22px]"
                >
                  <span className="landingMono text-[10px] font-bold uppercase tracking-[0.14em] text-[#0E8C63]">
                    {card.label}
                  </span>
                  <p className="mt-2.5 text-[14.5px] font-semibold text-[#0B1220]">{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="support" className="border-t border-[#E9EAE5] bg-[#F4F5F1]">
          <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 px-6 py-20 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <Eyebrow>Support</Eyebrow>
              <h2 className="landingDisplay mt-4 text-[30px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[36px]">
                Need help with Applendium?
              </h2>
              <p className="mt-5 max-w-[46ch] text-base leading-[1.65] text-[#5C6470]">
                Send the account email, what you expected to happen, what happened instead, and any
                screenshot or error text that makes the issue reproducible.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[14px] border border-[#E5E7E3] bg-white p-6">
                <p className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#9AA0A6]">
                  General support
                </p>
                <h3 className="mt-3 text-lg font-bold tracking-[-0.01em]">
                  support@applendium.com
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#5C6470]">
                  Installation, sign-in, sync, billing, and account troubleshooting.
                </p>
                <a
                  href="mailto:support@applendium.com?subject=Applendium%20Support"
                  className="landingButtonDark mt-5 inline-flex items-center justify-center rounded-lg bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0E8C63]"
                >
                  Email support
                </a>
              </article>

              <article className="rounded-[14px] border border-[#E5E7E3] bg-white p-6">
                <p className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#9AA0A6]">
                  Privacy requests
                </p>
                <h3 className="mt-3 text-lg font-bold tracking-[-0.01em]">
                  privacy@applendium.com
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#5C6470]">
                  Data deletion, Gmail access, and privacy-specific account requests.
                </p>
                <a
                  href="mailto:privacy@applendium.com?subject=Applendium%20Privacy%20Request"
                  className="mt-5 inline-flex items-center justify-center rounded-lg border border-[#D8DAD3] bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1220] transition-colors hover:border-[#0B1220]"
                >
                  Contact privacy
                </a>
              </article>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#0B1220]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0E8C63] opacity-[0.16] blur-[150px]" />
          </div>
          <Reveal className="relative mx-auto max-w-[1180px] px-6 pb-20 pt-24 text-center md:px-8 lg:pb-28 lg:pt-28">
            <h2 className="landingDisplay mx-auto max-w-[18ch] text-[36px] font-bold leading-[1.04] tracking-[-0.035em] text-white md:text-[52px]">
              Stop being your own{" "}
              <span className="bg-gradient-to-r from-[#2FBE8F] to-[#34E3A8] bg-clip-text text-transparent">
                ATS.
              </span>
            </h2>
            <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Magnetic className="inline-block">
                <a
                  href={chromeHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 rounded-[12px] bg-gradient-to-b from-[#16A874] to-[#0E8C63] px-6 py-[15px] text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(14,140,99,0.8)] ring-1 ring-inset ring-white/15"
                >
                  <Chrome className="h-4 w-4" />
                  Add to Chrome &mdash; free
                </a>
              </Magnetic>
              <Link
                to="/upgrade"
                className="inline-flex items-center justify-center rounded-[12px] border border-white/15 bg-white/[0.03] px-6 py-[14px] text-base font-semibold text-white/90 transition-colors hover:border-white/30 hover:bg-white/[0.06]"
              >
                Start Premium
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#E9EAE5]" data-testid="site-footer">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-7 md:px-8">
          <div className="flex items-center gap-2">
            <BrandMark boxClass="h-5 w-5 rounded-[5px]" imgClass="h-[15px] w-[15px]" />
            <span className="text-[13px] text-[#9AA0A6]">
              &copy; {year} Applendium &mdash; made for the inbox.
            </span>
          </div>
          <div className="flex flex-wrap gap-6">
            <a href="#privacy" className="text-[13px] text-[#6B7280] transition-colors hover:text-[#0B1220]">
              Privacy
            </a>
            <Link
              to="/terms"
              className="text-[13px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              data-testid="footer-terms-link"
            >
              Terms
            </Link>
            <a
              href="#support"
              className="text-[13px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              data-testid="footer-support-link"
            >
              Support
            </a>
            <a
              href="#premium"
              className="text-[13px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              data-testid="footer-premium-link"
            >
              Premium
            </a>
            <a
              href={chromeHref}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              data-testid="footer-chrome-link"
            >
              Chrome Web Store
            </a>
            <a
              href={premiumUpdatesHref}
              className="text-[13px] font-semibold text-[#0B1220] transition-colors hover:text-[#0E8C63]"
              data-testid="footer-email-cta"
            >
              support@applendium.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
