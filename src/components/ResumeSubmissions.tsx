import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmSubmittedResume, fetchResumeSubmissions, type ResumeSubmissionApplication, type ResumeVariant } from '@/lib/emails';
import { Panel } from '@/components/premium/PremiumUI';
import { BUTTON } from '@/components/premium/tone';

type SubmissionPage = Awaited<ReturnType<typeof fetchResumeSubmissions>>;

export function submissionNeedsConfirmation(application: ResumeSubmissionApplication) {
  const record = application.submission;
  // An explicit unknown is an answer. A named unavailable document needs review.
  return !record || Boolean(record.variantId && record.documentAvailable !== true);
}

function requireSubmissionPage(value: SubmissionPage) {
  if (value?.success !== true || !Array.isArray(value.applications)
    || !value.applications.every(a => a && typeof a.id === 'string' && a.id.length > 0
      && (a.submission === null || a.submission && Number.isSafeInteger(a.submission.revision)
        && a.submission.revision > 0 && (a.submission.variantId === null || typeof a.submission.variantId === 'string')))
    || new Set(value.applications.map(a => a.id)).size !== value.applications.length
    || !(value.nextCursor === null || typeof value.nextCursor === 'string')) {
    throw new Error('Application confirmations could not be verified. Reload before changing a submitted version.');
  }
  return value;
}

function SubmissionChoice({ application: a, variants, saved, reload, choicesAvailable, setBusy }: {
  application: ResumeSubmissionApplication; variants: ResumeVariant[];
  saved: (application: ResumeSubmissionApplication, unknown: boolean, restoreFocus: boolean) => Promise<void>;
  reload: () => void; choicesAvailable: boolean; setBusy: (id: string, pending: boolean) => void;
}) {
  const needsConfirmation = submissionNeedsConfirmation(a);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(a.submission ? a.submission.variantId || 'unknown' : '');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const request = useRef<{ payload: string; requestId: string } | null>(null);
  const row = useRef<HTMLLIElement>(null), submitting = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const recordedId = a.submission?.variantId;
  const missing = recordedId && !variants.some(v => v.id === recordedId);
  const unchanged = !needsConfirmation && choice === (recordedId || 'unknown');
  const save = async () => {
    if (submitting.current || !choice || !choicesAvailable || unchanged || missing && choice === recordedId) return;
    const body = { variantId: choice === 'unknown' ? null : choice, expectedRevision: a.submission?.revision || 0 };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload) request.current = { payload, requestId: crypto.randomUUID() };
    submitting.current = true; setSaving(true); setError(''); setBusy(a.id, true);
    try {
      const response = await confirmSubmittedResume(a.id, { ...body, requestId: request.current.requestId });
      if (response?.success !== true) throw new Error('The save was not confirmed. Retry unchanged to check the same request safely.');
      await saved(a, choice === 'unknown', Boolean(row.current?.contains(document.activeElement)));
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'The confirmation could not be saved. Retry to check the same request safely.');
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
      setBusy(a.id, false);
    }
  };
  return <li ref={row} className="space-y-2 border-b border-border py-4 last:border-0" data-testid={`submission-${a.id}`}>
    <p className="font-semibold break-words">{a.role || 'Role not identified'} · {a.company || 'Employer not identified'}</p>
    <p className="text-xs text-muted-foreground">Application {a.id}{a.appliedAt ? ` · ${new Date(a.appliedAt).toLocaleDateString()}` : ''} · {a.outcomeLabel === 'interviewed' ? 'Reached interview stage' : a.outcomeLabel === 'pending' ? 'Outcome not established - excluded from outcome rates' : a.outcomeLabel === 'offered' ? 'Offer reached' : 'Rejection recorded'}</p>
    <p className="text-sm">{recordedId ? `Confirmed submitted: ${a.submission?.name || 'Saved version'}${a.submission?.archived ? ' (archived)' : ''}` : a.submission ? 'Recorded as unknown — no version receives credit.' : 'Submitted resume unknown — no version receives credit.'}</p>
    {recordedId && !a.submission?.documentAvailable ? <p role="status" className="text-sm">The recorded document is unavailable or changed. Its outcomes are withheld; review the submitted version.</p> : null}
    {a.outcomeEvidenceLimited ? <p role="status" className="text-sm">This application has more email evidence than this report can safely read. It is excluded from outcome rates; no partial outcome is inferred.</p> : null}
    {!needsConfirmation ? <button type="button" className={BUTTON.ghost} aria-expanded={editing} onClick={() => setEditing(value => !value)} disabled={saving}>{editing ? 'Close correction' : 'Change submitted resume'}</button> : null}
    {/* Hiding a correction retains its draft and retry identity. */}
    <div hidden={!needsConfirmation && !editing}>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
        <label className="w-full min-w-0 text-sm sm:flex-1">Resume you actually submitted
          <select className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background p-2" aria-label={`Submitted resume for application ${a.id}`} value={choice} onChange={e => { setChoice(e.target.value); setError(''); }} disabled={saving || !choicesAvailable}>
            <option value="">Choose only if you remember</option>
            <option value="unknown">I don't know / a version not saved here</option>
            {missing ? <option value={recordedId!}>{a.submission?.name} (recorded unavailable version)</option> : null}
            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <button type="button" className={BUTTON.secondary + ' min-h-10 self-start sm:self-auto'} disabled={saving || !choice || !choicesAvailable || unchanged || Boolean(missing && choice === recordedId)} onClick={save}>{saving ? 'Saving…' : error ? 'Retry confirmation' : 'Confirm submitted resume'}</button>
      </div>
      {error ? <div role="alert" className="text-sm"><p>{error}</p><button type="button" className="underline" onClick={reload}>Reload saved choice</button><span> — discards this unsaved selection.</span></div> : null}
    </div>
  </li>;
}

