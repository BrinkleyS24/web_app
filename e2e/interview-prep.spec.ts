import {expect,test} from "@playwright/test";
const logicalKey="0123456789abcdef",dedupeKey="fedcba9876543210",variantId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const focus="Manage appointment scheduling and patient records.";
const posting=`Receptionist responsibilities at Example Health. ${focus} Maintain accurate information and support patients and visitors throughout the day.`;
const source={logicalKey,dedupeKey,sourceVersion:"a".repeat(64),company:"Example Health",role:"Receptionist",threadId:"thread",schedule:{startAt:"2026-10-08T00:00:00Z",timeZone:null,hasTime:false,source:"ics"},excerpts:[{id:"1",subject:"Interview invitation",sender:"Recruiter <recruiter@example.test>",receivedAt:null,text:"The invitation does not include a confirmed time."}]};
const action={id:"interview-task",logicalKey,dedupeKey,primaryEntityId:"interview:thread",threadId:"thread",emailId:1,applicationId:10,actionType:"prep_interview",legacyActionType:"prepare_interview",actionCategory:"optimization",title:"Prepare for your Receptionist interview",company:"Example Health",roleTitle:"Receptionist",whyNow:"Invitation received.",targetOutcome:"Prepare truthful examples.",effortMinutes:20,urgencyLevel:"high",confidenceLevel:"strong",status:"open",effectiveStatus:"open",createdAt:"2026-10-07T00:00:00Z",evidenceVersion:"v1",source:"followup_engine",queueSource:"followup",intent:"PREP_INTERVIEW",intentLabel:"Prepare interview",draftEligible:false,routeHref:"/next-actions",routeLabel:"Open queue",sourceLabel:"Interview task",stageLabel:"Interview",evidence:["Interview invitation"],playbook:["Prepare your examples."],blockedByLogicalKeys:[]};
const pack={sourceVersion:source.sourceVersion,resume:{id:variantId,name:"Front desk resume",version:"b".repeat(64)},postingVersion:"c".repeat(64),disclosure:"Practice prompts from your posting, not predictions of interview questions.",practice:[{id:"focus-one",quote:focus,kind:"experience",question:"Walk through a real example relevant to this responsibility.",guidance:"Only use facts you can support.",askInterviewer:"How is success measured?",possibleExamples:["Managed appointment scheduling and patient records for a busy clinic."]}]};
for(const width of [320,390,1440])test(`grounded interview prep and retained notes fit at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));let completed=false;const builds:unknown[]=[],completions:unknown[]=[];
  await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copied:string}).copied=text;}}}));
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;let body:unknown={success:true};
    if(path.endsWith("/suggestions/queue"))body={success:true,queue:{doToday:completed?[]:[action],thisWeek:[],later:[],blocked:[],dismissed:[],expired:[],done:[],resolvedActions:[{...action,effectiveStatus:completed?"done":"open"}]}};
    else if(path.endsWith("/interview-prep/context"))body={success:true,source};
    else if(path.endsWith("/interview-prep/practice")){builds.push(route.request().postDataJSON());body={success:true,pack};}
    else if(path.endsWith("/resumes"))body={success:true,variants:[{id:variantId,name:"Front desk resume",isDefault:true,charCount:100}]};
    else if(path.endsWith("/queue/actions/complete")){completions.push(route.request().postDataJSON());completed=true;body={success:true,state:"completed",logicalKey,dedupeKey};}
    else if(path.endsWith("/stored-emails"))body={success:true,emails:[]};
    else if(path.endsWith("/suggestions/states"))body={success:true,actions:[]};
    else if(path.endsWith("/followup-needed"))body={success:true,suggestions:[]};
    else if(path.endsWith("/apply-gate/history"))body={success:true,history:[]};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto("/next-actions");await page.getByRole("link",{name:"Prepare for interview"}).click();
  await expect(page).toHaveURL(new RegExp(`/interview-prep\\?action=${logicalKey}&version=${dedupeKey}`));
  await expect(page.getByText(/Oct 8, 2026. Time is unconfirmed/)).toBeVisible();
  await expect(page.getByLabel("Resume for this interview")).toHaveValue(variantId);
  await expect(page.getByTestId("prep-resume-why")).toContainText("your default resume");
  await expect(page.getByRole("button",{name:"Build my practice"})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Add the posting below, at least 100 characters");
  await page.getByLabel("Posting for this role").fill(posting);await page.getByLabel("Responsibilities or requirements to practice").fill(focus);
  await page.getByRole("button",{name:"Build my practice"}).click();await expect(page.getByText(pack.practice[0].question)).toBeVisible();
  expect(builds).toEqual([{logicalKey,dedupeKey,sourceVersion:source.sourceVersion,variantId,jobDescription:posting,focusAreas:[focus]}]);expect(completions).toEqual([]);
  await page.getByLabel("What I did",{exact:true}).fill("I verified appointment times and corrected the records.");await page.getByRole("button",{name:"Copy practice notes"}).click();
  const copied=await page.evaluate(()=>(window as unknown as {copied:string}).copied);expect(copied).toContain("What I did: I verified appointment times and corrected the records.");expect(completions).toEqual([]);
  await page.getByText("Review source, change setup or enable tab recovery").click();
  await expect(page.getByRole("button",{name:"Rebuild practice"})).toBeDisabled();
  await page.getByRole("link",{name:"Back to Next Actions"}).click();await page.getByRole("link",{name:"Prepare for interview"}).click();
  await expect(page.getByLabel("What I did",{exact:true})).toHaveValue("I verified appointment times and corrected the records.");expect(builds).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);expect(errors).toEqual([]);
  await page.getByRole("button",{name:"I've finished this task"}).click();await expect(page.getByText(/Task marked done/)).toBeVisible();expect(completions).toEqual([{logicalKey,dedupeKey,sourceVersion:source.sourceVersion}]);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`C:/dev/intrackt-project-root/.codex_tmp/interview-prep-${width}.png`,fullPage:true});
});

for(const width of [320,390,1440])for(const entry of ["general","invitation"] as const)test(`${entry} practice works without a queued task at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const selectedSource=entry==="general"?{kind:"general",sourceVersion:source.sourceVersion,company:"",role:"",threadId:null,schedule:null,excerpts:[],resumeSubmission:{status:"unknown"}}:{...source,logicalKey:undefined,dedupeKey:undefined,kind:"invitation",emailId:"101"};
  const qualification="Active nursing licence required before starting.";
  const extra={...pack.practice[0],id:"qualification",quote:qualification,kind:"eligibility",question:"Explain your current credential status."};
  const practice={...pack,practice:[pack.practice[0],extra]};let built=false;
  await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copied:string}).copied=text;}}}));
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;let body:unknown={success:true};let status=200;
    if(path.endsWith("/suggestions/queue")){status=503;body={success:false,error:"Fictional task queue outage"};}
    else if(path.endsWith("/interview-prep/context"))body={success:true,source:selectedSource};
    else if(path.endsWith("/interview-prep/practice")){built=true;expect(route.request().postDataJSON()).toMatchObject(entry==="general"?{mode:"general"}:{emailId:"101"});body={success:true,pack:practice};}
    else if(path.endsWith("/resumes"))body={success:true,variants:[{id:variantId,name:"Front desk resume",isDefault:true}]};
    else if(path.endsWith("/stored-emails"))body=entry==="invitation"?{success:true,emails:[{id:"101",thread_id:"thread",company_name:"Example Health",position:"Receptionist",category:"Interviewed",date:new Date().toISOString()}]}:{success:true,emails:[]};
    else if(path.endsWith("/suggestions/states"))body={success:true,actions:[]};
    else if(path.endsWith("/followup-needed"))body={success:true,suggestions:[]};
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto("/interview-prep");
  if(entry==="invitation")await page.getByRole("link",{name:"Prepare for this interview"}).click();else await page.getByRole("link",{name:"Practice for a role",exact:true}).click();
  await expect(page.getByLabel(entry==="general"?"Resume for this practice":"Resume for this interview")).toHaveValue(variantId);
  if(entry==="general")await expect(page.getByRole("link",{name:"Read interview messages in Gmail"})).toHaveCount(0);
  await page.getByLabel("Posting for this role").fill(posting+" "+qualification);await page.getByLabel("Responsibilities or requirements to practice").fill(focus+"\n"+qualification);
  await page.getByRole("button",{name:"Build my practice",exact:true}).click();await expect(page.getByRole("region",{name:"Interview practice",exact:true})).toBeFocused();expect(built).toBe(true);
  await page.getByLabel("What I did",{exact:true}).fill("My first truthful example.");await page.getByRole("button",{name:"Practice topic 2",exact:true}).click();await expect(page.getByLabel("What I did",{exact:true})).toHaveCount(0);
  await page.getByLabel("My current status").fill("Not issued yet; pending.");await page.getByRole("button",{name:"Practice topic 1",exact:true}).click();await expect(page.getByLabel("What I did",{exact:true})).toHaveValue("My first truthful example.");
  await page.getByRole("button",{name:"Copy practice notes",exact:true}).click();const copied=await page.evaluate(()=>(window as unknown as {copied:string}).copied);expect(copied).toContain("My first truthful example.");expect(copied).toContain("Not issued yet; pending.");
  expect(await page.locator("textarea:visible").count()).toBe(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
  await page.getByText("Review source, change setup or enable tab recovery").click();await page.getByLabel(/Keep a recovery copy/).check();await page.reload();await expect(page.getByLabel("What I did",{exact:true})).toHaveValue("My first truthful example.");
  await expect(page.locator("#main-content")).toHaveCSS("opacity","1");
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`C:/dev/intrackt-project-root/.codex_tmp/interview-prep-ui-20261111/fixture-${entry}-${width}.png`,fullPage:true,animations:"disabled"});
});

test("a new customer with no resume has a clear setup action",async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    const body=path.endsWith("/interview-prep/context")?{success:true,source:{kind:"general",sourceVersion:source.sourceVersion,company:"",role:"",threadId:null,schedule:null,excerpts:[]}}:path.endsWith("/resumes")?{success:true,variants:[]}:path.endsWith("/stored-emails")?{success:true,emails:[]}:{success:true};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto("/interview-prep?practice=general");await expect(page.getByText("Add a readable resume before building your practice.")).toBeVisible();await expect(page.getByRole("button",{name:"Build my practice"})).toBeDisabled();await expect(page.getByRole("link",{name:"Manage resumes"})).toHaveAttribute("href","/resumes");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
