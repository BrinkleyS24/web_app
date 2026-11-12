import {expect,test} from '@playwright/test';

const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const preferences={resumeId:id,resumeMode:'default',roleMode:'resume',roles:[],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
const job=(key:string,title:string)=>({key,dedupeKey:key,title,company:'Example employer',location:'US - Remote',url:`https://jobs.example.test/${key}`,publishedAt:'2026-10-23',lastCheckedAt:'2026-10-24',dateBasis:'first_published',decision:'supported',window:'recent',reasons:['Python has supporting resume evidence.'],requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Built Python test automation.'}]});
const catalog={revision:'application-fixture',capturedAt:'2026-10-24',stale:false,scope:'Test inventory.',sourcesAttempted:1,sourcesSuccessful:1,sourcesFailed:0,sourcesLimited:0};
const resume={id,name:'Default resume',fingerprint:'fp'};

for(const width of [320,1280])test(`tracked submissions are separate and history refresh does not repeat discovery at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const rows=[job('applied','QA Engineer'),job('possible','Automation Engineer'),job('fresh','Software Engineer')];
 let feedReads=0,statusReads=0,justApplied=false;
 const writes:string[]=[],errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()!=='GET'&&path!=='/api/jobs/application-status'&&/^\/api\/(?:jobs\/|applications(?:\/|$)|apply-gate(?:\/|$))/.test(path))writes.push(`${request.method()} ${path}`);
  let body:unknown={success:true};
  if(path==='/api/resumes')body={success:true,variants:[{id,name:resume.name,isDefault:true}]};
  if(path==='/api/jobs/preferences')body={success:true,preferences,version:2,setupRequired:null,resume};
  if(path==='/api/jobs/feed'){
   feedReads++;
   body={success:true,version:2,resume,matchingMode:'resume_discovery',catalog,counts:{recent:3,review:0,older:0,excluded:0},recent:rows,review:[],older:[],excluded:[],eligibleCandidates:rows};
  }
  if(path==='/api/jobs/application-status'){
   statusReads++;
   body={success:true,status:'available',checkedAt:'2026-10-24',matches:request.postDataJSON().jobs.map((row:{key:string})=>({key:row.key,state:row.key==='applied'||row.key==='fresh'&&justApplied?'confirmed':row.key==='possible'?'possible':'none_known',source:'manual',applicationId:row.key,appliedAt:row.key==='possible'?null:'2026-10-23',status:'applied'}))};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByRole('button',{name:'Matches (2)',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'QA Engineer',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Automation Engineer',exact:true})).toBeVisible();
 await expect(page.getByText(/A similar application is in your tracker/)).toBeVisible();
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await expect(page.getByRole('button',{name:'Already applied (1)',exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('fresh-and-possible.png'),fullPage:true});
 const previousStatusReads=statusReads;
 justApplied=true;
  { const summary=page.getByText('Job sources and coverage',{exact:true}); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await page.getByRole('button',{name:'Recheck applications',exact:true}).click();
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await expect(page.getByRole('button',{name:'Already applied (2)',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Matches (1)',exact:true})).toBeVisible();
 expect(statusReads).toBeGreaterThan(previousStatusReads);expect(feedReads).toBe(1);
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await page.getByRole('button',{name:'Already applied (2)',exact:true}).click();
 await expect(page.getByRole('heading',{name:'QA Engineer',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Software Engineer',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Open tracker'})).toHaveCount(2);
 expect(writes).toEqual([]);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('already-applied.png'),fullPage:true});
});

test('history outage keeps matches visible and can recover without another qualification scan',async({page})=>{
 const row=job('fit','QA Automation Specialist');let unavailable=true,feedReads=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let body:unknown={success:true};
  if(path==='/api/resumes')body={success:true,variants:[{id,name:resume.name,isDefault:true}]};
  if(path==='/api/jobs/preferences')body={success:true,preferences,version:2,setupRequired:null,resume};
  if(path==='/api/jobs/feed'){feedReads++;body={success:true,version:2,resume,matchingMode:'resume_discovery',catalog,counts:{recent:1,review:0,older:0,excluded:0},recent:[row],review:[],older:[],excluded:[],eligibleCandidates:[row]};}
  if(path==='/api/jobs/application-status'){
   if(unavailable){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({status:'unavailable',error:'Application history unavailable.'})});return;}
   body={success:true,status:'available',checkedAt:'2026-10-24',matches:[{key:row.key,state:'confirmed',source:'manual',status:'applied',appliedAt:'2026-10-23'}]};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByRole('heading',{name:row.title})).toBeVisible();
 await expect(page.getByText('Application history could not be checked. These results may include jobs you already applied to.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Matches (1)',exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('history-unavailable.png'),fullPage:true});
 unavailable=false;await page.getByRole('button',{name:'Retry application check',exact:true}).click();
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await expect(page.getByRole('button',{name:'Already applied (1)',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Matches (0)',exact:true})).toBeVisible();
 expect(feedReads).toBe(1);
});
