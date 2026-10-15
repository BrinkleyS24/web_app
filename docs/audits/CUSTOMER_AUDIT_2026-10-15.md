# Applendium customer audit — October 15, 2026

## Verdict

| Experience | Grade | Customer judgment |
| --- | --- | --- |
| Free | **B−, provisional** | Useful everyday email tracker. Manual tracking, reports and the handoff to the weekly check have meaningful gaps. |
| Premium | **C+** | Several useful tools work, but the paid action loop breaks and guidance can disagree with the evidence. Not yet dependable enough to recommend broadly at $24.99/month. |
| New customer / public mobile experience | **C+** | Polished layout; sign-in friction and inconsistent privacy claims weaken activation and trust. |
| Overall | **C+, provisional** | Presentation is ahead of workflow completeness. The next investment should finish the customer journeys and make their recommendations consistent. |

These are qualitative product grades, not measured conversion rates, model accuracy scores, or an average of independent human reviews. Three agents acted as different customer personas; the parent reviewer also exercised the live services.

## How this was checked

- Live production website at `https://applendium.com`, including authenticated Free and Premium sessions using **six isolated synthetic accounts** over three passes. No existing customer's records were used.
- Backend observed during the audit: **`applendium-backend-aplus-eec7541`**, serving 100% of traffic. The initial local backend checkout was older; local source concerns were not automatically classified as production defects.
- Local current extension UI, synthetic browser fixtures, and current web browser scenarios. The store listing showed version 2.1.9; the installed store extension and real Gmail OAuth were not exercised.
- Desktop and mobile layouts, including 390px and 320px public/fixture flows; authenticated live captures at 1440px and 390px.
- Real backend AI responses, resume storage, manual saves, draft editing/copying, interview practice, snoozing, task completion attempts, export, disconnect and synthetic account deletion.
- Billing checkout/portal, outgoing messages and automatic Gmail sync were prevented in the live browser harness. The injected auth bridge substituted for extension sign-in; this does **not** validate the normal Google/extension authentication chain.
- All six synthetic Firebase identities and their application database records were removed. Cleanup checks found no remaining rows in the inspected tables with those synthetic user IDs. No product implementation, subscription or deployment was changed.

The audit touched each customer feature family below. It did **not** execute every integration or every possible state. A full-production A is withheld while Gmail OAuth, real import and billing lifecycle remain unverified.

## Most important findings

### P1 — Premium task completion fails in production

Clicking **Mark done** on “Tailor resume before applying to QA Engineer” returned HTTP **500** and showed “Failed to complete queue action.” The task stayed open. A second synthetic Premium account reproduced the same failure on two API attempts, including retry. This is a broken paid workflow, not just awkward wording.

**For an A:** completing a current task must persist after reload; retries must be safe; stale or changed tasks must explain what changed. Exercise this against the deployed database as well as fixture responses.

### P1 — Interview guidance confuses events with updates

A synthetic message explicitly said, “Thank you for speaking with our hiring team in your interview.” Eighteen days later the live queue recommended **preparing for that interview**, while the same page discussed a post-interview close-loop window.

For a separate invitation, Ask's answer correctly described an invitation, but its cited next-step explanation said to follow up 2–5 days after an interview. An invitation is not proof that an interview occurred. Ask's generated follow-up also supplied an exact interview date derived from an update without evidence of the actual meeting date.

**For an A:** distinguish invitation, availability response, scheduled meeting, completed meeting and post-interview silence. Use an unknown date when the evidence does not establish one. Dashboard, Ask, action queue and prep should agree about the event and appropriate next step.

### P1 — Manual tracking stops halfway

In the current extension UI, a manually added application appeared in the tracker but the activity report said **0 applications** and disabled PDF download. Its card exposed **Remove entry** without editing or stage controls. A phone interview or offer cannot be recorded unless a matching email arrives.

These defects were reproduced using the actual local UI with synthetic API fixtures; they were not a live Gmail test. Separately, the live manual save returned 201 and the JSON data export correctly included the manual application. The PDF omission must not be confused with a broken JSON export.

**For an A:** manual and email-derived applications must share the reporting contract. Users must be able to correct details and record interview, offer, rejection and closure, with a clear distinction between their input and email evidence.

### P1 — A strong Apply Gate verdict creates contradictory work

The live strong-match QA check correctly said **Apply now**, but “What to do” said **Fix first**, and the queue generated a tailoring task plus an Apply task conditioned on closing a proof gap. The resume already evidenced the requested core skills. A useful optional improvement should not silently become a prerequisite.

The same result described “Low rejection risk” with a fit-based estimate label. The backend identifies this as not outcome calibrated. Fit can support a recommendation; it does not establish the chance of rejection.

**For an A:** use one recommendation contract across result, history and action dependencies. Clearly separate mandatory blockers, useful optional edits and fit estimates from validated outcome predictions.

### P1 — Preparation work disappears after refresh

