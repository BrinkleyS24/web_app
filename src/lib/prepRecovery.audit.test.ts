import {beforeEach,expect,test,vi} from "vitest";
import {clearOtherPrepDrafts,loadPrepDrafts,PREP_DRAFT_TTL,savePrepDrafts,emptyPrepSession} from "./prepDraftStorage";
import {loadPrepInterviewEmails} from "./interviewPrep";
const key="0123456789abcdef:fedcba9876543210";
const sessions={[key]:{...emptyPrepSession,posting:"Private fictional posting",notes:{"example:Situation":"Fictional work example"}}};
beforeEach(()=>{sessionStorage.clear();vi.restoreAllMocks();});

test("general and direct invitation drafts recover independently without inventing a task",()=>{
  const drafts={general:{...emptyPrepSession,posting:"General practice posting"},"email:101":{...emptyPrepSession,posting:"Invitation practice posting"},...sessions};
  savePrepDrafts("owner",drafts);expect(loadPrepDrafts("owner").sessions).toEqual(drafts);
});
test("explicit tab copies restore only the same owner, expire, and clear on account change",()=>{
  const now=Date.now();expect(loadPrepDrafts("owner",now).remember).toBe(false);
  savePrepDrafts("owner",sessions,now);expect(loadPrepDrafts("owner",now+100).sessions).toEqual(sessions);
  expect(loadPrepDrafts("other",now+100).sessions).toEqual({});
  expect(loadPrepDrafts("owner",now+PREP_DRAFT_TTL+1).remember).toBe(false);
  expect(Object.keys(sessionStorage)).toHaveLength(0);
  savePrepDrafts("owner",sessions,now);sessionStorage.setItem("unrelated","keep");clearOtherPrepDrafts("other");
  expect(loadPrepDrafts("owner",now).remember).toBe(false);expect(sessionStorage.getItem("unrelated")).toBe("keep");
  savePrepDrafts("other",sessions,now);clearOtherPrepDrafts(null);expect(loadPrepDrafts("other",now).remember).toBe(false);
});
test("corrupt, oversized and future-dated tab copies never become practice",()=>{
  sessionStorage.setItem("applendium:interview-prep:v1:owner","{broken");
  expect(loadPrepDrafts("owner").sessions).toEqual({});
  expect(()=>savePrepDrafts("owner",{[key]:{...emptyPrepSession,posting:"x".repeat(25_001)}})).toThrow();
});
test("storage denial returns an honest memory-only fallback",()=>{
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new DOMException("Denied","SecurityError");});
  expect(loadPrepDrafts("owner")).toMatchObject({remember:false,sessions:{},error:expect.stringMatching(/unavailable/)});
});
test("a later page can contain the interview and a decision cannot vanish behind the first 500",async()=>{
  const first=Array.from({length:500},(_,i)=>({id:String(i+1),category:"Applied"}));
  const last=[{id:"501",category:"Interviewed"},{id:"502",category:"Rejected"}];
  const fetch=vi.fn().mockResolvedValueOnce({success:true,emails:first,hasMore:true,totalCount:502}).mockResolvedValueOnce({success:true,emails:last,hasMore:false,totalCount:502});
  expect(await loadPrepInterviewEmails(fetch)).toHaveLength(502);expect(fetch).toHaveBeenLastCalledWith({limit:500,offset:500});
});
test.each(["failed page","duplicate page","changed total","short partial page"])("%s fails without returning an incomplete interview list",async(reason)=>{
  const first=Array.from({length:500},(_,i)=>({id:String(i+1)}));
  const second=reason==="failed page"?{success:false}:reason==="duplicate page"?{success:true,emails:first,hasMore:false,totalCount:1000}:reason==="changed total"?{success:true,emails:[{id:"501"}],hasMore:false,totalCount:501}:{success:true,emails:[],hasMore:true,totalCount:1000};
  const fetch=vi.fn().mockResolvedValueOnce({success:true,emails:first,hasMore:true,totalCount:1000}).mockResolvedValueOnce(second);
  await expect(loadPrepInterviewEmails(fetch)).rejects.toThrow();
});
