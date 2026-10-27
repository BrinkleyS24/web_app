import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Uses actual matching-service output for two real postings with an explicitly
// separate, user-confirmed diagnostic profile. All account APIs are intercepted.
const fixtureRoot=process.env.JOB_FEED_EVIDENCE_FIXTURE;
for(const width of [320,1280])test(`supported clauses and partial evidence stay distinct at ${width}px`,async({page})=>{
 test.skip(!fixtureRoot,'Set JOB_FEED_EVIDENCE_FIXTURE to the local evidence-fix artifact folder.');
 const {input,feed}=JSON.parse(readFileSync(path.join(fixtureRoot!,'confirmed-case-ui.private.json'),'utf8'));
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
 await page.getByRole('button',{name:`Excluded (${feed.counts.excluded})`}).click();
 const impiricus=feed.excluded.find((r:any)=>r.key.includes('impiricus'));
 const arbiter=feed.excluded.find((r:any)=>r.key.includes('arbiter-ai'));
 const cardFor=(row:any)=>page.locator('article').filter({has:page.getByRole('heading',{name:row.title,exact:true})});
 const impCard=cardFor(impiricus);await impCard.getByText('Posting requirements and resume evidence',{exact:true}).click();
 for(const phrase of ['Strong understanding of Agile methodologies and CI/CD pipelines.','Basic SQL skills for database validation and troubleshooting.']){
  expect(impiricus.requirements.find((r:any)=>r.quote===phrase).status).toBe('satisfied');
  await expect(impCard.getByText(`${phrase} · Evidence found`,{exact:true})).toBeVisible();
 }
 const arbCard=cardFor(arbiter);await arbCard.getByText('Posting requirements and resume evidence',{exact:true}).click();
 const partial=arbiter.requirements.find((r:any)=>r.quote?.includes('Experience writing test plans and bug reports'));
 expect(partial.status).toBe('unclear');expect(partial.evidence).toContain('Wrote test plans');
 await expect(arbCard.getByText(`${partial.label} · Not established`,{exact:true})).toBeVisible();
 await expect(arbCard.getByText(`Resume: ${partial.evidence}`,{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:path.join(fixtureRoot!,`clause-ui-${width}.private.png`),fullPage:false});
});
