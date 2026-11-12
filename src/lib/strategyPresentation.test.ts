import { expect, test } from "vitest";
import { requireResumePatterns, requireStrategyAlerts, resumePatternSummary } from "./strategyPresentation";

const alert={id:"observed",kind:"performance",severity:"medium",title:"An observation",description:"Observed events do not prove a cause."};
const sample={success:true,basis:"current_default_resume_checks" as const,resume:{variantId:"r",name:"Default"},analyzedVerdicts:1,distinctRolesEvaluated:1,verdictsWithGapData:1,gaps:[],outdatedVerdictsExcluded:71};

test("one current role stays insufficient despite many excluded older checks",()=>{
  const data=requireResumePatterns(sample);expect(resumePatternSummary(data).title).toBe("Only one current role checked");
  expect(resumePatternSummary(data).body).not.toMatch(/No repeated/);expect(resumePatternSummary(data).href).toBe("/apply-gate");
});
test("missing resume, zero current checks and a sufficient scoped negative remain distinct",()=>{
  expect(resumePatternSummary(requireResumePatterns({...sample,resume:null,analyzedVerdicts:0,distinctRolesEvaluated:0})).href).toBe("/resumes");
  expect(resumePatternSummary(requireResumePatterns({...sample,analyzedVerdicts:0,distinctRolesEvaluated:0})).title).toBe("No current role checks for this version");
  expect(resumePatternSummary(requireResumePatterns({...sample,analyzedVerdicts:2,distinctRolesEvaluated:2})).title).toBe("No repeated requirements in these checks");
  expect(resumePatternSummary(requireResumePatterns({...sample,analyzedVerdicts:2,distinctRolesEvaluated:2})).body).toContain("does not establish qualification");
});
test.each([{success:false,alerts:[]},{success:true},{success:true,alerts:{}},{success:true,alerts:[null]},{success:true,alerts:[{...alert,severity:"critical"}]},{success:true,alerts:[alert,alert]},{success:true,alerts:[{...alert,debrief:{items:[],total:-1}}]}])("unverifiable findings never become an empty success: %j",value=>{
  expect(()=>requireStrategyAlerts(value)).toThrow(/could not be verified/);
});
test.each([{success:false},{basis:"old"},{distinctRolesEvaluated:-1},{distinctRolesEvaluated:"2"},{gaps:{}},{resume:null},{truncated:true},{outdatedVerdictsExcluded:-1},{gaps:[{skill:"Degree",category:"unknown",occurrences:2,examples:[]}]},{distinctRolesEvaluated:2,gaps:[{skill:"Degree",category:"required",occurrences:3,examples:[]}]}])("invalid resume analysis is unavailable, not reassuring: %j",patch=>{
  expect(()=>requireResumePatterns({...sample,...patch})).toThrow(/could not be verified/);
});
test("known requirement categories and missing source attribution are preserved",()=>{
  const gaps=["required","evidence","preferred"].map((category,index)=>({skill:`Detail ${index}`,category,occurrences:2,examples:[{company:null,position:null,requirementQuote:"Original source passage."}]}));
  const data=requireResumePatterns({...sample,analyzedVerdicts:2,distinctRolesEvaluated:2,gaps});expect(data.gaps.map(gap=>gap.category)).toEqual(["required","evidence","preferred"]);expect(data.gaps[0].examples[0].verdictId).toBeUndefined();
});
