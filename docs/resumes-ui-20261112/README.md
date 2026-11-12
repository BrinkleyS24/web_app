# Resumes UI review — November 12, 2026

**Prior A grade withdrawn.** The customer found that confirmed applications stayed editable in the work list. The earlier assessment missed persistent task completion; passing the listed technical checks did not justify that grade. A follow-up correction separates actionable work from recorded history and adds stateful completion/reload/correction acceptance tests. This revision was deployed and verified on November 12; see the [release receipt](release.json).

The baseline [UI review](../ui-review-20261111/README.md) graded Resumes **C**. Saved wording, outcome analysis, health findings and submission confirmations competed on one page. “Compare” described two different tasks. In the observed account, 509 applications with unknown submitted versions appeared before the library, while the confirmation action was far below it.

## Completion correction after customer review

The customer correctly identified that a confirmed application remained an editable task. The previous browser fixture returned `submission: null` even after a successful PUT; it asserted a save message, not completion that survives a reload. The technical pass counts below did not establish that product behavior. **The A is withdrawn, with no automatic replacement grade.**

The [correction plan](COMPLETION-PLAN.md) defines the revised acceptance and risks. The panel now puts only unanswered applications or named unavailable documents in **Needs confirmation on this page**. Saved answers move into compact **Recorded on this page** history after a server refresh. A recorded entry has an explicit **Change submitted resume** action; unchanged choices cannot be saved again. Explicit unknown answers complete the task while preserving zero resume credit. No application, resume, confirmation or historical outcome is deleted.

Write failures keep the task and its retry identity. A failed or inconsistent read after an acknowledged write reports that the updated list could not be verified, rather than claiming completion. The completion message lives outside the removed row. Pagination waits for pending saves; page-local empty copy retains the older-applications action. Dependent advice is invalidated immediately without making task completion wait for unrelated analysis reads.

Correction validation passed **809 web tests, 104 targeted checks, 16 browser scenarios, TypeScript and guarded production/preview builds**. The new stateful browser scenario starts with ten applications (two already recorded), finishes the eight tasks, retries a lost acknowledgment using the same request, reloads, corrects a recorded choice using its revision, then records an older application as unknown. It runs at 320/390/768/1440px. Existing editor/wording/Apply Gate and view-preservation checks also pass.

A fresh read-only check on the actual account observed **3 needing confirmation and 7 recorded on the current ten-application page**, with older pages available. Those seven are absent from the editable task list; correction can be opened without writing. No actual-account records were changed during validation. The older source-parity/count measurements below describe the earlier snapshot before the customer's confirmations, not this later account state.

See [correction results and limits](completion-results.json), [mobile completion](completion-390.png) and [desktop completion](completion-1440.png). The published screenshots use fictional data. This correction is **deployed and verified**; see the [release receipt](release.json). It changes presentation, not attribution policy or database transactions; no migration/backend rollout is required. Counts/history remain page-local rather than a new server-filtered global queue. Human usability and complete accessibility/multi-browser validation remain unverified.

This is the **deployed frontend revision** as of November 12, 2026. Strategy Alerts was separately [deployed and verified](../strategy-ui-20261112/release.json). No new backend, migration, worker, AI call or source-changing action on the real account is part of this Resumes change. Dashboard remains last.

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

The frontend-only rollout passed draft and serving checks with normal authentication, exact source/history grouping, correction access, resume handoff and injected list-failure recovery. Public asset hashes match frozen commit e7dc1de. The backend/configuration and publish lock were preserved; the Strategy web deploy is retained for rollback. No database rollback is needed. Existing endpoint failure statuses and client errors are the monitoring signals; do not log resume text or tokens. The Library remains useful when historical analysis fails; unverified data is never substituted for confirmed history.
