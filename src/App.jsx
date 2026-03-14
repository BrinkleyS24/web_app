import React from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/DashboardNew.tsx";
import Upgrade from "./pages/Upgrade.tsx";
import ApplyGate from "./pages/ApplyGate.tsx";
import FixSuggestions from "./pages/FixSuggestions.tsx";
import OutcomeMemory from "./pages/OutcomeMemory.tsx";
import StrategyAlerts from "./pages/StrategyAlerts.tsx";
import WeeklySummary from "./pages/WeeklySummary.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";

const queryClient = new QueryClient();

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/apply-gate",
  "/fix-suggestions",
  "/outcome-memory",
  "/strategy-alerts",
  "/weekly-summary",
  "/settings",
];

function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <NotFound />;
  }

  return children;
}

function RequirePremium({ children }) {
  const { user, loading, plan, planLoading } = useAuth();

  if (loading || planLoading) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <NotFound />;
  }

  if (plan !== "premium") {
    return <Navigate to="/upgrade" replace />;
  }

  return children;
}

export default function App() {
  const location = useLocation();
  const isDashboard = DASHBOARD_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );
  const isUpgrade = location.pathname.startsWith("/upgrade");
  const containerClass = (isDashboard || isUpgrade)
    ? "container container--full"
    : "container";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <div className={containerClass}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/pricing" element={<Navigate to="/upgrade" replace />} />
              <Route
                path="/account"
                element={
                  <RequireAuth>
                    <Account />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequirePremium>
                    <Dashboard />
                  </RequirePremium>
                }
              />
              <Route
                path="/upgrade"
                element={
                  <RequireAuth>
                    <Upgrade />
                  </RequireAuth>
                }
              />
              <Route
                path="/apply-gate"
                element={
                  <RequirePremium>
                    <ApplyGate />
                  </RequirePremium>
                }
              />
              <Route
                path="/fix-suggestions"
                element={
                  <RequirePremium>
                    <FixSuggestions />
                  </RequirePremium>
                }
              />
              <Route
                path="/outcome-memory"
                element={
                  <RequirePremium>
                    <OutcomeMemory />
                  </RequirePremium>
                }
              />
              <Route
                path="/strategy-alerts"
                element={
                  <RequirePremium>
                    <StrategyAlerts />
                  </RequirePremium>
                }
              />
              <Route
                path="/weekly-summary"
                element={
                  <RequirePremium>
                    <WeeklySummary />
                  </RequirePremium>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
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
