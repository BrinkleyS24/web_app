import { Users } from "lucide-react";

interface ReferralNudgeProps {
  company: string | null | undefined;
}

export function ReferralNudge({ company }: ReferralNudgeProps) {
  const name = typeof company === "string" ? company.trim() : "";
  if (!name) return null;

  const href = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`;

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/10 p-4 space-y-1.5">
      <div className="flex items-start gap-2">
        <Users className="h-4 w-4 shrink-0 mt-0.5 text-accent" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold text-foreground leading-snug">
            Referred candidates clear screening far more often than cold applies.
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Before you apply, it&apos;s worth finding a warm intro at {name}.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs font-medium text-accent underline underline-offset-2 hover:text-accent/80"
          >
            Find people at {name}
          </a>
        </div>
      </div>
    </div>
  );
}
