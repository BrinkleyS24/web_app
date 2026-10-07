import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/premium/PremiumUI';
import { BUTTON } from '@/components/premium/tone';
import { createResumeVariant } from '@/lib/emails';
import { fetchResumeDocument, resumeToolHref, RESUME_ID, compareResumeLines, type ResumeDocument } from '@/lib/resumeWorkspace';
import { useDraftSession } from '@/hooks/useDraftSession';

type EditSession = {
  original: ResumeDocument; name: string; text: string; makeDefault: boolean;
  request?: { payload: string; id: string }; receipt?: { payload: string; id: string; document?: ResumeDocument };
};
const field = 'mt-1.5 w-full min-w-0 rounded-xl border border-border bg-background p-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export function ResumeEditor({ id, owner, search, onSaved }: { id: string; owner: string; search: string; onSaved: () => void }) {
  const client = useQueryClient();
  const source = useQuery({ queryKey: ['resume-document', owner, id], queryFn: () => fetchResumeDocument(id), retry: false, staleTime: 0 });
  const [sessions, updateSessions] = useDraftSession<EditSession>('resume-editor');
  const session = sessions[id];
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [discard, setDiscard] = useState(false);
  const mounted = useRef(true), submitting = useRef(false), editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; editorRef.current?.focus(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (source.data) updateSessions(current => current[id] ? current : { ...current, [id]: { original: source.data!, name: `${source.data!.name.slice(0, 115)} copy`, text: source.data!.text, makeDefault: false } });
  }, [source.data, id]);
  const update = (patch: Partial<EditSession>) => updateSessions(current => current[id] ? ({ ...current, [id]: { ...current[id], ...patch } }) : current);
  const payload = session ? JSON.stringify({ name: session.name.trim(), text: session.text.trim(), defaultMode: session.makeDefault ? 'replace' : 'none' }) : '';
  const confirmed = session?.receipt?.payload === payload ? session.receipt.document : undefined;
  const valid = Boolean(session?.name.trim() && session.name.trim().length <= 120 && session.text.trim().length >= 50 && session.text.length <= 50000);
  const changes = session ? compareResumeLines(session.original.text, session.text) : null;

  async function verify(receipt: NonNullable<EditSession['receipt']>) {
    const doc = await fetchResumeDocument(receipt.id);
    const expected = JSON.parse(receipt.payload) as { name: string; text: string };
    if (doc.name !== expected.name || doc.text !== expected.text) throw new Error('The saved text does not match this draft. Keep your draft and reload the saved version before using it.');
    if (!mounted.current) return;
    update({ receipt: { ...receipt, document: doc } });
    client.setQueryData(['resume-document', owner, doc.id], doc);
    setMessage(`Saved and verified: ${doc.name}. The original version is unchanged.`);
  }
  async function save() {
    if (!session || !valid || submitting.current || confirmed) return;
    submitting.current = true; setPending(true); setError(''); setMessage('');
    let receipt = session.receipt?.payload === payload ? session.receipt : undefined;
    try {
      if (!receipt) {
        const request = session.request?.payload === payload ? session.request : { payload, id: crypto.randomUUID() };
        update({ request });
        const response = await createResumeVariant({ ...JSON.parse(payload), requestId: request.id });
        if (!response.success || !RESUME_ID.test(response.id || '')) throw new Error('The save was not confirmed. Your draft remains here; retry unchanged to reuse the same save request.');
        receipt = { payload, id: response.id! };
        if (!mounted.current) return;
        update({ receipt }); onSaved();
      }
      await verify(receipt);
    } catch (err) {
      if (mounted.current) setError(receipt
        ? 'Your new version was saved, but its text could not be verified. Keep this draft and retry verification before using the saved version.'
        : err instanceof Error ? err.message : 'The save was not confirmed. Keep this draft and retry unchanged.');
    }
    finally { submitting.current = false; if (mounted.current) setPending(false); }
  }
  async function copy(doc = confirmed) {
    if (!doc) return;
    try { await navigator.clipboard.writeText(doc.text); if (mounted.current) setMessage('Verified saved resume text copied. No application was submitted.'); }
    catch { if (mounted.current) setMessage('Copy failed. Your saved version and draft are still available; select its text below.'); }
  }
  function download(doc = confirmed) {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([doc.text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${doc.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) || 'resume'}.txt`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div ref={editorRef} role="region" aria-label="Resume editor" tabIndex={-1} className="min-w-0 scroll-mt-24 outline-none">
    <Panel title="Edit a new version" description="Keep the original and its past checks intact. Your edits become a separate saved version.">
      {source.isPending && !session ? <p role="status">Loading saved resume text…</p> : null}
      {source.isError ? <div role="alert" className="mb-3 text-sm"><p>{source.error instanceof Error ? source.error.message : 'This version could not be opened.'}</p>{session ? <p>Your unsaved copy remains here. Saving it creates an independent new version.</p> : null}<button className={BUTTON.secondary} onClick={() => void source.refetch()}>Reload source</button></div> : null}
      {session ? <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
        <p className="text-sm">Starting from <strong>{session.original.name}</strong>. Review only facts you can support.</p>
        {source.data && !source.isError && !source.isFetching ? <details><summary className="cursor-pointer text-sm font-medium">View the current saved original</summary><pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm">{source.data.text}</pre><div className="mt-3 flex flex-wrap gap-2"><button className={BUTTON.secondary} onClick={() => void copy(source.data)}>Copy original text</button><button className={BUTTON.secondary} onClick={() => download(source.data)}>Download original text</button><Link className={BUTTON.secondary} to={resumeToolHref('/apply-gate', source.data.id, search)}>Use the original in Apply Gate</Link></div><p className="mt-2 text-xs text-muted-foreground">This is saved text, without your unsaved edits. Downloads are plain text and do not preserve document layout.</p></details> : null}
        {source.data && source.data.fingerprint !== session.original.fingerprint ? <p role="status" className="text-sm">The source changed since you opened it. Your copy has been retained; review the current source before saving.</p> : null}
        <label className="block text-sm font-medium">New version name<input className={field} maxLength={120} disabled={pending} value={session.name} onChange={e => { update({ name: e.target.value }); setMessage(''); }} /></label>
        <label className="block text-sm font-medium">Resume text to save<textarea className={`${field} min-h-[300px]`} maxLength={50000} disabled={pending} value={session.text} onChange={e => { update({ text: e.target.value }); setMessage(''); }} /></label>
        <details><summary className="cursor-pointer text-sm font-medium">Compare your draft with the original</summary>
          <p className="mt-2 text-xs text-muted-foreground">{changes?.sameText ? 'The wording is unchanged.' : `${changes?.removed.length} original lines changed or removed; ${changes?.added.length} draft lines changed or added. Line order is not scored.`}</p>
          <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">{[['Original text', session.original.text], ['Draft text', session.text]].map(([label, text]) => <div key={label} className="min-w-0"><p className="text-sm font-semibold">{label}</p><pre className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border p-3 font-sans text-sm">{text}</pre></div>)}</div>
        </details>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={session.makeDefault} disabled={pending} onChange={e => { update({ makeDefault: e.target.checked }); setMessage(''); }} />Use this new version as my default for extension job checks</label>
        <div className="flex flex-wrap gap-2"><button className={BUTTON.primary} disabled={!valid || pending || Boolean(confirmed)} onClick={() => void save()}>{pending ? 'Saving and verifying…' : session.receipt?.payload === payload && !confirmed ? 'Retry verification' : 'Save as new version'}</button>
          <button className={BUTTON.ghost} disabled={pending} onClick={() => setDiscard(true)}>Discard this draft</button></div>
        {discard ? <div className="rounded-xl border border-border p-3 text-sm"><p>Discard this local draft and reload the current source? Any already saved version stays in your library.</p><button className={BUTTON.secondary} disabled={pending || source.isFetching} onClick={async () => { const refreshed = await source.refetch(); if (!mounted.current) return; if (refreshed.isError || !refreshed.data) { setError('The source could not be reloaded. Your draft was kept.'); return; } const original = refreshed.data; updateSessions(current => ({ ...current, [id]: { original, name: `${original.name.slice(0, 115)} copy`, text: original.text, makeDefault: false } })); setDiscard(false); setMessage(''); setError(''); }}>Confirm discard</button><button className={BUTTON.ghost} onClick={() => setDiscard(false)}>Keep editing</button></div> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="text-sm">{message}</p> : null}
        {confirmed ? <div className="space-y-3 rounded-xl border border-border p-4"><p className="text-sm font-semibold">Ready to use: {confirmed.name}</p><div className="flex flex-wrap gap-2">
          <Link className={BUTTON.primary} to={resumeToolHref('/apply-gate', confirmed.id, search)}>Use this version in Apply Gate</Link>
          <button className={BUTTON.secondary} onClick={() => void copy()}>Copy saved text</button><button className={BUTTON.secondary} onClick={() => download()}>Download saved text</button></div>
          <details><summary className="cursor-pointer text-sm">Verified saved text</summary><pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm">{confirmed.text}</pre></details>
          <p className="text-xs text-muted-foreground">Plain text for checks and your document editor; this download does not preserve Word or PDF layout. Recheck the role explicitly before relying on an earlier verdict.</p></div> : null}
        <p className="text-xs text-muted-foreground">Unsaved edits stay in this tab for up to 30 minutes after leaving. Reloading or signing out clears them. Saved versions stay in your library.</p>
      </div> : null}
    </Panel>
  </div>;
}

export function ResumeTextComparison({ ids, owner }: { ids: string[]; owner: string }) {
  const left = useQuery({ queryKey: ['resume-document', owner, ids[0]], queryFn: () => fetchResumeDocument(ids[0]), retry: false, staleTime: 0 });
  const right = useQuery({ queryKey: ['resume-document', owner, ids[1]], queryFn: () => fetchResumeDocument(ids[1]), retry: false, staleTime: 0 });
  const changes = left.data && right.data ? compareResumeLines(left.data.text, right.data.text) : null;
  return <Panel title="Compare saved wording" description="Review the actual text. Different wording does not establish which version will perform better.">
    {changes ? <p className="mb-3 text-sm">{changes.sameText ? 'These versions have identical text.' : `${changes.removed.length} lines only in the first version; ${changes.added.length} only in the second. Line order is not scored.`}</p> : null}
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{[left, right].map((query, index) => <div key={ids[index]} className="min-w-0">{query.isPending ? <p role="status">Loading version {index + 1}…</p> : query.isError ? <div role="alert"><p className="text-sm">{query.error instanceof Error ? query.error.message : 'This version could not be loaded.'}</p><button className={BUTTON.secondary} onClick={() => void query.refetch()}>Retry version {index + 1}</button></div> : query.data ? <><h3 className="font-semibold">{query.data.name}</h3><pre className="mt-2 max-h-[450px] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border p-3 font-sans text-sm">{query.data.text}</pre></> : null}</div>)}</div>
  </Panel>;
}