Live interview practice built successfully, grounded prompts in the selected posting/resume, copied notes, and retained the notes across navigation. Reloading cleared the posting, generated practice and rehearsal notes. The interface discloses this, but disclosure does not recover a paying customer's work.

The customer must select a resume, paste the posting, and separately copy 1–5 exact quotations before building practice. Saved posting context is not automatically reused. Resume edits and Apply Gate inputs also have disclosed refresh-loss limits in the current UI.

**For an A:** provide an explicit, privacy-conscious save/recover mechanism for drafts and rehearsal notes. Reuse confirmed posting and resume context, and suggest requirements for the user to approve.

### P1 — Returning users and Free users lose their intended path

Public **Sign in** routes through the pricing page. A signed-out workspace prescribes installing the extension, signing in there, returning and reloading, even though web Google sign-in exists. On mobile, the sign-in control sits far down the pricing page.

Free users can manage resumes, but **Use in Apply Gate** sends them into a Premium wall rather than the weekly Free extension check. Six Premium sidebar destinations are not marked as paid before the click.

**For an A:** direct sign-in from each workspace entry should return to the requested page. Mark paid destinations. Preserve the chosen resume and explain or complete the handoff to the Free allowance.

### P1 — Privacy and onboarding promises disagree

The live landing page says data is never “shared”; the policy describes processing by service providers, including OpenAI. This finding concerns contradictory product copy, not evidence of unauthorized sharing.

The Chrome Store listing discloses Google's unverified-app warning and an audit in progress; the landing page's easy one-click language does not prepare the customer for that warning. Terms also describe an older, narrower Premium product.

**For an A:** landing, authorization explanation, Settings, policy, terms and store listing must describe the same actual data flows and current product. Explain the Gmail connection steps before the customer encounters them.

### P2 — Paid output needs a more complete finish

- Ask's live draft was editable and copied the edited content successfully, but the answer repeated the entire email twice above the editor.
- Resume comparison, immutable saved versions and text editing work. Intake and output remain oriented around pasted text and `.txt`; users must transfer the content into another document workflow to submit a polished resume.
- The new Premium dashboard is long and repeats several insufficient-data states. Those limits are honest, but the page needs a shorter first useful action.
- Ask presents one answer at a time, with little continuity for follow-up work. Its local default daily cap is not visible before reaching it; this was inspected, not load-tested on production.

**For an A:** concise nonduplicated answers, recoverable context, application-ready document output or a reliable document editor handoff, and a focused first-use path that produces immediate value.

### P2 — Keyboard and error recovery are unfinished

- Extension report overlay leaves focus behind it, ignores Escape, and lacks dialog semantics in the tested current UI.
- Live mobile public menu ignores Escape.
- Billing radio controls respond to click but not expected arrow-key selection.
- Canceling Google popup shows `Firebase: Error (auth/popup-closed-by-user).`
- Simulated public price outage falls back to “Pricing at checkout” without an explanation or retry.

**For an A:** useful focus management, keyboard behavior consistent with control roles, plain-language recovery, and visible retry for recoverable failures. Screen-reader and complete contrast conformance were not established by this audit.

## What worked

- Free live manual application creation, correct Premium gating for Ask, accessible Free resume/settings routes.
- Live JSON export, including a manual entry. Disconnect returned 200 for a synthetic account with no connected mailbox; actual Google token revocation remains unverified.
- Synthetic account deletion rejected a wrong confirmation with 400 and accepted the correct confirmation with 200.
- Premium saved resume creation and explicit resume selection during a real browser check.
- Strong QA fit produced APPLY. An explicitly absent mandatory RN license produced SKIP. These few probes support those cases, not a claim of general AI accuracy.
- Ask identified the waiting application and pending assessment and did not invent a reason for an unexplained rejection. These read requests generally took about 2.5–4.8 seconds in the second pass; the first strong-fit check took about 5.7 seconds. Small warm samples are not a latency benchmark.
- Ask and outreach editors copied the user's edited text; snoozing an assessment persisted.
- Interview practice generated and copied grounded notes; notes survived ordinary navigation before refresh.
- Tested public layouts and authenticated captures had no document horizontal overflow. No page runtime exception was recorded in the second authenticated pass; this does not negate the observed server error.
- Public tracker demo, search, filters, thread preview, legal/support navigation and 404 recovery worked.

## Coverage and boundaries

