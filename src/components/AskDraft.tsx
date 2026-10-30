import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { BUTTON } from "@/components/premium/tone";

/**
 * A drafted email from Ask Applendium, as editable fields with a Copy button (A+ review,
 * 2026-10-14): the draft used to arrive crammed into the answer paragraph between "---" markers,
 * with nothing to edit and nothing to copy. What is copied is what the member edited.
 */
export function AskDraft({ draft }: { draft: { subject?: string | null; body: string } }) {
  const [subject, setSubject] = useState(draft.subject || "");
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  function changed() {
    revision.current += 1;
    setCopied(false);
    setCopyError("");
    if (timer.current) clearTimeout(timer.current);
  }

  async function copy() {
    if (!body.trim()) return;
    const atRevision = revision.current;
    const text = subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      if (!active.current || atRevision !== revision.current) return;
      setCopied(true);
      setCopyError("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (!active.current || atRevision !== revision.current) return;
      setCopied(false);
      setCopyError("Couldn't copy this email. Your edits are still here. Try again or select the text to copy it manually.");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3.5" data-testid="ask-draft">
      <label className="block text-[12px] font-semibold text-muted-foreground" htmlFor="ask-draft-subject">Subject</label>
      <input
        id="ask-draft-subject"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
        value={subject}
        onChange={(event) => { changed(); setSubject(event.target.value); }}
      />
      <label className="block text-[12px] font-semibold text-muted-foreground" htmlFor="ask-draft-body">Message</label>
      <textarea
        id="ask-draft-body"
        className="min-h-[160px] w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground"
        value={body}
        onChange={(event) => { changed(); setBody(event.target.value); }}
      />
      <button type="button" className={BUTTON.secondary} onClick={copy} disabled={!body.trim()}>
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy email"}
      </button>
      {copyError ? <p role="alert" className="text-[13px] text-destructive">{copyError}</p> : null}
      <p className="text-[12px] text-muted-foreground">Review it before you send. Applendium never sends email for you.</p>
    </div>
  );
}
