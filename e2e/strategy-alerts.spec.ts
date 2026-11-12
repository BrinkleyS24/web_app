import { expect, test, type Page } from "@playwright/test";

const variantId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const interview={id:"performance-focus-interview",kind:"performance",severity:"medium",title:"Review the interview decisions you have recorded",description:"12 tracked applications reached interview-stage messages. Five decisions are known. These records do not confirm attendance or explain an employer's decision.",supporting_stat:"12 reached an interview · 5 decisions known",recommendation:"If those interviews took place, review your notes and specific feedback before choosing a preparation topic. These totals do not establish that your resume needs rewriting.",timeframe_label:"Across your tracked search"};
const oneRole={success:true,basis:"current_default_resume_checks",resume:{variantId,name:"Current default"},analyzedVerdicts:1,distinctRolesEvaluated:1,verdictsWithGapData:1,gaps:[],outdatedVerdictsExcluded:17,changedResumeVerdictsExcluded:0,otherResumeVerdictsExcluded:0,sampledChecks:20,truncated:false};
async function fixtures(page:Page, read:()=>{alerts:unknown;gaps:unknown}){
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname,state=read();let body:unknown={success:true};
    if(path.endsWith("/suggestions/strategy-alerts"))body=state.alerts;
    else if(path.endsWith("/resume-gaps"))body=state.gaps;
    else if(path.endsWith("/suggestions/queue"))body={success:true,queue:{doToday:[],thisWeek:[],later:[],blocked:[],resolvedActions:[]}};
    else if(path.endsWith("/stored-emails"))body={success:true,emails:[],hasMore:false,totalCount:0};
    else if(path.endsWith("/resumes"))body={success:true,variants:[{id:variantId,name:"Current default",isDefault:true}]};
    else if(path.endsWith("/interview-prep/context"))body={success:true,source:{kind:"general",sourceVersion:"a".repeat(64),company:"",role:"",threadId:null,schedule:null,excerpts:[]}};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
}

