import { RefreshCw, ScanSearch } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { BUTTON } from "@/components/premium/tone";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxSync } from "@/hooks/useInboxSync";
import { useAuth } from "@/lib/AuthContext.jsx";
import { cn } from "@/lib/utils";

/**
 * The bar above every premium page. It held only the sidebar toggle — 56px of nothing on every
 * screen (review, 2026-09-26). It now carries the two things worth reaching from anywhere: how fresh
 * the inbox is (with Sync now), and Apply Gate, which had no use by anyone in the 30 days before the
 * review partly because it lived one menu item away from where people decide to apply.
 *
 * Read-only on sync: the automatic 15-minute check stays on the Dashboard alone, so two instances of
 * useInboxSync never both start one.
 */
export function AppTopBar() {
  const { user, plan } = useAuth() as { user?: { uid?: string } | null; plan?: string | null };
  const location = useLocation();
  const premium = plan === "premium";
  const inbox = useInboxSync(premium ? user?.uid : null, { auto: false });

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger />
      {premium ? (
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12px] text-muted-foreground sm:inline" aria-live="polite">
            {inbox.isSyncing ? "Checking your inbox…" : inbox.lastCheckedLabel ? `Inbox checked ${inbox.lastCheckedLabel}` : null}
          </span>
          <button type="button" onClick={inbox.syncNow} disabled={inbox.isSyncing} className={BUTTON.ghost}>
            <RefreshCw className={cn("h-3.5 w-3.5", inbox.isSyncing && "animate-spin")} aria-hidden />
            Sync now
          </button>
          {location.pathname !== "/apply-gate" ? (
            <Link to="/apply-gate" className={cn(BUTTON.primary, "px-3 py-1.5")}>
              <ScanSearch className="h-3.5 w-3.5" aria-hidden />
              Check a job
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
