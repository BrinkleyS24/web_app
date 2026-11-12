import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, ExternalLink, MapPin, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, ToneChip } from '@/components/premium/PremiumUI';
import { BUTTON, TONES } from '@/components/premium/tone';
import { useAuth } from '@/lib/AuthContext.jsx';
import { fetchResumeVariants } from '@/lib/emails';
import { fetchJobFeed, fetchJobPreferences, saveJobPreferences, fetchJobApplicationStatuses, retryJobFeed, type FeedJob, type JobPreferences } from '@/lib/jobFeed';
import { applicationCheckCandidates, projectApplicationAwareFeed, applicationStatusReference, retainApplicationStatuses } from '@/lib/jobFeedApplications';
import { jobReviewQuestion } from '@/lib/jobFeedPresentation';
import { resumeLibraryHref } from '@/lib/resumeLibraryPresentation';
import { JOB_COUNTRIES, US_STATES, countryName, stateCode } from '@/lib/jobFeedLocations';

const INPUT = 'mt-1 w-full min-h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const message = (e: unknown) => e instanceof Error ? e.message : 'Please try again.';
type Draft = { resumeId: string; resumeMode: 'default' | 'chosen'; roleMode: 'resume' | 'custom'; roles: string; workStyles: string[]; locations: JobPreferences['locations']; remoteCountry: string; remoteRegion: string };
const blankLocation = () => ({ city: '', region: '', country: '' });
const empty: Draft = { resumeId: '', resumeMode: 'default', roleMode: 'resume', roles: '', workStyles: [], locations: [blankLocation()], remoteCountry: '', remoteRegion: '' };
function fromSaved(p: JobPreferences): Draft {
  return { ...p, resumeMode:p.resumeMode || 'default', roleMode:p.roleMode || 'resume', roles: p.roleMode === 'custom' ? p.roles.join(', ') : '', locations: p.locations.length ? p.locations.map(l => ({...l})) : [blankLocation()] };
}
function fromDraft(d: Draft, inferredRoles: string[]): JobPreferences {
  const customRoles = d.roles.split(',').map(v => v.trim()).filter(Boolean);
  return { ...d, roleMode: d.roleMode === 'custom' && customRoles.length ? 'custom' : 'resume', roles: d.roleMode === 'custom' ? customRoles : inferredRoles,
    locations: d.workStyles.some(s => s !== 'remote') ? d.locations.map(l => ({city:l.city.trim(),region:l.region.trim(),country:l.country})) : [],
    remoteCountry: d.remoteCountry.trim().toUpperCase(), remoteRegion: d.remoteRegion.trim() };
}
function CountrySelect({value, onChange}: {value:string; onChange:(value:string)=>void}) {
  return <select className={INPUT} required value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Choose a country</option>
    {JOB_COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
  </select>;
}
function RegionInput({country, value, onChange}: {country:string; value:string; onChange:(value:string)=>void}) {
  return country === 'US' ? <select className={INPUT} value={stateCode(value) || value} onChange={e => onChange(e.target.value)}>
    <option value="">Choose a state (optional)</option>
    {value && !stateCode(value) && <option value={value}>{value}</option>}
    {US_STATES.map(state => <option key={state.code} value={state.code}>{state.name}</option>)}
  </select> : <input className={INPUT} value={value} maxLength={80} placeholder="State, province, or region" onChange={e => onChange(e.target.value)} />;
}
function locationSummary(p: JobPreferences) {
  return [p.workStyles.includes('remote') ? `Remote from ${[p.remoteRegion,countryName(p.remoteCountry)].filter(Boolean).join(', ')}` : '',
    p.workStyles.filter(s => s !== 'remote').map(s => s === 'onsite' ? 'Onsite' : 'Hybrid').join(' / '),
    ...p.locations.map(l => [l.city,l.region,countryName(l.country)].filter(Boolean).join(', '))].filter(Boolean).join(' · ');
}
function PostingCard({ job }: { job: FeedJob }) {
  const safeUrl = (() => { try { const u = new URL(job.url); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } })();
  const notes = [...new Set(job.reasons)];
  const question = jobReviewQuestion(job);
  const preview = notes.slice(0,2).map(note => {
    const text = note.replace(/^Confirm the full requirement: /, 'Confirm: ');
    return text.length > 160 ? `${text.slice(0,157).trimEnd()}…` : text;
  });
  const showFullNotes = job.decision === 'review' ? notes.some(note => note !== question) : notes.length > 2 || notes.some(note => note.replace(/^Confirm the full requirement: /, 'Confirm: ').length > 160);
  const blocker = job.decision === 'excluded' && (!job.exclusionKind || job.exclusionKind === 'requirement_blocker');
  return <article className="min-w-0 break-words rounded-xl border border-border bg-card p-5 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-full"><p className="text-xs font-medium text-muted-foreground">{job.company}</p><h2 className="mt-1 text-base font-semibold">{job.title}</h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span className="min-w-0">{job.location || 'Location needs confirmation'}</span></p></div>
      <ToneChip tone={job.decision === 'supported' ? 'positive' : blocker ? 'risk' : job.decision === 'excluded' ? 'neutral' : 'attention'}>{job.decision === 'supported' ? 'Resume-supported' : blocker ? 'Requirement blocker' : job.decision === 'excluded' ? 'Qualification not established' : 'Needs review'}</ToneChip>
    </div>
    {job.window === 'older' && <p className="text-sm font-medium">31–60 days old · Employer was accepting applications when checked.</p>}

    {job.application?.state === 'confirmed' && <p className="text-sm font-medium">Already applied{job.application.appliedAt ? ` · Recorded ${date(job.application.appliedAt)}` : ''}{job.application.status ? ` · ${job.application.status}` : ''}. <Link to="/dashboard" className="underline">Open tracker</Link></p>}
    {job.application?.state === 'possible' && <p className="text-sm font-medium">A similar application is in your tracker. Confirm the posting before applying again. <Link to="/dashboard" className="underline">Open tracker</Link></p>}
    {job.decision === 'review' ? <div data-testid="review-question" className={`rounded-lg border p-3 text-sm ${TONES.attention.surface}`}>
      <p className="text-xs font-semibold text-foreground">Check before applying</p>
      <p className="mt-1 leading-relaxed text-foreground">{question || 'The remaining fit question was not supplied. Review the employer posting and requirement evidence before applying.'}</p>
    </div> : <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{preview.map((reason, i) => <li key={i}>{reason}</li>)}</ul>}
    {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={BUTTON.secondary}>Read employer posting <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
    <p className="text-xs text-muted-foreground">{job.dateBasis === 'last_published' ? 'Last published' : job.dateBasis === 'first_published' ? 'First published' : 'Employer posting date'}: {date(job.publishedAt)}{job.dateBasis === 'last_published' ? ' · May be a repost' : ''} · Checked {date(job.lastCheckedAt)}</p>
    {job.decision !== 'excluded' && job.interviewHistory && <p className="text-sm font-medium">Your history marks {job.interviewHistory.similarRoles} similar {job.interviewHistory.roleFamily} {job.interviewHistory.similarRoles === 1 ? 'role' : 'roles'} as Interviewed or Offer.</p>}
    {showFullNotes && <details className="text-sm"><summary className="cursor-pointer font-medium">All fit notes ({notes.length})</summary>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">{notes.map((note,i) => <li key={i}>{note}</li>)}</ul>
    </details>}
    <details className="rounded-lg bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Posting requirements and resume evidence</summary>
      <div className="mt-3 space-y-4 text-sm">{job.requirements.length ? job.requirements.map((r,i) => <div key={i}>
          <p className="font-medium">{r.label} · {r.blocking ? 'Conflicts with the stated requirement' : r.status === 'interview_assessment' ? 'Assessed during interviews' : r.status === 'satisfied' ? 'Evidence found' : job.decision === 'review' ? 'Needs confirmation' : 'Not established'}</p>
        {r.quote && <blockquote className="mt-1 border-l-2 border-border pl-3 text-muted-foreground">{r.quote}</blockquote>}
        <p className="mt-1 text-muted-foreground">{r.status === 'interview_assessment' ? 'Discuss this during interviews; it is not a missing resume qualification.' : `Resume: ${r.evidence || 'No supporting passage was established.'}`}</p>
      </div>) : <p>The requirements could not be fully extracted. Read the employer’s posting.</p>}</div>
    </details>
  </article>;
}
export default function Jobs() {
  const { user, plan } = useAuth();
  const uid = user?.uid;
  const enabled = Boolean(uid) && plan === 'premium';
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);
  const [dirty, setDirty] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedTab, setTab] = useState<'recent' | 'review' | 'older' | 'excluded' | 'applied' | null>(null);
  const [localError, setLocalError] = useState('');
  const [otherSectionsOpen, setOtherSectionsOpen] = useState(false);
  const prefs = useQuery({ queryKey: ['job-preferences', uid], queryFn: fetchJobPreferences, enabled, retry: false, refetchInterval:60000 });
  const resumes = useQuery({ queryKey: ['job-resumes', uid], queryFn: fetchResumeVariants, enabled, retry: false });
  const variants = resumes.data?.variants || [];
  const saved = prefs.data?.preferences;
  const available = Boolean(saved && variants.some(v => v.id === saved.resumeId));
  const setupRequired = prefs.data?.setupRequired || (!saved ? 'resume' : saved.roleMode === 'custom' && !saved.roles.length ? 'roles' : !saved.workStyles.length ? 'location' : null);
  const defaultResume = variants.find(v => v.isDefault);
  useEffect(() => { if (!dirty) { setDraft(saved ? fromSaved(saved) : empty); setDraftVersion(prefs.data?.version ?? 0); } }, [saved, prefs.data?.version, dirty]);
  // AccountQueryScope remounts the page on sign-in changes; these keys also protect
  // direct renders and every request is authenticated again on the server.
  const feed = useQuery({ queryKey: ['job-feed', uid, prefs.data?.version, saved?.resumeId, prefs.data?.resume?.fingerprint],
    queryFn: ({ signal, queryKey }) => fetchJobFeed(prefs.data!.version, signal, prefs.data?.resume?.fingerprint, progress => { if (!signal.aborted) client.setQueryData(queryKey,progress); }),
    enabled: enabled && !prefs.isError && !resumes.isError && available && !setupRequired && !dirty, retry: false,
    staleTime: saved?.roleMode === 'resume' ? 300000 : 0,
    refetchOnWindowFocus: saved?.roleMode !== 'resume',
    refetchInterval: query => (query.state.error as {payload?:{code?:string}} | null)?.payload?.code === 'job_feed_busy' ? 5000
      : (query.state.error as {payload?:{code?:string}} | null)?.payload?.code === 'catalog_stale' || query.state.data?.catalog?.stale ? 60000
      : query.state.data?.generationPending ? query.state.error ? 60000 : 5000
      : query.state.data?.generation?.expiresAt ? Math.max(5000,Math.min(1800000,Date.parse(query.state.data.generation.expiresAt)-Date.now()+10))
      : query.state.data?.catalogPending ? 15000 : saved?.roleMode === 'resume' ? 1800000 : 300000 });
  const catalogStale = (feed.error as {payload?:{code?:string}} | null)?.payload?.code === 'catalog_stale' || Boolean(feed.data?.catalog?.stale);
  const snapshotExpired=Boolean(feed.data?.generation?.expiresAt&&Date.parse(feed.data.generation.expiresAt)<=Date.now());
  useEffect(()=>{if(snapshotExpired&&!feed.isFetching&&!feed.isError)void feed.refetch();},[snapshotExpired,feed.isFetching,feed.isError,feed.refetch]);
  const applicationCandidates = useMemo(() => catalogStale||snapshotExpired ? [] : applicationCheckCandidates(feed.data), [catalogStale,snapshotExpired,feed.data]);
  const applicationStatuses = useQuery({queryKey:['job-application-status',uid,applicationCandidates.map(applicationStatusReference)],
    queryFn:({signal})=>fetchJobApplicationStatuses(applicationCandidates,signal),
    enabled:enabled && !dirty && !prefs.isError && !resumes.isError && available && !setupRequired && applicationCandidates.length>0,
    retry:false,staleTime:15000,refetchInterval:60000,placeholderData:(previous,previousQuery)=>previousQuery?.queryKey[1]===uid?retainApplicationStatuses(previous,previousQuery.queryKey[2],applicationCandidates):undefined});
  useEffect(() => { if (dirty) { void client.cancelQueries({queryKey:['job-feed',uid]}); void client.cancelQueries({queryKey:['job-application-status',uid]}); } }, [dirty,client,uid]);
  useEffect(() => {
    const code = (feed.error as {payload?:{code?:string}})?.payload?.code;
    if (code === 'search_changed' || code === 'preferences_changed') {
      void client.invalidateQueries({queryKey:['job-preferences',uid]});
      void client.invalidateQueries({queryKey:['job-resumes',uid]});
    }
  }, [feed.error, client, uid]);
  const save = useMutation({
    mutationFn: (preferences: JobPreferences) => saveJobPreferences(preferences, draftVersion),
    onSuccess: data => { client.setQueryData(['job-preferences', uid], data); client.removeQueries({ queryKey: ['job-feed', uid] }); setDirty(false); setShowPreferences(false); setLocalError(''); setTab(null); },
  });
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(d => ({ ...d, [key]: value })); setDirty(true); setLocalError(''); save.reset(); }
  function invalidateFeed() { void client.invalidateQueries({ queryKey: ['job-preferences', uid] }); void client.invalidateQueries({ queryKey: ['job-resumes', uid] }); void client.invalidateQueries({ queryKey: ['job-feed', uid] }); void client.invalidateQueries({queryKey:['job-application-status',uid]}); }
  const refreshRequest=useMutation({mutationFn:()=>retryJobFeed(prefs.data!.version,prefs.data?.resume?.fingerprint||''),onSettled:invalidateFeed});
  function refresh(){if(refreshRequest.isPending)return;if(prefs.data?.backgroundGeneration)refreshRequest.mutate();else invalidateFeed();}
  const feedError = feed.error as {status?:number} | null;
  const keepPreviousFeed = !catalogStale && (!feed.isError || !feedError?.status || feedError.status >= 500);
  const rawResults = !dirty && available && !setupRequired && !prefs.isError && !resumes.isError && keepPreviousFeed && !snapshotExpired && !feed.data?.generationPending && !feed.data?.catalogPending && !feed.data?.setupRequired ? feed.data : null;
  const results = useMemo(() => rawResults ? projectApplicationAwareFeed(rawResults,applicationStatuses.data) : null,[rawResults,applicationStatuses.data]);
  // Bring available opportunities into view on arrival; preserve an explicit
  // tab choice across background refreshes. Never default to excluded roles.
  const tab = selectedTab ?? (results?.counts.recent ? 'recent' : results?.counts.review ? 'review' : results?.counts.older ? 'older' : 'recent');
  useEffect(() => { if (results && (results.counts.recent || results.counts.review || results.counts.older)) setTab(current => current ?? (results.counts.recent ? 'recent' : results.counts.review ? 'review' : results.counts.older ? 'older' : 'recent')); }, [results]);
  const showForm = Boolean(setupRequired || !available || dirty || showPreferences);
  return <DashboardLayout><div className="min-w-0 break-words space-y-4 sm:space-y-6" data-testid="jobs-page">
    <PageHeader eyebrow="Premium · Pilot" title="Jobs picked for you" description="Jobs matched to your resume and work preferences. New results appear automatically." />
    {!enabled ? <EmptyState title="Jobs is included with Premium" body="Use a saved resume and your own location preferences to search the pilot inventory." action={<Link to="/upgrade?source=web_jobs" className={BUTTON.primary}>Explore Premium</Link>} /> : <>
      {(prefs.isLoading || resumes.isLoading) && <LoadingRows />}
      {(prefs.isError || resumes.isError) && <ErrorState stackRetryOnMobile title="Your feed preferences did not load" detail={message(prefs.error || resumes.error)} onRetry={refresh} />}
      {!prefs.isPending && !resumes.isPending && !prefs.isError && !resumes.isError && <Panel bodyClassName={showForm ? undefined : 'p-4 sm:p-5'} title={showForm ? setupRequired === 'location' ? 'Where would you like to work?' : 'Your feed preferences' : undefined} icon={showForm ? SlidersHorizontal : undefined} description={showForm ? setupRequired === 'location' ? 'Confirm this once. Your resume will bring you relevant jobs automatically.' : 'Roles come from your resume. Adjust these preferences whenever your plans change.' : undefined} action={showForm && saved && available && !setupRequired ? <button type="button" className={BUTTON.secondary} disabled={dirty || save.isPending} onClick={() => setShowPreferences(false)}>Hide preferences</button> : undefined}>
        {!variants.length ? <EmptyState title="Save a resume to start" body="Choose the version that represents the work you want to do next." action={<Link to="/resumes" className={BUTTON.primary}>Open Resumes</Link>} /> : !showForm && saved ? <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3"><p className="min-w-0"><Link to={resumeLibraryHref('',saved.resumeId)} className="font-semibold underline-offset-2 hover:underline" aria-label="View matching resume">{variants.find(v => v.id === saved.resumeId)?.name}</Link><span className="text-xs text-muted-foreground"> · {saved.resumeMode === 'chosen' ? 'Chosen resume' : 'Default resume'}</span></p><button type="button" className={BUTTON.secondary} onClick={() => setShowPreferences(true)}>Adjust feed</button></div>
          <p className="text-xs text-muted-foreground">{locationSummary(saved)}</p><p className="text-xs text-muted-foreground">{saved.roleMode === 'custom' ? `Your target titles: ${saved.roles.join(', ')}` : 'Resume-driven discovery · No title filter'}</p>
        </div> : <form onSubmit={event => { event.preventDefault(); try { const p = fromDraft(draft, saved?.roleMode === 'custom' ? [] : saved?.roles || []); setLocalError(''); save.mutate(p); } catch (error) { setLocalError(message(error)); } }}>
          <fieldset disabled={save.isPending} className="space-y-4">
            {saved && !available && <p role="alert" className="text-sm text-destructive">Your saved resume is unavailable. Choose another version and save your search.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">Matching resume<select className={INPUT} value={draft.resumeMode === 'default' ? 'default' : draft.resumeId} required onChange={e => { const value=e.target.value; setDraft(d => ({...d,resumeMode:value === 'default' ? 'default' : 'chosen',resumeId:value === 'default' ? defaultResume?.id || '' : value,roleMode:'resume',roles:''})); setDirty(true); save.reset(); }}><option value="default" disabled={!defaultResume}>Use my default resume{defaultResume ? ` (${defaultResume.name})` : ' — set one in Resumes'}</option>{draft.resumeMode === 'chosen' && draft.resumeId && !variants.some(v => v.id === draft.resumeId) && <option value={draft.resumeId} disabled>Saved resume unavailable</option>}{variants.map(v => <option key={v.id} value={v.id}>Use {v.name} for this feed</option>)}</select></label>
              <div className="text-sm"><p className="font-medium">Resume-driven discovery</p><p className="mt-1 text-xs text-muted-foreground">Without an override, job titles do not limit discovery. Each posting still needs supporting resume evidence.</p><p className="mt-2 text-muted-foreground">We use your resume experience, skills, and qualifications to assess each posting. Location preferences still apply.</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.roleMode === 'custom'} onChange={e => change('roleMode',e.target.checked ? 'custom' : 'resume')} />Limit discovery to target titles</label></div>
            </div>
            {draft.roleMode === 'custom' && <label className="block text-sm font-medium">Target job titles<input className={INPUT} value={draft.roles} maxLength={648} placeholder="Separate titles with commas" onChange={e => change('roles',e.target.value)} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Optional. Leave blank to discover roles without a title filter. Requirements still need supporting resume evidence.</span></label>}
            {!defaultResume && draft.resumeMode === 'default' && <p className="text-sm"><Link to="/resumes" className={BUTTON.link}>Set a default resume</Link> or choose a version above.</p>}
            <fieldset><legend className="text-sm font-medium">Work arrangements</legend><div className="mt-2 flex flex-wrap gap-5">{['remote','hybrid','onsite'].map(style => <label className="flex min-h-9 items-center gap-2 text-sm" key={style}><input type="checkbox" checked={draft.workStyles.includes(style)} onChange={e => change('workStyles', e.target.checked ? [...draft.workStyles, style] : draft.workStyles.filter(s => s !== style))} />{style === 'onsite' ? 'Onsite' : style[0].toUpperCase()+style.slice(1)}</label>)}</div></fieldset>
            {draft.workStyles.includes('remote') && <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">Country you would work remotely from<CountrySelect value={draft.remoteCountry} onChange={value => { setDraft(d => ({...d,remoteCountry:value,remoteRegion:''})); setDirty(true); setLocalError(''); save.reset(); }} /><span className="mt-1 block text-xs font-normal text-muted-foreground">This is your working location, not the company’s headquarters.</span></label>
              <label className="text-sm font-medium">Remote working state or region (optional)<RegionInput country={draft.remoteCountry} value={draft.remoteRegion} onChange={value => change('remoteRegion',value)} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose a region to check explicit regional restrictions. Unclear restrictions stay separate.</span></label>
            </div>}
            {draft.workStyles.some(s => s !== 'remote') && <fieldset className="space-y-3"><legend className="text-sm font-medium">Onsite or hybrid locations</legend>
              {draft.locations.map((location,index) => {
                const update = (values:Partial<typeof location>) => change('locations',draft.locations.map((l,i) => i === index ? {...l,...values} : l));
                return <fieldset key={index} className="rounded-lg border border-border p-3"><legend className="px-1 text-xs text-muted-foreground">Location {index+1}</legend><div className="grid gap-3 md:grid-cols-3">
                  <label className="min-w-0 text-sm font-medium">City<input className={INPUT} value={location.city} maxLength={80} required placeholder="e.g. New York" onChange={e => update({city:e.target.value})} /></label>
                  <label className="min-w-0 text-sm font-medium">Country<CountrySelect value={location.country} onChange={country => update({country,region:''})} /></label>
                  <label className="min-w-0 text-sm font-medium">State or region (optional)<RegionInput country={location.country} value={location.region} onChange={region => update({region})} /></label>
                </div>{draft.locations.length > 1 && <button type="button" className={`${BUTTON.ghost} mt-2`} aria-label={`Remove location ${index+1}`} onClick={() => change('locations',draft.locations.filter((_,i) => i !== index))}>Remove location</button>}</fieldset>;
              })}
              {draft.locations.length < 8 && <button type="button" className={BUTTON.secondary} onClick={() => change('locations',[...draft.locations,{...blankLocation(),country:draft.locations[draft.locations.length-1]?.country || ''}])}>Add another location</button>}
              <p className="text-xs text-muted-foreground">Add the cities you want to work in, including nearby cities you would commute to.</p>
            </fieldset>}
            <p className="text-xs text-muted-foreground">A degree in progress does not count as completed. Equivalent experience, work authorization, scoped years, and unfamiliar requirements need review. Your resume is never sent to job boards.</p>
            {(localError || save.isError) && <ErrorState stackRetryOnMobile title="Your preferences were not saved" detail={localError || message(save.error)} />}
            {save.isError && <button type="button" className={BUTTON.secondary} onClick={async () => { const loaded = await prefs.refetch(); if (loaded.isSuccess) { setDirty(false); setLocalError(''); save.reset(); } }}>Reload saved preferences</button>}
            <div className="flex flex-wrap items-center gap-3"><button type="submit" className={BUTTON.primary} disabled={!dirty || (!draft.resumeId && !defaultResume) || !draft.workStyles.length || save.isPending}>{save.isPending ? 'Saving…' : setupRequired ? 'Start my feed' : 'Save preferences'}</button>{dirty && <><span className="text-xs text-muted-foreground">Unsaved changes · results hidden</span><button type="button" className={BUTTON.ghost} onClick={() => { setDirty(false); setLocalError(''); save.reset(); }}>Discard changes</button></>}</div>
          </fieldset>
        </form>}
      </Panel>}
      {!dirty && available && !setupRequired && feed.isFetching && !results && !feed.data?.generationPending && <div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">Checking jobs against your resume and preferences…</p><LoadingRows /></div>}
      {!dirty && available && !setupRequired && catalogStale && <ErrorState stackRetryOnMobile title="The job collection needs an update" detail="Current matches cannot be checked because the collection is over 48 hours old. This does not tell us whether jobs fit your resume. Your preferences are saved; this page will check again automatically." onRetry={refresh} />}
      {!dirty && available && !setupRequired && feed.isError && !catalogStale && <ErrorState stackRetryOnMobile title={results ? 'Updates could not be loaded' : 'Jobs could not be loaded'} detail={results ? `${message(feed.error)} Showing previously loaded jobs.` : message(feed.error)} onRetry={refresh} />}
      {!dirty && available && !setupRequired && !feed.isError && feed.data?.generationPending && <div role="status" aria-live="polite"><EmptyState icon={BriefcaseBusiness} title="Preparing your matches" body="We are checking jobs against your resume. This can take a few minutes. You can leave this page; preparation will continue." /></div>}
      {!dirty && available && feed.data?.catalogPending && <EmptyState icon={BriefcaseBusiness} title="Preparing your job feed" body={feed.data.message || 'Your resume and preferences are ready. Jobs will appear here automatically when the collection is ready.'} />}
      {results && <>

        {applicationCandidates.length>0 && !applicationStatuses.data && <p role="status" className="text-sm text-muted-foreground">{applicationStatuses.isError ? 'Application history could not be checked. These results may include jobs you already applied to.' : 'Checking your tracked applications for these roles…'}</p>}
        {applicationStatuses.isError && applicationStatuses.data && <p role="status" className="text-sm text-muted-foreground">Application history could not be updated. Showing the last checked application status.</p>}
        {applicationStatuses.isError && <button type="button" className={BUTTON.ghost} disabled={applicationStatuses.isFetching} onClick={()=>void applicationStatuses.refetch()}>Retry application check</button>}
        {results.discovery && !results.discovery.complete && <p role="status" className="text-sm text-muted-foreground">{feed.isFetching ? 'Discovering roles from your resume' : 'Discovery paused'}: {results.discovery.scannedParts} of {results.discovery.totalParts} catalog batches checked. Results and counts are partial until the scan finishes.</p>}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" aria-label="Job result sections">{([['recent','Matches'],['review','Needs review'],['older','Older']] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={tab === key} className={tab === key ? BUTTON.primary : BUTTON.secondary} onClick={() => {setTab(key);setOtherSectionsOpen(false);}}>{label} ({results.counts[key]})</button>)}</div>
          <details open={otherSectionsOpen} onToggle={event => setOtherSectionsOpen(event.currentTarget.open)} className="text-sm">
            <summary className="min-h-10 cursor-pointer py-2 text-muted-foreground">Other results{tab === 'excluded' ? ' · Excluded selected' : tab === 'applied' ? ' · Already applied selected' : ''}</summary>
            <div className="mt-1 flex flex-wrap gap-2">{([['applied','Already applied'],['excluded','Excluded']] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={tab === key} className={tab === key ? BUTTON.primary : BUTTON.secondary} onClick={() => setTab(key)}>{label} ({results.counts[key]})</button>)}</div>
          </details>
            <p role="status" className="min-h-8 text-xs text-muted-foreground sm:min-h-4">{feed.isFetching ? 'Checking for updates…' : tab === 'older' ? 'Posted 31–60 days ago' : tab === 'applied' ? 'These postings match applications already recorded in your tracker' : tab === 'excluded' ? 'Requirement blockers and missing resume evidence are different' : tab === 'review' ? 'Core experience has support; check the remaining fit questions' : 'Posted in the past 30 days'}</p>
          {tab === 'excluded' && <p className="text-sm text-muted-foreground">{results.exclusionSummary && `${results.exclusionSummary.requirementBlockers} requirement blockers; ${results.exclusionSummary.insufficientEvidence} with qualification not established. `}Missing evidence does not mean you lack the qualification. Some requirements or supporting resume passages could not be established. These roles stay out of recommendations until their core requirements have support.</p>}
          {tab !== 'excluded' && results.personalization?.status === 'unavailable' && <p className="text-xs text-muted-foreground">Interview history is temporarily unavailable. Jobs are ordered by posting date.</p>}
        </div>

        {tab === 'applied' && <p className="text-sm text-muted-foreground">These roles stay out of fresh recommendations. Similar titles alone do not establish that you applied to the same posting. Applications missing from your tracker cannot be checked.</p>}
        {tab === 'older' && <p className="text-sm text-muted-foreground">Only postings the employer was still accepting applications for are included here. Each card retains its requirement status.</p>}
        {results[tab].length ? <div className="space-y-4">{results[tab].map(job => <PostingCard key={job.key} job={job} />)}{results.counts[tab] > results[tab].length && <p className="text-sm text-muted-foreground">Showing {results[tab].length} of {results.counts[tab]}.</p>}</div> : results.discovery && !results.discovery.complete ? <EmptyState icon={BriefcaseBusiness} title="Discovery is still incomplete" body="No roles in this section have been established in the batches checked so far. This is not a complete result." /> : <EmptyState icon={BriefcaseBusiness} title={tab === 'applied' ? 'No confirmed prior applications in these results' : tab === 'recent' && results.counts.applied>0 ? 'Some matching roles are already in your tracker' : tab === 'recent' ? 'No resume-supported matches in this collection' : tab === 'review' ? 'No recent jobs waiting for review' : tab === 'older' ? 'No eligible older listings in this collection' : 'No requirement exclusions to show'} body={tab === 'applied' ? 'Only confirmed applications to the same posting appear here. Missing records and similar titles are not treated as proof.' : tab === 'recent' ? 'We keep checking for new jobs using your resume and saved preferences. Needs review and Older stay available separately. Coverage is still limited during this pilot.' : 'Your preferences are saved. We keep checking for new jobs automatically.'} action={tab !== 'applied' && tab !== 'excluded' && results.counts.applied > 0 ? <button type="button" className={BUTTON.secondary} onClick={() => {setOtherSectionsOpen(true);setTab('applied');}}>View tracked postings</button> : undefined} />}
        <details className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Job sources and coverage</summary>
          <div className="mt-3 space-y-2">
            <p>Collection updated {date(results.catalog.capturedAt)}.{results.generation?.asOf ? ` Matches checked ${new Date(results.generation.asOf).toLocaleString()}.` : ''} Application history is checked separately.</p>
            <div className="flex flex-wrap gap-2"><button type="button" className={BUTTON.secondary} onClick={refresh} disabled={feed.isFetching || save.isPending || refreshRequest.isPending || dirty}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Check for updates</button>
              {applicationCandidates.length>0 && <button type="button" className={BUTTON.ghost} disabled={applicationStatuses.isFetching} onClick={()=>void applicationStatuses.refetch()}>{applicationStatuses.isFetching ? 'Checking applications…' : 'Recheck applications'}</button>}</div>
          </div>
          <p className="mt-3">{results.catalog.scope} Collected {date(results.catalog.capturedAt)}. {results.catalog.sourcesSuccessful} of {results.catalog.sourcesAttempted} sources responded; {results.catalog.sourcesFailed} unavailable, {results.catalog.sourcesLimited} partial. Thin results can reflect source coverage.</p>
          <p className="mt-2">The feed checks for updates automatically while this page is open. Your default resume follows future default changes; a chosen version stays selected. Opening a posting does not record an application.</p>
          <p className="mt-2">Your resume controls qualification. Tracked interview outcomes prioritize similar eligible roles, even without an Apply Gate check. Interview history never overrides a requirement or identifies which resume you submitted.</p>
          {Boolean(results.personalization?.relevantInterviewedRoles) && <p className="mt-2">Your history marks {results.personalization.relevantInterviewedRoles} roles in this focus as Interviewed or Offer. These tracked stages guide ordering; they do not verify qualifications or which resume you submitted.</p>}
          {results[tab].some(job => job.interviewHistory) && <p className="mt-2">Similar roles with tracked interview outcomes appear first.</p>}
          {Boolean(results.personalization?.roleFamilies?.length) && <p className="mt-2">Relevant interview history: {results.personalization.roleFamilies.map(stat=>`${stat.similarRoles} ${stat.roleFamily} ${stat.similarRoles === 1 ? 'role' : 'roles'}`).join('; ')}.</p>}
          {results.catalog.attribution && <p className="mt-2">Source directory: <a className="underline" href="https://github.com/fyrosofttech/lastroundai-hiring-data/tree/main/ats-directory" target="_blank" rel="noopener noreferrer">LastRound AI / fyrosofttech</a> · <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Sources selected and rechecked by Applendium.</p>}
        </details>
      </>}
    </>}
  </div></DashboardLayout>;
}
