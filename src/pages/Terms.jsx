import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Chrome } from "lucide-react";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { premiumUpdatesHref } from "../lib/premiumLaunchContent.js";

const sections = [
  {
    title: "Using Applendium",
    items: [
      "Applendium helps users track job applications by connecting to Gmail with user-authorized, read-only access.",
      "You are responsible for keeping your Google account, browser profile, and Applendium account access secure.",
      "You may use Applendium only if you can legally agree to these terms and comply with applicable laws.",
    ],
  },
  {
    title: "Google and Gmail access",
    items: [
      "Applendium requests Gmail read-only access so it can identify, classify, and display job-application-related emails.",
      "Applendium does not need permission to send, delete, or modify Gmail messages for the current extension workflow.",
      "You can revoke Applendium's Google access from your Google Account permissions at any time.",
    ],
  },
  {
    title: "Classification accuracy",
    items: [
      "Applendium uses automated classification to group emails by application stage, including applied, interview, offer, rejected, and irrelevant.",
      "Automated classification may be incomplete or incorrect, so review important emails directly in Gmail before making job-search decisions.",
      "Correction and support workflows may be used to improve product quality, investigate issues, and reduce future misclassification risk.",
    ],
  },
  {
    title: "Accounts and acceptable use",
    items: [
      "Do not misuse the service, interfere with its operation, attempt unauthorized access, or use Applendium to process data you do not have rights to access.",
      "Applendium may limit or suspend access if an account creates security, abuse, operational, or legal risk.",
      "If you want account deletion or data removal, contact the support or privacy address listed below.",
    ],
  },
  {
    title: "Premium and billing",
    items: [
      "The Chrome extension is free. Premium unlocks the web workspace for Apply Gate and weekly search-health summaries.",
      "Pricing, renewal, cancellation, and refund details are shown before purchase.",
      "Payment details, when applicable, are handled by the payment processor rather than stored directly by Applendium.",
    ],
  },
  {
    title: "Data and privacy",
    items: [
      "Applendium's data practices are described in the privacy section and any posted Privacy Policy, including Gmail-derived data, retention, support, and deletion requests.",
      "Applendium does not sell Gmail data or personal information.",
      "Service providers may process data only as needed to operate authentication, hosting, database, support, analytics, or billing infrastructure.",
    ],
  },
  {
    title: "Service changes",
    items: [
      "Applendium may update, limit, suspend, or discontinue features as the product evolves.",
      "These terms may be updated from time to time. Material changes will be posted on this page with a revised effective date.",
      "Continued use of Applendium after updated terms are posted means you accept the updated terms.",
    ],
  },
  {
    title: "Disclaimers and liability",
    items: [
      "Applendium is provided as a productivity tool and does not guarantee job outcomes, interview outcomes, employer responses, or uninterrupted service.",
      "To the fullest extent permitted by law, Applendium is not liable for indirect, incidental, special, consequential, or punitive damages.",
      "Nothing in these terms limits rights that cannot be limited under applicable law.",
    ],
  },
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

export default function Terms() {
  const chromeHref = CHROME_WEB_STORE_URL || premiumUpdatesHref;
  const year = new Date().getFullYear();

  usePageMetadata({
    title: "Applendium | Terms of Service",
    description:
      "Read the Applendium Terms of Service for the Chrome extension, Gmail read-only access, account use, classification limitations, support, and premium status.",
  });

  return (
    <div className="landingPage min-h-screen bg-[#fdfdfc] text-[#111111]">
      <header className="sticky top-0 z-50 w-full bg-[#fdfdfc]/85 backdrop-blur" data-testid="site-header">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
          <Link to="/" className="group flex items-center gap-2" data-testid="logo-link">
            <BrandMark />
            <span className="landingDisplay text-xl font-extrabold tracking-tight">applendium</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <Link to="/#how-it-works" className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black">
              How it works
            </Link>
            <Link to="/#features" className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black">
              Features
            </Link>
            <Link to="/upgrade" className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black">
              Premium
            </Link>
            <Link to="/#privacy" className="landingLinkUnderline text-sm font-medium text-gray-700 hover:text-black">
              Privacy
            </Link>
            <Link to="/terms" className="landingLinkUnderline text-sm font-semibold text-black">
              Terms
            </Link>
          </nav>

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
          <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
            <span className="landingMono text-xs font-bold uppercase tracking-[0.24em] text-[#10B981]">
              Terms of Service
            </span>
            <h1 className="landingDisplay mt-6 max-w-4xl text-5xl font-black leading-[0.9] tracking-tighter text-[#111111] md:text-7xl">
              Terms for using Applendium.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600 md:text-xl">
              Effective date: April 11, 2026. These terms explain how you may use
              Applendium, what the Gmail-connected extension does, and what limits apply to
              automated classification and future premium features.
            </p>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
              By using Applendium, you agree to these terms. If you do not agree, do not use
              the extension or related Applendium services.
            </p>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-[#F3F4F6] py-16 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-5 px-6 md:px-10 lg:grid-cols-2">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(17,17,17,0.35)]"
              >
                <h2 className="landingDisplay text-xl font-bold tracking-tight text-[#0B1220]">
                  {section.title}
                </h2>
                <ul className="mt-4 space-y-3 text-base leading-7 text-gray-600">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B981]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-5 px-6 md:px-10 lg:grid-cols-2">
            <article className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="landingMono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                Support
              </p>
              <h2 className="landingDisplay mt-4 text-2xl font-bold text-[#111111]">
                Questions or deletion requests
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600">
                For account support, email{" "}
                <a className="font-bold text-[#111111] hover:text-[#10B981]" href="mailto:support@applendium.com">
                  support@applendium.com
                </a>
                . For privacy, data access, or deletion requests, email{" "}
                <a className="font-bold text-[#111111] hover:text-[#10B981]" href="mailto:privacy@applendium.com">
                  privacy@applendium.com
                </a>
                .
              </p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-[#111111] p-6 text-white">
              <p className="landingMono text-[10px] font-bold uppercase tracking-[0.2em] text-[#10B981]">
                Back to product
              </p>
              <h2 className="landingDisplay mt-4 text-2xl font-bold">
                Review the extension-first launch page.
              </h2>
              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-[#111111] hover:bg-[#10B981] hover:text-white"
              >
                Return home
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-[#F3F4F6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
          <span className="landingMono text-[11px] tracking-wider text-gray-500">
            (c) {year} Applendium - made for the inbox.
          </span>
          <Link to="/#support" className="landingMono text-[11px] uppercase tracking-[0.2em] text-gray-500 hover:text-[#10B981]">
            Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
