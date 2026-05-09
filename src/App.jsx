import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Upgrade from "./pages/Upgrade.jsx";
import Dashboard from "./pages/DashboardNew.tsx";
import PaymentSuccess from "./pages/PaymentSuccess.tsx";
import PaymentCancel from "./pages/PaymentCancel.tsx";
import ApplyGate from "./pages/ApplyGate.tsx";
import FixSuggestions from "./pages/FixSuggestions.tsx";
import OutcomeMemory from "./pages/OutcomeMemory.tsx";
import StrategyAlerts from "./pages/StrategyAlerts.tsx";
import WeeklySummary from "./pages/WeeklySummary.tsx";
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

const queryClient = new QueryClient();

const DASHBOARD_ROUTES = [
  "/admin",
  "/dashboard",
  "/apply-gate",
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
  const { user, loading, planLoading, adminEmail } = useAuth();

  if (loading || planLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/upgrade" replace />;
  if (adminEmail) return <Navigate to="/admin/review" replace />;

  return children;
}

function RequirePremiumUser({ children }) {
  const { user, loading, plan, planLoading, planError, adminEmail } = useAuth();

  if (loading || planLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/upgrade" replace />;
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
    return <Navigate to="/upgrade" replace />;
  }

  return children;
}

function RequireAdminEmail({ children }) {
  const { user, loading, planLoading, adminEmail } = useAuth();

  if (loading || planLoading) return <LoadingScreen />;

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
                path="/fix-suggestions"
                element={
                  <RequirePremiumUser>
                    <FixSuggestions />
                  </RequirePremiumUser>
                }
              />
              <Route
                path="/outcome-memory"
                element={
                  <RequirePremiumUser>
                    <OutcomeMemory />
                  </RequirePremiumUser>
                }
              />
              <Route
                path="/strategy-alerts"
                element={
                  <RequirePremiumUser>
                    <StrategyAlerts />
                  </RequirePremiumUser>
                }
              />
              <Route
                path="/weekly-summary"
                element={
                  <RequirePremiumUser>
                    <WeeklySummary />
                  </RequirePremiumUser>
                }
              />
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
