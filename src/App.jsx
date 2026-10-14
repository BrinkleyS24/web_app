import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Privacy from "./pages/Privacy.jsx";
import Goodbye from "./pages/Goodbye.jsx";
import Terms from "./pages/Terms.jsx";
import Upgrade from "./pages/Upgrade.jsx";
import { gateSource } from "./lib/funnel.js";
import Dashboard from "./pages/DashboardNew.tsx";
import PaymentSuccess from "./pages/PaymentSuccess.tsx";
import PaymentCancel from "./pages/PaymentCancel.tsx";
import ApplyGate from "./pages/ApplyGate.tsx";
import Resumes from "./pages/Resumes.tsx";
import FixSuggestions from "./pages/FixSuggestions.tsx";
import InterviewPrep from "./pages/InterviewPrep.tsx";
import StrategyAlerts from "./pages/StrategyAlerts.tsx";
import Settings from "./pages/Settings.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AdminDebug from "./pages/AdminDebug.tsx";
import AdminJobs from "./pages/AdminJobs.tsx";
import AdminReview from "./pages/AdminReview.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import NotFound from "./pages/NotFound.tsx";
import SignedOutWorkspace from "./components/landing/SignedOutWorkspace.jsx";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";

function AccountQueryScope({ children }) {
  const { user } = useAuth();
  const accountId = user?.uid || 'signed-out';
  const queryClient = useMemo(() => new QueryClient(), [accountId]);
  // Remount local form state too. Late requests retain only their old account's cache.
  return <QueryClientProvider key={accountId} client={queryClient}>{children}</QueryClientProvider>;
}

const DASHBOARD_ROUTES = [
  "/admin",
  "/dashboard",
  "/apply-gate",
  "/resumes",
  "/next-actions",
  "/interview-prep",
  "/fix-suggestions",
  "/outcome-memory",
  "/strategy-alerts",
  "/weekly-summary",
  "/settings",
  "/account",
  "/admin/debug",
  "/admin/review",
  "/admin/analytics",
  "/admin/jobs",
  "/admin/users",
];

function LoadingScreen({ restoring = false }) {
  return (
    <div className="container" style={{ paddingTop: 48 }} role="status" aria-live="polite">
      <p className="muted">{restoring ? "Signing you in from the Applendium™ extension..." : "Loading..."}</p>
    </div>
  );
}

// How long a signed-out visitor with no sign of the extension sees "Loading..." before the
// signed-out page replaces it. The bridge check keeps running behind that page (2026-10-14).
export const SIGNED_OUT_GRACE_MS = 1200;

function useElapsed(ms) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}

/**
 * The signed-out decision for workspace routes. On a cold load Firebase reports null once before a
 * session restores, and the extension bridge may still be signing the visitor in, so a signed-in
 * user must never be sent away during that window. Before 2026-10-14 every guard showed "Loading..."
 * until the bridge had retried for up to ~30 s and then redirected to /upgrade. Now:
 *   - "signed-in"  a user is present (plan checks follow in each guard);
 *   - "restoring"  the extension is present and still signing in: keep the spinner;
 *   - "signed-out" the bridge finished with no user, or nothing has answered after a short grace.
 * The signed-out page renders in place, never as a redirect, so a late bridge sign-in still lands
 * the visitor on the page they asked for.
 */
export function useWorkspaceAuthState() {
  const { user, loading, bridgeDone, extensionDetected } = useAuth();
  const graceOver = useElapsed(SIGNED_OUT_GRACE_MS);
  if (user) return "signed-in";
  if (loading) return "loading";
  if (bridgeDone) return "signed-out";
  if (extensionDetected) return "restoring";
  return graceOver ? "signed-out-checking" : "loading";
}

function SignedOutGate({ state, upgradeHref = "/upgrade?source=web_signed_out" }) {
  if (state === "loading" || state === "restoring") return <LoadingScreen restoring={state === "restoring"} />;
  return <SignedOutWorkspace checking={state === "signed-out-checking"} upgradeHref={upgradeHref} />;
}

function RequireNonAdminUser({ children }) {
  const { loading, planLoading, adminEmail } = useAuth();
  const state = useWorkspaceAuthState();

  if (state !== "signed-in") return <SignedOutGate state={state} />;
  if (loading || planLoading) return <LoadingScreen />;
  if (adminEmail) return <Navigate to="/admin/review" replace />;

  return children;
}

