import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  CHROME_EXTENSION_IS_LIVE,
  CHROME_STORE_CTA_LABEL,
  CHROME_WEB_STORE_URL,
  WEB_WORKSPACE_IS_PUBLIC,
} from "../lib/publicSiteConfig.js";

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
    <Link className={className} to={WEB_WORKSPACE_IS_PUBLIC ? "/app" : "/support"}>
      {label}
    </Link>
  );
}

export default function PublicSiteLayout({ children }) {
  const { user, plan, planLoading, adminEmail, logout } = useAuth();
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const premiumEntryPath = !planLoading && adminEmail
    ? "/admin/review"
    : (!planLoading && plan === "premium" ? "/dashboard" : "/upgrade");

  async function handleSignOut() {
    setSignOutError("");
    setSignOutBusy(true);

    try {
      await logout();
    } catch (error) {
      setSignOutError(error?.message || "Sign-out failed.");
    } finally {
      setSignOutBusy(false);
    }
  }

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
              to="/terms"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Terms
            </NavLink>
            <NavLink
              to="/support"
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Support
            </NavLink>
            <NavLink
              to={premiumEntryPath}
              className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
            >
              Premium
            </NavLink>
            {WEB_WORKSPACE_IS_PUBLIC ? (
              <NavLink
                to="/app"
                className={({ isActive }) => `publicNavLink ${isActive ? "publicNavLinkActive" : ""}`.trim()}
              >
                Web Workspace
              </NavLink>
            ) : null}
          </nav>

          <div className="publicHeaderActions">
            {user ? (
              <>
                {signOutError ? (
                  <span className="publicHeaderError" role="alert">
                    {signOutError}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="publicButton publicButtonSecondary publicSignOutButton"
                  onClick={handleSignOut}
                  disabled={signOutBusy}
                >
                  {signOutBusy ? "Signing out..." : "Sign out"}
                </button>
              </>
            ) : null}
            <ExternalOrInternalCta
              className="publicButton publicButtonPrimary"
              label={CHROME_WEB_STORE_URL ? CHROME_STORE_CTA_LABEL : "Get support"}
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
              {CHROME_EXTENSION_IS_LIVE
                ? "The Chrome extension is live. Premium dashboard workflows are still in active build."
                : "The Chrome Web Store listing is under review. Premium dashboard workflows are still in active build."}
            </p>
          </div>

          <div className="publicFooterLinks">
            <div>
              <p className="publicFooterHeading">Company</p>
              <Link to="/">Home</Link>
              <Link to={premiumEntryPath}>{adminEmail || plan === "premium" ? "Dashboard" : "Premium Status"}</Link>
              {CHROME_WEB_STORE_URL ? (
                <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
                  Chrome Store
                </a>
              ) : null}
              {WEB_WORKSPACE_IS_PUBLIC ? <Link to="/app">Web Workspace</Link> : null}
            </div>
            <div>
              <p className="publicFooterHeading">Legal</p>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
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
