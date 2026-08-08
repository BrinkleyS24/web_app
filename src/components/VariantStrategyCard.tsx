import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import type { VariantStrategy, VariantStrategyGap } from "@/lib/emails";

export type VariantDraftDecisions = { accepted: string[]; dismissed: string[] };

type VariantStrategyCardProps = {
  strategy: VariantStrategy;
  onDraftDecisionsChange?: (decisions: VariantDraftDecisions) => void;
};

function gapTypeLabel(type: VariantStrategyGap["type"]): string {
  if (type === "missing") return "Missing";
  if (type === "buried") return "Buried";
  return "Reframe";
}

function gapTypeBadgeClass(type: VariantStrategyGap["type"]): string {
  if (type === "missing") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (type === "buried") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  return "border-accent/20 bg-accent/10 text-accent";
}

function gapHumanLine(type: VariantStrategyGap["type"], location: VariantStrategyGap["location"]): string {
  if (type === "buried") {
    const loc = location === "none" ? "your résumé" : `your ${location}`;
    return `Shows up only in ${loc} — surface it`;
  }
  if (type === "reframe") {
    return "You have this under a different term — mirror the posting's wording";
  }
  return "";
}

/**
 * The one sentence that stops this card from reading as a contradiction.
 *
 * This card picks the best-suited résumé for the role, which is often NOT the one the verdict above
 * it was computed from. When that happens a requirement the verdict counted as covered can show up
 * here as a gap, and until now nothing on screen explained how both could be true. Returns null
 * unless we can name both documents — "different from something we can't identify" is worse than
 * silence — and null when they're the same file, where the note would just be noise.
 *
 * The wording follows the gap list, because with no gaps "these gaps are from…" points at nothing.
 */
export function variantStrategyDocumentNote(strategy: VariantStrategy): string | null {
  if (!strategy.analyzedDifferentDocument) return null;
  const analyzed = strategy.analyzedVariant?.name;
  const scored = strategy.scoredVariant?.name;
  if (!analyzed || !scored) return null;
  return strategy.gaps.length > 0
    ? `These gaps are from ${analyzed}. The verdict above was scored on ${scored}, so the two can disagree.`
    : `We checked ${analyzed} here. The verdict above was scored on ${scored}, the one you picked for this run.`;
}

/**
 * The short chip beside the name, and the reason under it.
 *
 * The card used to print a résumé name under a "Résumé strategy" heading and stop. A user who had
 * selected a different document for the run read that as "it analysed the wrong file" — reasonable,
 * because nothing on screen said this was a *recommendation*, and the computed reason was thrown
 * away. Worse, the pick is often a tie: measured on a real QA posting, all six of one user's
 * résumés covered all three must-haves, so the winner was decided purely by the default flag. A
 * tie-break dressed as a finding is the thing to avoid here, so it gets its own label.
 */
export function variantStrategyPickLabel(strategy: VariantStrategy): string {
  if (strategy.recommended.basis === "your_outcomes") return "Best results so far";
  if (strategy.recommended.requiredCount === 0) return "Your default";
  return strategy.isTieBreak ? "Any of these work" : "Best match";
}

/**
 * What to say when the gap analysis came back clean.
 *
 * An empty gap list has two causes that mean opposite things: the résumé covers everything, or we
 * never read a requirement to check it against. Rendering nothing for both left an empty panel that
 * still spoke — the same defect as the verdict tiles. Returns null when there ARE gaps to show.
 */
export function variantStrategyNoGapsNote(strategy: VariantStrategy): string | null {
  if (strategy.gaps.length > 0) return null;
  const name = strategy.analyzedVariant?.name ?? strategy.recommended.name;
  if (strategy.recommended.requiredCount === 0) {
    return `We couldn't read specific requirements from this posting, so there's nothing to check ${name} against — not a clean bill of health.`;
  }
  return `Nothing to fix on ${name} for this posting — send it as it is.`;
}

