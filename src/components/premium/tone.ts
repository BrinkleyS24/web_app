/**
 * The premium surfaces' shared vocabulary for status. Every page marks the same six meanings the
 * same way, so "needs attention" looks identical on the Dashboard, Next Actions and Strategy Alerts.
 * Subtle by design: tinted backgrounds and a colored dot or rail, never a full-color block.
 */
export type Tone = "attention" | "upcoming" | "positive" | "risk" | "neutral" | "done" | "brand";

export type ToneStyle = {
  /** Small pill: tinted background, colored text, hairline ring. */
  chip: string;
  /** Rounded square behind an icon. */
  icon: string;
  /** Solid 3px rail / dot color. */
  rail: string;
  /** Colored text alone. */
  text: string;
  /** Faint card surface + border for a whole card. */
  surface: string;
};

export const TONES: Record<Tone, ToneStyle> = {
  attention: {
    chip: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/20",
    icon: "bg-warning/10 text-warning",
    rail: "bg-warning",
    text: "text-warning",
    surface: "bg-warning/[0.035] border-warning/25",
  },
  upcoming: {
    chip: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
    icon: "bg-info/10 text-info",
    rail: "bg-info",
    text: "text-info",
    surface: "bg-info/[0.035] border-info/25",
  },
  positive: {
    chip: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
    icon: "bg-success/10 text-success",
    rail: "bg-success",
    text: "text-success",
    surface: "bg-success/[0.035] border-success/25",
  },
  risk: {
    chip: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
    icon: "bg-destructive/10 text-destructive",
    rail: "bg-destructive",
    text: "text-destructive",
    surface: "bg-destructive/[0.03] border-destructive/25",
  },
  neutral: {
    chip: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    icon: "bg-muted text-muted-foreground",
    rail: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    surface: "bg-card border-border",
  },
  done: {
    chip: "bg-muted text-muted-foreground/80 ring-1 ring-inset ring-border",
    icon: "bg-muted text-muted-foreground/70",
    rail: "bg-muted-foreground/25",
    text: "text-muted-foreground/80",
    surface: "bg-muted/40 border-border",
  },
  brand: {
    chip: "bg-accent/10 text-accent ring-1 ring-inset ring-accent/20",
    icon: "bg-accent/10 text-accent",
    rail: "bg-accent",
    text: "text-accent",
    surface: "bg-accent/[0.035] border-accent/25",
  },
};

/** Shared button looks for premium pages (the shadcn outline variant fills brand-green on hover). */
export const BUTTON = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
  link: "inline-flex items-center gap-1 text-[13px] font-semibold text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:underline",
} as const;

export const EYEBROW = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground";
export const CARD = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(11,18,32,0.04)]";
