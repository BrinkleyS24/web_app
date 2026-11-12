import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
const path=process.env.JOB_FEED_BACKGROUND_FIXTURE;
test.skip(!path,'Requires actual matcher/AES/PostgreSQL generated fictional fixture.');
for(const width of [320,1280])test(`Background preparation survives reload and automatically presents completed evidence at ${width}px`,async({page},testInfo)=>{
 const fixture=JSON.parse(readFileSync(path!,'utf8'));
 expect(fixture.feed.generation.state).toBe('ready');expect(fixture.feed.counts.recent).toBe(1);
 // Replay at the captured matcher time; expiry behavior has separate live-clock cases.
 await page.clock.setFixedTime(new Date(fixture.feed.generation.asOf));
 let ready=false,feedReads=0,statusReads=0;const errors:string[]=[],writes:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});
 await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 await page.route('**/api/**',async route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;let body:unknown={success:true},status=200;
  if(pathname==='/api/resumes')body={variants:[{...fixture.resume,isDefault:true}]};
  if(pathname==='/api/jobs/preferences')body={success:true,preferences:fixture.preferences,version:fixture.version,resume:fixture.resume,backgroundGeneration:true};
  if(pathname==='/api/jobs/feed'){
   feedReads++;expect(new URL(req.url()).searchParams.get('background')).toBe('1');
   if(ready)body=fixture.feed;else {status=202;body={success:true,version:fixture.version,resume:fixture.resume,catalog:fixture.feed.catalog,matchingMode:'resume_discovery',generationPending:true,generation:{state:'running'}};}
  }
  if(pathname==='/api/jobs/application-status'){statusReads++;body=fixture.statuses;}
  if(!['GET','HEAD'].includes(req.method())&&!['/api/activity','/api/jobs/application-status'].includes(pathname))writes.push(pathname);
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');await expect(page.getByText('Preparing your matches',{exact:true})).toBeVisible();
 await expect(page.getByText(/You can leave this page/)).toBeVisible();await expect(page.getByRole('button',{name:'Matches (0)',exact:true})).toHaveCount(0);
 expect(statusReads).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('preparing.png'),fullPage:true,animations:'disabled'});
 await page.reload();await expect(page.getByText('Preparing your matches',{exact:true})).toBeVisible();ready=true;
 await expect(page.getByRole('button',{name:'Matches (1)',exact:true})).toBeVisible({timeout:10000});
 await page.getByText('Job sources and coverage',{exact:true}).click();
 await expect(page.getByText(/Matches checked/)).toBeVisible();await expect(page.getByText(/A similar application is in your tracker/)).toBeVisible();
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await expect(page.getByRole('button',{name:'Already applied (0)',exact:true})).toBeVisible();
 await page.getByText('Posting requirements and resume evidence',{exact:true}).click();
 await expect(page.locator('blockquote').first()).toBeVisible();await expect(page.getByText('Preparing your matches',{exact:true})).toHaveCount(0);
 expect(feedReads).toBeGreaterThanOrEqual(3);expect(statusReads).toBeGreaterThan(0);expect(writes).toEqual([]);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 await page.screenshot({path:testInfo.outputPath('ready.png'),fullPage:true,animations:'disabled'});
});
