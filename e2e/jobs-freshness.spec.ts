import {expect,test} from '@playwright/test';

for(const width of [320,1280])test(`Collection expiry is not a qualification verdict and recovers at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let mode:'fresh'|'stale'|'recovered'='fresh',preferenceWrites=0;
 const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const preferences={resumeId:id,resumeMode:'default',roleMode:'resume',roles:[],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
 const job={key:'control',title:'Software Engineer Intern',company:'Example employer',location:'US - Remote',url:'https://jobs.example.test/control',publishedAt:new Date().toISOString(),lastCheckedAt:new Date().toISOString(),dateBasis:'first_published',decision:'review',window:'recent',reasons:['Confirm the completed coursework and its language.'],requirements:[{label:'REST API project experience',quote:'Project work involving REST APIs.',status:'satisfied',evidence:'Built Node.js REST APIs.'}]};
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/jobs/preferences'&&request.method()!=='GET')preferenceWrites++;
  if(path==='/api/jobs/feed'&&mode==='stale')return route.fulfill({status:503,headers:{'Retry-After':'60'},contentType:'application/json',body:JSON.stringify({error:'The collection expired.',code:'catalog_stale'})});
  let body:unknown={success:true};
  if(path==='/api/resumes')body={variants:[{id,name:'Original resume',isDefault:true}]};
  if(path==='/api/jobs/preferences')body={preferences,version:2,resume:{id,name:'Original resume',fingerprint:'fp'}};
  if(path==='/api/jobs/feed')body={version:2,resume:{id,name:'Original resume',fingerprint:'fp'},matchingMode:'resume_discovery',catalog:{revision:mode,capturedAt:new Date().toISOString(),stale:false,scope:'Controlled browser fixture.',sourcesAttempted:2,sourcesSuccessful:2,sourcesFailed:0,sourcesLimited:0},counts:{recent:0,review:1,older:0,excluded:0},recent:[],review:[job],older:[],excluded:[]};
  if(path==='/api/jobs/application-status')body={status:'available',checkedAt:new Date().toISOString(),matches:request.postDataJSON().jobs.map((j:{key:string})=>({key:j.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByRole('heading',{name:'Software Engineer Intern',exact:true})).toBeVisible();
 mode='stale';await page.getByRole('button',{name:'Check for updates'}).click();
 await expect(page.getByText('The job collection needs an update',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Job result sections')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Software Engineer Intern',exact:true})).toHaveCount(0);
 await expect(page.getByText('No resume-supported matches in this collection',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/This does not tell us whether jobs fit your resume/)).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('collection-expired.png'),fullPage:true});
 mode='recovered';await page.getByRole('button',{name:'Check for updates'}).click();
 await expect(page.getByRole('heading',{name:'Software Engineer Intern',exact:true})).toBeVisible();
 await expect(page.getByText('The job collection needs an update',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(preferenceWrites).toBe(0);expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('collection-recovered.png'),fullPage:true});
});
