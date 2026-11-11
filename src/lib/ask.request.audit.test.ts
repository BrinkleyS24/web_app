import {afterEach,expect,test,vi} from 'vitest';
const {apiFetch}=vi.hoisted(()=>({apiFetch:vi.fn()}));
vi.mock('@/lib/api',()=>({apiFetch}));
import {askApplendium} from './ask';
afterEach(()=>{vi.useRealTimers();apiFetch.mockReset();});
test.each([null,{success:true,answer:'An answer',applications:'not an array'},{success:true,answer:'An answer',applications:[],quotes:'not an array'}])('malformed success cannot become a blank screen or a render crash: %j',async result=>{
 apiFetch.mockResolvedValue(result);await expect(askApplendium('What happened?')).rejects.toThrow(/answer|response/i);
});
test('the client deadline includes an API operation stuck before fetch',async()=>{
 vi.useFakeTimers();apiFetch.mockImplementation(()=>new Promise(()=>{}));
 const result=askApplendium('What happened?');const check=expect(result).rejects.toThrow(/too long/i);
 await vi.advanceTimersByTimeAsync(45001);await check;
});
test('an already-cancelled owner request never starts an API operation',async()=>{
 const controller=new AbortController();controller.abort();await expect(askApplendium('What happened?',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(apiFetch).not.toHaveBeenCalled();
});

test.each([{applications:{private:'invalid'}},{applications:1,open:-1},{applications:1,open:0,reachedInterview:NaN}])('invalid totals cannot crash rendering or misstate counts: %j',async totals=>{
 apiFetch.mockResolvedValue({success:true,answer:'Your totals',applications:[],totals});
 await expect(askApplendium('How many applications?')).rejects.toThrow(/response/i);
});

test.each([
 {kind:'no_reply',total:2,items:[{ref:'R1',company:'Example',role:null}]},
 {kind:'no_reply',total:2,items:[{ref:'R1',company:'Example',role:null},{ref:'R1',company:'Other',role:null}]},
 {kind:'no_reply',total:1,items:[{ref:'R1',company:'Example',role:null,threadId:{unsafe:'object'}}]},
])('incomplete or malformed structured lists cannot silently misstate complete results: %j',async list=>{
 apiFetch.mockResolvedValue({success:true,answer:'Your applications',applications:[],list});
 await expect(askApplendium('Who has not replied?')).rejects.toThrow(/response/i);
});

test('the older complete list contract is accepted without new optional source metadata',async()=>{
 const result={success:true,answer:'One application',applications:[],list:{kind:'reached_interview',total:1,items:[{ref:'R1',company:'Example',role:null,stage:'rejected',interviewedOn:'2026-10-01'}]}};
 apiFetch.mockResolvedValue(result);await expect(askApplendium('Which applications reached interviews?')).resolves.toEqual(result);
});
