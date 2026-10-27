import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Actual matching-service output from the fixed catalog and original PDF.
// All account APIs are intercepted; no applications or preferences are written.
const fixtureRoot=process.env.JOB_FEED_CONCEPT_FIXTURE;
for(const width of [320,1280])test(`multiple employers show bounded review on arrival at ${width}px`,async({page})=>{
 test.skip(!fixtureRoot,'Set JOB_FEED_CONCEPT_FIXTURE to a real local matcher replay.');
 const input=JSON.parse(readFileSync(path.join(fixtureRoot!,'input.private.json'),'utf8'));
 const feed=JSON.parse(readFileSync(path.join(fixtureRoot!,'owner-feed.private.json'),'utf8'));
 expect(feed.recent).toHaveLength(0);
 expect(feed.review.length).toBeGreaterThan(1);
 expect(new Set(feed.review.map((r:any)=>r.company)).size).toBe(feed.review.length);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:1000});
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname!=='/api/jobs/application-status'&&/^\/api\/(?:jobs|resumes)(?:\/|$)/.test(url.pathname))expect(route.request().method()).toBe('GET');
  let body:any={success:true};
  if(url.pathname==='/api/jobs/preferences')body={success:true,preferences:input.preferences,version:feed.version,setupRequired:null,resume:feed.resume};
  if(url.pathname==='/api/resumes')body={success:true,variants:[{...feed.resume,isDefault:true,charCount:input.document.text.length,createdAt:'2026-10-22'}]};
  if(url.pathname==='/api/jobs/feed')body={...feed,matchingMode:input.preferences.roleMode==='custom'?'custom_titles':'resume_discovery'};
  if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 // No tab selection or search is needed to see the available opportunities.
 await expect(page.locator('article')).toHaveCount(feed.review.length);
 await page.screenshot({path:path.join(fixtureRoot!,`concept-arrival-${width}.private.png`),fullPage:false});
 for(const row of feed.review){
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:row.title,exact:true})});
  await expect(card).toBeVisible();
  await expect(card.getByText('Needs review',{exact:true})).toBeVisible();
  expect(row.decision).toBe('review');
  await expect(card.getByRole('link',{name:'Read employer posting'})).toHaveAttribute('href',row.url);
  await card.getByText(`All fit notes (${row.reasons.length})`,{exact:true}).click();
  for(const reason of row.reasons)await expect(card.getByText(reason,{exact:true}).last()).toBeVisible();
  await card.getByText('Posting requirements and resume evidence',{exact:true}).click();
  const question=row.requirements.find((r:any)=>r.quote&&r.status==='unclear');
  expect(question).toBeTruthy();
  await expect(card.getByText(`${question.label} \u00b7 Needs confirmation`,{exact:true})).toBeVisible();
  if(question.evidence)await expect(card.getByText(`Resume: ${question.evidence}`,{exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:path.join(fixtureRoot!,`concept-ui-${width}.private.png`),fullPage:true});
});
