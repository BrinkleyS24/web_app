# Premium Cold-Start "First Move" Card — Design

- **Date:** 2026-06-21
- **Status:** Approved design, pre-implementation
- **Surface:** `frontend/web` (premium web app)
- **Primary file:** `frontend/web/src/pages/DashboardNew.tsx` (premium home)

## Problem & Context

Applendium Premium's killer feature is **Apply Gate** — a grounded "apply / fix-first / skip"
verdict on a real job posting, evaluated against the user's resume and Gmail job-search history.
It is the clearest day-one reason to pay, and it works for thin *and* rich accounts (a verdict
needs only a resume + one job description; for established users it is auto-enriched by their
tracked applications).

But the **first Premium session does not deliver that aha.** A new subscriber lands on the
premium home (`DashboardNew`), which is a command center built around accumulated data — Daily
Action Queue, Outcome Memory, Strategy Alerts. On a thin account these honestly read "not enough
data yet." Meanwhile the one feature that *would* land immediately, Apply Gate, has a hidden
blocker: it needs a saved resume, and **resume capture is buried in Settings** (`ResumePrompt` is
only mounted there). So the new subscriber sees a mostly-empty dashboard, never adds a resume, and
Apply Gate reports "resume not found." The pieces exist; they are not choreographed.

This is the #1 churn risk for the cohort the hard-promote will drive: new subscribers whose first
session feels empty.

## Goals / Success Criteria

- A new subscriber reaches their **first Apply Gate verdict** within the first session.
- The flow works for **both cohorts** (see below) and never greets anyone with "not enough data yet"
  as their first impression.
- **No new Chrome permissions, no new backend endpoints/schema** — pure `frontend/web` work that
  reuses existing queries and the Apply Gate page.
- The surface is **cold-start only**: it never shows to a user who has already run a gate, and it
  retires itself the moment its job is done.

## Non-Goals (v1)

- Embedding the JD input + verdict rendering inside the card (the `/apply-gate` page owns that).
- The Browser Career Coach Sidebar (separate, larger initiative — needs broad host permissions and
  a heavier Chrome review; tracked separately).
- Making every "not enough data yet" empty state actionable (a worthwhile complement — see Future).
- Cross-device dismiss persistence / any backend flag.

## User Cohorts (both common)

1. **Established free user → upgrades:** dozens of tracked Gmail applications already, but never ran
   Apply Gate and no recorded outcomes. Tracking is rich; the moat features are empty.
2. **Brand-new:** installed, connected Gmail, upgraded fast — a handful of synced threads, no resume,
   no Apply Gate runs. Almost everything is thin.

The design must land for both. The unifying move is Apply Gate, which is valuable with or without
history.

## Solution Overview

A single new self-contained component, **`FirstMoveCard`**, mounted at the top of `DashboardNew`,
above the existing brief. It removes the buried-resume blocker and points one clear arrow at Apply
Gate. It owns *resume capture + motivation*; the existing `/apply-gate` page owns the JD paste,
the ~30s analysis, and the rich verdict (the aha payoff).

## Trigger & Lifecycle

Driven entirely by signals the frontend already has — pure derivation, no state to drift:

- `visible = !dismissed && (!hasResume || applyGateRunCount === 0)`
- `step = hasResume ? 2 : 1`

State machine:

| Account state | Card |
| --- | --- |
| No resume | **Step 1 — "Add your resume"** |
| Resume saved, 0 gate runs | **Step 2 — "Run your first Apply Gate"** |
| ≥1 gate run | **Auto-hidden permanently** (the aha has happened) |
| Manually dismissed | Hidden (per-device) |

The card is purely a cold-start surface. Established users who have already run a gate never see it,
and it vacates the moment someone completes their first verdict.

## Card Content

Voice: direct, grounded, specific (per `PREMIUM_PRODUCT_STRATEGY.md`) — not generic positivity.
Eyebrow on both states: **"First move."**

### Step 1 — no resume on file
- Headline: *"Get a verdict on the next role you're considering."*
- Body: *"Apply Gate reads your resume against any job posting and tells you apply, fix-first, or
  skip — grounded in your real history, not generic advice. Add your resume to start."*
- Inline resume paste (reuses the resume-save path → `users.resume_text`, encrypted), with a trust
  line: *"Stored encrypted. Used only to evaluate roles for you."*
- On save → advances to Step 2 in place (no reload).

