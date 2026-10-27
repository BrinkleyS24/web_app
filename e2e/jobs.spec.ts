import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) test(`Jobs setup, strict results and review sections work at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:1000});
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let preferences: any = {resumeId:id,resumeMode:'default',roleMode:'resume',roles:['QA Engineer','SDET'],workStyles:[],locations:[],remoteCountry:'',remoteRegion:''}, version = 0;
  const row = {key:'example:qa',title:'QA Engineer',company:'Example employer',location:'London, United Kingdom - Remote',url:'https://jobs.example.test/qa',publishedAt:'2026-10-20',lastCheckedAt:'2026-10-21',dateBasis:'first_published',decision:'review',window:'recent',reasons:['Confirm whether the equivalent-experience route accepts your bootcamp and QA experience.'],requirements:[{label:'Education or equivalent experience',quote:"Bachelor's degree or equivalent practical experience.",status:'unclear',evidence:'Coding bootcamp certificate; B.S. expected 2028.'}]};
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = {success:true};
    if (path === '/api/resumes') body = {success:true,variants:[{id,name:'QA resume',isDefault:true,charCount:300,createdAt:'2026-10-21'}]};
    else if (path === '/api/jobs/preferences') {
      if (request.method() === 'PUT') { const payload = request.postDataJSON(); expect(payload.expectedVersion).toBe(version); preferences = payload.preferences; version++; }
      body = {success:true,preferences,version,setupRequired:preferences.workStyles.length ? null : 'location',resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)}};
    } else if (path === '/api/jobs/feed') body = {success:true,version,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)},matchingMode:'resume_discovery',catalog:{revision:'catalog',capturedAt:'2026-10-21',stale:false,scope:'Limited public employer boards; coverage varies by profession and region.',sourcesAttempted:40,sourcesSuccessful:38,sourcesFailed:2,sourcesLimited:8},counts:{recent:0,review:1,older:1,excluded:0},recent:[],review:[row],older:[{...row,key:'older',title:'SDET',publishedAt:'2026-09-15',window:'older',availability:'accepting_applications'}],excluded:[]};
    if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/jobs');
  await expect(page.getByRole('heading',{name:'Jobs picked for you'})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Remote',exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Matching resume')).toHaveValue('default');
  await expect(page.getByLabel('Target job titles')).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Remote',exact:true}).check();
  await page.getByLabel('Country you would work remotely from').selectOption({label:'United Kingdom'});
  await page.getByRole('button',{name:'Start my feed'}).click();
  await expect(page.getByRole('heading',{name:'QA Engineer',exact:true})).toBeVisible();
  expect(preferences).toMatchObject({resumeId:id,roles:['QA Engineer','SDET'],remoteCountry:'GB',workStyles:['remote']});
  await page.getByRole('button',{name:'Matches (0)'}).click();
  await expect(page.getByText('No resume-supported matches in this collection')).toBeVisible();
  await page.getByRole('button',{name:'Needs review (1)'}).click();
  await page.getByText('Posting requirements and resume evidence').click();
  await expect(page.getByText("Bachelor's degree or equivalent practical experience.")).toBeVisible();
  await page.getByRole('button',{name:'Older (1)'}).click();
  await expect(page.getByRole('heading',{name:'SDET',exact:true})).toBeVisible();
  await expect(page.getByText('31–60 days old · Employer was accepting applications when checked.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Read employer posting'})).toHaveAttribute('target','_blank');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  expect(errors).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0,0); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({path:`C:/dev/intrackt-project-root/.codex_tmp/job-feed-auto/jobs-${width}.png`,fullPage:true});
  await page.reload();
  await page.getByRole('button',{name:'Adjust feed'}).click();
  await expect(page.getByLabel('Matching resume')).toHaveValue('default');
  await expect(page.getByLabel('Country you would work remotely from')).toHaveValue('GB');
});

for (const width of [320,1280]) test(`Jobs uses ordinary location fields and preserves reading during updates at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let preferences:any={resumeId:id,resumeMode:'default',roleMode:'resume',roles:['QA Engineer'],workStyles:[],locations:[],remoteCountry:'',remoteRegion:''};
  let version=0, feedCalls=0, release:()=>void;
  const job={key:'example:qa',title:'QA Engineer',company:'Example employer',location:'New York, NY, US - Hybrid',url:'https://jobs.example.test/qa',publishedAt:'2026-10-20',lastCheckedAt:'2026-10-21',dateBasis:'first_published',decision:'supported',window:'recent',reasons:['Python requirement has supporting resume evidence.'],requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Developed Python automation.'}]};
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let body:any={success:true};
    if(path==='/api/resumes') body={success:true,variants:[{id,name:'QA resume',isDefault:true,charCount:300,createdAt:'2026-10-21'}]};
    if(path==='/api/jobs/preferences') {
      if(request.method()==='PUT'){preferences=request.postDataJSON().preferences;version++;}
      body={success:true,preferences,version,setupRequired:preferences.workStyles.length?null:'location',resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)}};
    }
    if(path==='/api/jobs/feed') {
      feedCalls++;
      if(feedCalls>1) await new Promise<void>(resolve=>{release=resolve;});
      body={success:true,version,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)},matchingMode:'resume_discovery',catalog:{revision:'fixture',capturedAt:'2026-10-21',stale:false,scope:'Limited public employer boards.',sourcesAttempted:40,sourcesSuccessful:40,sourcesFailed:0,sourcesLimited:23},counts:{recent:1,review:0,older:0,excluded:0},recent:[job],review:[],older:[],excluded:[]};
    }
    if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/jobs');
  await page.getByRole('checkbox',{name:'Hybrid',exact:true}).check();
  await page.getByLabel('City',{exact:true}).fill('New York');
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption({label:'United States'});
  await page.getByRole('combobox',{name:'State or region (optional)',exact:true}).selectOption({label:'New York'});
  await page.getByRole('button',{name:'Start my feed'}).click();
  await expect(page.getByRole('heading',{name:'QA Engineer',exact:true})).toBeVisible();
  expect(preferences.locations).toEqual([{city:'New York',region:'NY',country:'US'}]);
  await page.locator('article summary').click();
  await expect(page.locator('article details')).toHaveAttribute('open','');
  await page.getByRole('button',{name:'Check for updates'}).click();
  await expect(page.getByText('Checking for updates…')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article details')).toHaveAttribute('open','');
  await expect.poll(()=>Boolean(release)).toBe(true);
  release();
  await expect(page.getByText('Checking for updates…')).toHaveCount(0);
  await expect(page.locator('article details')).toHaveAttribute('open','');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});

