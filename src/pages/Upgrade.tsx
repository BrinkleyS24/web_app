import { Crown, Check, Zap, Shield, Brain, Bell, FileText, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../lib/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { useState } from "react";
import { Navigate } from "react-router-dom";

const features = [
  { icon: Shield, title: "Unlimited Apply Gate", desc: "Get a verdict on every job before you apply" },
  { icon: Zap, title: "Pre-jection Simulator", desc: "Know rejection reasons before they happen" },
  { icon: Wrench, title: "Fix Suggestions", desc: "Targeted edits to boost your resume per job" },
  { icon: Brain, title: "Outcome Memory", desc: "Track patterns across all your applications" },
  { icon: Bell, title: "Strategy Alerts", desc: "Smart nudges to refine your approach" },
  { icon: FileText, title: "Weekly Summary", desc: "Your action plan, delivered every week" },
];

const Upgrade = () => {
  const { user, loading: authLoading, plan, planLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already premium — redirect straight to dashboard
  if (!authLoading && !planLoading && plan === "premium") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleStartTrial() {
    if (!user) return;
    setError("");
    setBusy(true);
    try {
      const resp = await apiFetch("/api/subscriptions/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan: "premium" }),
      });
      if (resp?.url) {
        // Redirect to Stripe Checkout
        window.location.href = resp.url;
      } else {
        setError("No checkout URL returned. Please try again.");
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to start checkout.";
      // If billing isn't configured on the backend, show a helpful message
      if (msg.toLowerCase().includes("billing is not configured")) {
        setError("Billing is being set up. Please try again later.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col justify-center w-1/2 bg-primary p-12 xl:p-20">
        <div className="max-w-md">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-8">
            <Crown className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-3">
            Land your next role, faster.
          </h1>
          <p className="text-primary-foreground/70 mb-10 text-sm leading-relaxed">
            Premium gives you the intelligence layer most job seekers don't have. Stop guessing. Start applying strategically.
          </p>
          <div className="space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-foreground">{f.title}</p>
                  <p className="text-xs text-primary-foreground/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-xl font-bold text-foreground">Upgrade to Premium</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unlock all features with a 7-day free trial
            </p>
          </div>

          <div className="glass-card rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Premium Plan</p>
              <p className="text-xs text-muted-foreground">Billed monthly</p>
            </div>
            <p className="text-xl font-bold text-foreground">$9.99<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
          </div>

          {authLoading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting to extension...
            </div>
          ) : !user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Open the MorrowFold extension and sign in to continue.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>

              {error && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
                  {error}
                </div>
              )}

              <Button
                onClick={handleStartTrial}
                disabled={busy}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-sm font-medium"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Setting up checkout...
                  </>
                ) : (
                  "Start Free Trial"
                )}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            You won't be charged until your 7-day trial ends.
          </p>

          <div className="space-y-1.5 pt-2">
            {["Unlimited Apply Gate verdicts", "Pre-jection analysis", "Personalized weekly summaries"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;

