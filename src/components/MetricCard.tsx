import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export function MetricCard({ icon: Icon, label, value, change, changeType = "neutral" }: MetricCardProps) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        {Icon ? <Icon className="w-4 h-4 text-accent" /> : null}
      </div>
      <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-foreground">{value}</p>
      {change && (
        <p className={"text-xs mt-1 " + (
          changeType === "positive" ? "text-success" :
          changeType === "negative" ? "text-destructive" :
          "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