export function ResumeSubmissions({ owner, variants, openOnArrival = false, choicesAvailable = true }: { owner: string; variants: ResumeVariant[]; openOnArrival?: boolean; choicesAvailable?: boolean }) {
  const client = useQueryClient();
  const panel = useRef<HTMLDivElement>(null), needsList = useRef<HTMLUListElement>(null);
  const deepLinkHandled = useRef(false), focusAfterSave = useRef<string | null>(null);
  const [expanded, setExpanded] = useState(openOnArrival);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState('');
  useEffect(() => { if (openOnArrival) setExpanded(true); }, [openOnArrival]);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [refresh, setRefresh] = useState(0);
  const before = cursors[cursors.length - 1];
  const queryKey = ['resume-submissions', owner, before];
  const query = useQuery({ queryKey, queryFn: () => fetchResumeSubmissions(before), select: requireSubmissionPage, enabled: Boolean(owner), retry: false });
  const applications = query.data?.applications ?? [];
  const needs = applications.filter(submissionNeedsConfirmation);
  const recorded = applications.filter(a => !submissionNeedsConfirmation(a));
  useEffect(() => {
    if (!openOnArrival) { deepLinkHandled.current = false; return; }
    if (!expanded || query.isPending || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView?.({ block: 'start' });
  }, [openOnArrival, expanded, query.isPending]);
  useEffect(() => {
    if (!focusAfterSave.current || needs.some(a => a.id === focusAfterSave.current)) return;
    focusAfterSave.current = null;
    // Removal usually leaves focus on body. Respect a customer who moved to
    // another field or switched views while the refresh was outstanding.
    if (!expanded || document.activeElement !== document.body) return;
    const target = needsList.current?.querySelector<HTMLSelectElement>('select:not(:disabled)') || panel.current;
    target?.focus({ preventScroll: true });
  }, [query.data, expanded]);
  const setBusy = (id: string, pending: boolean) => setBusyIds(current => {
    const next = new Set(current); if (pending) next.add(id); else next.delete(id); return next;
  });
  const saved = async (application: ResumeSubmissionApplication, unknown: boolean, restoreFocus: boolean) => {
    const acknowledgment = unknown ? 'Saved as unknown. No version receives credit.' : 'Submitted version confirmed.';
    setMessage(acknowledgment + ' Updating the list…');
    if (restoreFocus) focusAfterSave.current = application.id;
    // Invalidate dependent advice immediately, but don't hold up this task on
    // unrelated analysis reads. Only its own refreshed record proves completion.
    void Promise.all([['variant-scoreboard'], ['apply-gate-history'], ['fix-suggestions', 'queue', owner], ['dashboard', 'queue'], ['strategy-alerts']].map(key => client.invalidateQueries({ queryKey: key }))).catch(() => undefined);
    await client.invalidateQueries({ queryKey: ['resume-submissions', owner] });
    let page: SubmissionPage | undefined;
    try { page = requireSubmissionPage(client.getQueryData<SubmissionPage>(queryKey)!); } catch { /* An invalid refresh cannot establish completion. */ }
    const current = page?.applications.find(a => a.id === application.id);
    const reloaded = client.getQueryState(queryKey)?.status === 'success';
    if (reloaded && current?.submission && current.submission.revision > (application.submission?.revision || 0)) {
      setMessage(acknowledgment + (submissionNeedsConfirmation(current) ? ' Its saved document still needs review.' : ' Find it under Recorded on this page.'));
    } else {
      setMessage(acknowledgment + ' The updated list could not be verified yet. Reload applications before changing it again.');
    }
  };
  const choices = (rows: ResumeSubmissionApplication[]) => rows.map(a => <SubmissionChoice key={`${a.id}:${a.submission?.revision || 0}:${refresh}`} application={a} variants={variants} choicesAvailable={choicesAvailable} saved={saved} setBusy={setBusy} reload={() => { query.refetch().then(result => { if (result.isSuccess) setRefresh(n => n + 1); }); }} />);
  const changePage = (next: Array<string | undefined>) => { if (busyIds.size) return; setCursors(next); setMessage(''); };
  return <div id="submitted-resumes" ref={panel} role="region" aria-label="Submitted resume confirmations" tabIndex={-1} className="scroll-mt-24"><Panel title="Which resume did you submit?" description="Confirm the version on each application. Completed answers move into recorded history; checks and defaults never count as a submitted version."
    action={<button type="button" className={BUTTON.secondary} aria-expanded={expanded} aria-controls="resume-submission-choices" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide application confirmations' : 'Review submitted resumes'}</button>}>
    {message ? <p role="status" className="mb-3 text-sm">{message}</p> : null}
    {!expanded ? <p className="text-sm text-muted-foreground">{query.isError ? 'Application confirmations could not be loaded. Open this panel to retry; your resume library is still available.' : query.isPending ? 'Loading application confirmations…' : `${needs.length} needing confirmation · ${recorded.length} recorded on this page.`}</p> : null}
    <div id="resume-submission-choices" hidden={!expanded}>
      {!choicesAvailable ? <p role="status" className="mb-3 text-sm">Your saved versions could not be checked. Your selection is retained; reload the library before confirming it.</p> : null}
      {query.isPending ? <p role="status">Loading applications…</p> : query.isError ? <div role="alert"><p>Application confirmations could not be loaded. Your resumes are still available.</p><button className={BUTTON.secondary} onClick={() => query.refetch()}>Try loading applications again</button></div> : <>
        {(query.data?.unlinkedSubmissions || 0) > 0 ? <p role="status" className="mt-3 text-sm">{query.data?.unlinkedSubmissions} saved confirmation(s) have an application link that changed. They are retained without outcome credit. Confirm the version on the current application below; no transfer is guessed.</p> : null}
        <h3 className="mt-3 text-sm font-semibold">Needs confirmation on this page ({needs.length})</h3>
        {needs.length ? <ul ref={needsList} aria-label="Applications needing resume confirmation">{choices(needs)}</ul> : <p className="mt-3 text-sm">{applications.length ? 'No applications on this page need confirmation.' : 'No tracked applications on this page. Applications appear after inbox tracking or adding an application in the extension.'}{query.data?.nextCursor ? ' Older applications are available below; this is not an account-wide completion count.' : ''}</p>}
        {recorded.length ? <details className="mt-4 rounded-xl border border-border p-4"><summary className="min-h-10 cursor-pointer text-sm font-semibold">Recorded on this page ({recorded.length})</summary><p className="mt-2 text-xs text-muted-foreground">Your answers remain saved. Open an entry’s correction action only if the version you recorded is wrong.</p><ul aria-label="Recorded resume submissions">{choices(recorded)}</ul></details> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {cursors.length > 1 ? <button className={BUTTON.secondary} disabled={busyIds.size > 0} onClick={() => changePage(cursors.slice(0, -1))}>Previous applications</button> : null}
          {query.data?.nextCursor ? <button className={BUTTON.secondary} disabled={busyIds.size > 0} onClick={() => changePage([...cursors, query.data!.nextCursor!])}>More applications</button> : null}
        </div>
      </>}
      <details className="mt-4 text-xs text-muted-foreground"><summary className="min-h-10 cursor-pointer py-2 font-medium">How these answers affect outcomes</summary><p>Rates describe reached-interview or offer outcomes among confirmed applications with tracked outcomes. Waiting and unknown versions are excluded. These associations do not explain why an employer responded.</p></details>
    </div>
  </Panel></div>;
}
