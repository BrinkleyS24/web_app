import { useState } from "react";
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

  async function copy() {
    const text = subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3.5" data-testid="ask-draft">
      <label className="block text-[12px] font-semibold text-muted-foreground" htmlFor="ask-draft-subject">Subject</label>
      <input
        id="ask-draft-subject"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      />
      <label className="block text-[12px] font-semibold text-muted-foreground" htmlFor="ask-draft-body">Message</label>
      <textarea
        id="ask-draft-body"
        className="min-h-[160px] w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <button type="button" className={BUTTON.secondary} onClick={copy}>
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy email"}
      </button>
      <p className="text-[12px] text-muted-foreground">Review it before you send. Applendium never sends email for you.</p>
    </div>
  );
}
