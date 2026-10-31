import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorState, LoadingRows, PageHeader, Panel, PanelLink, StatTile } from "@/components/premium/PremiumUI";
import { BUTTON, EYEBROW } from "@/components/premium/tone";
import { Switch } from "@/components/ui/switch";
import { fetchResumeVariants } from "@/lib/emails";
import { YourDataPanel } from "@/components/YourDataPanel";
import { cn } from "@/lib/utils";
import { friendlyErrorMessage } from "@/lib/apiErrors";
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
  cancel_at_period_end?: boolean | null;
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
  // The plan limit as the extension counts it (backend services/quotaPayload.js): applications,
  // 500 in a rolling 30 days on Free, no limit (null) on Premium.
  quotaData?: {
    unit?: string;
    trackedApplications?: number | null;
    monthlyProcessed?: number | null;
    limit?: number | null;
    windowDays?: number | null;
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
  const { user } = useAuth();
  return <SettingsAccount key={user?.uid || "signed-out"} />;
}

function SettingsAccount() {
  const { user, plan, planLoading, planError, logout, refreshPlan } = useAuth();
  const navigate = useNavigate();
  const [subStatus, setSubStatus] = useState<SubscriptionResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [busyPortal, setBusyPortal] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [coachPref, setCoachPref] = useState<CoachPreference | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachError, setCoachError] = useState("");

  const requests = useRef<Partial<Record<"coach" | "billing" | "portal", AbortController>>>({});
  const coachSavePending = useRef(false);
  function startRequest(channel: "coach" | "billing" | "portal") {
    requests.current[channel]?.abort();
    const controller = new AbortController();
    requests.current[channel] = controller;
    return { signal: controller.signal,
      current: () => !controller.signal.aborted && requests.current[channel] === controller };
  }

  async function fetchCoachPreference() {
    if (!user || coachSavePending.current) return;
    const request = startRequest("coach");
    setCoachError(""); setCoachLoading(true);
    try {
      const resp = await apiFetch("/api/user/coach-preference", { method: "GET", signal: request.signal });
      if (!request.current()) return;
      if (typeof resp?.enabled !== "boolean") throw new Error("Your coach setting could not be confirmed.");
      setCoachPref(resp);
    } catch (error: any) {
      if (!request.current()) return;
      setCoachPref(null);
      setCoachError(friendlyErrorMessage(error, "Your coach setting did not load. Try again in a moment."));
    } finally { if (request.current()) setCoachLoading(false); }
  }

  async function saveCoachPreference(nextEnabled: boolean) {
    if (!user || !coachPref || coachSavePending.current) return;
    coachSavePending.current = true;
    const request = startRequest("coach");
    setCoachError(""); setCoachSaving(true);
    setCoachPref({ ...coachPref, enabled: nextEnabled });
    try {
      const resp = await apiFetch("/api/user/coach-preference", {
        method: "POST", body: JSON.stringify({ enabled: nextEnabled }), signal: request.signal,
      });
      if (!request.current()) return;
      if (resp?.enabled !== nextEnabled) throw new Error("Your coach setting was not confirmed. Please retry.");
      setCoachPref(resp);
    } catch (error: any) {
      if (!request.current()) return;
      // A lost acknowledgement can follow a committed write. Re-read rather
      // than presenting the previous value as the confirmed current choice.
      setCoachPref(null);
      setCoachError(friendlyErrorMessage(error, "We could not confirm the change. Refresh your coach setting before trying again."));
    } finally {
      if (request.current()) { coachSavePending.current = false; setCoachSaving(false); }
    }
  }

  async function fetchSubStatus() {
    if (!user) return;
    const request = startRequest("billing");
    setSubError(""); setSubStatus(null); setSubLoading(true);
    try {
      const resp = await apiFetch("/api/subscriptions/status", { method: "GET", signal: request.signal });
      if (!request.current()) return;
      if (!["free", "premium"].includes(resp?.subscription?.plan) || !resp?.subscription?.status) {
        throw new Error("Your billing details could not be verified. Please retry.");
      }
      setSubStatus(resp);
      // Refresh the shared account reader after reconciliation, so route guards,
      // the sidebar and other features see the same persisted entitlement.
      if (resp.subscription.plan !== plan || planError) await refreshPlan?.();
    } catch (error: any) {
      if (!request.current()) return;
      setSubError(friendlyErrorMessage(error, "Your billing details did not load. Try again in a moment."));
    } finally { if (request.current()) setSubLoading(false); }
  }

  async function openPortal() {
    if (!user || busyPortal) return;
    const request = startRequest("portal");
    setPortalError(""); setBusyPortal(true);
    try {
      const resp = await apiFetch("/api/subscriptions/create-portal-session", {
        method: "POST", body: JSON.stringify({}), signal: request.signal,
      });
      if (!request.current()) return;
      const url = new URL(resp?.url || "");
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") throw new Error("The billing portal URL could not be verified.");
      window.location.assign(url.href);
    } catch (error: any) {
      if (!request.current()) return;
      setPortalError(friendlyErrorMessage(error, "The billing portal could not be opened. Please retry."));
    } finally { if (request.current()) setBusyPortal(false); }
  }

  useEffect(() => {
    if (user) { void fetchSubStatus(); void fetchCoachPreference(); }
    return () => { Object.values(requests.current).forEach(controller => controller?.abort()); };
  }, [user?.uid]);

  async function handleSignOut() {
    await logout();
    navigate("/upgrade", { replace: true });
  }

  const subscription = subStatus?.subscription || null;
  const effectivePlan = subscription?.plan || plan;
  const isPremium = effectivePlan === "premium";
  const isActive = Boolean(subscription && !subError && isPremium && ["active", "trialing"].includes(subscription.status || ""));
  const statusLabel = subError && !subscription ? "unavailable" : subscription?.status || "loading";
  const renewalDate = formatDate(subscription?.current_period_end);
  const quota = subStatus?.quotaData;
  const trackedApplications = quota?.trackedApplications ?? quota?.monthlyProcessed ?? null;
  const quotaLimit = isPremium ? null : quota?.limit ?? 500;
  const quotaWindowDays = quota?.windowDays ?? 30;
  const billingPortalAvailable = Boolean(subscription?.billingPortalAvailable);
  // Premium granted outside Stripe (founder, comped) has no renewal, no cancellation and no card on
  // file, so those boxes and the Stripe line only appear when Stripe actually bills this account.
  const billedByStripe = billingPortalAvailable || Boolean(subscription?.subscription_id);
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
    if (status === "unavailable") return "Unavailable";
    if (status === "active") return "Active";
    if (status === "trialing") return "Trial";
    if (status === "past_due") return "Payment due";
    if (status === "canceled") return "Canceled";
    return "Not active";
  })();

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader eyebrow="Your account" title="Settings" description="Your account, resumes, coach voice, billing and data." />

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

        {planLoading ? null : <ResumesSummaryPanel />}

        {isPremium ? (
          <Panel title="Coach voice" icon={MessageSquareText} id="coach-voice">
            <div data-testid="coach-voice-settings" className="space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    Write your next-step suggestions in plain language instead of a fixed template.
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    When this is on, Applendium™ sends the structured details of a thread (company, role,
                    sender domain, stage and dates) to an AI model to draft the suggestion. It does not
                    send the text of your emails. Turn it off and you still get every suggestion, just in
                    the standard wording.
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:pt-1">
                  {coachSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                  <Switch
                    aria-label="Coach voice"
                    checked={coachPref?.enabled === true}
                    disabled={coachLoading || coachSaving || !coachPref}
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

              {!coachPref && !coachLoading ? <p className="text-[13px] text-muted-foreground">We could not confirm your coach setting. Refresh it before making a change.</p> : null}
              {coachError ? <ErrorState stackRetryOnMobile title={coachPref ? "Your coach setting did not save" : "Your coach setting did not load"} detail={coachError} onRetry={fetchCoachPreference} /> : null}
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
                    ? "Next Actions, Strategy Alerts and Apply Gate."
                    : "The Chrome extension stays free. Premium adds the coach workspace."
                }
              />
              <StatTile
                label="Status"
                value={statusText}
                tone={isActive ? "positive" : "neutral"}
                hint={!subscription ? "Billing details have not been verified." : isActive ? "Your Premium access is active." : "No active Premium subscription on this account."}
                loading={subLoading && !subStatus}
              />
              <StatTile
                label={isPremium ? "Applications tracked" : "Applications this period"}
                value={trackedApplications == null ? "—" : Number(trackedApplications).toLocaleString()}
                hint={
                  quotaLimit == null
                    ? "No limit on Premium."
                    : `of ${Number(quotaLimit).toLocaleString()} in the last ${quotaWindowDays} days`
                }
                loading={subLoading && !subStatus}
              />
            </div>

            {subStatus && billedByStripe ? (
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <dt className={EYEBROW}>{subscription?.cancel_at_period_end ? "Access through" : "Current period ends"}</dt>
                  <dd className="mt-1.5 font-medium text-foreground">{renewalDate || "No renewal date on file"}</dd>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <dt className={EYEBROW}>Cancellation</dt>
                  <dd className="mt-1.5 font-medium text-foreground">
                    {subscription?.cancel_at_period_end === true ? "Cancels at the end of this period" : subscription?.cancel_at_period_end === false ? "No cancellation scheduled" : "Cancellation schedule not confirmed"}
                  </dd>
                </div>
              </dl>
            ) : null}

            {subError ? <ErrorState stackRetryOnMobile title="Billing details did not load" detail={subError} onRetry={fetchSubStatus} /> : null}
            {portalError ? <ErrorState stackRetryOnMobile title="Billing portal did not open" detail={portalError} onRetry={openPortal} /> : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {subscription && billingPortalAvailable ? (
                <button type="button" className={BUTTON.secondary} disabled={busyPortal} onClick={openPortal}>
                  {busyPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ExternalLink className="h-3.5 w-3.5" aria-hidden />}
                  {busyPortal ? "Opening…" : "Manage billing"}
                </button>
              ) : subscription && isPremium ? (
                <p className="text-[13px] text-muted-foreground">
                  Premium is active. Billing for this account is not managed through Stripe, so there is no billing portal.
                </p>
              ) : subscription && !billedByStripe ? (
                <button type="button" className={BUTTON.primary} onClick={() => navigate("/upgrade?source=web_settings")}>
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                  Upgrade to Premium
                </button>
              ) : <p className="text-[13px] text-muted-foreground">Refresh billing to verify how this account is billed.</p>}
              {billedByStripe || !isPremium ? (
                <p className="text-[12px] text-muted-foreground">
                  Payments are handled by Stripe. Applendium™ never stores card numbers.
                </p>
              ) : null}
            </div>
          </div>
        </Panel>

        <YourDataPanel />
      </div>
    </DashboardLayout>
  );
}

/**
 * Resumes live in one place. Settings used to embed a second resume editor that wrote to the
 * legacy profile field while reading back the default version, so once a user had any saved
 * version an edit here appeared to vanish and never reached Apply Gate (it reads the default
 * version first). This panel only points at the Resumes page and names what Apply Gate uses.
 */
function ResumesSummaryPanel() {
  const { user } = useAuth();
  const variantsQuery = useQuery({ queryKey: ["resume-variants", user?.uid], queryFn: fetchResumeVariants });
  const variants = variantsQuery.data?.variants ?? [];
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? null;

  return (
    <div id="resume"><Panel
      title="Resumes"
      icon={FileText}
      action={<PanelLink to="/resumes">{variants.length > 0 ? "Manage resumes" : "Add your resume"}</PanelLink>}
    >
      {variantsQuery.isLoading ? (
        <LoadingRows rows={1} />
      ) : variantsQuery.isError ? (
        <ErrorState title="Your resumes did not load" onRetry={() => variantsQuery.refetch()} />
      ) : defaultVariant ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Apply Gate checks roles against{" "}
          <span className="font-semibold text-foreground">{defaultVariant.name}</span>
          {variants.length > 1 ? `, your default of ${variants.length} saved versions.` : ", your saved resume."} You can
          pick a different version for any single check.
        </p>
      ) : variants.length > 0 ? (
        <p className="text-sm">No default resume is set. Choose one in Resumes before using extension checks.</p>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          No resume saved yet. Add one and choose a default before checking a role.
        </p>
      )}
    </Panel></div>
  );
}
