# Resumes UI review — November 12, 2026

**Grade: A for the reviewed local UI/main workflows. Not deployed.** This is a heuristic engineering assessment, not a human usability-study result or production-readiness certification of every Premium feature.

The baseline [UI review](../ui-review-20261111/README.md) graded Resumes **C**. Saved wording, outcome analysis, health findings and submission confirmations competed on one page. “Compare” described two different tasks. In the observed account, 509 applications with unknown submitted versions appeared before the library, while the confirmation action was far below it.

This is a **local frontend candidate**, not the serving production revision. Strategy Alerts was separately [deployed and verified](../strategy-ui-20261112/release.json). No new backend, migration, worker, AI call or source-changing action on the real account is part of this Resumes change. Dashboard remains last.

## Acceptance criteria

The [pre-code plan](PLAN.md) records dependencies, failure/edge/privacy/async analysis, fallbacks, performance, rollback and verification. The candidate must make the initial editing task clear, distinguish wording from outcome comparison, preserve immutable versions and unknown attribution, retain drafts and safe retries across views, keep independent tools usable during failures, and preserve exact document/task handoffs.

| Problem | Result | Review evidence |
| --- | --- | --- |
| Five purposes mixed together | **Library** opens with saved versions and their tools. **Outcomes & submissions** contains the separate history task. Visited views remain mounted; history reads wait until requested. | Populated account browser inspection; lazy-query tests |
| “Compare” could mean wording or response rates | **Compare wording** on the document; **Confirmed outcomes by version** in Outcomes. Application drilldowns and archived versions use disclosures. | Existing wording/editor tests and browser handoff; populated/thin/archived fixtures |
| Attribution warnings without an obvious action | Library has **Record which resume you submitted**. Outcomes places confirmation access first and unknown counts beside a direct review action. | Existing hash deep link, focus/scroll tests and actual account inspection |
| A role filter could imply that confirmations are filtered too | Explicit scope beside the role form: rates/history below are filtered; confirmations above include all applications. | Role query and scope assertions |
| Basic checks could look like eligibility or an ATS score | Scope disclosure names email, work dates, history gaps and quantified examples. Unreadable, unavailable and clean states stay different. | Health contract/headline tests; source-failure browser checks |
| Late errors could leave cached rates/clean labels visible | Verified library/health response boundaries; failed refreshes withhold derived claims. Confirmation choices are retained but disabled until the library recovers. | Cached-refresh and malformed-response regressions; failure/retry browser states |
| The legacy-profile cache key lacked an owner | It now includes the signed-in UID as defense in depth. App.AccountQueryScope already resets caches and local state on account change. | Synthetic shared-cache isolation test; no live disclosure observed or other live account accessed |
| An outcome-row link could leave its document hidden | Exact Library links preserve action/version context and identify the named saved version. Keyboard tabs and browser history retain work. | Draft, selected wording, Back/Forward and exact Apply Gate handoff scenarios |

## Observed UI improvement

Actual-account normal Firebase authentication was exercised through a simulated extension token bridge. The compiled local preview used serving API reads. The browser blocked source-changing requests, including automatic telemetry/send attempts; no email was sent, and no resume, default, application or confirmation was changed.

All four resume API response bodies matched the baseline after excluding only the per-request `requestId`. There were two saved versions, two health rows, 509 unknown-attribution applications, ten applications on the confirmation page, and no archived outcome rows. Rate math, sample thresholds, unknown attribution, pending exclusions and recommendation policy were not changed.

| Width | Initial page height, before → after | First saved version top, before → after | Submission entry top, before → after |
| --- | --- | --- | --- |
| 1440px | 1197 → 900px | 380 → 320px | 1052 → 280px |
| 768px | 1541 → 985px | 470 → 393px | 1399 → 353px |
| 390px | 1665 → 1094px | 532 → 415px | 1508 → 375px |
| 320px | 1892 → 1133px | 593 → 435px | 1735 → 395px |

These are measurements of this account at a 900px viewport height, not conversion or human-usability benchmarks. No horizontal overflow or page errors appeared in the actual-account Library/Outcomes/editor/wording checks. Original bodies and captures remain private in `.codex_tmp/resumes-ui-20261112/`; published captures use fictional data only.

## Reproduce

Use the existing dependencies from `frontend/web`:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --minWorkers=1
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node node_modules/@playwright/test/cli.js test e2e/resumes-organization.spec.ts e2e/resume-workspace.spec.ts e2e/apply-gate-resumes-layout.spec.ts --workers=2
```

The browser tests use fictional APIs and development-only authentication. They verify lost-response retries reuse the request ID, unsent drafts and wording selections survive view changes, Back/Forward works, exact saved wording reaches Apply Gate, and health/library/outcome failures remain distinct from clean/empty results. The separate actual-account production-mode preview uses normal authentication, not the development bypass. Production guard, token check, TypeScript and both production/loopback preview builds must pass before release; the loopback review build is never a deployment artifact.

Validation passed **801 web tests, TypeScript, production guard/token checks and production/preview builds**. All 12 browser scenarios passed; the four organization/failure scenarios were rerun after the final phone error-layout refinement, with zero failures or flakes. The fictional task-context capture deliberately exercises an unavailable task without blocking the resume tools; the existing workspace scenario separately verifies a valid task and exact Apply Gate handoff.

See [sanitized results](results.json), [Library desktop](library-initial-1440.png), [Library mobile](library-initial-390.png), [Outcomes mobile](outcomes-390.png), and [unavailable checks](checks-unavailable-320.png).

## Grade scope and release safety

The grade in `results.json` is an engineering UI assessment of the observed workflows, rather than a new claim about all matching, attribution or billing correctness. A customer usability study, full accessibility audit, all browsers/assistive technologies and live source mutations/concurrency are not independently validated here. Populated rates, archived versions, malformed responses and writer failures use fixtures because the current owner account does not supply all those states. Unsaved editor drafts retain the existing memory-only lifecycle: reload/sign-out clears them; saved exports remain plain text rather than PDF/Word layout.

Release is frontend-only and compatible with the serving APIs. Build an immutable candidate from the committed source, inspect draft and serving assets with normal auth, preserve the current backend/configuration and publish lock, and retain the Strategy web deploy for rollback. No database rollback is needed. Existing endpoint failure statuses and client errors are the monitoring signals; do not log resume text or tokens. The Library remains useful when historical analysis fails; unverified data is never substituted for confirmed history.
