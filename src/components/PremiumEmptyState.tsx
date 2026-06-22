import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type PremiumEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One honest line on what unlocks this panel. */
  body?: string;
  /**
   * Present → cold-start (no data YET): give the user a concrete next step
   * (usually Apply Gate). Absent → caught-up / transient: stay calm, no nag.
   */
  cta?: { label: string; to: string };
};

/**
 * Shared empty-state card for the premium surfaces. The presence of `cta` is the
 * cold-start-vs-caught-up switch: cold-start panels pass a CTA so a new/thin
 * account always has a next move; caught-up panels omit it so an active user who
 * is simply all-done is reassured, not pushed.
 */
export function PremiumEmptyState({ icon: Icon, title, body, cta }: PremiumEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      {Icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="mx-auto mt-1.5 max-w-[52ch] text-sm leading-6 text-muted-foreground">{body}</p>
      ) : null}
      {cta ? (
        <Button asChild size="sm" className="mt-4 gap-1.5">
          <Link to={cta.to}>
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
