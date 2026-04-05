import React from "react";
import { Link, NavLink } from "react-router-dom";

const CHROME_WEB_STORE_URL = (import.meta.env.VITE_CHROME_WEB_STORE_URL || "").trim();

function ExternalOrInternalCta({ className, label }) {
  if (CHROME_WEB_STORE_URL) {
    return (
      <a
        className={className}
        href={CHROME_WEB_STORE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    );
  }

  return (
    <Link className={className} to="/app">
      {label}
    </Link>
  );
}

export default function PublicSiteLayout({ children }) {
  return (
    <div className="publicSiteShell">
      <div className="publicSiteBackdrop" aria-hidden="true" />
      <header className="publicSiteHeader">
        <div className="publicSiteHeaderInner">
          <Link className="publicBrand" to="/">
            <span className="publicBrandMark" aria-hidden="true">
              <img className="publicBrandMarkImage" src="/favicon.png" alt="" />
            </span>
            <span>Applendium</span>
          </Link>

          <nav className="publicNav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Home
            </NavLink>
            <NavLink
              to="/privacy"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Privacy
            </NavLink>
            <NavLink
              to="/support"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Support
            </NavLink>
            <NavLink
              to="/upgrade"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Premium
            </NavLink>
            <NavLink
              to="/app"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Companion App
            </NavLink>
          </nav>

          <div className="publicHeaderActions">
            <ExternalOrInternalCta
              className="publicButton publicButtonPrimary"
              label={CHROME_WEB_STORE_URL ? "Install Extension" : "Open Companion App"}
            />
          </div>
        </div>
      </header>

      <main className="publicSiteMain">{children}</main>

      <footer className="publicFooter">
        <div className="publicFooterInner">
          <div className="publicFooterBrand">
            <p className="publicFooterEyebrow">Applendium</p>
            <p className="publicFooterCopy">
              The Gmail extension is live. Premium dashboard workflows are still in active build.
            </p>
          </div>

          <div className="publicFooterLinks">
            <div>
              <p className="publicFooterHeading">Company</p>
              <Link to="/">Home</Link>
              <Link to="/upgrade">Premium Status</Link>
              <Link to="/app">Companion App</Link>
            </div>
            <div>
              <p className="publicFooterHeading">Legal</p>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/support">Support</Link>
            </div>
            <div>
              <p className="publicFooterHeading">Contact</p>
              <a href="mailto:support@applendium.com">support@applendium.com</a>
              <a href="mailto:privacy@applendium.com">privacy@applendium.com</a>
            </div>
          </div>
        </div>

        <div className="publicFooterMeta">
          <span>(c) {new Date().getFullYear()} Applendium</span>
          <span>Built for Gmail-based application tracking.</span>
        </div>
      </footer>
    </div>
  );
}
