import type { SuggestionDraft } from "@/lib/emails";

export type DraftEdits = { subject: string; body: string; signature: string };
const FILL_IN = /\[(?:your\b|insert\b|add\b|name\b|company\b|role\b|recruiter\b|specific\b|relevant\b)[^\]\n]{0,100}\]/i;

export function initialDraftEdits(draft: SuggestionDraft, displayName?: string | null): DraftEdits {
  const signature = String(displayName || "").trim();
  return {
    subject: draft.subject,
    // Mixed-version backend compatibility: an old placeholder never reaches copied text.
    body: draft.body.replace(/\s*\[Your Name\]\s*$/i, "").trimEnd(),
    signature: signature.length <= 100 && !/[\r\n\x00-\x1f]/.test(signature) && !FILL_IN.test(signature) ? signature : "",
  };
}

export function draftEditingError(edits: DraftEdits): string | null {
  if (!edits.subject.trim()) return "Add a subject before copying.";
  if (!edits.body.trim()) return "Add a message before copying.";
  if (!edits.signature.trim()) return "Add your signature before copying.";
  if (/[\r\n\x00-\x1f]/.test(edits.subject) || /[\r\n\x00-\x1f]/.test(edits.signature)) return "Keep the subject and signature on one line.";
  if (edits.subject.length > 300 || edits.body.length > 12_000 || edits.signature.length > 100) return "Shorten the subject, message or signature before copying.";
  if (FILL_IN.test(`${edits.subject}\n${edits.body}\n${edits.signature}`)) return "Replace the fill-in placeholders before copying.";
  return null;
}

export function editedDraftText(edits: DraftEdits, includeSubject = false): string {
  const error = draftEditingError(edits);
  if (error) throw new Error(error);
  const body = `${edits.body.trim()}\n${edits.signature.trim()}`;
  return includeSubject ? `Subject: ${edits.subject.trim()}\n\n${body}` : body;
}
