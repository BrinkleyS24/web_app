/**
 * The premium page kit: one header, one card, one chip, one stat tile and one set of loading /
 * empty / error states, used by every premium page so the seven screens read as one product.
 * The Weekly Summary is the reference for tone: a clear read at the top, evidence underneath,
 * nothing decorative.
 */
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "./tone";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.025em] text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  icon: Icon,
  tone = "neutral",
  meta,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const hasHeader = Boolean(title || meta || action);
  return (
    <section id={id} className={cn(CARD, "overflow-hidden", className)}>
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONES[tone].icon)}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {meta || action ? (
            <div className="flex shrink-0 items-center gap-2">
              {meta}
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn(hasHeader ? "px-5 pb-5" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ToneChip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TONES[tone].chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONES[tone].rail)} aria-hidden />
      {children}
    </span>
  );
}

export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={BUTTON.link}>
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <div className={cn(CARD, "p-4")}>
      <p className={EYEBROW}>{label}</p>
      {loading ? (
        <Skeleton className="mt-2.5 h-7 w-16" />
      ) : (
        <p
          className={cn(
            "mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] tabular-nums",
            tone ? TONES[tone].text : "text-foreground",
          )}
        >
          {value}
        </p>
      )}
      {hint && !loading ? <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Placeholder rows shaped like the content that is coming — never a "0" or an empty message. */
export function LoadingRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-muted/30 text-center", compact ? "px-4 py-5" : "px-6 py-8")}>
      {Icon ? (
        <div className="mx-auto mb-2.5 grid h-9 w-9 place-items-center rounded-full bg-card ring-1 ring-border">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-3.5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "This section did not load",
  detail,
  onRetry,
}: {
  title?: ReactNode;
  detail?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3.5" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {detail ? <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{detail}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={BUTTON.ghost}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** A labelled group of rows inside a panel, e.g. "Today" and "More". */
export function SectionLabel({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={EYEBROW}>{children}</p>
      {meta ? <span className="text-[12px] text-muted-foreground">{meta}</span> : null}
    </div>
  );
}
