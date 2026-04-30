import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  Chrome,
  FileText,
  Lock,
  Menu,
  Search,
  Sparkles,
  TrendingDown,
  X,
  Zap,
} from "lucide-react";
import LandingExtensionDemo from "../components/LandingExtensionDemo.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#premium", label: "Premium" },
  { href: "#privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
];

const SIGNAL_ITEMS = [
  "100% read-only Gmail",
  "OAuth verified",
  "No data sold",
  "Built for job seekers",
  "Works with Google Workspace",
  "Chrome Web Store",
];

const PROMO_ASSETS = {
  smallTile: "/promos/small-promo-tile.png",
};

const OLD_WAY_ROWS = [
  { company: "Stripe", role: "Sr. Engineer", date: "Aug 12", status: "?" },
  { company: "???", role: "forgot to log", date: "-", status: "-" },
  { company: "Vercel", role: "DA", date: "Aug 15", status: "applied" },
  { company: "Linear", role: "Eng", date: "Aug 18", status: "reply?" },
  { company: "Notion", role: "duplicate", date: "Aug 12", status: "???" },
  { company: "Figma", role: "Designer...?", date: "...", status: "ghosted" },
];

const PROBLEM_FAILURES = [
  {
    title: "Duplicate applications",
    body: "The row went stale, the thread moved, and now you are not sure whether you already applied.",
  },
  {
    title: "Missed replies",
    body: "Interview invites and recruiter nudges disappear into the inbox before the sheet catches up.",
  },
  {
    title: "Zero trust",
    body: "By week three, nobody believes the tracker because it only updates when you remember to babysit it.",
  },
];

const SOLUTION_HIGHLIGHTS = [
  {
    title: "Search the actual inbox",
    body: "Find a company or role instantly without rebuilding context from scattered rows.",
    icon: Search,
  },
  {
    title: "Track stages automatically",
    body: "Applied, interview, offer, rejected - surfaced from the real email trail instead of manual notes.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Open the full thread",
    body: "Every status stays attached to the exact conversation that created it.",
    icon: FileText,
  },
];

const HERO_PROOF_POINTS = [
  {
    title: "Read-only Gmail scope",
    body: "No send, delete, or modify permissions.",
    icon: Lock,
  },
  {
    title: "Search every application",
    body: "Find a company or role without rebuilding context.",
    icon: Search,
  },
  {
    title: "Popup-first workflow",
    body: "Open the extension and review the live pipeline fast.",
    icon: Chrome,
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    icon: Chrome,
    title: "Install the extension",
    body: "Add Applendium to Chrome from the Web Store. One click. No account setup theatrics.",
  },
  {
    step: "02",
    icon: Lock,
    title: "Connect Gmail (read-only)",
    body: "Sign in with Google. We ask for read-only scope, so we can never send, delete, or modify a single email.",
  },
  {
    step: "03",
    icon: BriefcaseBusiness,
    title: "Review from the popup",
    body: "Open the toolbar popup. See every application grouped by stage. Search, refresh, open any thread to see the full story.",
  },
];

const LIVE_FEATURES = [
  {
    title: "Sign in from the popup",
    body: "Start in the Chrome toolbar. Connect the Gmail account you already use for applications.",
    icon: Chrome,
  },
  {
    title: "Pipeline by stage",
    body: "Applied, Interviews, Offers, Rejected - one glance, one column each.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Search companies & roles",
    body: "Type once to jump to a thread. Refresh from the popup. Open the email in Gmail when you need context.",
    icon: Search,
  },
  {
    title: "Read-only, always",
    body: "Applendium cannot send, delete, or modify email. The scope is reviewable in your Google account.",
    icon: Lock,
  },
];