### Step 2 — resume saved, 0 gate runs
- Cohort-aware headline:
  - Established (`applicationsSent ≥ 5`): *"Apply Gate already knows your {N} tracked applications.
    Run it on a role you're weighing."*
  - Thin / `applicationsSent` unavailable: *"Run Apply Gate on a role you're weighing."*
- Body: *"Paste a job posting and get a grounded apply / fix-first / skip verdict — top rejection
  risks, missing proof, and what to fix today — in about 30 seconds."*
- A `Resume saved ✓` chip (completed Step 1 reads as progress).
- Primary CTA: **"Run your first Apply Gate →"** → `navigate('/apply-gate')`.

## Architecture & Data Flow

**One new component, zero backend changes.**

**`FirstMoveCard.tsx`** (new) — self-contained; `DashboardNew` drops `<FirstMoveCard />` into its
top slot. Reads three existing signals:

- `fetchResume` → `hasResume` (the same query Apply Gate uses; `resumeText.trim().length > 20`).
- Apply Gate history fetch → `applyGateRunCount` (the `/apply-gate` page already loads prior
  verdicts; `count === 0` = never run). **Fallback** only if that query is not cleanly reachable
  from the dashboard: a tiny `GET …/apply-gate/count`. First choice is reuse — no new endpoint.
- `cohortMetrics.applicationsSent` → `N` (already fetched by `DashboardNew` for its tiles).

Data flow:

- *Step 1 save* → reuse the resume-save mutation. Extract a shared **`useSaveResume`** hook so
  `ResumePrompt` and `FirstMoveCard` share one save path (not two copies). On success → invalidate
  the resume query → card re-renders to Step 2.
- *Step 2 CTA* → `navigate('/apply-gate')`.
- *Auto-hide* → on return from a gate run, `applyGateRunCount ≥ 1` flips `visible` to false on the
  next fetch. No manual bookkeeping.

Dismiss persistence: `localStorage` flag (`firstMove.dismissed`) — no schema change; the card
already auto-retires after the first run, so per-device dismiss is sufficient for v1.

**Dependency summary:** `FirstMoveCard` depends on the resume query + save, the apply-gate-history
query, the metrics query, and the router — all existing. Backend untouched.

## Error Handling (fail safe — the card never breaks the dashboard)

- *Resume save fails* → inline error (*"Couldn't save your resume — try again"*), **keep the pasted
  text**, stay on Step 1, allow retry.
- *Empty / too-short resume* → inline validation matching the `>20 chars` threshold; save disabled
  until minimally valid.
- *Signal queries loading* → render nothing (no flash/skeleton-thrash). *Query error* → **hide the
  card** (a broken card is worse than no card; the dashboard is unaffected).
- *`applicationsSent` unavailable* → generic Step-2 headline; never *"knows your undefined
  applications."*
- *localStorage blocked* (private mode) → `try/catch`; treat as not-dismissed; cannot crash the card.
- *The Apply Gate run itself* → not the card's concern; the `/apply-gate` page already handles AI
  timeout/failure gracefully (the acceptance checklist's "AI failure fallback" bar).

## Testing (vitest + testing-library, mirroring `DashboardNew.test.tsx`)

1. No resume → Step 1 (resume input shown).
2. Resume + 0 runs → Step 2 + CTA.
3. Established (`applicationsSent ≥ 5`) → headline names *"your N tracked applications."*
4. Thin (`applicationsSent < 5`) / unavailable → generic headline (no N).
5. ≥1 gate run → card absent (auto-hidden).
6. Dismissed flag → card absent.
7. Resume save success → advances to Step 2 (mutation + query invalidation).
8. Resume save failure → inline error, text preserved, stays on Step 1.
9. Signal queries loading/error → renders nothing.
- Regression on `DashboardNew`: established, already-ran-a-gate user → card absent.
- No backend tests (no backend change).

## Future / Tracked (not this spec)

- **Inline JD + compact verdict in the card** — stronger in-card aha, but duplicates verdict
  rendering. Revisit if routing-to-page measurably under-converts.
- **Actionable empty states** — turn each "not enough data yet" into an Apply-Gate funnel (the
  "A + C combo" considered during brainstorming).
- **Cross-device dismiss** — promote the dismiss flag to a user record if device-local proves
  insufficient.
- **Browser Career Coach Sidebar (Build 3)** — the bigger "coach in the browser" bet; deferred for
  its Chrome-review / broad-host-permission cost, especially right after the 2.0 store submission.

## Success Measurement (post-ship)

- Share of new premium subscribers who run their first Apply Gate within the first session
  (before → after this card).
- Resume-on-file rate for new subscribers (the card surfaces the previously-buried capture).
