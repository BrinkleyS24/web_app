import React, { useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Upgrade from "./pages/Upgrade.jsx";
import { gateSource } from "./lib/funnel.js";
import Dashboard from "./pages/DashboardNew.tsx";
import PaymentSuccess from "./pages/PaymentSuccess.tsx";
import PaymentCancel from "./pages/PaymentCancel.tsx";
import ApplyGate from "./pages/ApplyGate.tsx";
import Resumes from "./pages/Resumes.tsx";
import FixSuggestions from "./pages/FixSuggestions.tsx";
import StrategyAlerts from "./pages/StrategyAlerts.tsx";
import Settings from "./pages/Settings.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AdminDebug from "./pages/AdminDebug.tsx";
import AdminJobs from "./pages/AdminJobs.tsx";
import AdminReview from "./pages/AdminReview.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import NotFound from "./pages/NotFound.tsx";
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

function LoadingScreen() {
  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <p className="muted">Loading...</p>
    </div>
  );
}

function RequireNonAdminUser({ children }) {
  const { user, loading, bridgeDone, planLoading, adminEmail } = useAuth();

  // On a cold load of a gated route, Firebase emits null once before the session
  // restores and the extension bridge re-authenticates. Wait for that to settle
  // before deciding the user is signed out — otherwise a real signed-in user gets
  // bounced to /upgrade on hard refresh / deep link.
  if (loading || planLoading || (!user && !bridgeDone)) return <LoadingScreen />;
  if (!user) return <Navigate to="/upgrade" replace />;
  if (adminEmail) return <Navigate to="/admin/review" replace />;

  return children;
}

function RequirePremiumUser({ children }) {
  const { user, loading, bridgeDone, plan, planLoading, planError, adminEmail } = useAuth();
  const location = useLocation();
  // Which Premium page turned this visitor away, so the Upgrade page can attribute the wall.
  const upgradeHref = `/upgrade?source=${gateSource(location.pathname)}`;

  // See RequireNonAdminUser: hold the loading state until auth has settled so a
  // premium user isn't redirected to /upgrade during the auth-restore window.
  if (loading || planLoading || (!user && !bridgeDone)) return <LoadingScreen />;
  if (!user) return <Navigate to={upgradeHref} replace />;
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
  const { user, loading, bridgeDone, planLoading, adminEmail } = useAuth();

  if (loading || planLoading || (!user && !bridgeDone)) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/upgrade" replace />;
  }

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
  const isPublicSite = location.pathname === "/" || location.pathname === "/privacy" || location.pathname === "/terms" || location.pathname === "/support";
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
