import { apiFetch } from '@/lib/api';
import { createDiscoveryAccumulator } from './jobFeedDiscovery';
export type JobPreferences = {
  resumeId: string; roles: string[]; workStyles: string[];
  resumeMode?: 'default' | 'chosen'; roleMode?: 'resume' | 'custom';
  locations: { city: string; region: string; country: string }[];
  remoteCountry: string; remoteRegion: string;
};
export type SavedJobPreferences = { preferences: JobPreferences | null; version: number;
  setupRequired?: 'resume' | 'roles' | 'location' | null; roleEvidence?: string[];
  resume?: { id: string; name: string; fingerprint: string } };
export type FeedJob = {
  qualificationAssessment?: {version:number;decision:'supported'|'review'|'excluded';exclusionKind?:string|null};
  application?: {state:'confirmed'|'possible'|'none_known'|'unavailable';applicationId?:string|null;status?:string;appliedAt?:string|null;source?:string;basis?:string};
  dedupeKey?: string;
  key: string; title: string; company: string; location: string; url: string;
  publishedAt: string; dateBasis: string; lastCheckedAt: string; provider: string;
  window: 'recent' | 'older'; decision: 'supported' | 'review' | 'excluded'; availability: string;
  exclusionKind?: 'requirement_blocker' | 'insufficient_evidence' | 'specialty' | 'seniority' | null;
  interviewHistory?: {similarRoles:number;roleFamily:string};
  reasons: string[]; requirements: { label: string; quote: string | null; status: string; evidence: string | null }[];
};
export type JobFeed = {
  eligibleCandidates?: FeedJob[];
  matchingMode?: 'resume_discovery' | 'custom_titles';
  discovery?: {asOf:string;scannedParts:number;totalParts:number;complete:boolean;nextCursor:string|null};
  setupRequired?: boolean | 'resume' | 'roles' | 'location'; version: number;
  catalogPending?: boolean; message?: string;
  resume: { id: string; name: string; fingerprint: string };
  personalization?: {status:'available'|'no_history'|'unavailable';interviewedRoles:number;relevantInterviewedRoles?:number;roleFamilies?:{roleFamily:string;similarRoles:number}[]};
  catalog: { revision: string; capturedAt: string; stale: boolean; scope: string;
    sourcesAttempted: number; sourcesSuccessful: number; sourcesFailed: number; sourcesLimited: number; postingsCollected: number;
    attribution?: { creator: string; license: string } | null };
  counts: Record<'recent' | 'review' | 'older' | 'excluded', number>;
  exclusionSummary?: {requirementBlockers:number;insufficientEvidence:number};
  recent: FeedJob[]; review: FeedJob[]; older: FeedJob[]; excluded: FeedJob[];
};
export const fetchJobPreferences = (): Promise<SavedJobPreferences> => apiFetch('/api/jobs/preferences');
export type JobApplicationStatuses={status:'available';checkedAt:string;matches:({key:string}&NonNullable<FeedJob['application']>)[]};
export async function fetchJobApplicationStatuses(jobs:FeedJob[],signal?:AbortSignal):Promise<JobApplicationStatuses>{
  const matches:JobApplicationStatuses['matches']=[];let checkedAt='';
  for(let index=0;index<jobs.length;index+=250){
    const batch=jobs.slice(index,index+250).map(({key,company,title,url,publishedAt,dateBasis})=>({key,company,title,url,publishedAt,dateBasis}));
    const result:JobApplicationStatuses=await apiFetch('/api/jobs/application-status',{method:'POST',body:JSON.stringify({jobs:batch}),signal,timeoutMs:10000});
    const expected=new Set(batch.map(job=>job.key));
    if(result?.status!=='available'||!Array.isArray(result.matches)||result.matches.length!==batch.length
      ||!Number.isFinite(Date.parse(result.checkedAt))||result.matches.some(match=>!match||!expected.delete(match.key)||!['confirmed','possible','none_known'].includes(match.state)))throw new Error('Your application history could not be checked.');
    matches.push(...result.matches);checkedAt=result.checkedAt;
  }
  return {status:'available',checkedAt,matches};
}
export const saveJobPreferences = (preferences: JobPreferences, expectedVersion: number): Promise<SavedJobPreferences> =>
  apiFetch('/api/jobs/preferences', { method: 'PUT', body: JSON.stringify({ preferences, expectedVersion }) });
function retryDelay(ms:number,signal?:AbortSignal) {
  return new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Discovery cancelled.','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
  });
}
export async function fetchJobFeed(version: number, signal?: AbortSignal, fingerprint?: string, onProgress?: (feed:JobFeed)=>void): Promise<JobFeed> {
  const accumulate=createDiscoveryAccumulator();
  let cursor:string|null=null;
  for (;;) {
    if(signal?.aborted)throw new DOMException('Discovery cancelled.','AbortError');
    let page:JobFeed;
    for(let attempt=0;;attempt++){
      try{page=await apiFetch(`/api/jobs/feed?version=${version}&discovery=1${fingerprint ? `&fingerprint=${encodeURIComponent(fingerprint)}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {signal,timeoutMs:60000});break;}
      catch(error){
        const status=(error as {status?:number}).status;
        if(!cursor||signal?.aborted||(error as Error).name==='AbortError'||attempt>=2||(status!=null&&status<500))throw error;
        await retryDelay(status===503?5000:1000,signal);
      }
    }
    if(!page.catalogPending&&!page.setupRequired&&!page.matchingMode)throw new Error('The job service needs an update for resume discovery. Please reload Applendium after the backend is updated.');
    if(!page.discovery)return page;
    const merged=accumulate(page);
    if(signal?.aborted)throw new DOMException('Discovery cancelled.','AbortError');
    onProgress?.(merged);
    if(page.discovery.complete)return merged;
    if(!page.discovery.nextCursor||page.discovery.nextCursor===cursor)throw new Error('Discovery could not continue. Check for updates to start again.');
    cursor=page.discovery.nextCursor;
  }
}
