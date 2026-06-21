import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Check, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApplyGateHistory, fetchEmailMetrics, fetchResume } from "@/lib/emails";
import { useSaveResume } from "@/hooks/useSaveResume";

const DISMISS_KEY = "firstMove.dismissed";
const ESTABLISHED_THRESHOLD = 5;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    /* private mode — ignore */
  }
}

/**
 * Cold-start "First Move" card on the premium dashboard. Removes the buried-resume
 * blocker and funnels a thin/new subscriber to their first Apply Gate verdict.
 * Shows only when (no resume) OR (no Apply Gate runs yet); auto-hides afterward.
 */
export function FirstMoveCard() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [draft, setDraft] = useState("");

  const resumeQuery = useQuery({
    queryKey: ["user-resume"],
    queryFn: fetchResume,
    staleTime: 60_000,
  });
  const historyQuery = useQuery({
    queryKey: ["dashboard", "apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    staleTime: 60_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["email-metrics", "last_30_days"],
    queryFn: () => fetchEmailMetrics("last_30_days"),
    staleTime: 60_000,
  });

  const saveMutation = useSaveResume();

  // Fail safe: while the gating signals load, render nothing; on error, hide.
  if (resumeQuery.isLoading || historyQuery.isLoading) return null;
  if (resumeQuery.isError || historyQuery.isError) return null;

  const hasResume = Boolean(
    resumeQuery.data?.resumeText && resumeQuery.data.resumeText.trim().length > 20,
  );
  const runCount = historyQuery.data?.history?.length ?? 0;
  const applicationsSent = metricsQuery.data?.cohortMetrics?.applicationsSent ?? 0;

  const visible = !dismissed && (!hasResume || runCount === 0);
  if (!visible) return null;

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const handleSave = () => {
    if (draft.trim().length >= 20) saveMutation.mutate(draft);
  };

  const step: 1 | 2 = hasResume ? 2 : 1;

  return (
    <div className="glass-card relative rounded-xl p-5 space-y-3" data-testid="first-move-card">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        First move
      </p>

      {step === 1 ? (
        <>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Get a verdict on the next role you're considering.
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Apply Gate reads your resume against any job posting and tells you apply,
                fix-first, or skip — grounded in your real history, not generic advice. Add
                your resume to start.
              </p>
            </div>
          </div>
          <textarea
            rows={6}
            aria-label="Resume text"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Paste your resume text here… (plain text, not a file)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Stored encrypted. Used only to evaluate roles for you.
          </p>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={draft.trim().length < 20 || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {saveMutation.isPending ? "Saving…" : "Save resume"}
          </Button>
          {saveMutation.isError && (
            <p className="text-xs text-red-500">Couldn't save your resume — try again.</p>
          )}
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-foreground">
            {applicationsSent >= ESTABLISHED_THRESHOLD
              ? `Apply Gate already knows your ${applicationsSent} tracked applications. Run it on a role you're weighing.`
              : "Run Apply Gate on a role you're weighing."}
          </h3>
          <p className="text-sm text-muted-foreground">
            Paste a job posting and get a grounded apply / fix-first / skip verdict — top
            rejection risks, missing proof, and what to fix today — in about 30 seconds.
          </p>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
            <Check className="h-3 w-3" />
            Resume saved
          </span>
          <div>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/apply-gate">
                Run your first Apply Gate
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
