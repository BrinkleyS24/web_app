# Ask Applendium UI revision — November 11, 2026

**Assessment: A for the standalone Ask page in the reviewed local workflows. Production release: deployed and serving checks passed.** This is an engineer's UI/UX judgment, not a human usability-study score or a certification of every possible AI answer. It supersedes the standalone page's D in the [baseline customer UI audit](../ui-review-20261111/README.md). Other pages retain their previous assessments. Dashboard's layout and embedded Ask card were deliberately deferred.

The change addresses the actual usability failure: a suggested question produced hundreds of paragraphs followed by dozens of source cards. The answer now leads, with a useful next step and a manageable result set. Complete results and original narrative remain accessible.

**What changed**

- A dedicated Ask workspace replaces the repeated page/card introduction. After submission, the large composer becomes a compact question summary with Edit and Ask another question actions.
- Deterministic no-reply and reached-interview answers use their complete structured results: five rows per page, explicit total/range, company/role filter and named sort order. Search, sorting and paging make no further Ask requests.
- Long narratives get a bounded preview and a clearly labeled full answer, including long single paragraphs. This is a presentation change, not a rewritten AI summary. Short answers remain complete on screen.
- Follow-up answers connect to Next Actions for prioritization. Existing Apply Gate, Resumes, Interview Prep and data-settings handoffs retain their destinations. Confirmed resume attribution and unknown attribution retain their meanings.
- Each result can expose its own email source and relevant context. Long titles wrap. Missing roles, dates and email links are explicit; no source is guessed from a company/title match.
- The API adds optional thread/stage/date metadata to every deterministic list row. The old fifty-citation cap no longer limits available source links in the complete list. Legacy answer and citation fields are preserved.
- Source selections in narrative answers are labeled as cited sources, rather than pretending they are necessarily all matching applications.
- Compound answers retain their other narrative answers, additional cited applications and visible unanswered-question notices. Only a server-marked pure list can replace enumerated prose with the structured presentation.
- Transient failures retain retry/edit paths. A declared AI quota outage offers deterministic tracked-history lookups instead of repeatedly retrying the unavailable AI answer.
- Owner-keyed state, unmount cancellation, pending-request protection, existing timeout and draft clipboard protections remain in use. Questions and answers gained no new persistence or telemetry.

One existing compiler mismatch was also corrected: the qualification assessment type now includes the optional `blocking` property already read by the existing evidence component and supplied in its fixtures. No qualification behavior changed.

**Evidence and grade criteria**

| Criterion | Result observed |
| --- | --- |
| Purpose | One labeled question composer with useful starting questions; no duplicated Ask introduction |
| Priority | The answer starts around y=380 on desktop, y=384 at 390px, and y=432 at 320px; the relevant next action is visible without traversing a long list |
| Hierarchy | Summary/action first, five result rows, then discoverable context; long narrative and source passages open deliberately |
| Cohesion | Links to the established task/resume workflows; explicit distinction between complete lists and cited selections; invitation uncertainty and unknown attribution retained |
| Feedback and access | Search-empty versus genuinely empty states, clear failures and recovery, request ownership protections, labeled controls, keyboard submission and pagination focus checked |

The same authorized account's 218-result no-reply case remained **218 results**. Of those, 214 had an email thread reference; four did not. Missing links remain missing. The initial rendered page measured:

| Viewport | Before | After |
| --- | ---: | ---: |
| 1440 × 900 | 11,139px | 1,806px |
| 390 × 900 | 19,055px | 2,229px |
| 320 × 900 | Not captured in the baseline | 2,323px |

These are browser document-height observations with five rows initially rendered, not service throughput benchmarks. The original full dataset remains accessible through paging/filtering. A live follow-up answer listing 23 possible follow-ups also demonstrated why a character bound, not just a line-count bound, was necessary.

**Verification performed**

- Full web regression: **729 tests passed**. The final focused workspace run covers 16 tests, including subsequently added new-question/Shift+Enter and cancellation-uncertainty cases; these counts overlap and are not summed.
- Ask backend regression: **260 tests passed across 13 files**, including deterministic facts, model-response safety, source privacy, resume outcomes and route contracts.
- Four checked-in Playwright scenarios passed at 320px, 390px and 1440px, covering the complete large list, sources beyond row fifty, filtering, paging/focus, request counts, retry, editing a draft and inert email HTML.
- TypeScript, production environment guard, shared token parity and production build passed. The existing large-bundle warning remains; this change does not claim to solve application-wide code splitting.
- Real account reads were exercised with normal Firebase verification and Premium authorization. The simulated extension bridge supplied a real custom token; there was no development auth bypass.
- The compiled UI was checked against the current production API for older-response compatibility. The changed native Ask router was checked against real account data and the production-configured AI credential, with actual successful no-reply, follow-up and interview-count answers.
- The final rendering replay used those frozen real responses, clearly separated from new live provider evaluation. There was no horizontal overflow in the inspected 320px, 390px and 1440px states.
- The working local preview was then verified with actual browser HTTP/CORS to its local Ask router and production account reads through its loopback proxy. It returned the complete 218-row list and 214 known source references without client errors, failed requests or auth bypass.
- Dashboard still rendered its embedded question field, no dedicated workspace, and the same observed 4,039px mobile document height. Its redesign was not included.

