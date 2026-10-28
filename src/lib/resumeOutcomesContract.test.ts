import { beforeEach, expect, test, vi } from 'vitest';
import { isConfirmedResumeOutcomes, OUTCOME_CONTRACT_MESSAGE } from './resumeOutcomesContract';
import { fetchVariantScoreboard } from './emails';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch }));
const valid = () => ({ success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5,
  unknownApplications: 4, perVariant: [{ variantId: 'A', name: 'Version actually submitted', sent: 8, matchedToOutcome: 7,
    interviewed: 3, offered: 1, rejected: 3, noResponse: 0, interviewRate: 57.1, sufficientSample: true }] },
  recommendation: { basis: 'confirmed_application_outcomes', variantId: 'A', name: 'Version actually submitted',
    sampleSize: 7, interviewRate: 57.1, kind: 'tracked' },
  breakdown: { A: [{ applicationId: '9007199254740993', role: 'QA Engineer', company: 'Fictional Cedar', outcome: 'interviewed' }] },
});
beforeEach(() => apiFetch.mockReset());

test('current confirmed outcomes retain exact bigint application identity and the tracked denominator', () => {
  expect(isConfirmedResumeOutcomes(valid())).toBe(true);
});
test.each(['applied_verdict_vs_email_cohort_outcome', undefined])('legacy or absent attribution basis is rejected even with zero rows: %s', basis => {
  expect(isConfirmedResumeOutcomes({ success: true, scoreboard: { basis, minSample: 5, perVariant: [] }, recommendation: null })).toBe(false);
});
test.each([
  { noResponse: 1 }, { matchedToOutcome: 9 }, { interviewed: 8 }, { offered: undefined },
  { interviewRate: 43 }, { sufficientSample: false }, { sent: -1 }, { sent: NaN },
])('an inconsistent denominator or malformed counter cannot be shown as confirmed: %j', change => {
  const data = valid(); Object.assign(data.scoreboard.perVariant[0], change);
  expect(isConfirmedResumeOutcomes(data)).toBe(false);
});
test('pending submissions and a null recommendation remain valid without invented zero outcome rates', () => {
  expect(isConfirmedResumeOutcomes({ success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5,
    perVariant: [{ variantId: 'A', name: 'Pending', sent: 2, matchedToOutcome: 0, interviewed: 0, offered: 0, rejected: 0,
      noResponse: 0, interviewRate: null, sufficientSample: false }] }, recommendation: null })).toBe(true);
});
test('legacy recommendation metadata and company/title-only drilldowns cannot pass the confirmed contract', () => {
  const data = valid(); delete (data.recommendation as Partial<typeof data.recommendation>).basis;
  expect(isConfirmedResumeOutcomes(data)).toBe(false);
  const other = valid(); other.breakdown.A[0].applicationId = 'undefined';
  expect(isConfirmedResumeOutcomes(other)).toBe(false);
});
test('the API client refuses an HTTP-success legacy scoreboard and passes current data unchanged', async () => {
  apiFetch.mockResolvedValueOnce({ success: true, scoreboard: { basis: 'applied_verdict_vs_email_cohort_outcome', perVariant: [] }, recommendation: null });
  await expect(fetchVariantScoreboard()).rejects.toThrow(OUTCOME_CONTRACT_MESSAGE);
  const data = valid(); apiFetch.mockResolvedValueOnce(data);
  await expect(fetchVariantScoreboard('QA Engineer')).resolves.toEqual(data);
  expect(apiFetch).toHaveBeenLastCalledWith('/api/resumes/scoreboard?title=QA%20Engineer', { method: 'GET' });
});