| Feature family | Exercised | Remaining gap |
| --- | --- | --- |
| Public site, pricing, mobile handoff | Live desktop/mobile, demo, monthly/quarterly click, popup cancellation, keyboard, outage simulation | Completed Google sign-in and real purchase conversion |
| Extension pipeline, search, filters, date range | Current UI with fixtures, existing scenario suite | Installed store build against a real mailbox |
| Gmail connection and sync recovery | Fixture errors/empty/disconnected states; live disconnected-account response | OAuth, actual import/classification, background refresh, revoked token recovery, notifications |
| Company/stage corrections and close/reopen | Current extension UI with fixtures | Production persistence, subsequent sync reconciliation |
| Manual tracking | Current UI add/report/lifecycle inspection; live create and JSON export | Live extension handoff and PDF contract after a fix |
| Free weekly Apply Gate | Current popup fixture, result and decision recording | Real production quota reset, real backend through store extension |
| Premium Apply Gate | Live browser submit, real AI probes, history/resume storage; responsive fixture journeys | Full job-URL source coverage, broader profession/credential holdout, long-term outcome calibration |
| Resumes | Current compare/edit/save/copy/text download fixtures; live creation and explicit selection | PDF/DOCX intake/export, refresh recovery and large/malformed document coverage |
| Ask | Live questions, evidence, draft/edit/copy; fixture 429 recovery | Large inbox completeness, sustained limits, conversational continuity |
| Next Actions / outreach | Live draft/edit/copy, snooze, completion failure/retry | Full action types, unsnooze, race conditions, all close-out outcomes |
| Interview Prep | Live build, quote/resume grounding, note copy, navigation retention and reload loss | Durable saves, all interview formats, invitation changes and completion flow |
| Dashboard / weekly / Strategy Alerts | Live populated and empty states; fixture rendered states | Large mature cohorts and full statistical correctness across histories |
| Settings / privacy controls | Live export, disconnect without mailbox, wrong/correct synthetic deletion; coach preference fixture | Revocation with a real Google grant, active Stripe subscription deletion, full export scale |
| Billing / entitlements | Live pricing display and Free/Premium API gates | Stripe test checkout, renewal, failed payment, cancellation, refund and expiry lifecycle |

Existing automated results: **24/24 extension scenarios passed**, **18/26 web scenarios passed**, and **112 tests in four targeted backend suites passed**. The eight web failures have obsolete labels and missing resume fixtures, so they are a regression-suite maintenance gap, not eight demonstrated customer failures. Passing fixture tests did not catch the live completion failure.

One first-pass synthetic assessment used an unsupported category. That observation was discarded. The second pass mapped the assessment to the supported Interviewed stage and Ask correctly recognized the pending assessment. Intentional browser blocks on outbound/telemetry paths are also excluded from defect counts.

## Order of work to reach an A

1. **Restore the paid action loop:** fix live completion, prove persistence and safe retries, then verify all common action types against the actual database.
2. **Make recommendations agree with evidence:** interview phase/date detection, assessment obligations, and one Apply/Fix/Skip contract across every surface.
3. **Finish tracking:** manual lifecycle, activity reports and consistent application counts across extension, dashboard, Ask and exports.
4. **Protect customer effort:** durable interview notes and drafts; reuse selected resume and posting; remove repeated data entry.
5. **Complete the resume job:** supported document intake/output and a reliable application-ready handoff with clear version identity.
6. **Fix activation and trust:** direct sign-in and return path, Free allowance handoff, labelled paywalls, consistent privacy and connection expectations.
7. **Polish output and accessibility:** remove duplicate drafts, simplify cold starts, fix keyboard/focus behavior and vendor errors.
8. **Earn release confidence:** repair stale tests, add dedicated real-service QA accounts/mailbox, verify Stripe lifecycle in test mode, and review a separate profession-diverse AI holdout. Record actual errors and sample sizes; this audit cannot establish perfect accuracy or production readiness for untested integrations.

An A means the customer can complete the intended work, trust the next step, keep their work, recover from failures, and understand what they are paying for. Visual polish and a passing fixture suite alone do not satisfy those conditions.

## Evidence retained locally

Raw evidence stays out of Git. Paths are relative to the shared workspace root:

- `.codex_tmp/customer-audit-20261015/live-pass2/results.json` and screenshots: actual browser interactions, AI answers, queue state and server response statuses.
- `.codex_tmp/customer-audit-20261015/live-pass2/extra-next-actions-completed.png`: visible failed-completion toast and open task.
- `.codex_tmp/customer-audit-20261015/live-followup/results.json`: independent completion reproduction, export completeness and deletion confirmation checks.
- `.codex_tmp/customer-audit-20261015/live/cleanup.json`, `live-pass2/cleanup.json`, `live-followup/cleanup.json`: synthetic cleanup checks.
- `.codex_tmp/customer-audit-20261015/public/PUBLIC_CUSTOMER_REVIEW.md` and public captures.
- `.codex_tmp/customer-audit-20261015/premium-audit-local.md`: Premium reviewer detail and fixture suite limitations.
- `frontend/job_sort/test-results/customer-audit-20261015/FREE_CUSTOMER_AUDIT.md` and `explore/`: Free reviewer detail and reproductions.

Harness check fields named `completed` in the original second-pass record sometimes mean the click sequence finished. In particular, the Mark done record is **not a success**: HTTP 500, the screenshot and the independent follow-up establish failure. This report uses the verified outcome.
