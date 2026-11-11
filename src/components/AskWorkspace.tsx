import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Loader2, Search } from "lucide-react";
import { ASK_HANDOFF_ROUTES, ASK_MAX_QUESTION_CHARS, ASK_SUGGESTIONS, askAnswerLines, type AskQuote, type AskResponse } from "@/lib/ask";
import { ASK_RESULTS_PAGE_SIZE, ASK_STAGE_LABELS, ASK_STEP_LABELS, askDate, askResultRows, orderAskRows, type AskResultRow } from "@/lib/askResults";
import { buildGmailThreadUrl } from "@/lib/premiumTaskQueue";
import { friendlyErrorMessage } from "@/lib/apiErrors";
import { ApiRequestError } from "@/lib/api";
import { BUTTON, CARD } from "@/components/premium/tone";
import { cn } from "@/lib/utils";
import { AskAnswerText, AskTotalsList } from "./AskAnswerText";
import { AskDraft } from "./AskDraft";

type Props = {
  ownerId: string | null; question: string; onQuestionChange: (text: string) => void;
  onAsk: (text: string) => void;
  asked: string | null; pending: boolean; error: Error | null; result?: AskResponse;
};

function EmailLink({ threadId }: { threadId?: string | null }) {
  const url = buildGmailThreadUrl(threadId);
  return url ? <a href={url} target="_blank" rel="noreferrer" className={cn(BUTTON.link, "min-h-11 text-sm")}>
    Open in Gmail <ExternalLink className="h-3.5 w-3.5" aria-hidden />
  </a> : <span className="text-xs text-muted-foreground">Email link unavailable</span>;
}

function EmailQuote({ quote }: { quote: AskQuote }) {
  return <details className="rounded-xl border border-border bg-muted/20 px-4 py-3">
    <summary className="cursor-pointer text-sm font-medium [overflow-wrap:anywhere]">
      What {quote.company} wrote{askDate(quote.date) ? ` · ${askDate(quote.date)}` : ""}
    </summary>
    <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm leading-relaxed [overflow-wrap:anywhere]">{quote.passage}</blockquote>
    {quote.rejectionNote ? <p className="mt-2 text-sm">From your inbox: {quote.rejectionNote}</p> : null}
    <EmailLink threadId={quote.threadId} />
    <p className="text-xs text-muted-foreground">Shown directly from your inbox. The AI did not read this passage.</p>
  </details>;
}

function NarrativeAnswer({ result }: { result: AskResponse }) {
  const lines = askAnswerLines(result);
  if (lines.length <= 6 && lines.join("\n").length <= 700) return <AskAnswerText result={result} />;
  const preview: string[] = [];
  let budget = 450;
  for (const line of lines.slice(0, 3)) {
    if (line.length <= budget) { preview.push(line); budget -= line.length; }
    else { const part = line.slice(0, budget); const sentence = part.match(/^.*?[.!?](?=\s|$)/)?.[0]; const boundary = part.lastIndexOf(" "); preview.push(sentence && sentence.length >= 15 ? sentence : `${part.slice(0, boundary > budget / 2 ? boundary : budget)}…`); break; }
    if (budget < 100) break;
  }
  return <div className="space-y-3">
    <AskAnswerText result={{ ...result, answerLines: preview }} />
    <details className="rounded-xl border border-border px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">Read the full answer</summary>
      <div className="mt-3"><AskAnswerText result={result} /></div>
    </details>
  </div>;
}

