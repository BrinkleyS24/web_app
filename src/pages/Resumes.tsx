import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, CircleCheck, FileText, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import {
  fetchResumeVariants,
  fetchVariantScoreboard,
  fetchApplicationStats,
  fetchResumeHealth,
  setResumeHealthFinding,
  createResumeVariant,
  setDefaultResumeVariant,
  archiveResumeVariant,
  type VariantScoreRow,
  type VariantBreakdownRow,
  type ResumeHealthEntry,
  type ResumeHealthFinding,
} from "@/lib/emails";

function roundedChars(n: number) {
  return `${Math.round(n / 100) * 100}+ chars`;
}

const VARIANT_NUDGE_DISMISS_KEY = "variantNudge.dismissed";

function readVariantNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(VARIANT_NUDGE_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeVariantNudgeDismissed() {
  try {
    localStorage.setItem(VARIANT_NUDGE_DISMISS_KEY, "true");
  } catch {
    /* private mode — ignore */
  }
}

function outcomeBadge(outcome: VariantBreakdownRow["outcome"]) {
  const cfg: Record<VariantBreakdownRow["outcome"], { label: string; cls: string }> = {
    interviewed: { label: "Interviewed", cls: "text-accent border-accent/20 bg-accent/10" },
    offered:     { label: "Offered",     cls: "text-accent border-accent/20 bg-accent/10" },
    rejected:    { label: "Rejected",    cls: "text-destructive border-destructive/20 bg-destructive/10" },
    no_response: { label: "No response", cls: "text-muted-foreground border-border bg-muted" },
    pending:     { label: "Pending",     cls: "text-muted-foreground border-border bg-muted" },
  };
  const { label, cls } = cfg[outcome] ?? cfg.pending;
  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function recordLine(score: VariantScoreRow | undefined) {
  const sent = score?.sent ?? 0;
  if (sent === 0) {
    return "No applications through this résumé yet — pick it in Apply Gate when you apply.";
  }
  // The headline count is the real number of applications sent through this
  // résumé (sent), NOT matchedToOutcome. matchedToOutcome only counts the
  // applications we've since been able to attribute an inbox outcome to, so
  // showing it as "applications" undercounts (5 applies could read as "1").
  const sentLabel = `${sent} application${sent === 1 ? "" : "s"} through this résumé`;
  if (!score || !score.sufficientSample) {
    const matched = score?.matchedToOutcome ?? 0;
    if (matched === 0) {
      return `${sentLabel} — waiting on inbox replies before we can call it.`;
    }
    return `${sentLabel} · ${matched} with a tracked outcome so far — not enough to call it yet.`;
  }
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return `${sentLabel} · ${plural(score.interviewed, "interview")} · ${plural(score.offered, "offer")} · ${plural(score.rejected, "rejected")} · ${score.noResponse} no response`;
}

/**
 * One line answering "is this résumé in good shape?" before any list of findings.
 *
 * Exported for its own test: the interesting cases are the two empty ones, which read very
 * differently. Nothing flagged means we checked and found nothing. No résumé to check means we
 * have not looked — and a health panel that renders those identically is claiming a clean bill
 * of health it never established.
 */
export function resumeHealthHeadline(entry: ResumeHealthEntry | undefined | null) {
  if (!entry || !entry.document) return null;
  const open = entry.findings.filter((f) => !f.dismissed);
  if (open.length === 0) return { clean: true as const, text: "Nothing flagged on this version." };
  const blocking = open.filter((f) => f.severity === "blocking").length;
  if (blocking > 0) {
    return {
      clean: false as const,
      text: blocking === 1 && open.length === 1
        ? "1 thing here stops a reviewer reaching you."
        : `${open.length} things to fix — ${blocking} stops a reviewer reaching you.`,
    };
  }
  return {
    clean: false as const,
    text: open.length === 1 ? "1 thing worth fixing on this version." : `${open.length} things worth fixing on this version.`,
  };
}

const SEVERITY_STYLE: Record<ResumeHealthFinding["severity"], string> = {
  blocking: "border-destructive/25 bg-destructive/5",
  important: "border-warning/25 bg-warning/5",
  suggested: "border-border/60 bg-muted/30",
};

function ResumeHealthBlock({
  entry,
  onSetState,
  pendingKey,
}: {
  entry: ResumeHealthEntry | undefined;
  onSetState: (finding: ResumeHealthFinding, next: "dismissed" | "active") => void;
  pendingKey: string | null;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const headline = resumeHealthHeadline(entry);
  if (!entry || !headline) return null;

  const open = entry.findings.filter((f) => !f.dismissed);
  const dismissed = entry.findings.filter((f) => f.dismissed);

  return (
    <div className="space-y-2 border-t border-border/60 pt-2">
      <p className={`flex items-center gap-1.5 text-xs font-medium ${headline.clean ? "text-accent" : "text-foreground"}`}>
        {headline.clean ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {headline.text}
      </p>

      {open.map((finding) => (
        <div key={finding.key} className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLE[finding.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{finding.title}</p>
            <button
              type="button"
              onClick={() => onSetState(finding, "dismissed")}
              disabled={pendingKey === finding.key}
              className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
            >
              Not an issue
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.evidence}</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{finding.action}</p>
        </div>
      ))}

      {dismissed.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showDismissed}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showDismissed ? "rotate-180" : ""}`} />
            {showDismissed ? "Hide" : `${dismissed.length} dismissed`}
          </button>
          {showDismissed
            ? dismissed.map((finding) => (
                <div key={finding.key} className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <p className="text-[11px] text-muted-foreground">{finding.evidence}</p>
                  <button
                    type="button"
                    onClick={() => onSetState(finding, "active")}
                    disabled={pendingKey === finding.key}
                    className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

const Resumes = () => {
  const queryClient = useQueryClient();
  const variantsQuery = useQuery({ queryKey: ["resume-variants"], queryFn: fetchResumeVariants });
  const scoreboardQuery = useQuery({ queryKey: ["variant-scoreboard"], queryFn: () => fetchVariantScoreboard() });
  const statsQuery = useQuery({ queryKey: ["application-stats"], queryFn: fetchApplicationStats });
  const healthQuery = useQuery({ queryKey: ["resume-health"], queryFn: fetchResumeHealth });

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draft, setDraft] = useState("");
  const [openDrilldowns, setOpenDrilldowns] = useState<Set<string>>(new Set());
  const [nudgeDismissed, setNudgeDismissed] = useState(readVariantNudgeDismissed);

  const toggleDrilldown = (id: string) => {
    setOpenDrilldowns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const variants = variantsQuery.data?.variants ?? [];
  const scoreByVariant = new Map(
    (scoreboardQuery.data?.scoreboard?.perVariant ?? []).map((r) => [r.variantId, r]),
  );
  const breakdown = scoreboardQuery.data?.breakdown ?? {};

  // Nudge toward a second variant: with only one résumé on file, Apply Gate has
  // nothing to compare and the outcome-steering guidance can never fire. A
  // rejection is the natural moment to suggest trying a different version.
  const rejectedCount = statsQuery.data?.stats?.applications?.rejected ?? 0;
  const showVariantNudge =
    !nudgeDismissed &&
    !variantsQuery.isLoading &&
    !statsQuery.isLoading &&
    variants.length === 1 &&
    rejectedCount > 0;
  const dismissVariantNudge = () => {
    writeVariantNudgeDismissed();
    setNudgeDismissed(true);
  };

  const healthByVariant = new Map(
    (healthQuery.data?.resumes ?? []).map((entry) => [entry.variantId, entry]),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["resume-variants"] });
    queryClient.invalidateQueries({ queryKey: ["variant-scoreboard"] });
    // A new or edited résumé is a different document, so its findings are recomputed from
    // scratch — there is no stored "resolved" state that could go stale against the text.
    queryClient.invalidateQueries({ queryKey: ["resume-health"] });
  };
  const createMut = useMutation({
    mutationFn: createResumeVariant,
    onSuccess: () => { setDraft(""); setDraftName(""); setAdding(false); invalidate(); },
  });
  const setDefaultMut = useMutation({ mutationFn: setDefaultResumeVariant, onSuccess: invalidate });
  const archiveMut = useMutation({ mutationFn: archiveResumeVariant, onSuccess: invalidate });
  const healthMut = useMutation({
    mutationFn: setResumeHealthFinding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resume-health"] }),
  });
  const pendingHealthKey = healthMut.isPending ? healthMut.variables?.key ?? null : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Your résumé library
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-foreground">Résumés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save the versions you tailor, then see which one actually gets interviews — and which gets auto-rejected.
          </p>
        </div>

        {showVariantNudge ? (
          <div className="glass-card relative space-y-1.5 rounded-xl border border-accent/20 bg-accent/10 p-4">
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissVariantNudge}
              className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-2 pr-6">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold leading-snug text-foreground">
                  {rejectedCount === 1
                    ? "You've had a rejection. Try a different résumé next time."
                    : `You've had ${rejectedCount} rejections. Try a different résumé next time.`}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Save a second version and Apply Gate will start tracking which one actually gets responses.
                </p>
                <Button size="sm" className="mt-2 gap-1.5" onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add a résumé version
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {variantsQuery.isLoading ? (
          <div className="glass-card flex items-center gap-2 rounded-xl px-5 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your résumés…
          </div>
        ) : (
          <div className="space-y-3">
            {variants.map((v) => (
              <div key={v.id} className="glass-card space-y-2 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <span className="font-semibold text-foreground">{v.name}</span>
                    {v.isDefault ? (
                      <span className="rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                        Default
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">({roundedChars(v.charCount)})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!v.isDefault ? (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setDefaultMut.mutate(v.id)}>
                        <Star className="h-3 w-3" /> Make default
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => archiveMut.mutate(v.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{recordLine(scoreByVariant.get(v.id))}</p>
                <ResumeHealthBlock
                  entry={healthByVariant.get(v.id)}
                  pendingKey={pendingHealthKey}
                  onSetState={(finding, next) =>
                    healthMut.mutate({ variantId: v.id, key: finding.key, state: next })
                  }
                />
                {(() => {
                  const rows = breakdown[v.id] ?? [];
                  if (rows.length === 0) return null;
                  const isOpen = openDrilldowns.has(v.id);
                  return (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => toggleDrilldown(v.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        aria-expanded={isOpen}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        {isOpen ? "Hide applications" : `Show ${rows.length} application${rows.length === 1 ? "" : "s"}`}
                      </button>
                      {isOpen && (
                        <div className="space-y-1.5 pt-1">
                          {rows.map((row, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs">
                              <span className="font-medium text-foreground">{row.role ?? "Unknown role"}</span>
                              {row.company ? <span className="text-muted-foreground">{row.company}</span> : null}
                              {outcomeBadge(row.outcome)}
                            </div>
                          ))}
                          {rows.some((r) => r.outcome === "pending") && (
                            <p className="text-[11px] text-muted-foreground">Pending applications aren't counted in the rate.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No résumés saved yet. Add the version you send most so Apply Gate can start learning which one gets responses.
              </p>
            ) : null}
          </div>
        )}

        {adding ? (
          <div className="glass-card space-y-3 rounded-xl p-4">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Name (e.g., QA-focused)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <textarea
              rows={10}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Paste your résumé text here… (plain text, not a file)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={draft.trim().length < 20 || createMut.isPending}
                onClick={() => createMut.mutate({ name: draftName.trim() || "My résumé", text: draft })}
              >
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add a résumé version
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Resumes;