const PREMIUM_FEATURES = [
  {
    title: "Apply Gate",
    body: "One pre-apply brief combining fit review, rejection risks, and fix-first guidance before you spend time applying.",
    icon: Sparkles,
  },
  {
    title: "Daily Action Queue",
    body: "Prioritize the next follow-ups, ghosting checks, resume fixes, and cleanup - with a reason behind each move.",
    icon: Zap,
  },
  {
    title: "Outcome Memory",
    body: "Track repeated misses and evidence gaps across applications so the dashboard surfaces what keeps happening.",
    icon: TrendingDown,
  },
  {
    title: "Strategy Alerts",
    body: "High-confidence warnings when your search pattern looks weak, noisy, stalled, or off-target.",
    icon: BellRing,
  },
  {
    title: "Weekly Summary",
    body: "A premium digest that highlights what changed this week and what deserves attention next.",
    icon: FileText,
  },
];

const PRIVACY_POINTS = [
  "Read-only Gmail OAuth scope",
  "No send / delete / modify",
  "Data stays on your device",
  "Revoke anytime in Google",
];

function BrandMark({ className = "h-8 w-8" }) {
  return (
    <img
      src="/favicon.png"
      alt="Applendium"
      className={`${className} rounded-md bg-[#0B1220] p-0.5`}
    />
  );
}

