import { cn } from "@/lib/utils";

type Status =
  | "strong"
  | "potential"
  | "risky"
  | "not-recommended"
  | "applied"
  | "interviewed"
  | "offers"
  | "rejected";

const config: Record<Status, { label: string; className: string }> = {
  strong: { label: "Strong", className: "status-strong" },
  potential: { label: "Potential", className: "status-potential" },
  risky: { label: "Risky", className: "status-risky" },
  "not-recommended": { label: "Not Recommended", className: "status-not-recommended" },
  applied: { label: "Applied", className: "status-applied" },
  interviewed: { label: "Interviewed", className: "status-interviewed" },
  offers: { label: "Offer", className: "status-offer" },
  rejected: { label: "Rejected", className: "status-rejected" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, className } = config[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", className)}>
      {label}
    </span>
  );
}
