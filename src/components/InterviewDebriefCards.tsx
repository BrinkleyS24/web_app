import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";

import {
  recordInterviewDebrief,
  type InterviewDebriefAnswer,
  type InterviewDebriefItem,
} from "@/lib/emails";

/**
 * The ask, one interview at a time.
 *
 * Founder's complaint about the previous dashboard was that it named a problem and then had
 * nothing for him to do about it. The deeper version of that problem was that the product did
 * not actually KNOW enough to advise: it could see how 4 of his 23 interviews ended, and was
 * calling the other 19 a conversion failure. An interview that dies in silence sends no email,
 * so no amount of classifier work recovers this — the only source is the person who was there.
 *
 * Hence: three buttons, no typing, no modal, no navigation. The cost of an answer has to be
 * lower than the cost of ignoring it or the data never arrives, and without the data every
 * sentence this product says about interviewing is a guess wearing a finding's clothes.
 */

/** Seconds a card realistically costs. Used only for the "about N minutes" honesty line. */
const SECONDS_PER_CARD = 8;

type Outcome = InterviewDebriefAnswer | "live";

const CHOICES: Array<{ outcome: Outcome; label: string }> = [
  { outcome: "no_response", label: "Never heard back" },
  { outcome: "rejected", label: "Rejected" },
  // "Still live" writes NOTHING. A process the user says is alive is a censored observation,
  // not an outcome, and recording it as one would put a fictional ending into the same funnel
  // this feature exists to stop guessing about. It only dismisses the card for this session.
  { outcome: "live", label: "Still live" },
];

export function InterviewDebriefCards({
  items,
  total,
}: {
  items: InterviewDebriefItem[];
  total: number;
}) {
  const queryClient = useQueryClient();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const remaining = useMemo(() => items.filter((item) => !handled.has(item.key)), [items, handled]);
  const current = remaining[0] || null;

  // Only refetch once the local stack is empty. Invalidating on every tap would re-render the
  // hero underneath the user's finger and swap the card they were reading for a different one.
  const refreshDependentViews = () => {
    queryClient.invalidateQueries({ queryKey: ["strategy-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["email-metrics"] });
  };

  const handle = async (item: InterviewDebriefItem, outcome: Outcome) => {
    setError(null);

    if (outcome === "live") {
      const next = new Set(handled).add(item.key);
      setHandled(next);
      if (next.size >= items.length) refreshDependentViews();
      return;
    }

    setPending(item.key);
    try {
      await recordInterviewDebrief({ emailId: item.emailId, answer: outcome });
      const next = new Set(handled).add(item.key);
      setHandled(next);
      setAnsweredCount((count) => count + 1);
      if (next.size >= items.length) refreshDependentViews();
    } catch {
      // The card stays. A silent failure here would look like the answer was accepted and
      // then have the same question reappear tomorrow, which is worse than never asking.
      setError("That did not save. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  };

  if (!current) {
    if (answeredCount === 0) return null;
    return (
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          {answeredCount} recorded. Your next read uses {answeredCount === 1 ? "it" : "them"} — reload
          when you want the updated one.
        </span>
      </div>
    );
  }

  const stillToGo = Math.max(total - answeredCount - 1, 0);
  const minutes = Math.max(1, Math.round(((stillToGo + 1) * SECONDS_PER_CARD) / 60));
  const isPending = pending === current.key;

  return (
    <div className="mt-5">
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5">
        <p className="text-[13px] font-semibold leading-snug text-foreground">
          {current.label}
          {current.silentLabel ? (
            <span className="font-normal text-muted-foreground"> · interviewed {current.silentLabel}</span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.outcome}
              type="button"
              disabled={isPending}
              onClick={() => handle(current, choice.outcome)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] font-semibold leading-snug text-destructive">{error}</p>
      ) : (
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
          {stillToGo > 0 ? `${stillToGo} more · about ${minutes} minute${minutes === 1 ? "" : "s"}` : "Last one."}
          {" "}Stop whenever you like — every answer counts on its own.
        </p>
      )}
    </div>
  );
}