function ResultRow({ row, result }: { row: AskResultRow; result: AskResponse }) {
  const citation = row.citation;
  const stage = citation?.interviewQuiet ? "interview_quiet" : row.stage || citation?.stage;
  const interview = result.list?.kind === "reached_interview";
  const date = askDate(interview ? row.interviewedOn : row.appliedOn || citation?.appliedOn);
  const quotes = result.quotes?.filter(quote => quote.ref === row.ref) || [];
  return <li className="space-y-2 p-4 [overflow-wrap:anywhere]" data-testid="ask-result-row">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1 basis-52">
        <h3 className="text-[15px] font-semibold leading-snug">{row.company || "Company not identified"}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{row.role || "Role not identified"}</p>
      </div>
      {stage && ASK_STAGE_LABELS[stage] ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{ASK_STAGE_LABELS[stage]}</span> : null}
    </div>
    <p className="text-sm text-muted-foreground">
      {interview ? [date ? `${row.interviewDateKnown === false ? "Invited" : row.interviewDateKnown === true ? "Interview" : "Interview-stage evidence"} ${date}` : "Interview date not established", row.interviewStatus === "cancelled" ? row.interviewDateKnown === true ? "Next interview cancelled" : row.interviewDateKnown === false ? "Interview cancelled" : "Cancellation recorded" : null].filter(Boolean).join(" · ")
        : [row.daysSinceLastUpdate != null ? `No tracked reply for ${row.daysSinceLastUpdate} days` : null, date ? `Applied ${date}` : null].filter(Boolean).join(" · ")}
    </p>
    {citation?.nextStep && ASK_STEP_LABELS[citation.nextStep] ? <p className="text-sm font-medium">{ASK_STEP_LABELS[citation.nextStep]}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <EmailLink threadId={row.threadId ?? citation?.threadId} />
      {citation?.why || citation?.note ? <details className="basis-full text-sm">
        <summary className="cursor-pointer py-2 font-medium">Why this application is included</summary>
        {citation.why ? <p className="py-1 leading-relaxed">{citation.why}</p> : null}
        {citation.note ? <p className="py-1 leading-relaxed">From your inbox: {citation.note}</p> : null}
      </details> : null}
    </div>
    {quotes.map((quote, i) => <EmailQuote key={`${quote.ref}-${i}`} quote={quote} />)}
  </li>;
}

function ApplicationResults({ result }: { result: AskResponse }) {
  const rows = useMemo(() => askResultRows(result), [result]);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState(result.list && result.answerKind !== "compound" ? "recent" : "answered");
  const [page, setPage] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const focusPage = useRef(false);
  const filtered = useMemo(() => orderAskRows(rows, search, order, result.list?.kind), [rows, search, order, result.list?.kind]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / ASK_RESULTS_PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * ASK_RESULTS_PAGE_SIZE;
  useEffect(() => {
    if (focusPage.current) { focusPage.current = false; title.current?.focus(); title.current?.scrollIntoView?.({ block: "start" }); }
  }, [currentPage]);
  if (!rows.length) return null;
  return <section className={cn(CARD, "overflow-hidden")} aria-labelledby="ask-results-title">
    <div className="space-y-3 border-b border-border p-4 sm:p-5">
      <h2 id="ask-results-title" ref={title} tabIndex={-1} className="text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{result.list && result.answerKind !== "compound" ? "Applications in this answer" : "Applications cited as sources"}</h2>
      {!result.list || result.answerKind === "compound" ? <p className="text-xs text-muted-foreground">These are the source references returned with the answer; they may be a selection.</p> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs font-medium">Filter by company or role
          <span className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm" />
          </span>
        </label>
        <label className="block text-xs font-medium">Sort results
          <select value={order} onChange={e => { setOrder(e.target.value); setPage(0); }} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm sm:min-w-48">
            <option value="answered">As answered</option>
            <option value="recent">{result.list?.kind === "reached_interview" ? "Latest interview evidence" : "Most recent activity"}</option>
            {result.list?.kind === "no_reply" ? <option value="longest">Longest without a reply</option> : null}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {filtered.length ? `${start + 1}–${Math.min(start + ASK_RESULTS_PAGE_SIZE, filtered.length)} of ${filtered.length}${search.trim() ? ` filtered results · ${rows.length} in this answer` : " applications"}` : `No results for this filter · ${rows.length} in this answer`}
      </p>
    </div>
    {filtered.length ? <ul className="divide-y divide-border" data-testid="ask-applications">
      {filtered.slice(start, start + ASK_RESULTS_PAGE_SIZE).map(row => <ResultRow key={row.ref} row={row} result={result} />)}
    </ul> : <div className="space-y-2 p-5"><p className="text-sm">No company or role matches your filter.</p><button type="button" className={BUTTON.secondary} onClick={() => { setSearch(""); setPage(0); }}>Clear filter</button></div>}
    {filtered.length > ASK_RESULTS_PAGE_SIZE ? <nav aria-label="Application result pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
      <button type="button" disabled={currentPage === 0} className={cn(BUTTON.secondary, "min-h-11")} onClick={() => { focusPage.current = true; setPage(currentPage - 1); }}>Previous</button>
      <span className="text-xs text-muted-foreground">Page {currentPage + 1} of {lastPage + 1}</span>
      <button type="button" disabled={currentPage >= lastPage} className={cn(BUTTON.secondary, "min-h-11")} onClick={() => { focusPage.current = true; setPage(currentPage + 1); }}>Next</button>
    </nav> : null}
  </section>;
}

function Answer({ result }: { result: AskResponse }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const list = result.list;
  const structured = result.answerKind === "list" && (list?.kind === "no_reply" || list?.kind === "reached_interview");
  const rows = useMemo(() => askResultRows(result), [result]);
  const refs = new Set(rows.map(row => row.ref));
  const extraQuotes = result.quotes?.filter(quote => !refs.has(quote.ref)) || [];
  const [visibleQuotes, setVisibleQuotes] = useState(5);
  const summary = structured && list?.kind === "no_reply"
    ? `${list.total} application${list.total === 1 ? "" : "s"} with no tracked reply`
    : structured && list?.kind === "reached_interview" ? `${list.total} application${list.total === 1 ? " has" : "s have"} reached an interview` : "Your answer";
  return <div className="space-y-4 [overflow-wrap:anywhere]">
    <section className={cn(CARD, "space-y-4 p-5 sm:p-6")} aria-labelledby="ask-answer-title">
      <h2 ref={heading} id="ask-answer-title" tabIndex={-1} className="text-xl font-semibold leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{summary}</h2>
      {result.unansweredQuestions?.length ? <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><p className="font-medium">Part of your question could not be answered</p><ul className="mt-1 list-disc pl-5">{result.unansweredQuestions.map((text, i) => <li key={i}>{text}</li>)}</ul><p className="mt-1">The full answer explains what was unavailable.</p></div> : null}
      {structured ? <>
        <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{list.kind === "no_reply"
          ? `${list.minDays ? `No tracked employer reply for at least ${list.minDays} days. ` : ""}Applications with assessment replies are excluded. Silence does not establish a rejection.`
          : "Includes applications that later ended in an offer or rejection. An invitation does not confirm attendance."}</p>
        {list.total === 0 ? <p className="text-sm">No applications match this request in your tracked history.</p> : null}
        {list.kind === "no_reply" && list.total > 0 ? <div className="space-y-2">
          <Link to="/next-actions" className={cn(BUTTON.primary, "min-h-11")}>See prioritized next actions <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <p className="text-xs text-muted-foreground">You do not need to follow up on every silent application.</p>
        </div> : null}
        {!!list.excludedAsReplied?.length && <details className="text-sm"><summary className="cursor-pointer py-2">{list.excludedAsReplied.length} assessment repl{list.excludedAsReplied.length === 1 ? "y excluded" : "ies excluded"}</summary><ul className="mt-2 list-disc space-y-1 pl-5">{list.excludedAsReplied.map(item => <li key={item.ref}>{item.company}{askDate(item.repliedOn) ? ` · ${askDate(item.repliedOn)}` : ""}</li>)}</ul></details>}
      </> : <NarrativeAnswer result={result} />}
      {result.totals ? <AskTotalsList totals={result.totals} /> : null}
      {result.handoff && ASK_HANDOFF_ROUTES[result.handoff.kind] ? <Link className={cn(BUTTON.primary, "min-h-11")} to={ASK_HANDOFF_ROUTES[result.handoff.kind]}>{result.handoff.label}<ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
      {!structured && !result.handoff && result.applications.some(app => app.nextStep) ? <Link className={cn(BUTTON.primary, "min-h-11")} to="/next-actions">Prioritize in Next Actions<ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
      {result.draft?.body ? <div className="[&_input]:min-h-11 [&_input]:text-base [&_textarea]:text-base [&_button]:min-h-11"><AskDraft key={result.draft.body} draft={result.draft} /></div> : null}
    </section>
    <ApplicationResults result={result} />
    {extraQuotes.length ? <section className="space-y-2" aria-label="Email evidence">
      {extraQuotes.slice(0, visibleQuotes).map((quote, i) => <EmailQuote key={`${quote.ref}-${i}`} quote={quote} />)}
      {visibleQuotes < extraQuotes.length ? <button type="button" className={BUTTON.secondary} onClick={() => setVisibleQuotes(n => n + 5)}>Show more email evidence ({extraQuotes.length - visibleQuotes} remaining)</button> : null}
    </section> : null}
    <details className="px-1 text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer py-2 font-medium">About this answer</summary>
      {typeof result.basis?.applications === "number" ? <p className="mt-2">Based on {result.basis.applications} tracked applications{askDate(result.basis.earliestTrackedOn) ? ` since ${askDate(result.basis.earliestTrackedOn)}` : ""}.</p> : null}
      <p className="mt-1">{result.handoff?.source === "confirmed_resume_outcomes" ? "Uses confirmed resume submissions and tracked outcomes. No resume content was sent to AI." : result.handoff && ["apply_gate", "resumes"].includes(result.handoff.kind) ? "Uses your saved resume list. No resume content was sent to AI." : "Answers use your tracked application details. When AI is used, it receives structured facts, never the text of your emails."}</p>
    </details>
  </div>;
}

export function AskWorkspace({ ownerId, question, onQuestionChange, onAsk, asked, pending, error, result }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const trackedRecovery = error instanceof ApiRequestError && error.payload?.recovery === "tracked_lookups";
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const submit = (text: string) => {
    if (!ownerId || pending || text.trim().length < 3) return;
    setEditing(false); onAsk(text);
  };
  return <div className="space-y-4" data-testid="ask-workspace">
    {asked && !editing ? <section className={cn(CARD, "space-y-2 p-4 sm:p-5")} aria-label="Current question">
      <p className="text-xs font-medium text-muted-foreground">You asked</p><p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{asked}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <button type="button" disabled={pending} className={cn(BUTTON.link, "min-h-11 text-sm")} onClick={() => { onQuestionChange(asked); setEditing(true); }}>Edit question</button>
        <button type="button" disabled={pending} className={cn(BUTTON.link, "min-h-11 text-sm")} onClick={() => { onQuestionChange(""); setEditing(true); }}>Ask another question</button>
      </div>
    </section> : <>
    <section className={cn(CARD, "p-4 sm:p-5")} aria-label="Ask a question">
      <form onSubmit={e => { e.preventDefault(); submit(question); }} className="space-y-3">
        <label htmlFor="ask-workspace-question" className="block text-sm font-semibold">Your question</label>
        <textarea id="ask-workspace-question" ref={input} value={question} onChange={e => onQuestionChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(question); } }} maxLength={ASK_MAX_QUESTION_CHARS} placeholder="e.g. Which applications need a follow-up?" rows={2} className="min-h-20 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-base leading-relaxed" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Applications, replies, interviews or your next step.</p>
          <button type="submit" disabled={!ownerId || question.trim().length < 3 || pending} className={cn(BUTTON.primary, "min-h-11")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}Ask
          </button>
        </div>
      </form>
      {!asked ? <div className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-medium text-muted-foreground">Try a question</h2>
        <div className="grid gap-2 sm:grid-cols-2">{ASK_SUGGESTIONS.map(text => <button key={text} type="button" disabled={!ownerId || pending} className="min-h-11 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => submit(text)}>{text}</button>)}</div>
      </div> : null}
    </section>
    {asked ? <button type="button" className={cn(BUTTON.link, "min-h-11 px-1 text-sm")} onClick={() => setEditing(false)}>Back to answer</button> : null}
    </>}
    {pending ? <p role="status" className="flex items-center gap-2 px-1 py-4 text-sm" data-testid="ask-thinking"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />Checking your tracked applications…</p> : null}
    {error ? <section role="alert" className={cn(CARD, "space-y-3 border-destructive/30 p-5")}><h2 className="font-semibold">We couldn't answer that question</h2><p className="text-sm leading-relaxed">{friendlyErrorMessage(error, "Please try again. Your question is still here.")}</p>
      {trackedRecovery ? <div className="flex flex-wrap gap-2"><button type="button" className={cn(BUTTON.primary, "min-h-11")} onClick={() => submit("Who hasn't replied in 2 weeks?")}>Find unanswered applications</button><button type="button" className={cn(BUTTON.secondary, "min-h-11")} onClick={() => submit("How many applications have I tracked?")}>Show application totals</button></div>
        : <button type="button" className={cn(BUTTON.secondary, "min-h-11")} onClick={() => asked && submit(asked)}>Try again</button>}
    </section> : null}
    {result ? <Answer key={asked} result={result} /> : null}
    {asked && !pending ? <details className="px-1 text-sm"><summary className="cursor-pointer py-2 font-medium">Ask something else</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{ASK_SUGGESTIONS.filter(text => text !== asked).map(text => <button key={text} type="button" disabled={!ownerId} className="min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => submit(text)}>{text}</button>)}</div></details> : null}
  </div>;
}