export function VariantStrategyCard({ strategy, onDraftDecisionsChange }: VariantStrategyCardProps) {
  const documentNote = variantStrategyDocumentNote(strategy);
  const pickLabel = variantStrategyPickLabel(strategy);
  const noGapsNote = variantStrategyNoGapsNote(strategy);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const handleAccept = useCallback(
    (requirement: string) => {
      const nextAccepted = [...accepted.filter((r) => r !== requirement), requirement];
      const nextDismissed = dismissed.filter((r) => r !== requirement);
      setAccepted(nextAccepted);
      setDismissed(nextDismissed);
      onDraftDecisionsChange?.({ accepted: nextAccepted, dismissed: nextDismissed });
    },
    [accepted, dismissed, onDraftDecisionsChange],
  );

  const handleDismiss = useCallback(
    (requirement: string) => {
      const nextDismissed = [...dismissed.filter((r) => r !== requirement), requirement];
      const nextAccepted = accepted.filter((r) => r !== requirement);
      setDismissed(nextDismissed);
      setAccepted(nextAccepted);
      onDraftDecisionsChange?.({ accepted: nextAccepted, dismissed: nextDismissed });
    },
    [accepted, dismissed, onDraftDecisionsChange],
  );

  return (
    <div className="glass-card space-y-4 rounded-xl p-4 mt-3.5">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Résumé strategy
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
            {strategy.recommended.name}
          </h3>
          <span
            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
              strategy.isTieBreak || strategy.recommended.requiredCount === 0
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-accent/20 bg-accent/10 text-accent"
            }`}
          >
            {pickLabel}
          </span>
        </div>
        {/* The reason the backend has always computed and this card used to throw away. Without it
            the name above is an unexplained assertion. */}
        {strategy.recommended.reason ? (
          <p className="mt-1 text-xs leading-relaxed text-foreground">{strategy.recommended.reason}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">{strategy.basisLabel}</p>
        {strategy.recommended.basis === "your_outcomes" && (
          <span className="mt-1.5 inline-flex items-center rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            Learning from your {strategy.recommended.outcomeBand?.sampleSize ?? strategy.recommended.sampleSize} outcomes
          </span>
        )}
        {documentNote ? (
          <p className="mt-2 rounded-md border border-warning/25 bg-warning/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {documentNote}
          </p>
        ) : null}
      </div>

      {/* Gaps */}
      {strategy.gaps.length > 0 ? (
        <div className="space-y-3">
          {strategy.gaps.map((gap, idx) => {
            const isAccepted = accepted.includes(gap.requirement);
            const isDismissed = dismissed.includes(gap.requirement);
            const hasDecision = isAccepted || isDismissed;

            return (
              <div
                key={`${gap.type}-${gap.requirement}-${idx}`}
                className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2"
              >
                {/* Badge + requirement row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${gapTypeBadgeClass(gap.type)}`}
                  >
                    {gapTypeLabel(gap.type)}
                  </span>
                  <span className="text-xs font-medium text-foreground">{gap.requirement}</span>
                </div>

                {/* Human line */}
                {gap.skipSignal ? (
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      You may not have provable experience here — consider whether this role fits
                    </p>
                  </div>
                ) : (
                  (() => {
                    const line = gapHumanLine(gap.type, gap.location);
                    return line ? <p className="text-xs leading-relaxed text-muted-foreground">{line}</p> : null;
                  })()
                )}

                {/* Draft rewrite (buried/reframe only — missing+skipSignal has no draft) */}
                {!gap.skipSignal && gap.draft ? (
                  <div className="space-y-2 pt-1">
                    {/* A reframe has no existing line to replace, so there is nothing to show
                        as "before" — rendering the panel anyway left an empty box with an
                        arrow pointing out of it. */}
                    {gap.draft.before ? (
                      <>
                        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Before</p>
                          <p className="text-xs leading-relaxed text-foreground">{gap.draft.before}</p>
                        </div>
                        <div className="flex items-center gap-1 pl-1 text-muted-foreground">
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">rewritten to</span>
                        </div>
                      </>
                    ) : null}
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {gap.draft.before ? "After" : "Suggested line"}
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">{gap.draft.after}</p>
                    </div>

                    {hasDecision ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        {isAccepted ? (
                          <>
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                            Draft accepted
                          </>
                        ) : (
                          <>Dismissed</>
                        )}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => handleAccept(gap.requirement)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleDismiss(gap.requirement)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : noGapsNote ? (
        <p className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-relaxed text-muted-foreground">
          {noGapsNote}
        </p>
      ) : null}
    </div>
  );
}
