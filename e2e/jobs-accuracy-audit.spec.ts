import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Optional private replay. The fixture is produced by the real matching service,
// not a manually invented positive result. No private evidence is checked in.
const fixtureRoot=process.env.JOB_FEED_AUDIT_FIXTURE;
for(const width of [320,1280])test(`frozen owner audit renders truthful exclusions at ${width}px`,async({page})=>{
 test.skip(!fixtureRoot,'Set JOB_FEED_AUDIT_FIXTURE to the local audit folder.');
 const input=JSON.parse(readFileSync(path.join(fixtureRoot!,'input.private.json'),'utf8'));
 const feed=JSON.parse(readFileSync(path.join(fixtureRoot!,'owner-feed.private.json'),'utf8'));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:1000});
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname!=='/api/jobs/application-status'&&/^\/api\/(?:jobs|resumes)(?:\/|$)/.test(url.pathname))expect(request.method()).toBe('GET');
  let body:any={success:true};
  if(url.pathname==='/api/jobs/preferences')body={success:true,preferences:input.preferences,version:feed.version,setupRequired:null,resume:feed.resume};
  if(url.pathname==='/api/resumes')body={success:true,variants:[{...feed.resume,isDefault:true,charCount:input.document.text.length,createdAt:'2026-10-22'}]};
  if(url.pathname==='/api/jobs/feed')body={...feed,matchingMode:input.preferences.roleMode==='custom'?'custom_titles':'resume_discovery'};
  if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await expect(page.getByRole('button',{name:`Excluded (${feed.counts.excluded})`})).toBeVisible();
  { const summary=page.getByText(/^Other results/); await expect(summary).toBeVisible(); if(!await summary.evaluate(e=>(e as HTMLElement).closest('details')!.open))await summary.click(); }
 await page.getByRole('button',{name:`Excluded (${feed.counts.excluded})`}).click();
 await expect(page.getByText(/Missing evidence does not mean you lack the qualification/)).toBeVisible();
 await expect(page.getByText(new RegExp(`${feed.exclusionSummary.requirementBlockers} requirement blockers`))).toBeVisible();
 expect(await page.locator('article').count()).toBe(feed.excluded.length);
 // Generated ledger labels no longer masquerade as employer quotations. Pick
 // a card with an actual source quote rather than assuming the first has one.
 const quotedIndex=feed.excluded.findIndex((row:any)=>row.requirements.some((r:any)=>r.quote));
 expect(quotedIndex).toBeGreaterThanOrEqual(0);
 const quotedCard=page.locator('article').nth(quotedIndex);
 await quotedCard.getByText('Posting requirements and resume evidence',{exact:true}).click();
 await expect(quotedCard.locator('blockquote').first()).toBeVisible();
 await expect(quotedCard.locator('blockquote').first()).toHaveText(feed.excluded[quotedIndex].requirements.find((r:any)=>r.quote).quote);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 expect(errors).toEqual([]);
 await page.screenshot({path:path.join(fixtureRoot!,`owner-ui-${width}.private.png`),fullPage:false});
});
