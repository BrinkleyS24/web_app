import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmSubmittedResume, fetchResumeSubmissions, type ResumeSubmissionApplication, type ResumeVariant } from '@/lib/emails';
import { Panel } from '@/components/premium/PremiumUI';
import { BUTTON } from '@/components/premium/tone';

function SubmissionChoice({ application: a, variants, saved, reload }: {
  application: ResumeSubmissionApplication; variants: ResumeVariant[]; saved: () => Promise<void>; reload: () => void;
}) {
  const [choice, setChoice] = useState(a.submission?.variantId || '');
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const request = useRef<{ payload: string; requestId: string } | null>(null);
  const recordedId = a.submission?.variantId;
  const missing = recordedId && !variants.some(v => v.id === recordedId);
  const save = async () => {
    if (saving || !choice) return;
    const body = { variantId: choice === 'unknown' ? null : choice, expectedRevision: a.submission?.revision || 0 };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload) request.current = { payload, requestId: crypto.randomUUID() };
    setSaving(true); setError(''); setMessage('');
    try {
      await confirmSubmittedResume(a.id, { ...body, requestId: request.current.requestId });
      setMessage(choice === 'unknown' ? 'Saved as unknown. No version receives credit.' : 'Submitted version confirmed.');
      await saved();
    } catch (e) { setError(e instanceof Error ? e.message : 'The confirmation could not be saved. Retry to check the same request safely.'); }
    finally { setSaving(false); }
  };
  return <li className="space-y-2 border-b border-border py-4 last:border-0" data-testid={`submission-${a.id}`}>
    <p className="font-semibold break-words">{a.role || 'Role not identified'} · {a.company || 'Employer not identified'}</p>
    <p className="text-xs text-muted-foreground">Application {a.id}{a.appliedAt ? ` · ${new Date(a.appliedAt).toLocaleDateString()}` : ''} · {a.outcomeLabel === 'interviewed' ? 'Reached interview stage' : a.outcomeLabel === 'pending' ? 'Outcome not established - excluded from outcome rates' : a.outcomeLabel === 'offered' ? 'Offer reached' : 'Rejection recorded'}</p>
    <p className="text-sm">{recordedId ? `Confirmed submitted: ${a.submission?.name || 'Saved version'}${a.submission?.archived ? ' (archived)' : ''}` : 'Submitted resume unknown — no version receives credit.'}</p>
    {recordedId && !a.submission?.documentAvailable ? <p role="status" className="text-sm">The recorded document is unavailable or changed. Its outcomes are withheld; review the submitted version.</p> : null}
    {a.outcomeEvidenceLimited ? <p role="status" className="text-sm">This application has more email evidence than this report can safely read. It is excluded from outcome rates; no partial outcome is inferred.</p> : null}
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
      <label className="w-full min-w-0 text-sm sm:flex-1">Resume you actually submitted
        <select className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background p-2" aria-label={`Submitted resume for application ${a.id}`} value={choice} onChange={e => { setChoice(e.target.value); setMessage(''); }} disabled={saving}>
          <option value="">Choose only if you remember</option>
          <option value="unknown">I don't know / a version not saved here</option>
          {missing ? <option value={recordedId!}>{a.submission?.name} (recorded archived version)</option> : null}
          {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <button type="button" className={BUTTON.secondary + " min-h-10 self-start sm:self-auto"} disabled={saving || !choice || Boolean(missing && choice === recordedId)} onClick={save}>{saving ? 'Saving…' : error ? 'Retry confirmation' : 'Confirm submitted resume'}</button>
    </div>
    {error ? <div role="alert" className="text-sm"><p>{error}</p><button type="button" className="underline" onClick={reload}>Reload saved choice</button><span> — discards this unsaved selection.</span></div> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </li>;
}

export function ResumeSubmissions({ owner, variants, openOnArrival = false }: { owner: string; variants: ResumeVariant[]; openOnArrival?: boolean }) {
  const client = useQueryClient();
  const panel = useRef<HTMLDivElement>(null);
  const deepLinkHandled = useRef(false);
  const [expanded, setExpanded] = useState(openOnArrival);
  useEffect(() => {
    if (openOnArrival) setExpanded(true);
  }, [openOnArrival]);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [refresh, setRefresh] = useState(0);
  const before = cursors[cursors.length - 1];
  const query = useQuery({ queryKey: ['resume-submissions', owner, before], queryFn: () => fetchResumeSubmissions(before), enabled: Boolean(owner), retry: false });
  useEffect(() => {
    if (!openOnArrival) { deepLinkHandled.current = false; return; }
    if (!expanded || query.isPending || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView?.({ block: 'start' });
  }, [openOnArrival, expanded, query.isPending]);
  const applicationCount = query.data?.applications.length || 0;
  const saved = async () => {
    await Promise.all([['resume-submissions', owner], ['variant-scoreboard'], ['apply-gate-history'], ['fix-suggestions', 'queue', owner], ['dashboard', 'queue'], ['strategy-alerts']].map(queryKey => client.invalidateQueries({ queryKey })));
  };
  return <div id="submitted-resumes" ref={panel} role="region" aria-label="Submitted resume confirmations" tabIndex={-1} className="scroll-mt-24"><Panel title="Which resume did you submit?" description="Confirm the version on each application, even when you did not use Apply Gate. Checks and defaults never count as a confirmed submission."
    action={<button type="button" className={BUTTON.secondary} aria-expanded={expanded} aria-controls="resume-submission-choices" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide application confirmations' : 'Review submitted resumes'}</button>}>
    {!expanded ? <p className="text-sm text-muted-foreground">{query.isError ? 'Application confirmations could not be loaded. Open this panel to retry; your resume library is still available.' : query.isPending ? 'Loading application confirmations…' : `${applicationCount} ${applicationCount === 1 ? 'application' : 'applications'} on this page. Open only when you want to confirm or correct a submitted version.`}</p> : null}
    {/* Keep the forms mounted: collapsing must preserve pending saves, edits and retry IDs. */}
    <div id="resume-submission-choices" hidden={!expanded}>
    <p className="text-sm text-muted-foreground">Rates describe reached-interview or offer outcomes among confirmed applications with tracked outcomes. Waiting and unknown versions are excluded. These associations do not explain why an employer responded.</p>
    {query.isPending ? <p role="status">Loading applications…</p> : query.isError ? <div role="alert"><p>Application confirmations could not be loaded. Your resumes are still available.</p><button className={BUTTON.secondary} onClick={() => query.refetch()}>Try loading applications again</button></div> : <>
      {(query.data?.unlinkedSubmissions || 0) > 0 ? <p role="status" className="mt-3 text-sm">{query.data?.unlinkedSubmissions} saved confirmation(s) have an application link that changed. They are retained without outcome credit. Confirm the version on the current application below; no transfer is guessed.</p> : null}
      {query.data?.applications.length ? <ul>{query.data.applications.map(a => <SubmissionChoice key={`${a.id}:${a.submission?.revision || 0}:${refresh}`} application={a} variants={variants} saved={saved} reload={() => { query.refetch().then(() => setRefresh(n => n + 1)); }} />)}</ul> : <p className="mt-3 text-sm">No tracked applications on this page. Applications appear after inbox tracking or adding an application in the extension.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {cursors.length > 1 ? <button className={BUTTON.secondary} onClick={() => setCursors(c => c.slice(0, -1))}>Previous applications</button> : null}
        {query.data?.nextCursor ? <button className={BUTTON.secondary} onClick={() => setCursors(c => [...c, query.data!.nextCursor!])}>More applications</button> : null}
      </div>
    </>}
    </div>
  </Panel></div>;
}
