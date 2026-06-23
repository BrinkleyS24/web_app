# Resume Variants + Outcome Attribution — Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — ready for implementation plan
**Scope:** v1 = "track-first" (Approach B: scoreboard + apply-time guidance). No AI generation, no verdict-% integration in v1.

## Problem & strategic frame

Today a user has one saved résumé (`users.resume_text`). In reality everyone tailors résumés per job. We want the résumé to become a **versioned, outcome-tagged asset**: the user saves tailored variants, each application records which variant was sent, and Applendium's existing inbox-outcome pipeline attributes the result (interview / offer / rejection / no-response) back to that variant. Over time the user learns **which résumé converts and which one gets auto-rejected**, and Apply Gate steers them onto the winner.

**Why this is defensible, not a me-too:** Teal/Jobscan let users save résumé versions, but their outcome tracking is manual self-reporting nobody maintains, so "what works" is hollow. Applendium already auto-detects outcomes from Gmail, so the variant→outcome link is (near-)automatic — the only way the learning is real. The feature only works because of infrastructure we already own.

## Decisions locked in brainstorming

1. **Wedge = track-first.** v1 ships the tracking/learning loop on existing infra. AI generation is deferred and will be *smarter* later because it can learn from what actually converted.
2. **Attribution = capture at Apply-Gate apply-time only.** When the user clicks "Apply," we record the variant that was analyzed. Rationale (founder): this makes Apply Gate the mandatory pre-apply ritual → drives premium engagement, and (with the future browser sidebar) keeps users in-product and off competitors. Accepted trade-off: attribution only covers gate-run applications; the learning surface must stay honest while data is thin.
3. **Ambition = Approach B:** variant scoreboard + apply-time guidance. NOT feeding variant performance into the rejection-risk % (Approach C, deferred until attribution volume is real).

## Data model

- **New table `resume_variants`** (Supabase, RLS enabled, user-scoped):
  `id (uuid pk)`, `user_id (text/fk)`, `name (text)`, `resume_text (text, encrypted at rest via the existing sensitive-data encryption)`, `is_default (bool)`, `created_at (timestamptz)`, `archived_at (timestamptz null)`.
  Variants are user-pasted named texts (consistent with today's paste-only input; PDF upload stays out of scope).
- **`apply_gate_verdicts` gains one column: `resume_variant_id (uuid null, fk → resume_variants.id)`.** The existing verdict insert (`_insertApplyGateVerdict`) is schema-drift-tolerant: it drops unknown columns and retries. So the backend can deploy **before** the column migration is applied (it simply omits the field until the column exists) — same safe-deploy posture as the Stripe webhook ledger.
- **Migration (backward compatible):** for every user with a non-empty `users.resume_text`, seed one `resume_variants` row named "My résumé" with `is_default = true` and the existing text. `getResume`/`getEnrichedProfile` resolve "the chosen variant, else the user's default variant, else legacy `users.resume_text`." Nothing breaks for existing users.

## Data flow (the flywheel)

1. User saves named variants on a **Résumés** page → `resume_variants`.
2. In Apply Gate the user **picks a variant**; `analyzeJob(userId, …, { variantId })` loads *that* variant's text as the résumé. The empty-profile guard (`hasEvaluableProfile`) runs against the chosen variant. The persisted verdict carries `resume_variant_id`.
3. User clicks **Apply** (the existing apply-action hook) → `user_action='applied'` on that verdict. The verdict now = {role, variant, applied}.
4. The inbox pipeline detects the role's outcome over time (unchanged).
5. **Scoreboard** = applied verdicts joined to each role's outcome cohort, grouped by `resume_variant_id`.
6. **Apply-time guidance** = for the role being analyzed, find the variant with the best record on *same-family* roles and surface it.

## Components (each isolated, single-purpose, testable)

### Backend
- **`resumeVariantService.js`** — CRUD: `createVariant`, `listVariants`, `renameVariant`, `setDefaultVariant`, `archiveVariant`, `getVariantText(userId, variantId)`. Encrypts `resume_text` at rest; decrypts on read for the owner. Routes under `/api/.../resumes` (premium-gated via `requirePremiumPlan`, fails closed).
- **`buildVariantScoreboard(verdicts, cohorts, { minSample })`** — **pure** function mirroring `buildVerdictCalibration`. Reuses `cohortKeyForRole` / `buildCohortOutcomeMap` so variant numbers never drift from Outcome Memory. Returns, per variant: `{ variantId, name, sent, interviewed, offered, rejected, noResponse, interviewRate, sufficientSample }`. Only verdicts with `user_action='applied'` and a matched outcome cohort are scored.
- **`recommendVariantForRole(role, scoreboards, { minSample })`** — **pure**; uses the same role-family matching Apply Gate Memory uses; returns the best-converting variant *only* above `minSample` (else `null` → no claim).
- **`analyzeJob` change:** accept optional `variantId`; load that variant's text (default resolution otherwise); persist `resume_variant_id` on the verdict.

### Frontend (`frontend/web`)
- **Résumés page** (new route) — list/add/rename/set-default/archive variants; each row shows its record or an honest "only N applications — not enough to call it yet."
- **Variant picker in Apply Gate** — a `select` above "Get decision"; the chosen `variantId` rides analyze → verdict → apply. Defaults to the last-used (or default) variant.
- **Apply-time guidance** — in the verdict, a line such as *"Your QA-focused variant is 3-for-7 to interviews on roles like this; the generic one is 0-for-5."* Hidden when below min sample.

## Error handling / edge cases

- **Thin data (honesty layer):** every surface refuses to claim below `minSample` (reuses calibration's `sufficientSample` discipline and the empty-profile honesty pattern). No "this résumé is best" on n=1.
- **Deleted variant referenced by verdicts:** soft-delete via `archived_at` so historical attribution survives; archived variants drop out of the picker but remain in the scoreboard history.
- **Empty chosen variant:** already covered by the `hasEvaluableProfile` guard (returns the insufficient-profile result instead of a verdict).
- **No variants yet / legacy user:** default-variant resolution falls back to `users.resume_text`; the picker shows the single migrated "My résumé."
- **Premium gating + RLS:** routes behind `requirePremiumPlan`; `resume_variants` ships with RLS enabled and no anon policies.

## Testing

- **Pure-function (backend, jest):**
  - `buildVariantScoreboard`: variants × outcomes → correct tallies; below `minSample` → `sufficientSample:false`; outcomes attribute to the right variant; numbers match the cohort join.
  - `recommendVariantForRole`: same-family roles pick the best-converting variant; cross-family does not bleed in; below min → `null`.
- **Route tests:** variant CRUD (create/list/rename/set-default/archive), premium-gated, RLS-safe.
- **Migration test:** existing `users.resume_text` → exactly one `is_default` variant; resolution falls back correctly.
- **Frontend (vitest):** Résumés page renders records + thin-data copy; Apply Gate picker passes `variantId` to `analyzeJobAlignment`; apply-time guidance renders above min sample and hides below.

## Explicitly NOT in v1 (YAGNI)

- AI résumé generation (deferred — track-first; will learn from converted variants later).
- Feeding variant performance into the Apply Gate rejection-risk % (Approach C).
- Auto-detecting which PDF was attached to an application (not possible from the inbox).
- PDF upload / résumé file parsing.

## Open follow-ups (post-v1)

- AI "tailored proof patch" generation that drafts a variant from the verdict's recommendations (honest, anchored to existing content), then tracks *its* outcomes — the originally-discussed generator, now data-informed.
- Approach C: let proven variant performance adjust the verdict.
- Browser-sidebar capture so the apply-time attribution happens on any job page.
