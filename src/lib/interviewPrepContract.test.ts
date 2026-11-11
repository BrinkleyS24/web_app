import { beforeEach, expect, test, vi } from "vitest";
import { buildInterviewPractice, fetchInterviewSource, prepSelectionKey, validPrepEmailId } from "./interviewPrep";
const api=vi.hoisted(()=>vi.fn());
vi.mock("./api",()=>({apiFetch:api}));
const source={kind:"general",sourceVersion:"a".repeat(64),company:"",role:"",threadId:null,schedule:null,excerpts:[]};
beforeEach(()=>api.mockReset());
test("general sources have no fictional invitation and the request carries explicit intent",async()=>{
  api.mockResolvedValue({success:true,source});expect(await fetchInterviewSource({mode:"general"})).toEqual(source);
  expect(api.mock.calls[0][0]).toBe("/api/suggestions/interview-prep/context?mode=general");
  api.mockResolvedValue({success:true,source:{...source,threadId:"pretend"}});await expect(fetchInterviewSource({mode:"general"})).rejects.toThrow(/not confirmed/);
});
test("direct sources must return the selected email and cannot degrade into general practice",async()=>{
  api.mockResolvedValue({success:true,source});await expect(fetchInterviewSource({emailId:"101"})).rejects.toThrow(/not confirmed/);
  api.mockResolvedValue({success:true,source:{...source,kind:"invitation",emailId:"102",threadId:"thread"}});await expect(fetchInterviewSource({emailId:"101"})).rejects.toThrow(/not confirmed/);
  api.mockResolvedValue({success:true,source:{...source,kind:"invitation",emailId:"101",threadId:"thread"}});expect((await fetchInterviewSource({emailId:"101"})).emailId).toBe("101");
});
test("selection keys preserve distinct drafts and never round an unsafe email ID",()=>{
  expect(prepSelectionKey({mode:"general"})).toBe("general");expect(prepSelectionKey({emailId:"101"})).toBe("email:101");
  for(const id of [null,"0","-1","e1","9007199254740992","1e3","01"])expect(validPrepEmailId(id)).toBe(false);
  expect(validPrepEmailId("9007199254740991")).toBe(true);
});
test("a response built from another resume revision cannot be accepted",async()=>{
  const input={mode:"general" as const,sourceVersion:source.sourceVersion,variantId:"resume",expectedResumeVersion:"b".repeat(64),jobDescription:"Manage patient scheduling and maintain accurate records.",focusAreas:["Manage patient scheduling and maintain accurate records."]};
  api.mockResolvedValue({success:true,pack:{sourceVersion:source.sourceVersion,resume:{id:"resume",name:"Resume",version:"c".repeat(64)},postingVersion:"d".repeat(64),disclosure:"Practice",practice:[{id:"topic",quote:input.focusAreas[0],kind:"experience",question:"Example?",guidance:"Truthful",askInterviewer:"Success?",possibleExamples:[]}]}});
  await expect(buildInterviewPractice(input)).rejects.toThrow(/not confirmed/);
});
