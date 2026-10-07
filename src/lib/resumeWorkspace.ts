import { apiFetch } from '@/lib/api';
import { readActionContext } from './actionWorkspace';

export const RESUME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ResumeDocument = { id: string; name: string; text: string; fingerprint: string };
export function readResumeChoice(search: string): { present: boolean; id: string | null } {
  const values = new URLSearchParams(search).getAll('resume');
  return { present: values.length > 0, id: values.length === 1 && RESUME_ID.test(values[0]) ? values[0].toLowerCase() : null };
}
export function resumeToolHref(path: '/resumes' | '/apply-gate', id: string, search: string): string {
  if (!RESUME_ID.test(id)) throw new Error('Choose an available saved resume.');
  const params = new URLSearchParams({ resume: id }); const context = readActionContext(search);
  if (context) { params.set('action', context.logicalKey); params.set('version', context.dedupeKey); }
  return `${path}?${params}`;
}
export async function fetchResumeDocument(id: string): Promise<ResumeDocument> {
  if (!RESUME_ID.test(id)) throw new Error('This resume link is incomplete. Choose a version from your library.');
  const response = await apiFetch(`/api/resumes/${encodeURIComponent(id)}`, { method: 'GET', timeoutMs: 20_000 }) as { success: boolean; document: ResumeDocument };
  const doc = response.document;
  if (!response.success || typeof doc?.id !== 'string' || doc.id.toLowerCase() !== id.toLowerCase() || typeof doc.name !== 'string' || typeof doc.text !== 'string' || doc.text.trim().length < 50 || doc.text.length > 50000 || !/^[a-f0-9]{64}$/.test(doc.fingerprint)) {
    throw new Error('The saved resume was not confirmed. Try loading it again.');
  }
  return doc;
}
/** Exact line multisets; order is intentionally not scored. Linear in text length. */
export function compareResumeLines(left: string, right: string): { removed: string[]; added: string[]; sameText: boolean } {
  const lines = (text: string) => text.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim());
  function only(a: string[], b: string[]) { const counts = new Map<string, number>(); for (const line of b) counts.set(line, (counts.get(line) || 0) + 1); return a.filter(line => { const n = counts.get(line) || 0; if (n) { counts.set(line, n - 1); return false; } return true; }); }
  const a = lines(left), b = lines(right); return { removed: only(a, b), added: only(b, a), sameText: left.replace(/\r\n/g, '\n') === right.replace(/\r\n/g, '\n') };
}
