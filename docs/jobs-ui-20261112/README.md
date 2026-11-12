# Jobs UI review — November 12, 2026

**UI assessment: A for the reviewed main workflows. Deployed and verified November 12, 2026.** This is an engineering assessment of the observed interface and completed journeys. It does not regrade the matcher, certify production capacity, establish human usability results or claim that every edge case is covered. The prior Resumes A remains withdrawn; its separate [completion correction is deployed](../resumes-ui-20261112/release.json).

The baseline [customer UI review](../ui-review-20261111/README.md) graded Jobs C. Routine preferences, two refresh concepts, collection status and five result sections competed with the roles. Review cards could lead with employer-assessed communication traits before the actual unresolved scope, experience or location issue. The [pre-code plan](PLAN.md) defines acceptance, dependencies, failure/edge/privacy/async analysis, fallbacks, performance, rollout/rollback and verification.

## What changed

| Baseline problem | Result | Evidence |
| --- | --- | --- |
| The customer parses controls before finding a role | Compact saved preferences; Matches / Needs review / Older are primary; Already applied and Excluded remain in **Other results**. | Real-account inspection, frozen-feed comparison, section-state and browser checks |
| The unresolved fit question competes with generic caveats | Each review card leads with **Check before applying**, using an existing actionable source note verbatim. **Read employer posting** follows immediately. | Source-preserving helper tests, full-note and requirement-quote assertions |
| Interview-assessed traits can obscure the remaining qualification question | Those notes remain accessible in **All fit notes**; original requirement statuses, quotations and resume evidence stay available. No requirement is silently rewritten or satisfied. | Controlled source parity and existing Affirm/evidence replay |
| Two update concepts dominate the daily view | Routine update/application recheck controls and detailed timestamps live in **Job sources and coverage**. A failed history lookup has a visible **Retry application check**. | Initial and cached-history failure cases; freshness/background replay |
| A completed history check could leave the next step unclear | Confirmed exact postings leave fresh recommendations. An empty opportunity section can open tracked postings directly. Possible duplicates remain explicitly uncertain. | Stateful history recovery → row removal → Already applied → tracker link |
| The matching document is disconnected from its tools | The saved-resume name opens that exact version in Library, preserving the selected/default distinction. | Exact URL assertions and actual-account read-only handoff |
| A failed settings save can strand the customer | The existing dirty-state guard retains edits and hides incompatible results. Retry followed by reload proves the saved optional title override really cleared. | Stateful failed save → retry → resumed feed → reload assertions |
| Long allowed names/titles can overflow a phone | Constrained, wrapping card headers, resume summary and location text. | A new 320px regression failed before the fix and passed afterward |

The first original actionable note is selected in source order, skipping notes about assessment during interviews. If none exists, the UI can use an unresolved original requirement label. If neither exists, it explicitly says the remaining question was not supplied. The helper does not infer a new question, change eligibility, truncate an alternative qualification route, or discard source notes.

No source coverage, job collection, matching rule, title filter, geography rule, qualification verdict, interview-history ranking, application identity, backend service, database schema or AI call was added or changed. Existing source-version guards, cancellation, automatic polling, stale/partial/preparing states and application-aware projection remain authoritative. Opening a posting still does not record an application.

## Controlled comparison and current live sample

The catalog refreshed during this review. The initial live snapshot had four review roles and 22,850 exclusions; a later live read had three review roles and 24,183 exclusions. Those are distinct samples, not a measured UI effect or a claim about changing qualifications.

For the layout comparison, both serving old Jobs UI and the compiled candidate received the **same frozen preferences, saved resumes, feed and application-status responses**, with the clock fixed to the captured feed time. All four response bodies matched exactly. Application history was resolved before measuring. The frozen sample contains four review roles, zero supported roles and 22,850 exclusions. No roles were manufactured or promoted to improve the count.

| Width | First role heading, before → after | Page height, before → after |
| --- | --- | --- |
| 1440px | 618 → 527px | 2205 → 2225px |
| 768px | 862 → 551px | 2822 → 2516px |
| 390px | 837 → 549px | 3184 → 2827px |
| 320px | 946 → 637px | 3637 → 3166px |

