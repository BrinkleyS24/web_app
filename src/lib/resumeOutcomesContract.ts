import type { VariantScoreboardResponse } from './emails';

export const CONFIRMED_OUTCOME_BASIS = 'confirmed_application_outcomes';
export const OUTCOME_CONTRACT_MESSAGE = 'These outcome records could not be verified as confirmed submissions. Past checks alone do not confirm which resume you submitted.';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const applicationId = (value: unknown): boolean => typeof value === 'string' && /^[1-9]\d*$/.test(value) && value.length <= 19 && BigInt(value) <= 9223372036854775807n;

// HMR and rolling releases can retain legacy cached responses under new labels.
// Check both network responses and already-cached presentation data.
export function isConfirmedResumeOutcomes(value: unknown): value is VariantScoreboardResponse {
  if (!object(value) || value.success !== true || !object(value.scoreboard)) return false;
  const board = value.scoreboard;
  if (board.basis !== CONFIRMED_OUTCOME_BASIS || !count(board.minSample) || board.minSample < 1 || !Array.isArray(board.perVariant)) return false;
  for (const key of ['unknownApplications', 'unlinkedSubmissions', 'ambiguousCohorts']) {
    if (board[key] !== undefined && !count(board[key])) return false;
  }
  const ids = new Set<string>();
  for (const row of board.perVariant) {
    if (!object(row) || !text(row.variantId) || !text(row.name) || ids.has(row.variantId)) return false;
    ids.add(row.variantId);
    if (!['sent', 'matchedToOutcome', 'interviewed', 'offered', 'rejected', 'noResponse'].every(key => count(row[key]))) return false;
    const { sent, matchedToOutcome: matched, interviewed, offered, rejected } = row as Record<string, number>;
    if (matched > sent || interviewed + offered + rejected !== matched || row.noResponse !== 0 || row.sufficientSample !== (matched >= board.minSample)) return false;
    const rate = matched ? Number(((interviewed + offered) / matched * 100).toFixed(1)) : null;
    if (row.interviewRate !== rate) return false;
  }
  if (value.breakdown !== undefined) {
    if (!object(value.breakdown)) return false;
    for (const rows of Object.values(value.breakdown)) {
      if (!Array.isArray(rows) || !rows.every(row => object(row) && applicationId(row.applicationId)
        && ['pending', 'interviewed', 'offered', 'rejected'].includes(String(row.outcome)))) return false;
    }
  }
  const rec = value.recommendation;
  if (rec !== null) {
    if (!object(rec) || rec.basis !== CONFIRMED_OUTCOME_BASIS || !text(rec.variantId) || !text(rec.name)
      || !count(rec.sampleSize) || rec.sampleSize < board.minSample || !['tracked', 'stronger'].includes(String(rec.kind))) return false;
    const row = board.perVariant.find(row => row.variantId === rec.variantId);
    if (!row || !row.sufficientSample || row.interviewRate <= 0 || rec.interviewRate !== row.interviewRate || rec.sampleSize !== row.matchedToOutcome) return false;
  }
  return true;
}
