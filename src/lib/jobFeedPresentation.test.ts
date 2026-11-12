import { expect, test } from 'vitest';
import type { FeedJob } from './jobFeed';
import { jobReviewQuestion } from './jobFeedPresentation';

const assessment = 'Communication, collaboration, growth and product judgment are assessed during interviews; they are not verified resume qualifications.';
const question = 'Production delivery has evidence; the employer’s unquantified scale expectation still needs confirmation.';
const row = (values: Partial<FeedJob>) => ({ decision: 'review', reasons: [], requirements: [], ...values } as FeedJob);

test('actionable source wording comes before interview-assessed traits without mutating the packet', () => {
  const job = row({ reasons: [assessment, question] });
  const before = structuredClone(job);
  expect(jobReviewQuestion(job)).toBe(question);
  expect(job).toEqual(before);
});

test('an unresolved original requirement is a fallback, preserving all alternatives', () => {
  const label = 'Bachelor’s degree or equivalent practical experience; bootcamp graduates considered.';
  expect(jobReviewQuestion(row({ reasons: [assessment], requirements: [
    { label: 'Team communication', status: 'interview_assessment', quote: null, evidence: null },
    { label, status: 'unclear', quote: label, evidence: null },
  ] }))).toBe(label);
});

test('an absent question is not replaced with a claim of eligibility', () => {
  expect(jobReviewQuestion(row({ reasons: [assessment] }))).toBeNull();
});

test.each(['supported', 'excluded'] as const)('presentation cannot turn a %s decision into a review question', decision => {
  expect(jobReviewQuestion(row({ decision, reasons: [question] }))).toBeNull();
});
