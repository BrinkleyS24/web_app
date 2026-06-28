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

export function VariantStrategyCard({ strategy, onDraftDecisionsChange }: VariantStrategyCardProps) {
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
          Résumé variant strategy
        </p>
        <h3 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-foreground">
          {strategy.recommended.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{strategy.basisLabel}</p>
        {strategy.recommended.basis === "your_outcomes" && (
          <span className="mt-1.5 inline-flex items-center rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            Learning from your {strategy.recommended.outcomeBand?.sampleSize ?? strategy.recommended.sampleSize} outcomes
          </span>
        )}
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
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Before</p>
                      <p className="text-xs leading-relaxed text-foreground">{gap.draft.before}</p>
                    </div>
                    <div className="flex items-center gap-1 pl-1 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">rewritten to</span>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">After</p>
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
      ) : null}
    </div>
  );
}
