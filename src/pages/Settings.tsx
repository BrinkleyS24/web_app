import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ResumePrompt } from "@/components/ResumePrompt";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Crown,
  CreditCard,
  FileText,
  User,
  Loader2,
  ExternalLink,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, plan, planLoading, logout } = useAuth();
  const navigate = useNavigate();

  // ── Subscription status ─────────────────────────────────────
  const [subStatus, setSubStatus] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [busyPortal, setBusyPortal] = useState(false);

  async function fetchSubStatus() {
    setSubError("");
    setSubLoading(true);
    try {
      const resp = await apiFetch("/api/subscriptions/status", { method: "GET" });
      setSubStatus(resp || null);
    } catch (e: any) {
      setSubError(e?.message || "Failed to load subscription status.");
    } finally {
      setSubLoading(false);
    }
  }

  async function openPortal() {
    setSubError("");
    setBusyPortal(true);
    try {
      const resp = await apiFetch("/api/subscriptions/create-portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const url = resp?.url;
      if (!url) throw new Error("Backend did not return a portal URL.");
      window.location.assign(url);
    } catch (e: any) {
      setSubError(e?.message || "Failed to open billing portal.");
    } finally {
      setBusyPortal(false);
    }
  }

  useEffect(() => {
    fetchSubStatus();
  }, []);

  async function handleSignOut() {
    await logout();
    navigate("/app");
  }

  const isPremium = plan === "premium";

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl">
        {/* ── Header ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your profile, resume, and subscription.
          </p>
        </div>

        {/* ── Account section ─────────────────────────────────── */}
        <section className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Account</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm text-foreground">{user?.email || "—"}</p>
              <p className="text-xs text-muted-foreground">
                Firebase UID: {user?.uid?.slice(0, 12)}…
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSignOut}>
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </section>

        {/* ── Resume / Profile section ────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Resume / Profile</h2>
          </div>
          <p className="text-xs text-muted-foreground px-1 -mt-1">
            Your resume is used by Apply Gate and Pre-jection to compare your
            experience against job postings. Without it we can only infer
            skills from your application history.
          </p>
          <ResumePrompt />
        </section>

        {/* ── Subscription section ────────────────────────────── */}
        <section className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Subscription</h2>
          </div>

          {/* Plan badge */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isPremium
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              {planLoading ? "Loading…" : isPremium ? "Premium" : "Free"}
            </div>
            {isPremium && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </span>
            )}
          </div>

          {/* Status details */}
          {subLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading subscription details…
            </div>
          ) : subStatus ? (
            <div className="text-xs text-muted-foreground space-y-1">
              {subStatus.status && (
                <p>
                  Status: <span className="font-medium text-foreground capitalize">{subStatus.status}</span>
                </p>
              )}
              {subStatus.current_period_end && (
                <p>
                  Renews:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(subStatus.current_period_end * 1000).toLocaleDateString()}
                  </span>
                </p>
              )}
            </div>
          ) : null}

          {subError && (
            <p className="text-xs text-red-500">{subError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {isPremium ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busyPortal}
                onClick={openPortal}
              >
                {busyPortal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                {busyPortal ? "Opening…" : "Manage Billing"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/upgrade")}
              >
                <Crown className="w-3.5 h-3.5" />
                Upgrade to Premium
              </Button>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
