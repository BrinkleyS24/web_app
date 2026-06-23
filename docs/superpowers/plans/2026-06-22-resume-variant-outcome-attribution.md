# Résumé Variants + Outcome Attribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the résumé from one static blob into versioned, outcome-tagged variants — Apply Gate records which variant was sent at apply-time, the existing inbox-outcome pipeline attributes interview/offer/rejection back to the variant, and a scoreboard + apply-time guidance steer users onto the résumé that converts.

**Architecture:** A new `resume_variants` table (encrypted text, RLS) holds named variants; `apply_gate_verdicts` gains a `resume_variant_id` column (the verdict insert is schema-drift-tolerant, so backend ships before the migration). The scoreboard is a pure function that mirrors `buildVerdictCalibration` — joining applied verdicts to email-cohort outcomes via the same `cohortKeyForRole`/`buildCohortOutcomeMap` so numbers never drift from Outcome Memory. Frontend adds a Résumés page, a variant picker in Apply Gate, and an apply-time guidance line.

**Tech Stack:** Backend `backend/gmail-job-tracker-be` (Node ESM, Jest via `node --experimental-vm-modules node_modules/jest/bin/jest.js`, Supabase). Frontend `frontend/web` (Vite + React 18 + TS, TanStack Query, vitest + testing-library). Spec: `frontend/web/docs/superpowers/specs/2026-06-22-resume-variant-outcome-attribution-design.md`.

## Global Constraints

- v1 = track-first / Approach B. NO AI generation, NO verdict rejection-% integration, NO PDF upload. (Spec §7.)
- Attribution captured at Apply-Gate apply-time only (the existing apply-action hook). (Spec §2.)
- New public Supabase tables ship with **RLS enabled, user-scoped, no anon policies** (the project invariant).
- Résumé text is **encrypted at rest** using the existing `encryptResumeText` / `_resumeTextForClient` helpers in `services/profileService.js`. Cap stored text at 50000 chars (matches `saveResume`).
- Premium routes are guarded by `verifyFirebaseToken, requirePremiumPlan` and must fail closed.
- Honesty-when-thin: any per-variant claim is suppressed below `minSample` matched outcomes (default 5), mirroring `buildVerdictCalibration`'s `sufficientSample`.
- Backend test runner: `node --experimental-vm-modules node_modules/jest/bin/jest.js <path>`. Pure-logic services live in `services/`, tests in `tests/services/`.

---

## Phase 1 — Data model + migration

### Task 1: `resume_variants` migration (table + RLS)

**Files:**
- Create: `backend/gmail-job-tracker-be/database/migrations/add_resume_variants.sql`

**Interfaces:**
- Produces: table `public.resume_variants(id uuid pk, user_id text, name text, resume_text text, is_default boolean, created_at timestamptz, archived_at timestamptz null)`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Named, tailored résumé variants. resume_text is encrypted at rest by the app
-- (services/profileService.js encryptResumeText), same as users.resume_text.
-- Written/read only by the backend service role; RLS enabled with NO anon policies.
CREATE TABLE IF NOT EXISTS public.resume_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  name        text NOT NULL DEFAULT 'My résumé',
  resume_text text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS resume_variants_user_idx
  ON public.resume_variants (user_id) WHERE archived_at IS NULL;

-- At most one default per user (partial unique index over active rows).
CREATE UNIQUE INDEX IF NOT EXISTS resume_variants_one_default_per_user
  ON public.resume_variants (user_id) WHERE is_default AND archived_at IS NULL;

