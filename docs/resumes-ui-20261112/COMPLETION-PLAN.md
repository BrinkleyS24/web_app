# Resume confirmation completion correction — before code

Acceptance: a successfully saved, reloaded confirmation leaves the default actionable list and survives reload in recorded history. Correcting an answer remains possible without deleting any application, resume or attribution. An explicit unknown answer is recorded without credit and is not asked repeatedly. A named but missing/changed document remains actionable. Failed/unacknowledged writes stay in place with the same retry ID. Finishing one bounded page does not claim the whole backlog is complete.

Implementation: classify the existing authenticated page into needs-confirmation and recorded sections. Default to the work needing action; compact recorded entries live behind a disclosure and require an explicit correction action before editing. Preserve server revision checks, idempotency, owner query keys and existing page cursors. Use server-refreshed records, not a browser-only dismissed list. Announce completion from the parent so removal/remount cannot erase its feedback; restore keyboard focus only when the removed form held focus. Disable pagination during pending writes. Reject a false/malformed write acknowledgment; do not claim a move until the refreshed record supports it. Explain that counts/history are for this page. No backend/schema or outcome-policy change.

Dependencies: current resume-submissions GET/PUT, exact application IDs, `submission` metadata (including document availability), React Query invalidation, existing revision/idempotency transactions and owner-remounted workspace. Existing list reads page all applications; client partitioning must retain the exact server cursor and visible continuation. Server-filtered queue pagination would require coordinated API/SQL changes; it is unnecessary for this correction and is deliberately not implied by a page-local count.

Failure/impact/mitigation/fallback:
- Save succeeds but row stays editable -> customer cannot see progress -> actionable/recorded partition based on refreshed server metadata -> compact recorded history with explicit correction.
- Local hiding without persistence -> returns on reload or loses correction history -> no local-only completion flag; refetch after ack -> leave unresolved on a failed/inconsistent read, expose retry.
- Unknown answer repeatedly requested -> endless work or invented attribution -> distinguish no record from explicitly recorded null variant -> record as unknown, retain zero credit and correction access.
- Missing/changed document treated as complete -> unsupported attribution disappears -> keep named unavailable documents in the actionable group -> original reference/evidence warning and choose an active version.
- All first-page records confirmed but older pages exist -> false global completion -> explicitly page-local counts, empty copy and More applications -> never infer an account-wide total.
- Failed/false save acknowledgment -> task incorrectly removed -> require success true and refreshed metadata -> keep selection/request ID with visible retry feedback.
- Concurrent/replayed/conflicting writers -> duplicate revision or wrong overwrite -> preserve current expectedRevision/request ID; unchanged recorded choices cannot be re-saved -> same-request retry or explicit reload after conflict.
- Pagination/unmount during an outstanding save -> lost retry state -> disable page controls while any form is saving; keep disclosures/views mounted -> retry from retained form after failure.
- Completed row removes focus or its own success message -> keyboard user loses place -> parent status/live announcement and conditional focus transfer to next actionable field -> focus panel when none remain, without stealing focus from another form.
- History, unrelated drafts or owner data lost -> customer trust/privacy loss -> keep records and stable owner keys; only presentation grouping changes -> original read APIs, source preservation and existing account reset.
- Malformed or failed list response -> fabricated empty queue or crash -> validate basic page shape and keep retryable unavailable state -> no partial completion claim.

Security/privacy: reuse authorized APIs; no real account writes in diagnostics; source text rendered as React text; no new storage/AI/telemetry. Real-account reads/captures private; fictional persistent browser fixtures cover mutations.

Performance/async: no scan of the full account, no recursive fetch or new fan-out; existing bounded page/cursor. Keep cross-feature invalidation. Track only currently pending form IDs; delays/errors must not clear an item prematurely. Existing database transactions remain authoritative.

UX verification: reproduce persisted recorded entries from the user's screenshot. Tests must use a stateful service fixture: GET reflects PUT; then verify removal, next task, unknown, full-page completion with older-page continuation, reload, recorded corrections/revisions, source missing, identical-choice disabling, success false, list failure after commit, conflict and lost response. Verify the actual account read-only and Chromium at 320/390/768/1440; preserve wording/editor and view-switch checks.

Deployment/rollback: compatible frontend-only correction; no migration or backend deployment. Validate type/build and targeted/full web/browser checks; keep unrelated work untouched. Previous frontend can be restored without data rollback. Do not re-award A automatically: withdraw the prior grade and report the corrected scope with observed results.

Observability/testability: sanitized counts, status/errors, source parity and stateful fixture assertions; no resume text/IDs in public reports. Main lesson: previous fixtures returned an unchanged null submission after PUT and tested a save message rather than persistent task completion. Add product-level completion acceptance, not just endpoint success.
