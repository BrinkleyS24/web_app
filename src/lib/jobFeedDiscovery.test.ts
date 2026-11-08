import {expect,test,vi,beforeEach} from 'vitest';
import {createDiscoveryAccumulator} from './jobFeedDiscovery';
import {fetchJobFeed,type FeedJob,type JobFeed} from './jobFeed';
const mocks=vi.hoisted(()=>({apiFetch:vi.fn()}));
vi.mock('@/lib/api',()=>({apiFetch:mocks.apiFetch}));
beforeEach(()=>mocks.apiFetch.mockReset());
const job=(key:string,extra:Partial<FeedJob>={}):FeedJob=>({key,title:'Quality Assurance Automation Specialist',company:'Example',url:`https://jobs.example.test/${key}`,publishedAt:'2026-10-20',decision:'supported',window:'recent',reasons:[],requirements:[],...extra} as FeedJob);
const page=(scannedParts:number,rows:FeedJob[],extra:Partial<JobFeed>={}):JobFeed=>({matchingMode:'resume_discovery',version:2,resume:{id:'resume',name:'Resume',fingerprint:'fp'},catalog:{revision:'catalog'},recent:rows.filter(r=>r.decision==='supported'&&r.window!=='older'),review:rows.filter(r=>r.decision==='review'),older:rows.filter(r=>r.window==='older'),excluded:rows.filter(r=>r.decision==='excluded'),counts:{recent:0,review:0,older:0,excluded:0},discovery:{asOf:'2026-10-24',scannedParts,totalParts:2,complete:scannedParts===2,nextCursor:scannedParts===2?null:'next'},...extra} as JobFeed);
test('aggregation deduplicates pages, keeps oldest body duplicates, computes counts, and ranks interviews after eligibility',()=>{
 const add=createDiscoveryAccumulator();
 expect(add(page(1,[job('new',{dedupeKey:'same'}),job('plain')])).discovery?.complete).toBe(false);
 const result=add(page(2,[job('old',{dedupeKey:'same',publishedAt:'2026-09-25',window:'older'}),job('interview',{interviewHistory:{similarRoles:2,roleFamily:'QA and testing'}}),job('blocked',{decision:'excluded',exclusionKind:'requirement_blocker'})]));
 expect(result.counts).toEqual({recent:2,review:0,older:1,excluded:1});
 expect(result.recent[0].key).toBe('interview');expect(result.older[0].key).toBe('old');
 expect(result.exclusionSummary).toEqual({requirementBlockers:1,insufficientEvidence:0});
});
test('exact counts survive the visible 50-row cap',()=>{
 const add=createDiscoveryAccumulator();add(page(1,Array.from({length:70},(_,i)=>job(String(i)))));
 const result=add(page(2,[job('later',{publishedAt:'2026-10-23'})]));
 expect(result.counts.recent).toBe(71);expect(result.recent).toHaveLength(50);expect(result.recent[0].key).toBe('later');
});

test('exclusion samples retain exact distinct counts without keeping every evidence card',()=>{
 const add=createDiscoveryAccumulator();
 const excluded=Array.from({length:1000},(_,i)=>job(`excluded-${i}`,{decision:'excluded',exclusionKind:i%2?'insufficient_evidence':'requirement_blocker'}));
 add(page(1,excluded));
 const result=add(page(2,[...excluded.slice(0,20),job('fit')]));
 expect(result.counts.excluded).toBe(1000);expect(result.excluded).toHaveLength(50);
 expect(result.counts.recent).toBe(1);expect(result.exclusionSummary).toEqual({requirementBlockers:500,insufficientEvidence:500});
});
test('mixed context and repeated or invalid progress cannot be merged',()=>{
 for(const change of [{version:3},{resume:{id:'other',fingerprint:'fp',name:'Other'}},{catalog:{revision:'other'}}]){
  const add=createDiscoveryAccumulator();add(page(1,[]));expect(()=>add(page(2,[],change as Partial<JobFeed>))).toThrow(/changed/);
 }
 const add=createDiscoveryAccumulator();add(page(1,[]));expect(()=>add(page(1,[]))).toThrow(/changed/);
});
test('fetch follows continuations automatically and publishes partial then complete results',async()=>{
 mocks.apiFetch.mockResolvedValueOnce(page(1,[])).mockResolvedValueOnce(page(2,[job('fit')]));
 const progress=vi.fn(),signal=new AbortController().signal;
 const result=await fetchJobFeed(2,signal,'fp',progress);
 expect(mocks.apiFetch.mock.calls[1][0]).toContain('cursor=next');
 expect(progress.mock.calls[0][0].discovery.complete).toBe(false);expect(result.counts.recent).toBe(1);
 expect(progress.mock.calls[1][0].discovery.complete).toBe(true);
});

test('an older backend cannot silently present title-filtered results as discovery',async()=>{
 mocks.apiFetch.mockResolvedValueOnce({version:2,catalog:{revision:'old'},recent:[],review:[],older:[],excluded:[],counts:{recent:0,review:0,older:0,excluded:0}});
 await expect(fetchJobFeed(2)).rejects.toThrow(/job service needs an update/i);
});
test('cancellation between batches prevents the next request and stale context errors are preserved',async()=>{
 mocks.apiFetch.mockResolvedValueOnce(page(1,[]));
 const controller=new AbortController();
 await expect(fetchJobFeed(2,controller.signal,'fp',()=>controller.abort())).rejects.toMatchObject({name:'AbortError'});
 expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
 mocks.apiFetch.mockReset().mockResolvedValueOnce(page(1,[])).mockRejectedValueOnce(Object.assign(new Error('Changed'),{status:409}));
 const progress=vi.fn();await expect(fetchJobFeed(2,undefined,'fp',progress)).rejects.toMatchObject({status:409});
 expect(progress).toHaveBeenCalledTimes(1);
});

test('a transient continuation outage retries the same page without duplicating earlier results',async()=>{
 vi.useFakeTimers();
 try{
  mocks.apiFetch.mockResolvedValueOnce(page(1,[job('first')])).mockRejectedValueOnce(Object.assign(new Error('Busy'),{status:503})).mockResolvedValueOnce(page(2,[job('second')]));
  const result=fetchJobFeed(2);
  await vi.advanceTimersByTimeAsync(5000);
  expect((await result).counts.recent).toBe(2);
  expect(mocks.apiFetch.mock.calls[1][0]).toBe(mocks.apiFetch.mock.calls[2][0]);
 }finally{vi.useRealTimers();}
});

test('a known expired catalog stops continuation without transient outage retries',async()=>{
 const error=Object.assign(new Error('Collection expired'),{status:503,payload:{code:'catalog_stale'}});
 mocks.apiFetch.mockResolvedValueOnce(page(1,[])).mockRejectedValueOnce(error);
 await expect(fetchJobFeed(2)).rejects.toBe(error);
 expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
});

test('cancelling retry backoff releases the timer and sends no further request',async()=>{
 vi.useFakeTimers();
 try{
  mocks.apiFetch.mockResolvedValueOnce(page(1,[])).mockRejectedValueOnce(Object.assign(new Error('Busy'),{status:503}));
  const controller=new AbortController();
  const result=fetchJobFeed(2,controller.signal).catch(error=>error);
  await vi.advanceTimersByTimeAsync(1);controller.abort();
  expect(await result).toMatchObject({name:'AbortError'});expect(vi.getTimerCount()).toBe(0);
  expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
 }finally{vi.useRealTimers();}
});
