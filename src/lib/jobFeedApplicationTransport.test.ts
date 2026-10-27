import {beforeEach,expect,test,vi} from 'vitest';
import {fetchJobApplicationStatuses,type FeedJob} from './jobFeed';
const mocks=vi.hoisted(()=>({apiFetch:vi.fn()}));
vi.mock('@/lib/api',()=>({apiFetch:mocks.apiFetch}));
const job=(key:string)=>({key,company:'Example',title:'QA Engineer',url:`https://example.test/jobs/${key}`,publishedAt:'2026-10-24',dateBasis:'first_published',requirements:[{evidence:'Private resume passage'}]}) as FeedJob;
const reply=(keys:string[])=>({status:'available',checkedAt:'2026-10-24',matches:keys.map(key=>({key,state:'none_known'}))});
beforeEach(()=>{mocks.apiFetch.mockReset();});

test('large public-reference requests are chunked; private qualification evidence is never sent',async()=>{
 const jobs=Array.from({length:501},(_,i)=>job(String(i)));
 mocks.apiFetch.mockImplementation(async(_url,options)=>reply(JSON.parse(options.body).jobs.map((row:FeedJob)=>row.key)));
 const controller=new AbortController();
 const result=await fetchJobApplicationStatuses(jobs,controller.signal);
 expect(result.matches).toHaveLength(501);
 expect(mocks.apiFetch.mock.calls.map(call=>JSON.parse(call[1].body).jobs.length)).toEqual([250,250,1]);
 for(const [url,options] of mocks.apiFetch.mock.calls){
  expect(url).toBe('/api/jobs/application-status');expect(options.method).toBe('POST');
  expect(options.signal).toBe(controller.signal);expect(options.body).not.toContain('Private resume');
 }
});
test.each([
 {...reply(['wrong'])},
 {...reply(['one','two']),matches:[{key:'one',state:'none_known'},{key:'one',state:'none_known'}]},
 {...reply(['one']),matches:[{key:'one',state:'invented'}]},
 {...reply(['one']),matches:undefined},
 {...reply(['one']),checkedAt:'invalid'},
])('malformed or mismatched results never become false application assertions: %#',async response=>{
 mocks.apiFetch.mockResolvedValue(response);
 const jobs=response.matches?.length===2?[job('one'),job('two')]:[job('one')];
 await expect(fetchJobApplicationStatuses(jobs)).rejects.toThrow('could not be checked');
});
test.each([403,503])('history failure %s is surfaced independently of qualification results',async status=>{
 const error=Object.assign(Error('History unavailable'),{status});mocks.apiFetch.mockRejectedValue(error);
 await expect(fetchJobApplicationStatuses([job('one')])).rejects.toBe(error);
});
