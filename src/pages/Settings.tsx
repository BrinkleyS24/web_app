import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ResumePrompt } from "@/components/ResumePrompt";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  User,
} from "lucide-react";

type SubscriptionStatus = {
  plan?: string;
  status?: string;
  current_period_end?: string | number | null;
  cancel_at_period_end?: boolean;
  subscription_id?: string;
  billingPortalAvailable?: boolean;
  billingSource?: string;
};

type SubscriptionResponse = {
  subscription?: SubscriptionStatus;
  quotaData?: {
    monthlyProcessed?: number;
    limit?: number;
    lastReset?: string;
  };
};

function formatDate(value: unknown) {
  if (!value) return "";
  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function Settings() {
  const { user, plan, planLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [subStatus, setSubStatus] = useState<SubscriptionResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [busyPortal, setBusyPortal] = useState(false);

  async function fetchSubStatus() {
    if (!user) {
      setSubStatus(null);
      return;
    }

    setSubError("");
    setSubLoading(true);
    try {
      const resp = await apiFetch("/api/subscriptions/status", { method: "GET" });
      setSubStatus(resp || null);
    } catch (error: any) {
      setSubError(error?.message || "Failed to load subscription status.");
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
    } catch (error: any) {
      setSubError(error?.message || "Billing portal is not available for this account yet.");
    } finally {
      setBusyPortal(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchSubStatus();
  }, [user?.uid]);

  async function handleSignOut() {
    await logout();
    navigate("/upgrade", { replace: true });
  }

  const subscription = subStatus?.subscription || null;
  const effectivePlan = subscription?.plan || plan;
  const isPremium = effectivePlan === "premium";
  const isActive = subscription
    ? subscription.status === "active" || subscription.status === "trialing"
    : isPremium;
  const statusLabel = subscription?.status || (subLoading ? "loading" : isPremium ? "active" : "inactive");
  const renewalDate = formatDate(subscription?.current_period_end);
  const monthlyLimit = subStatus?.quotaData?.limit ?? (isPremium ? 10000 : 100);
  const monthlyProcessed = subStatus?.quotaData?.monthlyProcessed ?? 0;
  const billingPortalAvailable = Boolean(subscription?.billingPortalAvailable);
  const accountInitials = (() => {
    const name = String(user?.displayName || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
    }
    const email = String(user?.email || "").trim();
    return email ? email[0].toUpperCase() : "?";
  })();
  const accountName = String(user?.displayName || "").trim() || String(user?.email || "").trim() || "Your account";
  const accountPlanLabel = planLoading ? "…" : isPremium ? "Premium" : "Free";
  const accountSecondary =
    user?.displayName && user?.email ? `${user.email} · ${accountPlanLabel}` : accountPlanLabel;

  const accountCards = useMemo(
    () => [
      {
        label: "Plan",
        value: planLoading ? "Loading..." : isPremium ? "Premium" : "Free",
        body: isPremium
          ? "Apply Gate, weekly search health, and the premium workspace are unlocked."
          : "The Chrome extension remains free. Premium unlocks the web workspace.",
        icon: Crown,
      },
      {
        label: "Status",
        value: statusLabel,
        body: isActive
          ? "Your subscription is active."
          : "No active Premium subscription is attached to this account.",
        icon: CheckCircle2,
      },
      {
        label: "Monthly limit",
        value: Number.isFinite(monthlyLimit) ? Number(monthlyLimit).toLocaleString() : "--",
        body: `${Number(monthlyProcessed).toLocaleString()} processed this period.`,
        icon: CreditCard,
      },
    ],
    [isActive, isPremium, monthlyLimit, monthlyProcessed, planLoading, statusLabel]
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-3.5">
        <div className="mb-2">
          <h1 className="text-[28px] font-bold tracking-[-0.025em] text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account, resume, and subscription in one place.
          </p>
        </div>

        <section className="glass-card space-y-4 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Account</h2>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {accountInitials}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{accountName}</p>
                <p className="text-xs text-muted-foreground">{accountSecondary}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Resume / Profile</h2>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Your resume is used by Apply Gate and Pre-jection to compare your experience
            against job postings. Without it we can only infer skills from your application history.
          </p>
          <ResumePrompt />
        </section>

        <section className="glass-card space-y-5 rounded-2xl p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Subscription</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Billing, access, and usage for this account.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={fetchSubStatus}
              disabled={subLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${subLoading ? "animate-spin" : ""}`} />
              {subLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {accountCards.map(({ label, value, body, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
                  </div>
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          {subLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription details...
            </div>
          ) : subStatus ? (
            <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <p className="font-semibold uppercase tracking-widest text-muted-foreground">Renewal</p>
                <p className="mt-2 font-medium text-foreground">
                  {renewalDate || "No renewal date available"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <p className="font-semibold uppercase tracking-widest text-muted-foreground">Cancellation</p>
                <p className="mt-2 font-medium text-foreground">
                  {subscription?.cancel_at_period_end ? "Cancels at period end" : "No cancellation scheduled"}
                </p>
              </div>
            </div>
          ) : null}

          {subError ? <p className="text-xs text-red-500">{subError}</p> : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isPremium && billingPortalAvailable ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busyPortal}
                onClick={openPortal}
              >
                {busyPortal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                {busyPortal ? "Opening..." : "Manage Billing"}
              </Button>
            ) : isPremium ? (
              <p className="text-xs text-muted-foreground">
                Premium access is active. Billing portal management is not available for this account.
              </p>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => navigate("/upgrade")}>
                <Crown className="h-3.5 w-3.5" />
                Upgrade to Premium
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Payment details are handled by Stripe. Applendium does not store card numbers.
            </p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