ALTER TABLE public.resume_variants ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies on purpose: only the service role (bypasses RLS).
```

- [ ] **Step 2: Document activation in the migration header comment** (the engineer applies it in the Supabase SQL editor; note it in the PR description). No automated test — this is DDL applied out-of-band, consistent with the repo's other `database/migrations/*.sql`.

- [ ] **Step 3: Commit**

```bash
git add backend/gmail-job-tracker-be/database/migrations/add_resume_variants.sql
git commit -m "feat(resumes): migration for resume_variants table (RLS, one-default-per-user)"
```

### Task 2: `resume_variant_id` column on `apply_gate_verdicts`

**Files:**
- Create: `backend/gmail-job-tracker-be/database/migrations/add_verdict_resume_variant_id.sql`

**Interfaces:**
- Produces: column `apply_gate_verdicts.resume_variant_id uuid null`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Links each Apply Gate verdict to the résumé variant it was analyzed against, so
-- outcomes (interview/offer/rejection) can attribute back to a variant.
-- The verdict insert (_insertApplyGateVerdict) is schema-drift-tolerant: it drops
-- unknown columns and retries, so the backend may deploy BEFORE this is applied.
ALTER TABLE public.apply_gate_verdicts
  ADD COLUMN IF NOT EXISTS resume_variant_id uuid;

CREATE INDEX IF NOT EXISTS apply_gate_verdicts_variant_idx
  ON public.apply_gate_verdicts (user_id, resume_variant_id)
  WHERE resume_variant_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add backend/gmail-job-tracker-be/database/migrations/add_verdict_resume_variant_id.sql
git commit -m "feat(resumes): add apply_gate_verdicts.resume_variant_id for attribution"
```

---

## Phase 2 — Variant store service + résumé resolution

### Task 3: `resumeVariantService` CRUD

**Files:**
- Create: `backend/gmail-job-tracker-be/services/resumeVariantService.js`
- Test: `backend/gmail-job-tracker-be/tests/services/resumeVariantService.test.js`

**Interfaces:**
- Consumes: `supabase` from `../database.js`; `encryptResumeText`, `_resumeTextForClient` from `./profileService.js` (export them in Step 1 if not already exported).
- Produces:
  - `listVariants(userId): Promise<Array<{id, name, isDefault, createdAt, charCount}>>` (no text; active only)
  - `getVariantText(userId, variantId): Promise<string|null>` (decrypted; null if not owned/archived)
  - `getDefaultVariant(userId): Promise<{id, text}|null>`
  - `createVariant(userId, {name, text}): Promise<{id}>` (first variant for a user becomes default)
  - `renameVariant(userId, variantId, name): Promise<boolean>`
  - `setDefaultVariant(userId, variantId): Promise<boolean>`
  - `archiveVariant(userId, variantId): Promise<boolean>`

- [ ] **Step 1: Ensure encryption helpers are exported from profileService**

In `services/profileService.js`, confirm `encryptResumeText` and `_resumeTextForClient` are `export`ed (add `export` if they are module-private). Run: `grep -n "encryptResumeText\|_resumeTextForClient" services/profileService.js`.

- [ ] **Step 2: Write the failing test** (mock supabase + encryption)

```js
import { jest } from '@jest/globals';

const rows = [];
const supabaseMock = { from: () => buildQuery(rows) };
function buildQuery(store) { /* minimal chainable mock: select/eq/insert/update/order/single/then */ }

jest.unstable_mockModule('../../database.js', () => ({ supabase: supabaseMock }));
jest.unstable_mockModule('../../services/profileService.js', () => ({
  encryptResumeText: (t) => `enc:${t}`,
  _resumeTextForClient: (t) => String(t || '').replace(/^enc:/, ''),
}));

const svc = await import('../../services/resumeVariantService.js');

describe('resumeVariantService', () => {
  test('first variant becomes the default', async () => {
    const { id } = await svc.createVariant('u1', { name: 'QA', text: 'a'.repeat(60) });
    const def = await svc.getDefaultVariant('u1');
    expect(def.id).toBe(id);
  });
  test('getVariantText decrypts and is owner-scoped', async () => {
    const { id } = await svc.createVariant('u1', { name: 'QA', text: 'plain text body over fifty characters long here.' });
    expect(await svc.getVariantText('u1', id)).toContain('plain text body');
    expect(await svc.getVariantText('intruder', id)).toBeNull();
  });
});
```

> Implementer note: model the supabase mock on `tests/services/syncService.stuckBackfill.test.js`'s `createSupabaseMock` (chainable builder backed by an in-memory array). Encode `is_default` flipping and `archived_at` filtering in the mock.

- [ ] **Step 3: Run test to verify it fails**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/services/resumeVariantService.test.js`
Expected: FAIL — module `resumeVariantService.js` not found.

- [ ] **Step 4: Implement `resumeVariantService.js`**

```js
import { supabase } from '../database.js';
import { encryptResumeText, _resumeTextForClient } from './profileService.js';
import logger from './logger.js';

const MAX_CHARS = 50000;

export async function listVariants(userId) {
  const { data, error } = await supabase
    .from('resume_variants')
    .select('id, name, is_default, created_at, resume_text')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { logger.warn(`[resumeVariants] list failed: ${error.message}`); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: Boolean(r.is_default),
    createdAt: r.created_at,
    charCount: (_resumeTextForClient(r.resume_text) || '').length,
  }));
}

export async function getVariantText(userId, variantId) {
  if (!variantId) return null;
  const { data, error } = await supabase
    .from('resume_variants')
    .select('resume_text')
    .eq('user_id', userId).eq('id', variantId).is('archived_at', null)
    .maybeSingle();
  if (error || !data) return null;
  return _resumeTextForClient(data.resume_text);
}

export async function getDefaultVariant(userId) {
  const { data } = await supabase
    .from('resume_variants')
    .select('id, resume_text')
    .eq('user_id', userId).eq('is_default', true).is('archived_at', null)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, text: _resumeTextForClient(data.resume_text) };
}

export async function createVariant(userId, { name, text }) {
  const existing = await listVariants(userId);
  const isDefault = existing.length === 0;
  const { data, error } = await supabase
    .from('resume_variants')
    .insert({ user_id: userId, name: (name || 'My résumé').slice(0, 120), resume_text: encryptResumeText(String(text || '').slice(0, MAX_CHARS)), is_default: isDefault })
    .select('id').single();
  if (error) throw new Error(`create variant failed: ${error.message}`);
  return { id: data.id };
}

export async function renameVariant(userId, variantId, name) {
  const { error } = await supabase.from('resume_variants')
    .update({ name: String(name || '').slice(0, 120) })
    .eq('user_id', userId).eq('id', variantId);
  return !error;
}

export async function setDefaultVariant(userId, variantId) {
  await supabase.from('resume_variants').update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
  const { error } = await supabase.from('resume_variants').update({ is_default: true }).eq('user_id', userId).eq('id', variantId).is('archived_at', null);
  return !error;
}

export async function archiveVariant(userId, variantId) {
  const { error } = await supabase.from('resume_variants')
    .update({ archived_at: new Date().toISOString(), is_default: false })
    .eq('user_id', userId).eq('id', variantId);
  return !error;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/services/resumeVariantService.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/gmail-job-tracker-be/services/resumeVariantService.js backend/gmail-job-tracker-be/tests/services/resumeVariantService.test.js backend/gmail-job-tracker-be/services/profileService.js
git commit -m "feat(resumes): resumeVariantService CRUD (encrypted, owner-scoped, default handling)"
```