These are observed positions at a 900px viewport height, not usability/conversion benchmarks. The desktop document is slightly longer because the focused question has its own block; earlier access and clearer priority, rather than a minimum total height, are the acceptance criteria. All original notes remain accessible. Neither version overflowed the controlled viewports; the separate long-name case exposed and fixed an additional phone defect.

Normal Firebase/Premium authentication was used through the established simulated extension bridge for both the fresh real-account check and the frozen-source replay. The latter explicitly substitutes captured read responses for a controlled comparison. Real preference/application writers and send/telemetry attempts were guarded. No actual account preferences, resumes or application records were changed. Original bodies, text and images remain private in `.codex_tmp/jobs-ui-20261112/`.

Published screenshots use fictional data: [mobile review](review-390.png), [desktop review](review-1440.png). See [sanitized validation results](results.json).

## Validation and reproduction

The review checks complete transitions rather than treating a success message as task completion: failed preference save retains edits, retry restores results for the saved version, reload preserves the cleared title override, a history outage retains explicit uncertainty, and successful recovery removes the exact tracked role from fresh recommendations while preserving access to its recorded state.

From `frontend/web`, using the existing dependencies:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --minWorkers=1
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node node_modules/@playwright/test/cli.js test e2e/jobs-organization.spec.ts e2e/jobs.spec.ts e2e/jobs-application-status.spec.ts e2e/jobs-freshness.spec.ts e2e/jobs-optional-roles.spec.ts e2e/jobs-resume-discovery.spec.ts --workers=2
```

The full browser run also includes `jobs-background.spec.ts` and `jobs-opportunity.spec.ts`. They require existing local captured fixtures: `JOB_FEED_BACKGROUND_FIXTURE` points to `.codex_tmp/job-feed-background-20261109/browser-fictional.public.json`; `JOB_FEED_OPPORTUNITY_FIXTURE` points to `.codex_tmp/job-feed-opportunity-20261022`. Paths are relative to the workspace root; supply absolute paths when running from `frontend/web`. The background UI replay fixes the clock to that captured matcher's time to avoid treating a historical fixture as currently unexpired. Freshness/expiry is tested separately with a live clock. These are replays, not a fresh certification of the worker/database engine. All 25 browser cases ran with these fixtures; none was silently skipped.

The final full web suite passed **817 tests**. Four additional frozen audit/evidence browser cases passed at 320/1280px, for **29 browser cases passed, zero failures/skips/flakes**. Those use `JOB_FEED_AUDIT_FIXTURE=.codex_tmp/job-feed-accuracy-20261022` and `JOB_FEED_EVIDENCE_FIXTURE=.codex_tmp/job-feed-evidence-fix-20261022`, including an unresolved graduation requirement, supported clauses and partial evidence. Original records/quotations remain unchanged; no matching service is rerun or retuned by the browser replay. The tracker destination is verified as the existing Dashboard link; this review does not certify every task inside Dashboard.

Production auth guards, token checks, TypeScript and production/loopback builds pass. The loopback review bundle is not a deployment artifact. Review the running development page at `http://localhost:5173/jobs`; a separate compiled review at 5190 uses a local proxy to the serving API because the API does not permit localhost origins directly. The user's development processes were preserved.

## Limits and release safety

The current account exercises review roles and possible application matches; supported, confirmed-applied, source-failure, no-resume/location setup, archived sources and long-field cases are primarily covered with fixtures. Backend match adjudication, job-supply adequacy, real application submission, live preference mutations/concurrent database writers, all browsers, complete assistive-technology conformance and human usability research are outside this UI assessment. The currently thin feed is not evidence of a poor resume or a zero-opportunity market.

The frontend-only release passed normally authenticated draft/serving checks at all four widths, source-backed notes/evidence, exact resume handoff, anonymous 401 checks and injected history-failure recovery. Public asset hashes match frozen commit d3944ef. The serving backend/configuration and publish lock were preserved; the prior Resumes deploy is retained for rollback. See the [release receipt](release.json). No migration or data rollback is required. Existing API status, client errors, source/version metadata and overflow checks provide observability; do not log resumes, application identifiers or tokens. Dashboard remains last in the redesign sequence.
