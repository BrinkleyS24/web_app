import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * What a suggestion stands on (2026-09-26): days since the last update, the rule Applendium™ applied,
 * and the member's own answer timing when there is enough of it. Written by the backend's
 * services/followUpBasis.js, never by the AI, so it can be checked against the inbox. One component
 * so the Dashboard, Next Actions and Ask Applendium™ say it the same way.
 */
export function WhyLine({
  why,
  className,
  label = "Why",
  testId = "why-line",
}: {
  why?: string | null;
  className?: string;
  /** "Why" for a suggestion's basis; "From your inbox" for what an email showed. */
  label?: string;
  testId?: string;
}) {
  if (!why) return null;
  return (
    <p className={cn("flex gap-1.5 text-[12px] leading-snug text-muted-foreground", className)} data-testid={testId}>
      <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-foreground/70">{label}: </span>
        {why}
      </span>
    </p>
  );
}

export default WhyLine;
