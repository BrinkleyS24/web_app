import { beforeEach, expect, test, vi } from 'vitest';
import { compareResumeLines, fetchResumeDocument, readResumeChoice, resumeToolHref } from './resumeWorkspace';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch }));
const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
beforeEach(() => { vi.clearAllMocks(); });
test('opaque handoff preserves only verified action context and rejects ambiguous resume choices', () => {
  expect(readResumeChoice(`?resume=${id.toUpperCase()}`)).toEqual({ present: true, id });
  expect(readResumeChoice(`?resume=${id}&resume=${id}`)).toEqual({ present: true, id: null });
  expect(readResumeChoice('?resume=bad')).toEqual({ present: true, id: null });
  expect(readResumeChoice('')).toEqual({ present: false, id: null });
  expect(resumeToolHref('/apply-gate', id, '?action=0123456789abcdef&version=fedcba9876543210&email=private&resume=bad')).toBe(`/apply-gate?resume=${id}&action=0123456789abcdef&version=fedcba9876543210`);
  expect(resumeToolHref('/resumes', id, '?action=bad&version=bad')).toBe(`/resumes?resume=${id}`);
});
test('comparison respects duplicate lines and handles reordered and large text without inventing a quality score', () => {
  expect(compareResumeLines('A\nA\nB', 'A\nB\nC')).toEqual({ removed: ['A'], added: ['C'], sameText: false });
  expect(compareResumeLines('A\r\nB', 'A\nB').sameText).toBe(true);
  expect(compareResumeLines('A\nB', 'B\nA')).toEqual({ removed: [], added: [], sameText: false });
  expect(compareResumeLines('line\n'.repeat(10000), 'line\n'.repeat(9999)).removed).toEqual(['line']);
});
test('preview rejects malformed and mismatched documents before they become editable', async () => {
  await expect(fetchResumeDocument('bad')).rejects.toThrow(/incomplete/); expect(apiFetch).not.toHaveBeenCalled();
  for (const document of [{ id: 'other', name: 'QA', text: 'x'.repeat(60), fingerprint: 'a'.repeat(64) }, { id, name: 'QA', text: 'short', fingerprint: 'a'.repeat(64) }, { id, name: 'QA', text: 'x'.repeat(60), fingerprint: 'bad' }]) {
    apiFetch.mockResolvedValue({ success: true, document }); await expect(fetchResumeDocument(id)).rejects.toThrow(/not confirmed/);
  }
});