### Task 4: Résumé resolution — variant-aware `getResume`

**Files:**
- Modify: `backend/gmail-job-tracker-be/services/profileService.js` (`getResume`)
- Test: `backend/gmail-job-tracker-be/tests/services/resumeResolution.test.js`

**Interfaces:**
- Produces: `getResume(userId, { variantId } = {})` — returns the chosen variant's text, else the default variant's text, else legacy `users.resume_text`.

- [ ] **Step 1: Write the failing test**

```js
// Mock supabase + resumeVariantService.getVariantText/getDefaultVariant.
test('getResume prefers the chosen variant, then default, then legacy users.resume_text', async () => {
  // variantId given -> getVariantText returns "VARIANT BODY"
  expect(await getResume('u1', { variantId: 'v1' })).toContain('VARIANT BODY');
  // no variantId, default exists -> default text
  expect(await getResume('u1')).toContain('DEFAULT BODY');
  // no variants at all -> legacy users.resume_text
  expect(await getResume('u2')).toContain('LEGACY BODY');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/services/resumeResolution.test.js`
Expected: FAIL — `getResume` ignores `variantId`.

- [ ] **Step 3: Implement the resolution** (modify `getResume`)

```js
export async function getResume(userId, options = {}) {
  try {
    const { getVariantText, getDefaultVariant } = await import('./resumeVariantService.js');
    if (options.variantId) {
      const t = await getVariantText(userId, options.variantId);
      if (t) return t;
    }
    const def = await getDefaultVariant(userId);
    if (def?.text) return def.text;
    const { data, error } = await supabase.from('users').select('resume_text').eq('id', userId).single();
    if (error || !data) return null;
    return _resumeTextForClient(data.resume_text);
  } catch { return null; }
}
```

> Dynamic `import()` avoids a static cycle (resumeVariantService imports from profileService).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/services/resumeResolution.test.js`
Expected: PASS.

- [ ] **Step 5: Regression — run the existing profile/applyGate suites**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/applyGate tests/services/applyGate`
Expected: PASS (no signature break — `options` is optional).

- [ ] **Step 6: Commit**

```bash
git add backend/gmail-job-tracker-be/services/profileService.js backend/gmail-job-tracker-be/tests/services/resumeResolution.test.js
git commit -m "feat(resumes): variant-aware getResume (chosen -> default -> legacy)"
```

### Task 5: Migration backfill — seed default variant from `users.resume_text`

**Files:**
- Create: `backend/gmail-job-tracker-be/scripts/backfillResumeVariants.mjs`
- Test: `backend/gmail-job-tracker-be/tests/services/backfillResumeVariants.test.js`

**Interfaces:**
- Produces: `buildBackfillRows(users): Array<{user_id, name, resume_text, is_default}>` (pure) + a runnable `scripts/backfillResumeVariants.mjs` that inserts them for users with non-empty `resume_text` and no existing variant.

- [ ] **Step 1: Write the failing test for the pure builder**

```js
import { buildBackfillRows } from '../../scripts/backfillResumeVariants.mjs';
test('seeds one default "My résumé" variant per user with résumé text', () => {
  const rows = buildBackfillRows([{ id: 'u1', resume_text: 'enc:body' }, { id: 'u2', resume_text: null }]);
  expect(rows).toEqual([{ user_id: 'u1', name: 'My résumé', resume_text: 'enc:body', is_default: true }]);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/services/backfillResumeVariants.test.js` → FAIL.

- [ ] **Step 3: Implement** (`scripts/backfillResumeVariants.mjs`)

```js
export function buildBackfillRows(users = []) {
  return (users || [])
    .filter((u) => u && u.id && u.resume_text)
    .map((u) => ({ user_id: u.id, name: 'My résumé', resume_text: u.resume_text, is_default: true }));
}

// Runner (only when invoked directly): SELECT id, resume_text FROM users WHERE resume_text IS NOT NULL,
// skip users who already have a resume_variants row, INSERT buildBackfillRows(...). Pass --dry-run to log only.
```

