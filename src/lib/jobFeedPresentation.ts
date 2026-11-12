import type { FeedJob } from './jobFeed';

/** Select existing source wording; this never changes eligibility or invents a question. */
export function jobReviewQuestion(job: FeedJob): string | null {
  if (job.decision !== 'review') return null;
  const actionable = job.reasons.find(reason => reason.trim()
    && !/assessed during interviews|are not certified by resume evidence/i.test(reason));
  if (actionable) return actionable;
  return job.requirements.find(requirement => !requirement.blocking
    && !['satisfied', 'interview_assessment'].includes(requirement.status)
    && requirement.label.trim())?.label || null;
}