function RequirePremiumUser({ children }) {
  const { loading, plan, planLoading, planError, adminEmail } = useAuth();
  const state = useWorkspaceAuthState();
  const location = useLocation();
  // Which Premium page turned this visitor away, so the Upgrade page can attribute the wall.
  const upgradeHref = `/upgrade?source=${gateSource(location.pathname)}`;

  if (state !== "signed-in") return <SignedOutGate state={state} upgradeHref={upgradeHref} />;
  // A signed-in user's plan is still loading: hold, so a premium user isn't sent to /upgrade.
  if (loading || planLoading) return <LoadingScreen />;
  if (adminEmail) return <Navigate to="/admin/review" replace />;

  if (planError && plan !== "premium") {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="error">
          Premium status could not be verified right now. Refresh and try again.
          <div style={{ marginTop: 8 }}>{planError}</div>
        </div>
      </div>
    );
  }

  if (plan !== "premium") {
    return <Navigate to={upgradeHref} replace />;
  }

  return children;
}

function RequireAdminEmail({ children }) {
  const { loading, planLoading, adminEmail } = useAuth();
  const state = useWorkspaceAuthState();

  if (state !== "signed-in") return <SignedOutGate state={state} />;
  if (loading || planLoading) return <LoadingScreen />;

  if (!adminEmail) {
    return <NotFound />;
  }

  return children;
}

export default function App() {
  const location = useLocation();
  const isDashboard = DASHBOARD_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );
  const isPayment = location.pathname.startsWith("/payment");
  const isUpgrade = location.pathname === "/upgrade";
  const isPublicSite = location.pathname === "/" || location.pathname === "/privacy" || location.pathname === "/terms" || location.pathname === "/support" || location.pathname === "/goodbye";
  const containerClass = (isDashboard || isPayment || isUpgrade)
    ? "container container--full"
    : (isPublicSite ? "container container--full" : "container");

  return (
    <AuthProvider>
      <AccountQueryScope>
        <TooltipProvider>
          <Toaster />
          <div className={containerClass}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<Navigate to="/upgrade" replace />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* Opened by Chrome when the extension is removed (ext 2.1.7). Public: no account needed. */}
              <Route path="/goodbye" element={<Goodbye />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/support" element={<Navigate to="/#support" replace />} />
              <Route
                path="/account"
                element={
                  <RequireNonAdminUser>
                    <Navigate to="/settings" replace />
                  </RequireNonAdminUser>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequirePremiumUser>
                    <Dashboard />
                  </RequirePremiumUser>
                }
              />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
              <Route
                path="/apply-gate"
                element={
                  <RequirePremiumUser>
                    <ApplyGate />
                  </RequirePremiumUser>
                }
              />
              <Route
                path="/resumes"
                element={
                  <RequireNonAdminUser>
                    <Resumes />
                  </RequireNonAdminUser>
                }
              />
              <Route
                path="/next-actions"
                element={
                  <RequirePremiumUser>
                    <FixSuggestions />
                  </RequirePremiumUser>
                }
              />
              <Route path="/interview-prep" element={<RequirePremiumUser><InterviewPrep /></RequirePremiumUser>} />
              {/* Old URLs stay valid. Next Actions used to live at /fix-suggestions, and Outcome
                  Memory's one current finding (skill gaps across checked roles) now lives on
                  Strategy Alerts, so bookmarks and old links land somewhere real. */}
              <Route path="/fix-suggestions" element={<Navigate to="/next-actions" replace />} />
              <Route path="/outcome-memory" element={<Navigate to="/strategy-alerts" replace />} />
              <Route
                path="/strategy-alerts"
                element={
                  <RequirePremiumUser>
                    <StrategyAlerts />
                  </RequirePremiumUser>
                }
              />
              {/* Folded into Next Actions (2026-10-04); old links and emails land on the week card. */}
              <Route path="/weekly-summary" element={<Navigate to="/next-actions#this-week" replace />} />
              <Route
                path="/settings"
                element={
                  <RequireNonAdminUser>
                    <Settings />
                  </RequireNonAdminUser>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAdminEmail>
                    <Navigate to="/admin/review" replace />
                  </RequireAdminEmail>
                }
              />
              <Route
                path="/admin/review"
                element={
                  <RequireAdminEmail>
                    <AdminReview />
                  </RequireAdminEmail>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <RequireAdminEmail>
                    <AdminAnalytics />
                  </RequireAdminEmail>
                }
              />
              <Route
                path="/admin/jobs"
                element={
                  <RequireAdminEmail>
                    <AdminJobs />
                  </RequireAdminEmail>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireAdminEmail>
                    <AdminUsers />
                  </RequireAdminEmail>
                }
              />
              <Route
                path="/admin/debug"
                element={
                  <RequireAdminEmail>
                    <AdminDebug />
                  </RequireAdminEmail>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </TooltipProvider>
      </AccountQueryScope>
    </AuthProvider>
  );
}
