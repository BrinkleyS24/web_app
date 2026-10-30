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
