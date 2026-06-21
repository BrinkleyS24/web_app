import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useInView, animate, useReducedMotion } from "framer-motion";

interface MetricCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

const EASE = [0.16, 1, 0.3, 1] as const;

function formatNum(n: number, decimals: number) {
  const fixed = n.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${withCommas}.${frac}` : withCommas;
}

export function MetricCard({ icon: Icon, label, value, change, changeType = "neutral" }: MetricCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();

  const raw = String(value ?? "");
  const match = raw.match(/^(-?[\d,]*\.?\d+)(.*)$/);
  const target = match ? parseFloat(match[1].replace(/,/g, "")) : null;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1]?.length || 0 : 0;

  // Start at the real value so SSR/tests/reduced-motion show it immediately;
  // the count-up only re-runs in-browser when scrolled into view.
  const [display, setDisplay] = useState(raw);

  useEffect(() => {
    if (target === null || reduce || !inView) return undefined;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (v) => setDisplay(formatNum(v, decimals) + suffix),
    });
    return () => controls.stop();
  }, [inView, target, reduce, suffix, decimals]);

  return (
    <motion.div
      ref={ref}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ duration: 0.2 }}
      className="group glass-card relative overflow-hidden rounded-xl p-5 transition-colors hover:border-accent/30"
    >
      {/* hover accent wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {Icon ? <Icon className="h-4 w-4 text-accent" /> : null}
      </div>
      <p className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-foreground tabular-nums">
        {display}
      </p>
      {change ? (
        <p
          className={
            "mt-1 text-xs " +
            (changeType === "positive"
              ? "text-success"
              : changeType === "negative"
                ? "text-destructive"
                : "text-muted-foreground")
          }
        >
          {change}
        </p>
      ) : null}
    </motion.div>
  );
}
