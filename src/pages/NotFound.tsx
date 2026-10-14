import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import PublicShell from "../components/landing/PublicShell.jsx";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access:", location.pathname);
  }, [location.pathname]);

  // Uses the public shell (2026-10-14) so a mistyped link still has the site nav and footer.
  return (
    <PublicShell>
      <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
        <p className="landingMono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0A7A55]">404</p>
        <h1 className="landingDisplay text-4xl font-bold tracking-[-0.03em]">Page not found</h1>
        <p className="text-base leading-relaxed text-[#5C6470]">That link does not go anywhere on Applendium™.</p>
        <Link
          to="/"
          className="landingButtonDark inline-flex min-h-[44px] items-center rounded-lg bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7A55]"
        >
          Return to home
        </Link>
      </main>
    </PublicShell>
  );
};

export default NotFound;
