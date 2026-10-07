import { beforeEach, expect, test, vi } from 'vitest';
const {apiFetch}=vi.hoisted(()=>({apiFetch:vi.fn()}));
vi.mock('./api.js',()=>({apiFetch}));
import { recordInterviewDebrief } from './emails';
beforeEach(()=>apiFetch.mockReset().mockResolvedValue({success:true,recorded:true}));
test('the displayed reference survives the actual close-by-email request',async()=>{
  const actionReference='j1.31.42.'+'a'.repeat(64);
  await recordInterviewDebrief({emailId:31,answer:'rejected',actionReference});
  expect(apiFetch).toHaveBeenCalledWith('/api/emails/applications/close-by-email',{method:'POST',body:{emailId:31,reason:'Rejected - interview debrief',actionReference}});
});
test('older backends with no reference remain compatible',async()=>{
  await recordInterviewDebrief({emailId:31,answer:'no_response'});
  expect(apiFetch).toHaveBeenCalledWith('/api/emails/applications/close-by-email',{method:'POST',body:{emailId:31,reason:'No response - interview debrief'}});
});
