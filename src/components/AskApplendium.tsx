import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { ErrorState, ToneChip } from "@/components/premium/PremiumUI";
import { BUTTON, CARD, EYEBROW, TONES, type Tone } from "@/components/premium/tone";
import { ASK_MAX_QUESTION_CHARS, askApplendium, type AskNextStep, type AskResponse, type AskStage } from "@/lib/ask";
import { buildGmailThreadUrl } from "@/lib/premiumTaskQueue";
import { STATUS_TONE } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

/**
 * Ask Applendium (2026-09-26): a question box that answers from the member's own tracked
 * applications. The backend does the lookups and counting; the AI only words the answer, and
 * every application it names is listed underneath with a way back to the email.
 */

// Starting points, not a menu: each maps to a lookup the backend can answer exactly.
export const ASK_SUGGESTIONS = [
  "Who hasn't replied in 2 weeks?",
  "What should I follow up on?",
  "How many applications did I send this month?",
  "Where do my interviews stand?",
];

// Labels match the Dashboard's stage bar word for word.
const STAGE_LOOK: Record<AskStage, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting on a reply", tone: STATUS_TONE.waiting },
  quiet: { label: "Went quiet", tone: STATUS_TONE.closed },
  interviewing: { label: "Interviewing", tone: STATUS_TONE.interview },
  offer: { label: "Offer", tone: STATUS_TONE.offer },
  rejected: { label: "Rejected", tone: STATUS_TONE.rejected },
  closed: { label: "Closed by you", tone: STATUS_TONE.closed },
};

// Same meanings as the Today list, whose timing the backend used to pick them.
const NEXT_STEP_LABEL: Record<AskNextStep, string> = {
  research: "Research the company",
  find_contact: "Find someone to contact",
  follow_up: "Time to follow up",
  thank_you: "Send a thank-you",
  interview_follow_up: "Follow up on the interview",
  status_check: "Ask for a status update",
};

function shortDate(isoDay: string | null | undefined) {
  if (!isoDay) return null;
  const parsed = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AskApplendium() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const mutation = useMutation<AskResponse, Error, string>({ mutationFn: (text) => askApplendium(text) });

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3 || mutation.isPending) return;
    setAsked(trimmed);
    setQuestion("");
    mutation.mutate(trimmed);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(question);
  };

  const result = mutation.data;
  const since = shortDate(result?.basis?.earliestTrackedOn);
  const count = result?.basis?.applications;

  return (
    <section className={cn(CARD, "px-5 py-5 sm:px-6")} aria-labelledby="ask-applendium-title">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", TONES.brand.icon)} aria-hidden>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 id="ask-applendium-title" className={cn(EYEBROW, "text-foreground")}>
          Ask Applendium
        </h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Ask anything about your search. The answer comes from the applications Applendium tracked for you.
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={ASK_MAX_QUESTION_CHARS}
          placeholder="e.g. Which companies haven't replied since I applied?"
          aria-label="Your question"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className={cn(BUTTON.primary, "shrink-0")}
          disabled={question.trim().length < 3 || mutation.isPending}
          aria-label="Ask"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>

      {!asked ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {ASK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => ask(suggestion)}
              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[12.5px] text-foreground/80 transition hover:bg-muted hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {asked ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="text-[12.5px] text-muted-foreground">
            You asked: <span className="font-medium text-foreground/85">{asked}</span>
          </p>

          {mutation.isPending ? (
            <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground" data-testid="ask-thinking">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Looking through your applications…
            </p>
          ) : null}

          {mutation.isError ? (
            <ErrorState title="No answer this time" detail={mutation.error?.message} onRetry={() => asked && ask(asked)} />
          ) : null}

          {result && !mutation.isPending ? (
            <>
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-foreground" data-testid="ask-answer">
                {result.answer}
              </p>

              {result.applications.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border" data-testid="ask-applications">
                  {result.applications.map((app) => {
                    const look = STAGE_LOOK[app.stage] || STAGE_LOOK.waiting;
                    const gmailUrl = buildGmailThreadUrl(app.threadId);
                    const last = shortDate(app.lastUpdateOn);
                    const step = app.nextStep ? NEXT_STEP_LABEL[app.nextStep] : null;
                    const detail = [last ? `Last update ${last}` : null, step].filter(Boolean).join(" · ");
                    return (
                      <li key={app.ref} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
                        {/* Full row on a phone, so the chip and link drop below instead of squeezing
                            the name to "P…" and the details to one word per line. */}
                        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {app.company}
                            {app.role ? <span className="font-normal text-muted-foreground"> · {app.role}</span> : null}
                          </p>
                          {detail ? <p className="text-[12px] text-muted-foreground">{detail}</p> : null}
                        </div>
                        <ToneChip tone={look.tone}>{look.label}</ToneChip>
                        {gmailUrl ? (
                          <a href={gmailUrl} target="_blank" rel="noreferrer" className={cn(BUTTON.link, "text-[12.5px]")}>
                            Open in Gmail
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <p className="text-[11.5px] leading-snug text-muted-foreground">
                {typeof count === "number" ? `Based on ${count} tracked application${count === 1 ? "" : "s"}${since ? ` since ${since}` : ""}. ` : ""}
                Only company, role, stage and dates are used to answer, never the text of your emails.
              </p>

              <div className="flex flex-wrap gap-2">
                {ASK_SUGGESTIONS.filter((suggestion) => suggestion !== asked).slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default AskApplendium;