for(const width of [320,390,1440])test(`insufficient sample, source disclosure and Prep handoff at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await fixtures(page,()=>({alerts:{success:true,alerts:[interview]},gaps:oneRole}));await page.goto("/strategy-alerts");
  await expect(page.getByText("Only one current role checked",{exact:true})).toBeVisible();await expect(page.getByText("No repeated gaps",{exact:true})).toHaveCount(0);
  await expect(page.getByText(interview.recommendation,{exact:true})).toBeVisible();await expect(page.getByText(interview.description,{exact:true})).not.toBeVisible();
  await expect(page.locator("#main-content")).toHaveCSS("opacity","1");await page.screenshot({path:`C:/dev/intrackt-project-root/.codex_tmp/strategy-ui-20261112/single-role-${width}.png`,fullPage:true,animations:"disabled"});
  const why=page.getByText("Why this appeared",{exact:true});await why.focus();await why.press("Enter");await expect(page.getByText(interview.description,{exact:true})).toBeVisible();await why.press("Enter");
  await page.getByText("What this summary uses",{exact:true}).click();await expect(page.getByText("17 older checks were excluded because the analysis needs updating.",{exact:true})).toBeVisible();await expect(page.getByText(/do not need to recheck every older job/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.getByRole("link",{name:"Open interview preparation",exact:true}).click();await expect(page.getByRole("heading",{level:1,name:"Interview preparation"})).toBeVisible();await page.getByRole("link",{name:"Practice for a role",exact:true}).click();await expect(page.getByText(/No invitation is connected/)).toBeVisible();expect(errors).toEqual([]);
});

for(const width of [320,390,1440])test(`multiple findings, requirement distinctions and exact evidence at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[],writes:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",req=>{const path=new URL(req.url()).pathname;if(path.startsWith("/api/")&&req.method()!=="GET"&&!["/api/user","/api/send","/api/activity"].includes(path))writes.push(path);});
  const status=width===1440?"measured":"running";
  const experiment={id:"experiment-screening",kind:"experiment",severity:"low",title:"Your experiment: review screening questions",description:"Observed progress is not proof of a cause.",supporting_stat:status==="measured"?"5 application outcomes observed":"3 of 5 applications so far",recommendation:"Check the next posting and answer its screening questions accurately.",experiment:{key:"screening",status}};
  const offer={id:"performance-rejection-velocity-auto_screen",kind:"performance",severity:"high",title:"Several rejections arrived soon after applying",description:"Four of six timed rejections arrived within three days. Timing does not identify the reason for rejection.",supporting_stat:"4 of 6 timed rejections arrived within 3 days",recommendation:"Before applying, review screening questions about work authorization, location and experience. Answer accurately; timing alone does not explain a rejection.",experiment:{key:"screening-first",status:"not_started",ask:"Try reviewing the screening questions before your next five applications.",howItWorks:"Choose whether to start this in Next Actions."}};
  const debrief={id:"performance-interview-debrief",kind:"performance",severity:"medium",title:"Unknown interview outcomes",description:"Awaiting your answers.",debrief:{kind:"interview_outcome",total:4,items:[{key:"one",emailId:101,label:"Example employer"}]}};
  const gaps=Array.from({length:7},(_,index)=>({skill:index===0?"Completed degree":index===6?"LongOptionalDetail"+"X".repeat(160):`Requirement ${index+1}`,category:index===0?"required":index===6?"preferred":"evidence",label:index===0?"Explicit requirement blocker in the checked resume":index===6?"Preferred detail, not a requirement":"Qualification evidence needs review",occurrences:4,examples:index===0?[{company:"Example Clinic",position:"QA analyst",requirementQuote:"A completed nursing degree is mandatory.",verdictId:"source/check"}]:[]}));
  await fixtures(page,()=>({alerts:{success:true,alerts:[interview,offer,experiment,debrief]},gaps:{...oneRole,analyzedVerdicts:4,distinctRolesEvaluated:4,gaps,sampledChecks:150,sampleLimit:150,truncated:true}}));await page.goto("/strategy-alerts#performance-focus-interview");
  await expect(page.getByText("Based on the latest 150 saved checks; older checks are outside this sample.",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Your experiments"})).toBeVisible();await expect(page.getByText(status==="measured"?"Experiment result":"Experiment running",{exact:true})).toBeVisible();
  await expect(page.getByTestId("debrief-link")).toHaveAttribute("href","/dashboard");await expect(page.getByRole("button",{name:"Never heard back"})).toHaveCount(0);
  const blocker=page.locator("li").filter({has:page.getByRole("heading",{name:"Completed degree",exact:true})});await expect(blocker.getByText("Requirement blocker",{exact:true})).toBeVisible();
  await blocker.getByText("See posting evidence",{exact:true}).click();await expect(blocker.getByText("A completed nursing degree is mandatory.",{exact:true})).toBeVisible();await expect(blocker.getByRole("link",{name:"Example Clinic · QA analyst",exact:true})).toHaveAttribute("href","/apply-gate?verdict=source%2Fcheck");await expect(blocker.getByText("Showing 1 of 4 checked roles.",{exact:true})).toBeVisible();
  await page.getByText("More repeated requirements (4)",{exact:true}).click();await expect(page.getByRole("heading",{name:gaps[6].skill,exact:true})).toBeVisible();await expect(page.getByText("Nice to have",{exact:true})).toBeVisible();
  await page.getByText("Try one change",{exact:true}).click();await expect(page.getByText(offer.experiment.ask,{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Start in Next Actions",exact:true})).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);expect(writes).toEqual([]);
  await page.getByText("More repeated requirements (4)",{exact:true}).click();await page.getByText("Try one change",{exact:true}).click();await blocker.getByText("See posting evidence",{exact:true}).click();await expect(page.locator("#main-content")).toHaveCSS("opacity","1");await page.evaluate(()=>scrollTo({top:0,left:0,behavior:"instant"}));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.screenshot({path:`C:/dev/intrackt-project-root/.codex_tmp/strategy-ui-20261112/populated-${width}.png`,fullPage:true,animations:"disabled"});
});

for(const failed of ["alerts","gaps"] as const)test(`malformed ${failed} remain retryable without hiding independent evidence`,async({page})=>{
  await page.setViewportSize({width:390,height:900});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));let invalid=true;
  await fixtures(page,()=>({alerts:failed==="alerts"&&invalid?{success:true,alerts:{}}:{success:true,alerts:[interview]},gaps:failed==="gaps"&&invalid?{...oneRole,basis:"obsolete"}:oneRole}));await page.goto("/strategy-alerts");
  await expect(page.getByText(failed==="alerts"?"Your alerts did not load":"Your resume patterns did not load",{exact:true})).toBeVisible();
  if(failed==="alerts"){await expect(page.getByText("Only one current role checked",{exact:true})).toBeVisible();await expect(page.getByText("No strong patterns yet",{exact:true})).toHaveCount(0);}else await expect(page.getByRole("heading",{name:interview.title,exact:true})).toBeVisible();
  invalid=false;await page.getByRole("button",{name:"Try again",exact:true}).click();await expect(page.getByText("Only one current role checked",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:interview.title,exact:true})).toBeVisible();expect(errors).toEqual([]);
});

test("no default resume and an honest empty history offer setup without a false verdict",async({page})=>{
  await page.setViewportSize({width:320,height:900});await fixtures(page,()=>({alerts:{success:true,alerts:[]},gaps:{...oneRole,resume:null,unavailableReason:"no_default_resume",analyzedVerdicts:0,distinctRolesEvaluated:0}}));await page.goto("/strategy-alerts");
  await expect(page.getByText("No strong patterns yet",{exact:true})).toBeVisible();await expect(page.getByText("Choose a default resume",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Open Resumes",exact:true})).toHaveAttribute("href","/resumes");await expect(page.getByText("No repeated requirements in these checks",{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
