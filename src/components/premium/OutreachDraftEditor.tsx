import { useId, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext.jsx";
import { useDraftSession } from "@/hooks/useDraftSession";
import { draftEditingError, editedDraftText, initialDraftEdits, type DraftEdits } from "@/lib/outreachDraftEditing";
import type { SuggestionDraft } from "@/lib/emails";
import { Button } from "@/components/ui/button";

export function OutreachDraftEditor({ draft, draftKey, gmailUrl }: { draft: SuggestionDraft; draftKey: string; gmailUrl: string | null }) {
  const { user } = useAuth();
  const fieldId = useId();
  const [session, updateSession] = useDraftSession<DraftEdits>("edits");
  const key = `${draftKey}:${draft.context}`;
  const edits = session[key] || initialDraftEdits(draft, user?.displayName);
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const copyPending = useRef(false);
  const error = draftEditingError(edits);
  const subjectField = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = subjectField.current;
    if (field) { field.style.height = "auto"; field.style.height = `${Math.max(64, field.scrollHeight)}px`; }
  }, [edits.subject]);
  const fieldClass = "w-full min-w-0 rounded-xl border border-border bg-background p-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
  const change = (field: keyof DraftEdits, value: string) => {
    updateSession(current => ({ ...current, [key]: { ...(current[key] || edits), [field]: value } }));
    setMessage("");
  };
  async function copy(includeSubject: boolean) {
    if (error || copyPending.current) return;
    copyPending.current = true;
    setCopying(true); setMessage("");
    try { await navigator.clipboard.writeText(editedDraftText(edits, includeSubject)); setMessage(includeSubject ? "Edited subject and message copied. Paste into the conversation and review before sending." : "Edited message copied. Paste into the conversation and review before sending."); }
    catch { setMessage("Copy failed. Select the message and signature below and copy them manually."); }
    finally { copyPending.current = false; setCopying(false); }
  }
  return <div className="min-w-0 space-y-3">
    <div><label htmlFor={`${fieldId}-subject`} className="block text-sm font-medium">Subject</label>
      <textarea id={`${fieldId}-subject`} ref={subjectField} rows={2} data-testid="draft-subject" value={edits.subject} maxLength={300} className={`${fieldClass} resize-none [overflow-wrap:anywhere]`} onChange={event => change("subject", event.target.value)} />
    </div>
    <div><label htmlFor={`${fieldId}-message`} className="block text-sm font-medium">Message</label>
      <textarea id={`${fieldId}-message`} value={edits.body} maxLength={12_000} className={`${fieldClass} min-h-[220px] leading-6`} onChange={event => change("body", event.target.value)} />
    </div>
    <div><label htmlFor={`${fieldId}-signature`} className="block text-sm font-medium">Your signature</label>
      <input id={`${fieldId}-signature`} value={edits.signature} maxLength={100} autoComplete="name" className={fieldClass} onChange={event => change("signature", event.target.value)} />
    </div>
    <p className="text-xs text-muted-foreground">Your signature is added below the message when copied. Each preset keeps its own edits in this tab for up to 30 minutes after you leave this page. Reloading or signing out clears them.</p>
    {error ? <p className="text-sm text-warning" role="status">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={Boolean(error) || copying} onClick={() => void copy(false)}>Copy draft</Button>
      <Button variant="outline" size="sm" disabled={Boolean(error) || copying} onClick={() => void copy(true)}>Copy subject + body</Button>
      {gmailUrl ? <a className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium" href={gmailUrl} target="_blank" rel="noreferrer">Open Gmail conversation</a> : null}
    </div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    <p className="text-xs text-muted-foreground">Copying or opening Gmail does not send this message or mark the action done.</p>
  </div>;
}