function HeaderLink({ href, label, onClick }) {
  if (href?.startsWith("/")) {
    return (
      <Link
        to={href}
        className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black"
        onClick={onClick}
      >
        {label}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black"
      onClick={onClick}
    >
      {label}
    </a>
  );
}

function HeroPreviewCard() {
  return (
    <div className="mx-auto max-w-[430px]">
      <article className="overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-[0_24px_56px_-32px_rgba(17,17,17,0.32)]">
        <div className="border-b border-gray-200 bg-[linear-gradient(135deg,#F5FBF7_0%,#FFF8ED_100%)] p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="landingMono inline-flex rounded-full border border-[#BDE7D3] bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E8C63]">
              Chrome extension
            </span>
            <span className="landingMono inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
              Free now
            </span>
          </div>

          <h3 className="landingDisplay mt-4 text-[28px] font-bold leading-tight text-[#0B1220]">
            The inbox-native tracker.
          </h3>
          <p className="mt-3 text-base leading-7 text-gray-600">
            One compact popup for confirmations, interviews, offers, and rejections - built
            around the Gmail threads you already have.
          </p>
        </div>

        <div className="p-6">
          <div className="overflow-hidden rounded-[22px] border border-gray-200 bg-[#F8FAFC] p-2">
            <img
              src={PROMO_ASSETS.smallTile}
              alt="Applendium promo tile previewing the Chrome extension and launch positioning."
              className="block w-full rounded-[16px]"
            />
          </div>

          <div className="mt-5 grid gap-3">
            {HERO_PROOF_POINTS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-[#FCFCFB] p-4"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[#0B1220]">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-gray-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function ProblemCard() {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
      <article className="relative overflow-hidden rounded-[32px] border border-gray-200 bg-white p-8 shadow-[0_22px_56px_-34px_rgba(17,17,17,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-white to-[#F8FAFC]" />

        <div className="relative z-10">
          <p className="landingMono text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
            The old way
          </p>
          <h3 className="landingDisplay mt-5 text-[24px] font-bold text-[#0B2341]">
            Manual spreadsheet
          </h3>
          <p className="mt-4 max-w-lg text-base leading-7 text-gray-500">
            You become the parser, the historian, and the status updater for a process that
            is already happening in email.
          </p>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-gray-200 bg-white">
            <table className="w-full border-collapse text-left text-[13px] text-gray-600">
              <thead className="bg-[#F3F4F6] text-[10px] uppercase tracking-[0.24em] text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Company</th>
                  <th className="px-4 py-3 font-bold">Role</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {OLD_WAY_ROWS.map((row) => (
                  <tr key={`${row.company}-${row.role}`} className="border-t border-gray-100">
                    <td className={`px-4 py-3 ${row.company.includes("?") ? "text-[#E63500]" : ""}`}>
                      {row.company}
                    </td>
                    <td className={`px-4 py-3 ${row.role.includes("?") ? "text-[#E63500]" : ""}`}>
                      {row.role}
                    </td>
                    <td
                      className={`px-4 py-3 ${row.date.includes("-") || row.date.includes("...") ? "text-[#E63500]" : ""}`}
                    >
                      {row.date}
                    </td>
                    <td className={`px-4 py-3 ${row.status.includes("?") ? "text-[#E63500]" : ""}`}>
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PROBLEM_FAILURES.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#F1D6CE] bg-[#FFF8F6] p-4"
              >
                <div className="landingMono text-[10px] font-bold uppercase tracking-[0.18em] text-[#E63500]">
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-base text-gray-500">
            Half-remembered, half-complete, fully abandoned by week three.
          </p>
        </div>
      </article>

      <article className="relative overflow-hidden rounded-[32px] border border-[#D7EBDD] bg-[linear-gradient(135deg,#F4FBF7_0%,#FFF8ED_100%)] p-8 shadow-[0_22px_56px_-34px_rgba(17,17,17,0.35)]">
        <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-[#10B981]/14 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#0B2341]/8 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="landingMono text-[10px] font-bold uppercase tracking-[0.24em] text-[#0E8C63]">
              The better way
            </p>
            <span className="landingMono inline-flex items-center rounded-full border border-[#BDE7D3] bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E8C63]">
              Inbox becomes pipeline
            </span>
          </div>

          <div className="mt-5">
            <h3 className="landingDisplay text-[24px] font-bold text-[#0B2341]">
              Applendium reads what already happened.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              Every confirmation, interview, offer, and rejection stays tied to the exact
              thread that created it. No duplicate logging. No second system to maintain.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {SOLUTION_HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_18px_32px_-28px_rgba(17,17,17,0.35)] backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111111] text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[#0B1220]">{title}</div>
                      <p className="mt-1 text-sm leading-6 text-gray-500">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <LandingExtensionDemo />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function StepCard({ step, icon: Icon, title, body }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_16px_40px_-32px_rgba(17,17,17,0.35)]">
      <span className="landingDisplay pointer-events-none absolute right-4 top-2 text-[96px] font-black tracking-tighter text-gray-100">
        {step}
      </span>
      <div className="relative z-10">
        <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="landingDisplay text-[22px] font-bold tracking-tight text-[#0B1220]">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-8 text-gray-600">{body}</p>
      </div>
    </article>
  );
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_16px_40px_-32px_rgba(17,17,17,0.35)]">
      <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="landingDisplay text-[20px] font-bold tracking-tight text-[#0B1220]">
        {title}
      </h3>
      <p className="mt-4 text-lg leading-8 text-gray-600">{body}</p>
    </article>
  );
}

function PremiumCard({ icon: Icon, title, body, wide = false }) {
  return (
    <article
      className={`rounded-2xl border border-dashed border-gray-300 bg-white p-6 ${wide ? "xl:col-span-2" : "xl:col-span-1"}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </div>
        <span className="landingMono inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
          <Lock className="h-2.5 w-2.5" />
          Locked
        </span>
      </div>
      <h3 className="landingDisplay text-[20px] font-bold tracking-tight text-[#0B2341]">
        {title}
      </h3>
      <p className="mt-4 text-lg leading-8 text-gray-500">{body}</p>
    </article>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  const year = new Date().getFullYear();

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
    <div className="landingPage min-h-screen bg-[#fdfdfc] text-[#111111]">
      <header className="sticky top-0 z-50 w-full bg-transparent transition-all" data-testid="site-header">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
          <a
            href="#top"
            className="group flex items-center gap-2"
            data-testid="logo-link"
            onClick={closeMobileMenu}
          >
            <BrandMark />
            <span className="landingDisplay text-xl font-extrabold tracking-tight">applendium</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV_LINKS.map((nav) => (
              <HeaderLink key={nav.label} href={nav.href || nav.to} label={nav.label} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#support"
              className="text-sm font-medium text-gray-700 hover:text-black"
              data-testid="nav-support"
            >
              Support
            </a>
            <a
              href={chromeHref}
              target="_blank"
              rel="noreferrer"
              className="landingButtonDark inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#10B981]"
              data-testid="header-install-button"
            >
              <Chrome className="h-4 w-4" />
              Install
            </a>
          </div>

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
          <div className="border-t border-black/8 bg-white/95 backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5">
              {NAV_LINKS.map((nav) => (
                nav.to ? (
                  <Link
                    key={nav.label}
                    to={nav.to}
                    className="text-base font-medium text-[#111111]"
                    onClick={closeMobileMenu}
                  >
                    {nav.label}
                  </Link>
                ) : (
                  <a
                    key={nav.label}
                    href={nav.href}
                    className="text-base font-medium text-[#111111]"
                    onClick={closeMobileMenu}
                  >
                    {nav.label}
                  </a>
                )
              ))}
              <a href="#support" className="text-base font-medium text-[#111111]" onClick={closeMobileMenu}>
                Support
              </a>
              <a
                href={chromeHref}
                target="_blank"
                rel="noreferrer"
                className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-3 text-sm font-bold text-white"
                onClick={closeMobileMenu}
              >
                <Chrome className="h-4 w-4" />
                Install
              </a>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section id="top" className="relative overflow-hidden" data-testid="hero-section">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#fdfdfc] via-[#fdfdfc]/80 to-transparent" />

          <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-24">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="animate-fade-up lg:col-span-6">
                <div className="landingMono mb-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
                  </span>
                  Chrome extension - live now
                </div>

                <h1
                  className="landingDisplay text-5xl font-black leading-[0.88] tracking-tighter text-[#111111] md:text-6xl lg:text-7xl"
                  data-testid="hero-headline"
                >
                  Your job hunt,
                  <br />
                  <span className="relative inline-block">
                    <span className="relative z-10">finally</span>
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 z-0 h-2.5 -rotate-1 bg-[#10B981]/90 md:bottom-1 md:h-4"
                    />
                  </span>{" "}
                  in one place.
                </h1>

                <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-gray-600 md:text-xl">
                  Applendium reads your Gmail in read-only mode, groups every application by
                  stage, and keeps your pipeline sharp - without a spreadsheet, without the
                  guesswork.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={chromeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-md bg-[#10B981] px-6 py-3.5 font-bold text-white shadow-[0_6px_20px_-4px_rgba(16,185,129,0.5)] transition-all hover:bg-[#111111] active:scale-[0.98]"
                    data-testid="hero-install-button"
                  >
                    <Chrome className="h-4 w-4" strokeWidth={2.5} />
                    Add to Chrome - it's free
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-6 py-3.5 font-bold text-[#111111] transition-all hover:-translate-y-0.5 hover:border-[#111111]"
                  >
                    See how it works
                  </a>
                </div>

                <div className="landingMono mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] uppercase tracking-[0.18em] text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Gmail read-only
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    No spreadsheet required
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Zero data sold
                  </span>
                </div>
              </div>

              <div className="animate-fade-up lg:col-span-6" style={{ animationDelay: "0.15s" }}>
                <HeroPreviewCard />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-y border-gray-200 bg-[#F3F4F6]">
          <div className="landingTickerTrack py-4">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-10 px-4"
                aria-hidden={copy === 1 ? "true" : undefined}
              >
                {SIGNAL_ITEMS.map((item) => (
                  <span
                    key={`${copy}-${item}`}
                    className="landingMono whitespace-nowrap text-[12px] uppercase tracking-[0.32em] text-gray-500"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 md:px-10">
            <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
              01 - The problem
            </span>
            <h2 className="landingDisplay mt-6 max-w-4xl text-4xl font-black leading-[0.92] tracking-tighter text-[#111111] md:text-6xl lg:text-7xl">
              Spreadsheets quit before you do.
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-gray-600 md:text-[18px]">
              You apply, forget, duplicate, miss interviews, and re-copy rejections into
              rows you'll never read. Applendium reads what's already in your inbox and
              makes it useful.
            </p>

            <div className="mt-16">
              <ProblemCard />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#F3F4F6] py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 md:px-10">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-7">
                <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                  02 - How it works
                </span>
                <h2 className="landingDisplay mt-6 max-w-4xl text-4xl font-black leading-[0.92] tracking-tighter text-[#111111] md:text-6xl">
                  Three steps from
                  <br />
                  install to relief.
                </h2>
              </div>
              <div className="lg:col-span-5 lg:pt-20">
                <p className="max-w-xl text-lg leading-8 text-gray-600 md:text-[18px]">
                  No onboarding video. No dashboard to configure. Install, connect, open
                  the popup - the pipeline is already built.
                </p>
              </div>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-3">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <StepCard key={step.step} {...step} />
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 md:px-10">
            <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
              03 - What's shipped, what's next
            </span>
            <h2 className="landingDisplay mt-6 max-w-4xl text-4xl font-black leading-[0.92] tracking-tighter text-[#111111] md:text-6xl lg:text-7xl">
              The extension is the product today.
            </h2>
            <p className="mt-8 max-w-4xl text-lg leading-8 text-gray-600 md:text-[18px]">
              Premium Beta starts narrowly: Apply Gate for better apply/skip decisions
              and a weekly search-health summary for your recent momentum.
            </p>

            <div className="mt-12 flex items-center gap-3">
              <span className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                Live now
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-4">
              {LIVE_FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>

            <div id="premium" className="mt-14 flex items-center gap-3">
              <span className="landingMono inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                <Lock className="h-3 w-3" />
                Premium Beta
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-5">
              {PREMIUM_FEATURES.map((feature, index) => (
                <PremiumCard
                  key={feature.title}
                  {...feature}
                  wide={index === 0}
                />
              ))}
            </div>

            <p className="landingMono mt-6 text-xs uppercase tracking-[0.22em] text-gray-500">
              Beta access focuses on Apply Gate and weekly search health first.
            </p>
          </div>
        </section>

        <section id="privacy" className="relative overflow-hidden bg-[#111111] text-white" data-testid="privacy-section">
          <div className="bg-grid-dark pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#10B981]/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-24 md:px-10 md:py-32 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                04 - Privacy
              </span>
              <h2 className="landingDisplay mt-4 text-4xl font-black leading-[0.92] tracking-tighter md:text-6xl lg:text-7xl">
                Your inbox
                <br />
                is yours.
              </h2>
              <p className="mt-6 max-w-xl text-base text-white/70 md:text-lg">
                Applendium requests only the <span className="font-semibold text-white">Gmail read-only</span>{" "}
                scope. It cannot send, delete, or modify email. It never sells, shares, or
                trains models on your data. You can revoke access from your Google account at
                any time.
              </p>

              <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
                {PRIVACY_POINTS.map((point) => (
                  <div
                    key={point}
                    className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3.5 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm font-medium text-white/90">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:col-span-5">
              <div className="relative">
                <div className="animate-pulse-glow absolute inset-0 bg-[#10B981]/30 blur-3xl" />
                <div className="relative flex h-44 w-44 items-center justify-center rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm md:h-56 md:w-56">
                  <Lock className="h-20 w-20 text-white md:h-24 md:w-24" strokeWidth={1.25} />
                  <span className="landingMono absolute -right-3 -top-3 rounded bg-[#10B981] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                    Read-only
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-5xl px-6 text-center md:px-10">
            <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
              05 - Ready when you are
            </span>
            <h2 className="landingDisplay mt-6 text-4xl font-black leading-[0.92] tracking-tighter text-[#111111] md:text-6xl lg:text-7xl">
              Install the extension.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">Skip the spreadsheet.</span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 z-0 h-2.5 -rotate-1 bg-[#10B981]/90 md:bottom-1 md:h-4"
                />
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-600 md:text-[18px]">
              Chrome extension is free. Premium drops when the dashboard is ready - you'll
              hear it here first.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={chromeHref}
                target="_blank"
                rel="noreferrer"
                className="landingButtonDark inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-[#10B981]"
              >
                <Chrome className="h-5 w-5" />
                Add to Chrome
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href={premiumUpdatesHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-10 py-4 text-lg font-bold text-[#111111] transition-colors hover:border-[#111111]"
              >
                Get premium updates
              </a>
            </div>
          </div>
        </section>

        <section id="support" className="border-t border-gray-200 bg-[#F3F4F6] py-20 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 md:px-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
                Support
              </span>
              <h2 className="landingDisplay mt-5 text-4xl font-black leading-[0.92] tracking-tighter text-[#111111] md:text-5xl">
                Need help with Applendium?
              </h2>
              <p className="mt-5 text-lg leading-8 text-gray-600">
                Send the account email, what you expected to happen, what happened instead,
                and any screenshot or error text that makes the issue reproducible.
              </p>
            </div>

            <div className="grid gap-5 lg:col-span-7 md:grid-cols-2">
              <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(17,17,17,0.35)]">
                <p className="landingMono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  General support
                </p>
                <h3 className="landingDisplay mt-4 text-xl font-bold text-[#0B1220]">
                  support@applendium.com
                </h3>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Installation, sign-in, sync, billing, and account troubleshooting.
                </p>
                <a
                  href="mailto:support@applendium.com?subject=Applendium%20Support"
                  className="mt-5 inline-flex items-center justify-center rounded-md bg-[#111111] px-5 py-3 text-sm font-bold text-white hover:bg-[#10B981]"
                >
                  Email support
                </a>
              </article>

              <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(17,17,17,0.35)]">
                <p className="landingMono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  Privacy requests
                </p>
                <h3 className="landingDisplay mt-4 text-xl font-bold text-[#0B1220]">
                  privacy@applendium.com
                </h3>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Data deletion, Gmail access, and privacy-specific account requests.
                </p>
                <a
                  href="mailto:privacy@applendium.com?subject=Applendium%20Privacy%20Request"
                  className="mt-5 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-[#111111] hover:border-[#111111]"
                >
                  Contact privacy
                </a>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-[#F3F4F6]" data-testid="site-footer">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="mb-4 flex items-center gap-2">
                <BrandMark />
                <span className="landingDisplay text-xl font-extrabold">applendium</span>
              </div>
              <p className="max-w-sm text-sm text-gray-600">
                Gmail job tracker for Chrome. Read-only. No spreadsheets. Built for people
                who are tired of losing track.
              </p>
            </div>

            <div className="md:col-span-2">
              <div className="landingMono mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
                Product
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>
                  <a
                    href={chromeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#10B981]"
                    data-testid="footer-chrome-link"
                  >
                    Chrome Extension
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-[#10B981]">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#premium" className="hover:text-[#10B981]" data-testid="footer-premium-link">
                    Premium roadmap
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <div className="landingMono mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
                Trust
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>
                  <a href="#privacy" className="hover:text-[#10B981]">
                    Privacy
                  </a>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-[#10B981]" data-testid="footer-terms-link">
                    Terms
                  </Link>
                </li>
                <li>
                  <a href="#support" className="hover:text-[#10B981]" data-testid="footer-support-link">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <div className="landingMono mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
                Stay in the loop
              </div>
              <a
                href={premiumUpdatesHref}
                className="landingLinkUnderline inline-flex items-center gap-2 text-sm font-bold text-[#111111] hover:text-[#10B981]"
                data-testid="footer-email-cta"
              >
                support@applendium.com
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-gray-200 pt-6 md:flex-row md:items-center">
            <span className="landingMono text-[11px] tracking-wider text-gray-500">
              (c) {year} Applendium - made for the inbox.
            </span>
            <span className="landingMono text-[11px] uppercase tracking-[0.2em] text-gray-400">
              v1.0 - extension-first
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