for(const width of [320,1280]) test(`Jobs explains interview history and separates unsupported roles at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const preferences={resumeId:id,resumeMode:'default',roleMode:'resume',roles:['QA Engineer'],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
  const job={key:'qa',title:'QA Engineer',company:'Example employer',location:'US - Remote',url:'https://jobs.example.test/qa',publishedAt:'2026-10-20',lastCheckedAt:'2026-10-21',dateBasis:'first_published',decision:'supported',window:'recent',reasons:['Python has supporting resume evidence.'],requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Developed Python automation.'}],interviewHistory:{similarRoles:2,roleFamily:'QA and testing'}};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body:any={success:true};
    if(path==='/api/resumes') body={success:true,variants:[{id,name:'QA resume',isDefault:true,charCount:300,createdAt:'2026-10-21'}]};
    if(path==='/api/jobs/preferences') body={success:true,preferences,version:1,setupRequired:null,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)}};
    if(path==='/api/jobs/feed') body={success:true,version:1,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)},matchingMode:'resume_discovery',catalog:{revision:'fixture',capturedAt:'2026-10-21',stale:false,scope:'Limited public employer boards.',sourcesAttempted:40,sourcesSuccessful:40,sourcesFailed:0,sourcesLimited:23},personalization:{status:'available',interviewedRoles:2,relevantInterviewedRoles:2,roleFamilies:[{similarRoles:2,roleFamily:'QA and testing'}]},counts:{recent:1,review:0,older:0,excluded:1},recent:[job],review:[],older:[],excluded:[{...job,key:'staff',title:'Staff Software Engineer',decision:'excluded',exclusionKind:'seniority',reasons:['The selected resume does not establish the advertised seniority.'],interviewHistory:undefined}]};
    if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/jobs');
  await expect(page.getByText('Your history marks 2 similar QA and testing roles as Interviewed or Offer.')).toBeVisible();
  await expect(page.getByText('Your history marks 2 roles in this focus as Interviewed or Offer. These tracked stages guide ordering; they do not verify qualifications or which resume you submitted.')).toBeVisible();
  await page.getByRole('button',{name:'Needs review (0)'}).click();
  await expect(page.getByText('No recent jobs waiting for review')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'Excluded (1)'}).click();
  await expect(page.getByText('Qualification not established',{exact:true})).toBeVisible();
  await expect(page.getByText('Your history marks 2 similar QA and testing roles as Interviewed or Offer.')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
