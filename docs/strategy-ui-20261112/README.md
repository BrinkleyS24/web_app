# Strategy Alerts UI review — November 12, 2026

**Grade: A for the reviewed local UI/main workflows. Strategy changes are committed for review; they are not deployed.** This is a heuristic engineering assessment of the observed states. Human usability-study results, complete accessibility conformance and a production rollout are outside this grade. Interview Prep was separately [deployed and verified](../interview-prep-ui-20261111/release.json) before this work.

The [baseline audit](../ui-review-20261111/README.md) assigned Strategy Alerts C−. The actual account had one current distinct-role check, 71 excluded older checks, and the heading “No repeated gaps.” Its interview finding repeated a long narrative before a broad Next Actions link. The main problem was interpretation and priority, rather than missing colors or decoration.

## Acceptance criteria and result

The [pre-code plan](PLAN.md) defines the criteria, dependencies, failure/edge/privacy/async reviews, UX fallback behavior, performance, rollback and verification. The revised page must distinguish insufficient evidence from a scoped negative, preserve source facts and requirement categories, present one relevant next step per finding, retain full evidence and exact source links, and keep independent content usable when a read fails.

| Finding | Correction | Evidence |
| --- | --- | --- |
| One current role labeled as no repeated gaps | Explicit “Only one current role checked”; two distinct roles are needed for repetition | Actual-account compiled preview and unit/browser cases |
| No default, zero current checks and a sufficient negative felt alike | Separate setup, no-current, one-role and sufficient-scoped-negative states | Targeted tests; no-default browser case |
| Stale-check warning competed with the useful action | Current document and role count stay visible; exclusions are available under “What this summary uses”; checking another relevant role is sufficient | Actual 71-exclusion disclosure verified; no request to recheck every old job |
| Scope of a capped history could be missed | A capped sample's size remains visible before opening evidence | Final dedicated regression and populated browser cases |
| Long repeated narrative and broad handoff | Finding → source statistic → proposed action; full original explanation under “Why this appeared”; known interview findings route to Prep and role-fit findings to Apply Gate | Actual-account explanation equality, Prep general-practice handoff and exact default-resume link |
| Requirement sources and distinctions were hard to scan | Required/evidence/preferred remain separate; original quotations and supplied verdict references remain accessible | Exact encoded source URL and quotation tests; unknown source IDs never invented |
| More than six returned gaps could disappear silently | First three are visible, with an explicit disclosure for all remaining returned requirements | Seven-requirement browser fixture and long unbroken detail |
| Invalid or success-false responses could look empty or break the sidebar | Validated per query observer; unavailable panels remain retryable; the independent panel survives; bad sidebar data produces no badge | Malformed payload, retry, cached-refresh failure and owner-isolation checks |

The existing Resumes mutations already invalidate the current owner's resume-pattern query. Apply Gate/task progress already invalidates Strategy queries. Those links were inspected and preserved. The sidebar and this page use the same validated visibility rules; Dashboard layout and other page redesigns were not changed. The pattern calculations, source coverage, thresholds, stored records and qualification policy are unchanged.

## What was actually tested

- **Actual account:** the published pre-change page, the local development page, and a compiled production-mode preview with the same owned records. The compiled preview used normal Firebase/Premium authentication through a loopback proxy to the serving production API, with the established simulated extension token bridge and no frontend auth bypass. The before/after source facts were identical. The full original finding description, exclusions, exact default-resume link and navigation into Prep's explicit general workspace were checked. Telemetry was guarded; no resume, application, task-completion, experiment or preference writes were performed. No model call was added.
- **Browser fixtures:** nine scenarios cover 320, 390 and 1440 pixels, a single-current-role sample, multiple findings, running/measured experiments, optional experiment guidance, the Dashboard debrief handoff, requirement blockers/evidence/preferred details, all returned requirements, original source quotes, missing attribution, long text, capped sampling, independent failures, retry and no default resume. Browser fixtures use the development test login; they are not live customer evidence.
- **Regression checks:** the full web suite passed **778 tests**. The final visible sample-limit notice then passed **47 targeted Strategy/presentation checks** and all **9 final browser scenarios**. The **6 sidebar checks** also passed. These counts overlap and must not be added. The full-suite run first encountered a 5-second timeout in an existing Prep test's character-by-character source setup; the source setup now models pasting and its two-topic fixture supplies both exact source quotes. Note typing/export assertions remain, and the broad rerun passed.
- **Build checks:** TypeScript app check, production environment guard, token check and production build passed. No packages, backend runtime code, schema, source collector, billing settings or scheduled jobs were changed for Strategy.

Observed actual-account page heights with the original disclosure state preserved:

| Width | Before | Revised compiled preview | Horizontal overflow |
| --- | ---: | ---: | --- |
| 1440 | 1016 px | 984 px | None |
| 390 | 1431 px | 1295 px | None |
| 320 | 1658 px | 1427 px | None |

These are measurements of this account and viewport, not speed, accessibility or conversion benchmarks. The populated fixture contains more findings and remains longer; explanations and all requirement evidence remain reachable.

Fictional captures: [single-role desktop](single-role-1440.png), [single-role mobile](single-role-390.png), [populated mobile](populated-390.png). [Sanitized results](results.json) record the validation scope. Original owner responses, bodies and screenshots remain private in `.codex_tmp/strategy-ui-20261112/` and are not published here.

## Reproduce and review

From `frontend/web`, using the existing dependencies:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --minWorkers=1
node node_modules/vitest/vitest.mjs run src/pages/StrategyAlerts.test.tsx src/lib/strategyPresentation.test.ts src/hooks/useNavCounts.test.tsx
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node node_modules/@playwright/test/cli.js test e2e/strategy-alerts.spec.ts --workers=1
```

The running development app is at `http://localhost:5173/strategy-alerts`; its existing server was preserved. A separate compiled preview runs on 5190 with a review-only API proxy on 3111 because the production API does not allow localhost origins directly. That proxy forwards normal authentication to production and starts no workers. Production assets must be rebuilt from the committed source for any later release; the review bundle is not a deployment artifact.

## Remaining limits and release safety

The actual account currently supplies one general finding and an insufficient current-role sample. Multiple recurring requirements, enough current checks for a negative result, experiments, malformed responses and missing defaults use fixtures. Exact saved-check URL preservation was tested; the current live sample had no recurring requirement source to open end to end. This work does not independently adjudicate the backend's historical outcomes, qualification checks or causal claims, establish a customer usability grade, or validate all browsers and assistive technologies.

Unverifiable packets are withheld as a whole rather than silently dropping items and presenting a partial list as complete. Other independent panels stay available. The current source API is the boundary of evidence: absence from the checked wording is not proof of lacking a skill, and past interviews are not qualification for a new posting. Unknown source identity stays unlinked.

Deployment is UI-only after the now-serving Prep backend compatibility. No migration or stored-data rollback is needed. Keep the current Prep web deploy as rollback; perform serving-asset, auth, real-account source/handoff and partial-failure checks before upgrading this candidate's release status. Existing endpoint/status diagnostics remain the monitoring points; do not log invitation/resume text or browser notes. Dashboard remains last in the redesign sequence.
