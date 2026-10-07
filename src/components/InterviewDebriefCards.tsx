import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { ApiRequestError } from "@/lib/api.js";

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
  // Background refetches may change the source, never the batch under the user's finger.
  // An explicit page refresh loads a new batch after a stale-view response.
  const [batch] = useState(items);
  const [batchTotal] = useState(total);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [alreadyResolvedCount, setAlreadyResolvedCount] = useState(0);
  const saving = useRef(false);

  const remaining = useMemo(() => batch.filter((item) => !handled.has(item.key)), [batch, handled]);
  const current = remaining[0] || null;

  // Only refetch once the local stack is empty. Invalidating on every tap would re-render the
  // hero underneath the user's finger and swap the card they were reading for a different one.
  const refreshDependentViews = () => {
    queryClient.invalidateQueries({ queryKey: ["strategy-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["email-metrics"] });
  };

  const handle = async (item: InterviewDebriefItem, outcome: Outcome) => {
    if (saving.current || requiresRefresh || item.actionReference === null) return;
    setError(null);

    if (outcome === "live") {
      const next = new Set(handled).add(item.key);
      setHandled(next);
      if (next.size >= batch.length) refreshDependentViews();
      return;
    }

    saving.current = true;
    setPending(item.key);
    try {
      const result = await recordInterviewDebrief({ emailId: item.emailId, answer: outcome,
        ...(item.actionReference !== undefined && item.actionReference !== null ? { actionReference: item.actionReference } : {}) });
      if (result?.success !== true) throw new Error("Save was not confirmed");
      const next = new Set(handled).add(item.key);
      setHandled(next);
      if (result.recorded === false) setAlreadyResolvedCount((count) => count + 1);
      else setAnsweredCount((count) => count + 1);
      if (next.size >= batch.length) refreshDependentViews();
    } catch (failure) {
      // The card stays. A silent failure here would look like the answer was accepted and
      // then have the same question reappear tomorrow, which is worse than never asking.
      if (failure instanceof ApiRequestError && failure.status === 401) {
        setError("That did not save. Your sign-in has expired. Sign in again, then retry.");
      } else if (failure instanceof ApiRequestError && failure.status === 404) {
        setRequiresRefresh(true);
        setError("That did not save. This email or its application is no longer available. Refresh this page, then retry.");
      } else if (failure instanceof ApiRequestError && failure.status === 409) {
        const code = failure.payload?.code;
        if (code === "APPLICATION_CHANGED") setRequiresRefresh(true);
        setError(code === "APPLICATION_LINK_BUSY"
          ? "That did not save. Your jobs are being updated. Wait a moment, then try again."
          : code === "APPLICATION_LINK_LIMIT"
            ? "That did not save. This role needs an application link, but your tracking limit is reached. Review your plan or retry after the limit resets."
            : code === "APPLICATION_LINK_REVIEW_REQUIRED"
              ? "That did not save. I could not link this email to one application safely. Open the matching role in the extension to check its company and job title."
              : "That did not save. This role changed while saving. Refresh this page, then retry.");
      } else if (failure instanceof ApiRequestError && failure.payload?.code === "APPLICATION_ACTION_UNAVAILABLE") {
        setRequiresRefresh(true);
        setError("That did not save. Refresh this page to load the current role before retrying.");
      } else if (failure instanceof ApiRequestError && (failure.status ?? 0) >= 500) {
        setError("That did not save. Applendium could not save your answer. Try again in a moment.");
      } else {
        setError("That did not save. Check your connection and try again.");
      }
    } finally {
      saving.current = false;
      setPending(null);
    }
  };

  if (!current) {
    if (answeredCount === 0 && alreadyResolvedCount === 0) return null;
    return (
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          {answeredCount > 0
            ? `${answeredCount} recorded. Your next read uses ${answeredCount === 1 ? "it" : "them"} — reload when you want the updated one.`
            : "These roles already have tracked outcomes. Refresh to see the updated read."}
        </span>
      </div>
    );
  }

  const stillToGo = Math.max(batchTotal - answeredCount - 1, 0);
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
              disabled={isPending || requiresRefresh || current.actionReference === null}
              onClick={() => handle(current, choice.outcome)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {error || current.actionReference === null ? (
        <div className="mt-2" role="alert">
          <p className="text-[12px] font-semibold leading-snug text-destructive">{error || "I could not identify this application safely. Review the role in the extension before recording its outcome."}</p>
          {requiresRefresh ? <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-foreground">Refresh page</button> : null}
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
          {stillToGo > 0 ? `${stillToGo} more · about ${minutes} minute${minutes === 1 ? "" : "s"}` : "Last one."}
          {" "}Stop whenever you like — every answer counts on its own.
        </p>
      )}
    </div>
  );
}