[Sanitized results and provenance](results.json) accompany this report. Private screenshots, original API responses, credential-free reproduction scripts and full test logs are retained under `.codex_tmp/ask-ui-20261111/` at the workspace root. Do not publish those private account artifacts.

An early native follow-up check used a different local backup credential and received a provider quota failure. That was a test-environment result, not evidence of a production outage. The runtime's configured secret was verified separately, and the successful live evaluation was repeated with it. No production secret or environment setting was changed.

**Reproducing the checks**

Use the repository's supported Node 24 runtime. In `frontend/web`, run `npm run test:run`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run test:e2e -- e2e/ask-workspace.spec.ts --workers=1`. The Playwright cases use fictional API fixtures and the repository's established development test authentication; they are separate from the real-account checks above.

For the backend Ask checks, from `backend/gmail-job-tracker-be` in PowerShell:

```powershell
$askTestFiles = @(Get-ChildItem tests/services/ask*.test.js | ForEach-Object FullName)
$askTestFiles += 'tests/routes/askRoutes.test.js'
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --runTestsByPath @askTestFiles
```

An initial overly broad `ask` test-path search also found an archived source snapshot and unrelated `Task` files. The archived snapshot could not resolve its old imports. The explicit current-file run above passed; the unrelated archive was not modified to make a report green.

**Local review and rollout**

The current preview is `http://localhost:5173/ask`. It uses a separate review bundle pointing to the loopback server on port 3107. That server runs the changed, authenticated Ask router and forwards other application routes to the unchanged production service. It starts no scheduled workers. Normal account authentication is still required. The preview processes are intentionally left running for review.

The release bundle is separate from the review bundle. **Do not deploy `preview-dist`: it points to a local API.** The release build preserves the deployed Jobs flag (`VITE_JOB_FEED_ENABLED=true`) and normal production API URL. No environment files were edited.

Deploy the additive backend changes first, then the frontend, using clean committed sources and the existing release procedures. No migration, backfill, billing change, queue change or classifier/Gmail change is required. Repeat the production authenticated Ask smoke checks and mobile inspection after rollout before describing the deployed version as verified. A frontend rollback restores the prior UI; a backend rollback remains readable by the new client, with explicit missing source links where older metadata is unavailable. No account data needs undoing.

**Risks and remaining limits**

| Risk / failure | Impact | Mitigation and fallback |
| --- | --- | --- |
| Incomplete or malformed structured list | Misleading total or omitted applications | Validate counts, unique references and field shapes; show a request error rather than a fabricated complete result |
| Missing source or older API metadata | Customer cannot verify a particular row by email link | Join only exact answer references; label unavailable links and preserve original answers |
| Partial compound answer | A list hides an unanswered part or another result | Preserve the compound narrative, union additional references and surface unanswered parts |
| Provider unavailable | Repeated futile paid-feature attempts | Keep the question editable; distinguish declared quota recovery from ordinary retry and offer factual lookups |
| Account switch / late response | Another account's private answer appears | Key state by owner, abort on unmount and test late arrivals |
| Stale filter page | False empty result | Reset/clamp paging and offer Clear filter; announce actual filtered range |
| Shared UI/config regression | Another feature changes while Ask is redesigned | Preserve the embedded Dashboard presentation, run full web regressions, and preserve the existing Jobs release flag |

There has been no independent human usability study or complete screen-reader/contrast certification. Gmail itself was not opened in an authenticated Gmail browser session; source links were verified against exact owned thread references. Only a bounded set of live AI questions was exercised; model output is not made infallible by a better interface. New-account and failure cases were covered with labeled fixtures rather than newly provisioned customer identities. The embedded Dashboard Ask experience remains scheduled for Dashboard's later redesign.

The A is scoped to this reviewed standalone interface. It does not upgrade unrelated features, prove every customer scenario, or describe an already deployed release.

**Released:** frontend `1caa4cb` is published as Netlify deploy `6af4edec058fdbad0c17836d`, with auto-publishing locked. Backend `e97b125` serves 100% of normal API traffic on `applendium-backend-ask-e97b125`. Actual published assets were byte-verified, and authenticated normal-browser/CORS checks passed at 1440px, 390px and 320px with all 218 rows, 214 known source references and a successful live AI follow-up. Unauthenticated Ask returned 401. These serving checks used the simulated extension token bridge, not an installed-extension/Google-popup certification. See [release.json](release.json). The earlier rollback target remains available; the Jobs worker and dispatcher were not changed.