- [ ] **Step 4: Run to verify it passes** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/gmail-job-tracker-be/scripts/backfillResumeVariants.mjs backend/gmail-job-tracker-be/tests/services/backfillResumeVariants.test.js
git commit -m "feat(resumes): backfill default variant from users.resume_text"
```

---

## Phase 3 — Variant CRUD routes + apply-time attribution

### Task 6: Résumé-variant routes

**Files:**
- Create: `backend/gmail-job-tracker-be/routes/resumeRoutes.js`
- Modify: the app's route registration (search: `grep -rn "subscriptionRoutes\|app.use('/api" backend/gmail-job-tracker-be/*.js backend/gmail-job-tracker-be/routes/index.js`) to mount `resumeRoutes` at `/api/resumes`.
- Test: `backend/gmail-job-tracker-be/tests/routes/resumeRoutes.test.js`

**Interfaces:**
- Consumes: `resumeVariantService` (Task 3), `verifyFirebaseToken`, `requirePremiumPlan`.
- Produces: `GET /api/resumes` (list), `POST /api/resumes` ({name,text}), `PATCH /api/resumes/:id` ({name?} or {makeDefault:true}), `DELETE /api/resumes/:id` (archive).

- [ ] **Step 1: Write the failing test** — mock `resumeVariantService`, assert `GET /api/resumes` returns `{success:true, variants:[...]}` and is premium-gated (403 for free). Model on `tests/routes/subscriptionRoutes.*.test.js`.

- [ ] **Step 2: Run to verify it fails** — FAIL (route file missing).

- [ ] **Step 3: Implement `resumeRoutes.js`**

```js
import express from 'express';
import verifyFirebaseToken from '../middleware/authMiddleware.js';
import requirePremiumPlan from '../middleware/requirePremiumPlan.js';
import * as variants from '../services/resumeVariantService.js';
import logger from '../services/logger.js';

const router = express.Router();
router.use(verifyFirebaseToken, requirePremiumPlan);

router.get('/', async (req, res) => {
  res.json({ success: true, variants: await variants.listVariants(req.user.uid) });
});
router.post('/', async (req, res) => {
  const { name, text } = req.body || {};
  if (!text || String(text).trim().length < 20) return res.status(400).json({ success: false, error: 'Résumé text too short.' });
  const { id } = await variants.createVariant(req.user.uid, { name, text });
  res.json({ success: true, id });
});
router.patch('/:id', async (req, res) => {
  const ok = req.body?.makeDefault
    ? await variants.setDefaultVariant(req.user.uid, req.params.id)
    : await variants.renameVariant(req.user.uid, req.params.id, req.body?.name);
  res.json({ success: ok });
});
router.delete('/:id', async (req, res) => {
  res.json({ success: await variants.archiveVariant(req.user.uid, req.params.id) });
});

export default router;
```

- [ ] **Step 4: Mount the router** — add `app.use('/api/resumes', resumeRoutes)` next to the other `app.use('/api/...')` registrations (exact file from the grep in Files).

- [ ] **Step 5: Run tests to verify they pass** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/gmail-job-tracker-be/routes/resumeRoutes.js backend/gmail-job-tracker-be/tests/routes/resumeRoutes.test.js
git commit -m "feat(resumes): premium-gated CRUD routes for résumé variants"
```

### Task 7: Persist `resume_variant_id` on the verdict

**Files:**
- Modify: `backend/gmail-job-tracker-be/services/applyGateService.js` (`analyzeJob` signature + the `_insertApplyGateVerdict` payload)
- Modify: `backend/gmail-job-tracker-be/routes/emailRoutes.js` (`/apply-gate/analyze` body schema + `analyzeJob` call)
- Modify: `backend/gmail-job-tracker-be/utils/requestValidation.js` (`ApplyGateAnalyzeBodySchema` — add optional `variantId`)
- Test: `backend/gmail-job-tracker-be/tests/services/applyGateVariantId.test.js`

**Interfaces:**
- Consumes: `getResume(userId, { variantId })` (Task 4).
- Produces: `analyzeJob(userId, jobTitle, jobDescription, jobUrl, companyName, options)` where `options.variantId` (a) selects the résumé and (b) is written to the persisted verdict's `resume_variant_id`.

- [ ] **Step 1: Write the failing test** — mock `getEnrichedProfile`/`getResume` so the chosen variant's text flows in; assert the verdict-insert payload includes `resume_variant_id: 'v1'` when `options.variantId='v1'`. (Spy the `_insertApplyGateVerdict` payload or the supabase `.from('apply_gate_verdicts').insert` arg.)

- [ ] **Step 2: Run to verify it fails** — FAIL (`resume_variant_id` not in payload).

- [ ] **Step 3: Implement**

In `analyzeJob`, thread `options.variantId` into `getResume`:

```js
const resumeText = await getResume(userId, { variantId: options?.variantId }).catch(() => null);
```

In the verdict-insert payload (inside the persist path that builds the `apply_gate_verdicts` row), add:

```js
resume_variant_id: options?.variantId || null,
```

In `utils/requestValidation.js` add `variantId: z.string().uuid().optional()` (or the repo's validator equivalent) to `ApplyGateAnalyzeBodySchema`.

In `routes/emailRoutes.js` `/apply-gate/analyze`, pass it through:

```js
const { jobTitle, jobDescription, jobUrl, companyName, riskTolerance, variantId } = body;
...
analyzeJob(userId, jobTitle||'', jobDescription||'', jobUrl||'', companyName||'',
  { ...(riskTolerance ? { riskTolerance } : {}), ...(variantId ? { variantId } : {}) }),
```

- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS. Because `_insertApplyGateVerdict` is drift-tolerant, this is safe even before the column migration.

- [ ] **Step 5: Regression** — `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/applyGate tests/services/applyGate` → PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/gmail-job-tracker-be/services/applyGateService.js backend/gmail-job-tracker-be/routes/emailRoutes.js backend/gmail-job-tracker-be/utils/requestValidation.js backend/gmail-job-tracker-be/tests/services/applyGateVariantId.test.js
git commit -m "feat(resumes): analyze against a chosen variant and persist resume_variant_id"
```

---

## Phase 4 — Scoreboard service + route

### Task 8: Pure `buildVariantScoreboard`

**Files:**
- Create: `backend/gmail-job-tracker-be/services/resumeVariantScoreboardService.js`
- Test: `backend/gmail-job-tracker-be/tests/services/resumeVariantScoreboard.test.js`

**Interfaces:**
- Consumes: `cohortKeyForRole`, `buildCohortOutcomeMap` from `../utils/cohortMetrics.js` (cohort shape `{interviewed, offered, rejected}`).
- Produces: `buildVariantScoreboard(verdicts, cohorts, variantNames, { minSample }): { perVariant: Array<{variantId, name, sent, matchedToOutcome, interviewed, offered, rejected, noResponse, interviewRate, sufficientSample}> }`. Only verdicts with `user_action==='applied'` and a non-null `resume_variant_id` count.

- [ ] **Step 1: Write the failing test**

```js
import { buildVariantScoreboard } from '../../services/resumeVariantScoreboardService.js';

const cohorts = new Map([
  ['acme::qa engineer', { interviewed: true, offered: false, rejected: false }],
  ['beta::qa engineer', { interviewed: false, offered: false, rejected: true }],
]);
const verdicts = [
  { resume_variant_id: 'A', user_action: 'applied', company_name: 'Acme', job_title: 'QA Engineer' },
  { resume_variant_id: 'A', user_action: 'applied', company_name: 'Beta', job_title: 'QA Engineer' },
  { resume_variant_id: 'A', user_action: 'skipped', company_name: 'X', job_title: 'QA Engineer' }, // not applied -> ignored
];

test('tallies applied verdicts per variant against cohort outcomes', () => {
  const r = buildVariantScoreboard(verdicts, cohorts, { A: 'QA-focused' }, { minSample: 1 });
  const a = r.perVariant.find((p) => p.variantId === 'A');
  expect(a).toMatchObject({ name: 'QA-focused', sent: 2, matchedToOutcome: 2, interviewed: 1, rejected: 1, noResponse: 0, interviewRate: 50, sufficientSample: true });
});

test('below minSample, sufficientSample is false', () => {
  const r = buildVariantScoreboard([verdicts[0]], cohorts, { A: 'QA-focused' }, { minSample: 5 });
  expect(r.perVariant[0].sufficientSample).toBe(false);
});
```

> `cohortKeyForRole` is the real key builder — the test uses literal keys it produces; if its exact format differs, derive the keys in-test via `cohortKeyForRole('Acme','QA Engineer')`.

- [ ] **Step 2: Run to verify it fails** — FAIL (module missing).

- [ ] **Step 3: Implement**

```js
import { supabase } from '../database.js';
import logger from './logger.js';
import { cohortKeyForRole, buildCohortOutcomeMap } from '../utils/cohortMetrics.js';
import { listVariants } from './resumeVariantService.js';

export function buildVariantScoreboard(verdicts = [], cohorts = new Map(), variantNames = {}, options = {}) {
  const minSample = Number.isFinite(options.minSample) ? options.minSample : 5;
  const byVariant = new Map();

  for (const v of verdicts) {
    if (v?.user_action !== 'applied' || !v?.resume_variant_id) continue;
    const id = v.resume_variant_id;
    let e = byVariant.get(id);
    if (!e) { e = { sent: 0, matched: 0, interviewed: 0, offered: 0, rejected: 0, noResponse: 0 }; byVariant.set(id, e); }
    e.sent += 1;
    const key = cohortKeyForRole(v.company_name, v.job_title);
    const outcome = key ? cohorts.get(key) : null;
    if (outcome) {
      e.matched += 1;
      if (outcome.interviewed) e.interviewed += 1;
      else if (outcome.offered) e.offered += 1;
      else if (outcome.rejected) e.rejected += 1;
      else e.noResponse += 1;
    }
  }

  const rate = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(1)) : null);
  const perVariant = [...byVariant.entries()].map(([variantId, e]) => ({
    variantId,
    name: variantNames[variantId] || 'Résumé',
    sent: e.sent,
    matchedToOutcome: e.matched,
    interviewed: e.interviewed,
    offered: e.offered,
    rejected: e.rejected,
    noResponse: e.noResponse,
    interviewRate: rate(e.interviewed + e.offered, e.matched),
    sufficientSample: e.matched >= minSample,
  }));

  return { basis: 'applied_verdict_vs_email_cohort_outcome', minSample, perVariant };
}

export async function getVariantScoreboard(userId, options = {}) {
  const [verdictsRes, emailsRes, variantList] = await Promise.all([
    supabase.from('apply_gate_verdicts')
      .select('resume_variant_id, user_action, job_title, company_name')
      .eq('user_id', userId).not('resume_variant_id', 'is', null).eq('user_action', 'applied'),
    supabase.from('emails')
      .select('category, company_name, company_name_corrected, position, position_corrected')
      .eq('user_id', userId).in('category', ['Applied', 'Interviewed', 'Offers', 'Rejected']),
    listVariants(userId),
  ]);
  if (verdictsRes.error) throw new Error(verdictsRes.error.message);
  const { cohorts } = buildCohortOutcomeMap(emailsRes.data || []);
  const names = Object.fromEntries((variantList || []).map((v) => [v.id, v.name]));
  return buildVariantScoreboard(verdictsRes.data || [], cohorts, names, options);
}
```

- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/gmail-job-tracker-be/services/resumeVariantScoreboardService.js backend/gmail-job-tracker-be/tests/services/resumeVariantScoreboard.test.js
git commit -m "feat(resumes): pure variant scoreboard mirroring verdict calibration"
```

### Task 9: Scoreboard route + recommendation, on the existing résumé routes

**Files:**
- Modify: `backend/gmail-job-tracker-be/routes/resumeRoutes.js` (add `GET /api/resumes/scoreboard`)
- Create: `backend/gmail-job-tracker-be/services/resumeVariantRecommendService.js`
- Test: `backend/gmail-job-tracker-be/tests/services/resumeVariantRecommend.test.js`

**Interfaces:**
- Produces: `recommendVariantForRole({ title }, scoreboardPerVariant, perVariantFamilyStats, { minSample }): {variantId, name, interviewRate}|null`. For v1, "roles like this" = same role-family token (a compact self-contained map; DRY follow-up: share with applyGateService's family logic).
- Produces route: `GET /api/resumes/scoreboard` → `{ success, scoreboard, recommendation }` where `recommendation` is keyed off an optional `?title=` query.

- [ ] **Step 1: Write the failing test** for `recommendVariantForRole`

```js
import { roleFamilyToken, recommendVariantForRole } from '../../services/resumeVariantRecommendService.js';

test('maps SDET/QA titles to one family token', () => {
  expect(roleFamilyToken('Software Development Engineer in Test')).toBe(roleFamilyToken('QA Automation Engineer'));
});

test('recommends the best-converting variant on same-family roles, above minSample', () => {
  const familyStats = {
    A: { token: 'qa_test', matched: 6, interviewed: 3 },
    B: { token: 'qa_test', matched: 6, interviewed: 0 },
  };
  const rec = recommendVariantForRole({ title: 'QA Engineer' }, { A: 'QA-focused', B: 'Generic' }, familyStats, { minSample: 5 });
  expect(rec).toMatchObject({ variantId: 'A', name: 'QA-focused', interviewRate: 50 });
});

test('returns null below minSample', () => {
  const rec = recommendVariantForRole({ title: 'QA Engineer' }, { A: 'QA' }, { A: { token: 'qa_test', matched: 2, interviewed: 2 } }, { minSample: 5 });
  expect(rec).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement `resumeVariantRecommendService.js`**

```js
// Compact role-family tokenizer (v1, self-contained). DRY follow-up: share with
// applyGateService's APPLY_GATE_ROLE_FAMILY_PATTERNS.
const FAMILY_PATTERNS = [
  [/(sdet|software development engineer in test|qa|quality assurance|test automation|automation engineer|test engineer)/i, 'qa_test'],
  [/(front[\s-]?end|react|vue|angular|ui engineer)/i, 'frontend'],
  [/(back[\s-]?end|api|server|platform engineer)/i, 'backend'],
  [/(data engineer|etl|pipeline|analytics engineer)/i, 'data'],
  [/(product manager|program manager|project manager)/i, 'pm'],
];
export function roleFamilyToken(title) {
  const t = String(title || '').toLowerCase();
  for (const [re, token] of FAMILY_PATTERNS) if (re.test(t)) return token;
  return t.trim() ? `other:${t.split(/\s+/).slice(0, 2).join('_')}` : 'unknown';
}

export function recommendVariantForRole(role, variantNames = {}, perVariantFamilyStats = {}, options = {}) {
  const minSample = Number.isFinite(options.minSample) ? options.minSample : 5;
  const targetToken = roleFamilyToken(role?.title);
  let best = null;
  for (const [variantId, stat] of Object.entries(perVariantFamilyStats)) {
    if (stat.token !== targetToken || stat.matched < minSample) continue;
    const interviewRate = Number(((stat.interviewed / stat.matched) * 100).toFixed(1));
    if (!best || interviewRate > best.interviewRate) {
      best = { variantId, name: variantNames[variantId] || 'Résumé', interviewRate };
    }
  }
  return best;
}
```

> The route computes `perVariantFamilyStats` by grouping the same applied-verdict+cohort join (Task 8 data) by `roleFamilyToken(job_title)` per variant. Build that aggregation in `getVariantScoreboard` or a sibling loader and pass `?title=` to pick the family.

- [ ] **Step 4: Add the route** in `resumeRoutes.js`

```js
import { getVariantScoreboard } from '../services/resumeVariantScoreboardService.js';
import { recommendVariantForRole } from '../services/resumeVariantRecommendService.js';
// inside the router:
router.get('/scoreboard', async (req, res) => {
  const scoreboard = await getVariantScoreboard(req.user.uid);
  const recommendation = req.query.title
    ? recommendVariantForRole({ title: String(req.query.title) }, /* names */ {}, /* familyStats */ {}, {})
    : null;
  res.json({ success: true, scoreboard, recommendation });
});
```

> Place `GET /scoreboard` BEFORE any `/:id` route so it isn't captured as an id.

- [ ] **Step 5: Run tests to verify they pass** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/gmail-job-tracker-be/services/resumeVariantRecommendService.js backend/gmail-job-tracker-be/routes/resumeRoutes.js backend/gmail-job-tracker-be/tests/services/resumeVariantRecommend.test.js
git commit -m "feat(resumes): variant scoreboard route + same-family recommendation (honest below minSample)"
```

