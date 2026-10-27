import {expect,test} from '@playwright/test';

for(const width of [320,1280])test(`Resume discovery checks another batch before claiming no matches at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const preferences={resumeId:id,resumeMode:'chosen',roleMode:'resume',roles:[],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
 let release:()=>void,continuation=false;
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const catalog={revision:'catalog',capturedAt:'2026-10-24',stale:false,scope:'Test inventory.',sourcesAttempted:2,sourcesSuccessful:2,sourcesFailed:0,sourcesLimited:0};
 const job={key:'alternate',dedupeKey:'body',title:'Quality Assurance Automation Specialist',company:'Example employer',location:'US - Remote',url:'https://jobs.example.test/alternate',publishedAt:'2026-10-23',lastCheckedAt:'2026-10-24',dateBasis:'first_published',decision:'supported',window:'recent',reasons:['Python requirement has supporting resume evidence.'],requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Built Python test automation.'}]};
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  let body:unknown={success:true};
  if(path==='/api/resumes')body={success:true,variants:[{id,name:'Evidence resume',isDefault:true}]};
  if(path==='/api/jobs/preferences')body={success:true,preferences,version:2,setupRequired:null,resume:{id,name:'Evidence resume',fingerprint:'fp'}};
  if(path==='/api/jobs/feed'){
   const second=url.searchParams.get('cursor')==='next';
   if(second){continuation=true;await new Promise<void>(resolve=>{release=resolve;});}
   body={success:true,version:2,resume:{id,name:'Evidence resume',fingerprint:'fp'},catalog,matchingMode:'resume_discovery',counts:{recent:second?1:0,review:0,older:0,excluded:0},recent:second?[job]:[],review:[],older:[],excluded:[],discovery:{asOf:'2026-10-24',scannedParts:second?2:1,totalParts:2,complete:second,nextCursor:second?null:'next'}};
  }
  if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByText('Resume-driven discovery · No title filter')).toBeVisible();
 await expect.poll(()=>continuation).toBe(true);
 await expect(page.getByText(/1 of 2 catalog batches checked/)).toBeVisible();
 await expect(page.getByText('No resume-supported matches in this collection')).toHaveCount(0);
 await expect(page.getByText('Discovery is still incomplete')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('discovery-progress.png'),fullPage:true});
 release();
 await expect(page.getByRole('heading',{name:job.title})).toBeVisible();
 await expect(page.getByRole('button',{name:'Matches (1)'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText(/catalog batches checked/)).toHaveCount(0);
 await page.getByRole('button',{name:'Adjust feed'}).click();
 await expect(page.getByRole('checkbox',{name:'Limit discovery to target titles'})).not.toBeChecked();
 await page.getByRole('checkbox',{name:'Limit discovery to target titles'}).check();
 await expect(page.getByRole('textbox',{name:/Target job titles/})).toHaveValue('');
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('discovery-target-override-blank.png'),fullPage:true});
});

test('a failed continuation keeps partial matches and explains that discovery paused',async({page})=>{
 const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const preferences={resumeId:id,resumeMode:'chosen',roleMode:'resume',roles:[],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
 const job={key:'fit',dedupeKey:'fit',title:'QA Automation Specialist',company:'Example',location:'US - Remote',url:'https://jobs.example.test/fit',publishedAt:'2026-10-23',lastCheckedAt:'2026-10-24',dateBasis:'first_published',decision:'supported',window:'recent',reasons:['Python has evidence.'],requirements:[]};
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());let body:unknown={success:true};
  if(url.pathname==='/api/resumes')body={success:true,variants:[{id,name:'Resume',isDefault:true}]};
  if(url.pathname==='/api/jobs/preferences')body={success:true,preferences,version:2,resume:{id,name:'Resume',fingerprint:'fp'},setupRequired:null};
  if(url.pathname==='/api/jobs/feed'){
   if(url.searchParams.has('cursor')){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'A catalog object is temporarily unavailable.'})});return;}
   body={success:true,version:2,resume:{id,name:'Resume',fingerprint:'fp'},matchingMode:'resume_discovery',catalog:{revision:'catalog',capturedAt:'2026-10-24',scope:'Fixture.',stale:false},counts:{recent:1,review:0,older:0,excluded:0},recent:[job],review:[],older:[],excluded:[],discovery:{asOf:'2026-10-24',scannedParts:1,totalParts:2,complete:false,nextCursor:'next'}};
  }
  if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByRole('heading',{name:job.title})).toBeVisible();
 await expect(page.getByText(/Discovery paused: 1 of 2/)).toBeVisible({timeout:20000});
 await expect(page.getByText('Updates could not be loaded')).toBeVisible();
});
