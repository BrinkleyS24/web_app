# Apply Gate UI and workflow review — November 12, 2026

**Grade: A for the exercised UI workflows, from the baseline C+. Local candidate; not deployed.** This is an engineering assessment of observed task clarity, source identity, error recovery and completion. It is not an independent customer study, model-quality grade, accessibility certification or production capacity/release certificate.

The customer can now start with a resume and posting, read one decision, record a choice, and move to a genuinely blank next posting. Saved checks have a separate destination rather than forming a second workspace below the form. The result's qualification warning and evidence remain separate from application strategy.

## Changes and reasons

- **Check a role / Saved checks:** URL-backed views retain the draft and pending operation while switching. A blank new check defers history fetching. Saved checks have explicit loading, failure, retry and empty states. History errors never masquerade as zero saved checks.
- **Focused entry:** resume, posting link and description are primary. Title, employer and apply style live in Optional details; supplied metadata and a non-default style remain visible in its summary. The idle result column is hidden. Selecting a resume no longer claims it records a submitted version.
- **Readable saved history:** date, employer, resume and decision stay visible. Detailed evidence and recording a choice have a named disclosure. An explicitly linked source opens its own exact run, including an older run; it is never silently replaced by a newer decision. Show more exposes every grouped posting in the returned dataset. Counts explicitly describe loaded history, not an all-time total.
- **Truthful progress and persistence:** elapsed time replaces time-invented stages and percentages. Analysis, recheck, resume setup and choice recording require positive success envelopes. A check without a saved record cannot claim to persist a choice. Failure keeps the posting and prior result available.
- **Async and completion safeguards:** dispatch captures the actual form payload; competing writes are serialized within this workspace. Edits after a check flag the old result and prevent recording it as advice about the changed draft. “Review another role” clears the posting, metadata, result and obsolete source/task URL while keeping resume/style choices. It also clears an older standalone draft when leaving a task handoff.
- **Connected destinations:** the exact resume editor handoff retains the posting. A saved-posting recheck explains its original resume selection rather than claiming to use whichever resume the form currently shows. Reloading that result opens its named saved source. Applying intent remains separate from confirming the submitted resume on the tracked application.

Qualification extraction, thresholds, degree/experience rules, historical attribution, ranking, source supply, backend APIs and extension presentation code were not changed. Existing backend/web/extension presentation parity assertions remain in the unit suite. No database migration is required.

## Observed evidence

The normal-auth inspection used the existing authorized account, a compiled production-mode frontend and the serving API. The extension token bridge was simulated; Firebase/API authentication was normal. Source-changing requests were guarded. No actual analysis, recheck, application choice, resume save, billing action or model call was performed against the account.

| Width | Original submit button top | Candidate submit button top | Earlier by |
| --- | ---: | ---: | ---: |
| 1440 | 1096.75 px | 783.88 px | 312.88 px |
| 768 | 1105.13 px | 808.25 px | 296.88 px |
| 390 | 1145.13 px | 818.75 px | 326.38 px |
| 320 | 1201.50 px | 834.75 px | 366.75 px |

These are layout measurements at a 900px viewport height, not response-time benchmarks. There was no horizontal overflow or client exception at these widths. The actual draft survived view switching and opening the exact selected resume. Four original requirement quotations were verified in the saved evidence. A read-only injected history 503 produced the error state and recovered through retry. See [sanitized account checks](owner-read-only.json).

Stateful fictional browser journeys exercise the writers without changing customer data. They cover check → negative save acknowledgment → retry → clear the next posting → saved history → reload at 320/390/768/1440px, plus text-only and URL-only checks, extraction failure, keyboard controls, no-resume setup, unconfirmed resume saves, stale-input protection, unsaved verdicts, competing operations, named source grouping, show more, recheck failure and result reload. The six persona scenarios retain resolved decisions and legacy requirement ledgers; the new workflows exercise the full current presentation contract. Production guards were preserved when older fixtures lacked the required decision envelope.

Final validation: **831 web tests passed; 28 browser cases passed; no skipped, failed or retried browser cases.** TypeScript, production environment/token guards and production builds passed. The final run includes the saved-source reload correction. [Machine-readable results](results.json) and the [pre-code plan and risk analysis](PLAN.md) accompany this review.

One earlier cross-page browser run failed resume save verification. Its cause was not established as a product defect and no speculative ResumeEditor fix was made. A rapid-field-change unit check and six isolated repeat handoffs passed; visible draft values are now asserted before saving, and the complete final browser run also passed. This does not re-award Resumes its withdrawn A or prove the earlier observation impossible.

## Review and reproduction

From `frontend/web`, with its existing dependencies installed:

```text
npx vitest run --maxWorkers=2 --minWorkers=1
npx tsc --noEmit -p tsconfig.app.json
npx playwright test e2e/apply-gate-workflow.spec.ts e2e/apply-gate.spec.ts e2e/apply-gate-persona-matrix.spec.ts e2e/apply-gate-resumes-layout.spec.ts e2e/resume-workspace.spec.ts --workers=2
npm run build
```

The Playwright configuration supplies local test authentication; API fixtures are fictional. This is distinct from the separate compiled, normally authenticated account inspection. Production build verification explicitly disabled authentication bypass. Node 24 was used. Private account captures, original API bodies and operational scripts remain outside the repository in `.codex_tmp/apply-gate-ui-20261112/`.

Only fictional screenshots are published: [phone entry](entry-390.png), [narrow entry](entry-320.png), and [recorded saved history](saved-history-320.png).

## Limits and release conditions

- A customer usability study, screen-reader/contrast audit, installed extension onboarding and new live model/provider accuracy/latency evaluation were not performed. Existing contractual safeguards and fixtures cannot establish those outcomes.
- The history service still bounds the returned dataset; Show more does not fetch records the service did not return. The UI labels this loaded scope.
- Unsubmitted drafts and current unsaved results remain in memory. Reload/sign-out clears unsaved inputs; saved records remain accessible. A recheck uses the stored posting and its original resume selection through the existing backend contract; unavailable originals remain an explicit error.
- The writer lock applies to this mounted workspace. Server authorization, consistency and behavior across independent tabs continue to depend on existing backend contracts.
- Production rollout is pending. Before promoting this candidate, freeze the committed source and repeat normal-auth draft/serving checks with the current backend/configuration pinned. The rollback target is the verified Jobs frontend deploy `6af62d7887d0ec064508d383`. No data rollback is needed for these changes.

Dashboard remains last. This review does not upgrade the grades of other features.