---

## Phase 5 — Frontend surfaces

### Task 10: API client functions

**Files:**
- Modify: `frontend/web/src/lib/emails.ts` (add variant API fns + types; add `variantId` to `analyzeJobAlignment` params)
- Test: covered by the page/component tests below.

**Interfaces:**
- Produces: `fetchResumeVariants()`, `createResumeVariant({name,text})`, `renameResumeVariant(id,name)`, `setDefaultResumeVariant(id)`, `archiveResumeVariant(id)`, `fetchVariantScoreboard(title?)`; types `ResumeVariant`, `VariantScoreboard`.

- [ ] **Step 1: Implement the API functions** (mirror the existing `apiFetch` usage, e.g. `fetchResume`/`analyzeJobAlignment`)

```ts
export type ResumeVariant = { id: string; name: string; isDefault: boolean; createdAt: string; charCount: number };
export type VariantScoreRow = { variantId: string; name: string; sent: number; matchedToOutcome: number; interviewed: number; offered: number; rejected: number; noResponse: number; interviewRate: number | null; sufficientSample: boolean };
export type VariantScoreboard = { perVariant: VariantScoreRow[]; minSample: number };

export async function fetchResumeVariants(): Promise<{ success: boolean; variants: ResumeVariant[] }> {
  return apiFetch('/api/resumes', { method: 'GET' });
}
export async function createResumeVariant(body: { name: string; text: string }) {
  return apiFetch('/api/resumes', { method: 'POST', body: JSON.stringify(body) });
}
export async function renameResumeVariant(id: string, name: string) {
  return apiFetch(`/api/resumes/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}
