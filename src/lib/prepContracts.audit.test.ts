import {beforeEach,expect,test,vi} from "vitest";
const mocks=vi.hoisted(()=>({api:vi.fn()}));
vi.mock("./api",()=>({apiFetch:mocks.api}));
import {buildInterviewPractice,fetchInterviewSource} from "./interviewPrep";
const keys={logicalKey:"0123456789abcdef",dedupeKey:"fedcba9876543210"};
const quote="Maintain safe inventory records and investigate discrepancies.";
const input={...keys,sourceVersion:"a".repeat(64),variantId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",jobDescription:quote,focusAreas:[quote]};
const pack={sourceVersion:input.sourceVersion,resume:{id:input.variantId,name:"Inventory resume",version:"b".repeat(64)},postingVersion:"c".repeat(64),disclosure:"Practice, not a prediction.",practice:[{id:"example",quote,kind:"experience",question:"Give a truthful example.",guidance:"Use real evidence.",askInterviewer:"How is success measured?",possibleExamples:[]}]};
beforeEach(()=>{vi.clearAllMocks();});
test("practice responses require exact source quotes and complete safe fields",async()=>{
  const controller=new AbortController();mocks.api.mockResolvedValue({success:true,pack});
  expect(await buildInterviewPractice(input,{signal:controller.signal})).toEqual(pack);
  expect(mocks.api.mock.calls[0][1].signal).toBe(controller.signal);
  for(const invalid of [null,{...pack,practice:[{...pack.practice[0],quote:"Invented requirement"}]},{...pack,practice:[{...pack.practice[0],kind:"invented"}]},{...pack,practice:[{...pack.practice[0],possibleExamples:null}]},{...pack,resume:{id:"other-owner-resume"}}]){
    mocks.api.mockResolvedValue({success:true,pack:invalid});await expect(buildInterviewPractice(input)).rejects.toThrow(/not confirmed/);
  }
});
test("a successful but malformed interview context is a recoverable error",async()=>{
  for(const source of [null,{...keys,sourceVersion:"a".repeat(64),excerpts:[]},{...keys,sourceVersion:"a".repeat(64),threadId:"thread",company:"Fictional",role:"Clerk",excerpts:[{id:"1",text:null}]}]){
    mocks.api.mockResolvedValue({success:true,source});await expect(fetchInterviewSource(keys)).rejects.toThrow(/not confirmed/);
  }
});
