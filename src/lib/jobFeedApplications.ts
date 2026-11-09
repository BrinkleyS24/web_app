import type {FeedJob,JobFeed,JobApplicationStatuses} from './jobFeed';

export type ApplicationAwareFeed=JobFeed&{applied:FeedJob[];counts:JobFeed['counts']&{applied:number}};
export const applicationStatusReference=(job:FeedJob)=>[job.key,job.url,job.company,job.title,job.publishedAt,job.dateBasis];

// An unchanged key alone cannot authorize reusing a confirmed submission. A
// catalog update may reuse it for another URL or a newly published hiring round.
export function retainApplicationStatuses(previous:JobApplicationStatuses|undefined,previousReferences:unknown,jobs:FeedJob[]):JobApplicationStatuses|undefined{
 if(!previous||!Array.isArray(previousReferences))return undefined;
 const current=new Map(jobs.map(job=>[job.key,JSON.stringify(applicationStatusReference(job))]));
 const compatible=new Set(previousReferences.filter(reference=>Array.isArray(reference)&&current.get(reference[0])===JSON.stringify(reference)).map(reference=>reference[0]));
 return {...previous,matches:previous.matches.filter(match=>compatible.has(match.key))};
}
const order=(a:FeedJob,b:FeedJob)=>(b.interviewHistory?.similarRoles||0)-(a.interviewHistory?.similarRoles||0)
 ||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.key.localeCompare(b.key);
export function applicationCheckCandidates(feed?:JobFeed|null):FeedJob[]{
 if(!feed||feed.catalogPending||feed.generationPending||feed.setupRequired||!feed.counts)return [];
 return [...new Map([...(feed.eligibleCandidates||[...feed.recent,...feed.review,...feed.older]),...feed.excluded].map(row=>[row.key,row])).values()];
}
export function projectApplicationAwareFeed(feed:JobFeed,statuses?:JobApplicationStatuses):ApplicationAwareFeed{
 const statusMap=new Map(statuses?.matches.map(match=>[match.key,match])||[]);
 const annotate=(job:FeedJob):FeedJob=>({...job,application:statusMap.get(job.key)||{state:'unavailable'}});
 const buckets:{recent:FeedJob[];review:FeedJob[];older:FeedJob[];applied:FeedJob[]}={recent:[],review:[],older:[],applied:[]};
 const entries=feed.eligibleCandidates
  ?feed.eligibleCandidates.map(job=>({job,section:job.window==='older'?'older':job.decision==='review'?'review':'recent'}))
  :(['recent','review','older'] as const).flatMap(section=>feed[section].map(job=>({job,section})));
 const seen=new Set<string>(),moved={recent:0,review:0,older:0};
 for(const {job,section} of entries){
  if(seen.has(job.key))continue;seen.add(job.key);
  const row=annotate(job);
  const target=row.application?.state==='confirmed'?'applied':section as 'recent'|'review'|'older';
  if(target==='applied')moved[section as keyof typeof moved]++;
  buckets[target].push(row);
 }
 const counts={...feed.counts,recent:feed.eligibleCandidates?buckets.recent.length:Math.max(0,feed.counts.recent-moved.recent),review:feed.eligibleCandidates?buckets.review.length:Math.max(0,feed.counts.review-moved.review),older:feed.eligibleCandidates?buckets.older.length:Math.max(0,feed.counts.older-moved.older),applied:buckets.applied.length};
 for(const name of ['recent','review','older','applied'] as const)buckets[name]=buckets[name].sort(order).slice(0,50);
 return {...feed,...buckets,counts,excluded:feed.excluded.map(annotate)};
}