export async function setDefaultResumeVariant(id: string) {
  return apiFetch(`/api/resumes/${id}`, { method: 'PATCH', body: JSON.stringify({ makeDefault: true }) });
}
export async function archiveResumeVariant(id: string) {
  return apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
}
export async function fetchVariantScoreboard(title?: string): Promise<{ success: boolean; scoreboard: VariantScoreboard; recommendation: { variantId: string; name: string; interviewRate: number } | null }> {
  return apiFetch(`/api/resumes/scoreboard${title ? `?title=${encodeURIComponent(title)}` : ''}`, { method: 'GET' });
}
```

Add `variantId?: string` to the `analyzeJobAlignment` params type and include it in the POST body when present.

- [ ] **Step 2: Typecheck** — `cd frontend/web && npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/src/lib/emails.ts
git commit -m "feat(resumes): web API client for résumé variants + scoreboard"
```

### Task 11: Résumés page (list + CRUD + scoreboard)

**Files:**
- Create: `frontend/web/src/pages/Resumes.tsx`
- Modify: the router (search: `grep -rn "ApplyGate\|createBrowserRouter\|<Route" frontend/web/src`) to add the `/resumes` route + a nav entry.
- Test: `frontend/web/src/pages/Resumes.test.tsx`

**Interfaces:**
- Consumes: the Task 10 API fns. Uses `DashboardLayout`, `useSaveResume` pattern, TanStack Query.

- [ ] **Step 1: Write the failing test** (mirror `ApplyGate.test.tsx` mock setup)

```tsx
test('lists variants with their record and honest thin-data copy', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA-focused', isDefault: true, createdAt: '', charCount: 1200 }] });
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { minSample: 5, perVariant: [{ variantId: 'A', name: 'QA-focused', sent: 2, matchedToOutcome: 2, interviewed: 1, offered: 0, rejected: 1, noResponse: 0, interviewRate: 50, sufficientSample: false }] }, recommendation: null });
  renderPage();
  await waitFor(() => {
    expect(screen.getByText('QA-focused')).toBeInTheDocument();
    expect(screen.getByText(/not enough/i)).toBeInTheDocument(); // sufficientSample:false copy
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend/web && npx vitest run src/pages/Resumes.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Resumes.tsx`** — a `DashboardLayout` page: list variants (name, default badge, charCount), a paste-textarea "Add variant" (≥20 chars, reuse the `ResumePrompt` textarea pattern), rename/set-default/archive actions, and per-variant record (`sent / interviewed / offered / rejected / noResponse`) — or, when `!sufficientSample`, the line `Only {matchedToOutcome} applications through this résumé — not enough to call it yet.` Wire CRUD via `useMutation` invalidating `["resume-variants"]` and `["variant-scoreboard"]`.

- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS.

- [ ] **Step 5: Add the route + nav entry**, then `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/src/pages/Resumes.tsx frontend/web/src/pages/Resumes.test.tsx frontend/web/src/<router-and-nav-files>
git commit -m "feat(resumes): Résumés page — variants, CRUD, per-variant scoreboard"
```

### Task 12: Variant picker + apply-time guidance in Apply Gate

**Files:**
- Modify: `frontend/web/src/pages/ApplyGate.tsx` (variant `<select>` above "Get decision"; pass `variantId` into `analyzeJobAlignment`; render the recommendation line)
- Test: extend `frontend/web/src/pages/ApplyGate.test.tsx`

**Interfaces:**
- Consumes: `fetchResumeVariants`, `fetchVariantScoreboard` (Task 10).

- [ ] **Step 1: Write the failing tests**

```tsx
test('passes the chosen variantId to analyze', async () => {
  fetchResumeVariants.mockResolvedValue({ success: true, variants: [{ id: 'A', name: 'QA-focused', isDefault: true, createdAt: '', charCount: 1200 }, { id: 'B', name: 'Generic', isDefault: false, createdAt: '', charCount: 1100 }] });
  analyzeJobAlignment.mockResolvedValue(baseResult);
  renderPage();
  await userEvent.selectOptions(await screen.findByLabelText(/Résumé/i), 'B');
  await runAnalyze();
  await waitFor(() => expect(analyzeJobAlignment).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'B' })));
});

