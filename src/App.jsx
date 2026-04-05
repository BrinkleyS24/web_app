import React from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Landing from "./pages/Landing.jsx";
import Privacy from "./pages/Privacy.jsx";
import Support from "./pages/Support.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/DashboardNew.tsx";
import Upgrade from "./pages/Upgrade.tsx";
import ApplyGate from "./pages/ApplyGate.tsx";
import FixSuggestions from "./pages/FixSuggestions.tsx";
import OutcomeMemory from "./pages/OutcomeMemory.tsx";
import StrategyAlerts from "./pages/StrategyAlerts.tsx";
import WeeklySummary from "./pages/WeeklySummary.tsx";
import Settings from "./pages/Settings.tsx";
import AdminDebug from "./pages/AdminDebug.tsx";
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
  "/admin/debug",
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
  if (!user) return <NotFound />;
  if (adminEmail) return <Navigate to="/admin/debug" replace />;

  return children;
}

function RequirePremiumUser({ children }) {
  const { user, loading, plan, planLoading, planError, adminEmail } = useAuth();

  if (loading || planLoading) return <LoadingScreen />;
  if (!user) return <NotFound />;
  if (adminEmail) return <Navigate to="/admin/debug" replace />;

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

  if (!user || !adminEmail) {
    return <NotFound />;
  }

  return children;
}

export default function App() {
  const location = useLocation();
  const isDashboard = DASHBOARD_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );
  const isUpgrade = location.pathname.startsWith("/upgrade");
  const isPublicSite = location.pathname === "/" || location.pathname === "/privacy" || location.pathname === "/support";
  const containerClass = (isDashboard || isUpgrade)
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
              <Route path="/app" element={<Home />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/support" element={<Support />} />
              <Route path="/pricing" element={<Navigate to="/upgrade" replace />} />
              <Route
                path="/account"
                element={
                  <RequireNonAdminUser>
                    <Account />
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
              <Route
                path="/upgrade"
                element={<Upgrade />}
              />
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
                    <Navigate to="/admin/debug" replace />
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

function TopLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `pill ${isActive ? "pillActive" : ""}`.trim()
      }
    >
      {label}
    </NavLink>
  );
}
