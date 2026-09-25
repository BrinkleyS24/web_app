import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorState, LoadingRows, PageHeader, Panel, PanelLink, StatTile } from "@/components/premium/PremiumUI";
import { BUTTON, EYEBROW } from "@/components/premium/tone";
import { Switch } from "@/components/ui/switch";
import { fetchResumeVariants } from "@/lib/emails";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  MessageSquareText,
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

type CoachPreference = {
  /** The user's choice: does the coach get to speak? */
  enabled?: boolean;
  /** Whether that choice currently has any effect (premium + backend flag on). */
  available?: boolean;
  premium?: boolean;
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
  const [coachPref, setCoachPref] = useState<CoachPreference | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachError, setCoachError] = useState("");

  async function fetchCoachPreference() {
    if (!user) {
      setCoachPref(null);
      return;
    }
    setCoachError("");
    setCoachLoading(true);
    try {
      const resp = await apiFetch("/api/user/coach-preference", { method: "GET" });
      setCoachPref(resp || null);
    } catch (error: any) {
      setCoachError(error?.message || "Failed to load your coach settings.");
    } finally {
      setCoachLoading(false);
    }
  }

  async function saveCoachPreference(nextEnabled: boolean) {
    const previous = coachPref;
    setCoachError("");
    setCoachSaving(true);
    // Optimistic: the switch should move under the finger, not after a round trip.
    setCoachPref((current) => ({ ...(current || {}), enabled: nextEnabled }));
    try {
      const resp = await apiFetch("/api/user/coach-preference", {
        method: "POST",
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      setCoachPref(resp || null);
    } catch (error: any) {
      setCoachPref(previous);
      setCoachError(error?.message || "Failed to save your coach settings.");
    } finally {
      setCoachSaving(false);
    }
  }

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
    fetchCoachPreference();
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
  const monthlyLimit = subStatus?.quotaData?.limit ?? (isPremium ? 10000 : 500);
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

  const statusText = (() => {
    const status = String(statusLabel || "").toLowerCase();
    if (status === "loading") return "Checking…";
    if (status === "active") return "Active";
    if (status === "trialing") return "Trial";
    if (status === "past_due") return "Payment due";
    if (status === "canceled") return "Canceled";
    return "Not active";
  })();

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        <PageHeader title="Settings" description="Your account, résumés, coach voice and billing." />

        <Panel title="Account" icon={User}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {accountInitials}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{accountName}</p>
                <p className="truncate text-[13px] text-muted-foreground">{accountSecondary}</p>
              </div>
            </div>
            <button type="button" className={BUTTON.secondary} onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </Panel>

        {isPremium ? <ResumesSummaryPanel /> : null}

        {isPremium ? (
          <Panel title="Coach voice" icon={MessageSquareText} id="coach-voice">
            <div data-testid="coach-voice-settings" className="space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    Write your next-step suggestions in plain language instead of a fixed template.
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    When this is on, Applendium sends the structured details of a thread (company, role,
                    sender domain, stage and dates) to an AI model to draft the suggestion. It does not
                    send the text of your emails. Turn it off and you still get every suggestion, just in
                    the standard wording.
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:pt-1">
                  {coachSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                  <Switch
                    aria-label="Coach voice"
                    checked={coachPref?.enabled !== false}
                    disabled={coachLoading || coachSaving}
                    onCheckedChange={saveCoachPreference}
                  />
                </div>
              </div>

              {coachPref && coachPref.available === false && coachPref.enabled !== false ? (
                <p className="text-[13px] text-muted-foreground">
                  The coach voice is on for your account but is not running yet. Suggestions stay in the
                  standard wording until it is enabled on the server.
                </p>
              ) : null}

              {coachError ? <ErrorState title="Your coach setting did not save" detail={coachError} /> : null}
            </div>
          </Panel>
        ) : null}

        <Panel
          title="Plan & billing"
          description="Billing, access, and usage for this account."
          icon={CreditCard}
          action={
            <button type="button" className={BUTTON.ghost} onClick={fetchSubStatus} disabled={subLoading}>
              <RefreshCw className={cn("h-3.5 w-3.5", subLoading && "animate-spin")} aria-hidden />
              {subLoading ? "Refreshing…" : "Refresh"}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Plan"
                value={planLoading ? "…" : isPremium ? "Premium" : "Free"}
                hint={
                  isPremium
                    ? "Next Actions, Strategy Alerts, the weekly summary and Apply Gate."
                    : "The Chrome extension stays free. Premium adds the coach workspace."
                }
              />
              <StatTile
                label="Status"
                value={statusText}
                tone={isActive ? "positive" : "neutral"}
                hint={isActive ? "Your subscription is active." : "No active Premium subscription on this account."}
                loading={subLoading && !subStatus}
              />
              <StatTile
                label="Emails checked"
                value={Number(monthlyProcessed).toLocaleString()}
                hint={
                  Number.isFinite(monthlyLimit)
                    ? `of ${Number(monthlyLimit).toLocaleString()} this period`
                    : "this period"
                }
                loading={subLoading && !subStatus}
              />
            </div>

            {subStatus ? (
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <dt className={EYEBROW}>Renewal</dt>
                  <dd className="mt-1.5 font-medium text-foreground">{renewalDate || "No renewal date on file"}</dd>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <dt className={EYEBROW}>Cancellation</dt>
                  <dd className="mt-1.5 font-medium text-foreground">
                    {subscription?.cancel_at_period_end ? "Cancels at the end of this period" : "No cancellation scheduled"}
                  </dd>
                </div>
              </dl>
            ) : null}

            {subError ? <ErrorState title="Billing details did not load" detail={subError} onRetry={fetchSubStatus} /> : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {isPremium && billingPortalAvailable ? (
                <button type="button" className={BUTTON.secondary} disabled={busyPortal} onClick={openPortal}>
                  {busyPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ExternalLink className="h-3.5 w-3.5" aria-hidden />}
                  {busyPortal ? "Opening…" : "Manage billing"}
                </button>
              ) : isPremium ? (
                <p className="text-[13px] text-muted-foreground">
                  Premium is active. Billing for this account is not managed through Stripe, so there is no billing portal.
                </p>
              ) : (
                <button type="button" className={BUTTON.primary} onClick={() => navigate("/upgrade")}>
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                  Upgrade to Premium
                </button>
              )}
              <p className="text-[12px] text-muted-foreground">
                Payments are handled by Stripe. Applendium never stores card numbers.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </DashboardLayout>
  );
}

/**
 * Résumés live in one place. Settings used to embed a second résumé editor that wrote to the
 * legacy profile field while reading back the default version, so once a user had any saved
 * version an edit here appeared to vanish and never reached Apply Gate (it reads the default
 * version first). This panel only points at the Résumés page and names what Apply Gate uses.
 */
function ResumesSummaryPanel() {
  const variantsQuery = useQuery({ queryKey: ["resume-variants"], queryFn: fetchResumeVariants });
  const variants = variantsQuery.data?.variants ?? [];
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0] ?? null;

  return (
    <Panel
      title="Résumés"
      icon={FileText}
      action={<PanelLink to="/resumes">{variants.length > 0 ? "Manage résumés" : "Add your résumé"}</PanelLink>}
    >
      {variantsQuery.isLoading ? (
        <LoadingRows rows={1} />
      ) : variantsQuery.isError ? (
        <ErrorState title="Your résumés did not load" onRetry={() => variantsQuery.refetch()} />
      ) : defaultVariant ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Apply Gate checks roles against{" "}
          <span className="font-semibold text-foreground">{defaultVariant.name}</span>
          {variants.length > 1 ? `, your default of ${variants.length} saved versions.` : ", your saved résumé."} You can
          pick a different version for any single check.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          No résumé saved yet. Apply Gate compares each posting against your résumé, so until you add one its call is
          based only on your application history.
        </p>
      )}
    </Panel>
  );
}