test('shows apply-time guidance when a variant out-performs', async () => {
  fetchVariantScoreboard.mockResolvedValue({ success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: { variantId: 'A', name: 'QA-focused', interviewRate: 43 } });
  analyzeJobAlignment.mockResolvedValue(baseResult);
  renderPage();
  await runAnalyze({ jobTitle: 'QA Engineer' });
  await waitFor(() => expect(screen.getByText(/QA-focused/)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify they fail** — FAIL.

- [ ] **Step 3: Implement** — add a `useQuery(["resume-variants"], fetchResumeVariants)`; a `<select id="resume-variant" aria-label="Résumé">` above "Get decision" (default = the `isDefault` variant, persisted in state); include `variantId` in the `analyzeJobAlignment({...})` call; after a verdict, `useQuery(["variant-scoreboard", jobTitle], () => fetchVariantScoreboard(jobTitle))` and render the `recommendation` as a line in the verdict (hidden when null). Reuse the existing `analyzeMutation`/state patterns. Update the baseResult-path mocks (`fetchResumeVariants`, `fetchVariantScoreboard`) in the test `beforeEach` so existing tests keep passing.

- [ ] **Step 4: Run the full ApplyGate suite** — `npx vitest run src/pages/ApplyGate.test.tsx` (update the snapshot with `-u` if the picker changes it). Expected: PASS.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/src/pages/ApplyGate.tsx frontend/web/src/pages/ApplyGate.test.tsx frontend/web/src/pages/__snapshots__/ApplyGate.test.tsx.snap
git commit -m "feat(resumes): Apply Gate variant picker + apply-time guidance"
```

---

## Self-review (completed by plan author)

- **Spec coverage:** §Data model → Tasks 1,2,5; §Components backend → Tasks 3,6,8,9; §résumé resolution → Task 4; §attribution → Task 7; §Frontend surfaces → Tasks 10,11,12; §honesty-when-thin → Tasks 8,9,11,12; §testing → every task's TDD steps; §migration → Tasks 1,5. No uncovered requirement.
- **Placeholder scan:** all code steps carry real code; the one deferred detail (route `perVariantFamilyStats` aggregation) has its construction described against Task 8 data — fold it into Task 9 Step 4 during implementation.
- **Type consistency:** `getResume(userId, {variantId})`, `analyzeJob(..., options.variantId)`, `buildVariantScoreboard(verdicts, cohorts, variantNames, {minSample})`, `recommendVariantForRole(role, variantNames, perVariantFamilyStats, {minSample})`, cohort shape `{interviewed, offered, rejected}`, and the `VariantScoreRow` fields are consistent across backend and frontend tasks.

## Deferred to post-v1 (do not build now)
AI "tailored proof patch" generation; Approach C (variant performance → rejection-%); browser-sidebar attribution capture; sharing `roleFamilyToken` with applyGateService's internal family logic (DRY follow-up).
