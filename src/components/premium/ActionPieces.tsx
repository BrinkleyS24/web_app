import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  FileText,
  Mail,
  PenLine,
  ScanSearch,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ActionCta } from "@/lib/actionPresentation";
import { describeActionKind } from "@/lib/actionPresentation";
import type { QueueItem } from "@/lib/premiumTaskQueue";
import { cn } from "@/lib/utils";
import { TONES, type Tone } from "./tone";

const KIND_VISUALS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  "Interview prep": { icon: CalendarClock, tone: "upcoming" },
  Assessment: { icon: PenLine, tone: "attention" },
  "Close-out": { icon: Archive, tone: "done" },
  "Data fix": { icon: Wrench, tone: "neutral" },
  Research: { icon: Search, tone: "neutral" },
  Networking: { icon: Users, tone: "neutral" },
  "Résumé": { icon: FileText, tone: "brand" },
  "Apply Gate": { icon: ScanSearch, tone: "brand" },
};

export function actionVisual(item: QueueItem): { kind: string; icon: LucideIcon; tone: Tone } {
  const kind = describeActionKind(item);
  const visual = KIND_VISUALS[kind] || { icon: Mail, tone: "brand" as Tone };
  return { kind, ...visual };
}

export function ActionIcon({ item, className }: { item: QueueItem; className?: string }) {
  const { icon: Icon, tone } = actionVisual(item);
  return (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES[tone].icon, className)}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

/**
 * The button for an action. Links out (Gmail, a search) open in a new tab; in-app tools route; work
 * that happens on Next Actions itself (drafting, the prep plan, closing out) deep-links to the card
 * there when rendered off that page, or calls `onAct` when it is.
 */
export function ActionCtaButton({
  item,
  cta,
  className,
  onAct,
  children,
}: {
  item: QueueItem;
  cta: ActionCta;
  className: string;
  onAct?: () => void;
  children?: ReactNode;
}) {
  const label = children ?? cta.label;
  if ((cta.kind === "external" || cta.kind === "gmail") && cta.href) {
    return (
      <a href={cta.href} target="_blank" rel="noreferrer" className={className}>
        {label}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    );
  }
  if (cta.kind === "route" && cta.href) {
    return (
      <Link to={cta.href} className={className}>
        {label}
      </Link>
    );
  }
  if (onAct) {
    return (
      <button type="button" onClick={onAct} className={className}>
        {label}
      </button>
    );
  }
  return (
    <Link to={`/next-actions#${encodeURIComponent(item.id)}`} className={className}>
      {label}
    </Link>
  );
}
