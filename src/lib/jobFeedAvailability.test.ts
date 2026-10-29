import { expect, test } from 'vitest';
import { isJobFeedEnabled } from './jobFeedAvailability';

test('Jobs defaults to local development only', () => {
  expect(isJobFeedEnabled({ DEV: true })).toBe(true);
  expect(isJobFeedEnabled({ DEV: false })).toBe(false);
  expect(isJobFeedEnabled({})).toBe(false);
});

test('explicit opt-in and fail-closed values apply in both environments', () => {
  for (const DEV of [true, false]) {
    expect(isJobFeedEnabled({ DEV, VITE_JOB_FEED_ENABLED: 'true' })).toBe(true);
    for (const value of ['false', '', 'yes', '1', 'typo']) {
      expect(isJobFeedEnabled({ DEV, VITE_JOB_FEED_ENABLED: value })).toBe(false);
    }
  }
});
