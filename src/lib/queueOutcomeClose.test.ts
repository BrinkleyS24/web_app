import { beforeEach, expect, test, vi } from 'vitest';
const apiFetch=vi.hoisted(()=>vi.fn());vi.mock('@/lib/api',()=>({apiFetch}));
import { closeQueueOutcome } from './emails';
const params={logicalKey:'a'.repeat(16),dedupeKey:'b'.repeat(16),actionReference:'j1.31.42.'+'c'.repeat(64)};
const receipt={success:true,state:'completed',logicalKey:params.logicalKey,dedupeKey:params.dedupeKey,replayed:true,recorded:false,application:{id:42}};
beforeEach(()=>{apiFetch.mockReset();});
test('one request carries only task/view selectors, confirming even an authoritative inbox outcome',async()=>{
  apiFetch.mockResolvedValue(receipt);expect(await closeQueueOutcome(params)).toEqual(receipt);
  expect(apiFetch).toHaveBeenCalledWith('/api/suggestions/queue/actions/close',{method:'POST',body:JSON.stringify(params)});
  expect(apiFetch).toHaveBeenCalledTimes(1);
});
test.each([{success:false},{state:'active'},{logicalKey:'other'},{dedupeKey:'other'},{replayed:'true'},
  {recorded:undefined},{application:null},{application:{}},{application:{id:-1}}])('invalid receipt cannot report confirmed save: %j',async change=>{
  apiFetch.mockResolvedValue({...receipt,...change});await expect(closeQueueOutcome(params)).rejects.toThrow('could not be confirmed');
});
test('timeout is propagated without a fallback mutation',async()=>{
  const error=new Error('Timed out');apiFetch.mockRejectedValue(error);await expect(closeQueueOutcome(params)).rejects.toBe(error);expect(apiFetch).toHaveBeenCalledTimes(1);
});
