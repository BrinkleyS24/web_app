import { expect, test } from 'vitest';
import { requireResumeChecks, requireSavedResumes, resumeLibraryHref } from './resumeLibraryPresentation';

const variant = { id: '11111111-1111-4111-8111-111111111111', name: 'QA version', isDefault: true, charCount: 500 };
const health = { variantId: variant.id, document: { variantId: variant.id, fingerprint: 'a'.repeat(64), characters: 500 }, findings: [] };

test('valid library responses retain exact identities and default choices', () => {
  const response = { success: true, variants: [variant] };
  expect(requireSavedResumes(response)).toBe(response);
  expect(requireSavedResumes({ success: true, variants: [] }).variants).toEqual([]);
});

test.each([
  null, {}, { success: false, variants: [] }, { success: true, variants: null },
  { success: true, variants: [variant, variant] },
  { success: true, variants: [variant, { ...variant, id: 'another' }] },
  { success: true, variants: [{ ...variant, name: '' }] },
  { success: true, variants: [{ ...variant, isDefault: undefined }] },
  { success: true, variants: [{ ...variant, charCount: -1 }] },
])('malformed library response never becomes an empty or trusted library: %j', response => {
  expect(() => requireSavedResumes(response)).toThrow(/could not be verified/);
});

test('a missing readable health document remains explicitly unchecked', () => {
  const response = { success: true, resumes: [{ ...health, document: null }] };
  expect(requireResumeChecks(response)).toBe(response);
});

test.each([
  { success: false, resumes: [] }, { success: true, resumes: [health, health] },
  { success: true, resumes: [{ ...health, document: { ...health.document, variantId: 'different' } }] },
  { success: true, resumes: [{ ...health, findings: [{}] }] },
])('malformed checks never produce a clean result: %j', response => {
  expect(() => requireResumeChecks(response)).toThrow(/could not be verified/);
});

test('an outcome link opens the exact saved version in Library and retains task identity', () => {
  const url = new URL(resumeLibraryHref('?view=outcomes&action=abcdef&version=1234&resume=old', variant.id), 'https://example.test');
  expect(url.pathname).toBe('/resumes');
  expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'library', action: 'abcdef', version: '1234', resume: variant.id });
  expect(url.hash).toBe('#resume-' + variant.id);
  expect(new URL(resumeLibraryHref('?resume=old', 'not-a-document'), url).searchParams.has('resume')).toBe(false);
});
