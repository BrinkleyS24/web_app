# Interview Prep review — November 11, 2026

**UI/main-workflow grade: A for the reviewed local revision. Deployment: pending.** This is a heuristic engineering assessment of the observed workflows, not a production certification or a human usability study. The earlier [D-grade UI audit](../ui-review-20261111/README.md) remains the historical baseline. Ask's separate release is already live; this revision has not been published.

The acceptance criteria were established before edits: users can enter from a current canonical task, an exact owned invitation without a task, or deliberate posting-based practice; none invents an interview or submitted resume. A usable setup leads directly to rehearsal. One topic is editable at a time, supporting evidence stays reachable, and source changes or navigation cannot silently discard notes. Recommendations, eligibility and tracked application outcomes remain separate from practice.

## What changed and why

- The real general rehearsal task previously returned 409 repeatedly because it had no invitation IDs. Only a fully unbound, current owned preparation task now opens an explicitly **general** source. Partial references, wrong owners, hidden/provisional evidence, cancellations, closed applications and ambiguous links still fail safely.
- An interview row can open its exact owned email when no usable queued task exists, including a queue outage. Employer/title resemblance no longer substitutes a task. The backend verifies ownership and application/thread evidence again before building.
- **Practice for a role** remains available during inbox loading/failure and does not require Gmail. A new customer with no resume gets a clear Manage resumes action and a disabled build, not a fabricated result.
- After generation, rehearsal appears first. Setup and original evidence sit under a review disclosure. Errors and stale-source warnings stay visible, with review controls opened when needed. The task banner's explanation is expandable on Prep only; other tool layouts and Dashboard were preserved.
- Topic navigation retains every answer. Copy/download includes all topics, including the factual-status field for eligibility questions. Rebuilding still requires acknowledgment before clearing written notes.
- Confirmed unchanged submitted versions take precedence for invitation practice; otherwise the named default is only a practice choice. Generation binds the currently selected resume's content version. Changed/unavailable sources keep notes editable and downloadable while blocking unverified reuse.
- Tab recovery remains opt-in, owner-bound, local to the tab and limited to 30 minutes without edits. No new account records, AI provider, job coverage, billing change, SQL migration or scheduler was added.

## Evidence

| Check | Observed result | Boundary |
| --- | --- | --- |
| Real owned general-task handoff | Previous 409 → local 200, `kind: general` | Normal Firebase/Premium authentication; simulated extension token bridge |
| Real selected resume + user-supplied posting | Practice 200; three topics; exact source quotes | Posting text supplied by the user, not a fresh listing verification |
| Real local browser at 1440 / 390 / 320 px | No horizontal overflow; four visible note fields; retained notes and complete copy | No application, resume or task-completion writes performed |
| Full web regression suite | 744 passed across 147 suites | Followed by final focused checks below; counts overlap |
| Final contract/banner checks | 6 passed, including an added missing-evidence regression | A second final targeted test verifies empty-resume setup |
| Backend source/API/queue/validation/debrief regressions | 154 passed across 6 files, including 67 Prep cases | In-memory fixtures, not a live database mutation/load test |
| Browser fixtures | 9 passing scenarios: task, direct invitation and general practice × 320 / 390 / 1440 px | Fixture API, development test login; kept separate from actual-account checks |
| New customer browser case | 1 passed at 390 px | Fictional no-resume account state |
| TypeScript app check / production guard / token check / production build | Passed | Local build; no Prep production rollout yet |

The first visual revision still placed too much setup above practice. A subsequent revision moved practice first and compacted its task explanation. In the final real-account capture, the practice heading begins at y=493 on desktop and y=596 on both mobile widths when the page is scrolled to the top. Generation also moves focus and scroll to the practice region. These measurements describe this sample, not all content lengths or customer performance.

Fictional captures: [mobile general practice](general-390.png), [desktop invitation practice](invitation-1440.png). Original owner screenshots, bodies and notes remain private under `.codex_tmp/interview-prep-ui-20261111/`; they were not copied into this report. [Sanitized results](results.json) record the validation boundaries.

## Reproduce

From `frontend/web` with its existing dependencies:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --minWorkers=1
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
node node_modules/@playwright/test/cli.js test e2e/interview-prep.spec.ts --workers=1
```

From `backend/gmail-job-tracker-be`:

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/services/interviewPrepService.test.js tests/services/interviewStateConsistency.test.js tests/routes/suggestionRoutes.test.js tests/utils/requestValidation.test.js tests/routes/interviewDebriefRoutes.test.js tests/services/interviewDebriefSnoozeService.test.js
```

For actual-account review, use the normal authenticated local preview at `http://localhost:5173/interview-prep`. The changed Prep router runs locally on 3109 with normal authentication and no workers; other reads use the deployed backend. Select a current general rehearsal task or Practice for a role, use a saved resume and posting, switch topics, and inspect copied/downloaded notes. Do not mark a real task done just to test rendering.

## Operational and remaining limits

The pre-code plan covered dependencies, failures, edge cases, privacy, asynchronous races, UX fallbacks, performance, deployment/rollback and observability. Key mitigations are exact owned source selections, strict request unions, source/resume fingerprints, pending/abort/owner guards, retained note keys, explicit destructive-rebuild acknowledgment and sanitized failure codes. The complete bounded inbox reader remains unchanged; direct general entry bypasses it. The final review also caught and fixed a compact-banner crash when task evidence is absent, with a regression test.

No genuine invitation was exercised on the owner's live account. Invitation ownership, no-task entry, cancellation, completion, mixed-role links, schedules and submission attribution have fixture coverage. This does not establish real Gmail link opening, every employer's invitation format, full assistive-technology conformance, multi-browser parity, a customer study or concurrent production capacity. Practice uses deterministic prompts and word-matched resume excerpts, not adaptive coaching, verified eligibility or predictions of interview questions.

Roll out the compatible backend before the frontend. Older clients remain supported for their existing task selections. No migration or persistent source-data rollback is needed. Keep the preceding API/web versions available; if reverting the frontend, export notes first because older builds cannot restore the new general/email recovery keys. Recovery is a convenience copy, not durable storage.

After deployment, repeat anonymous/Premium gates, the actual-account general task and practice checks against the serving revisions before assigning a production release grade. Monitor existing sanitized Prep failure codes, unexpected 409/503 rates and queue/source refresh failures; do not log resume text, invitation bodies or notes. The local findings are resolved in this revision; the production release checks above remain unverified.
