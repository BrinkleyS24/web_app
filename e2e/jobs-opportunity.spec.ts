import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Actual matcher replay, original PDF, full frozen employer posting. Account
// APIs are intercepted; this does not write resumes, applications or preferences.
const fixtureRoot=process.env.JOB_FEED_OPPORTUNITY_FIXTURE;
for(const width of [320,1280])test(`credible opportunity keeps its uncertainty visible at ${width}px`,async({page})=>{
 test.skip(!fixtureRoot,'Set JOB_FEED_OPPORTUNITY_FIXTURE to the local replay folder.');
 const input=JSON.parse(readFileSync(path.join(fixtureRoot!,'input.private.json'),'utf8'));
 const feed=JSON.parse(readFileSync(path.join(fixtureRoot!,'owner-feed.private.json'),'utf8'));
 const row=feed.review.find((r:any)=>r.key==='greenhouse:affirm:8017340003');
 expect(row?.decision).toBe('review');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
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
 await page.getByRole('button',{name:`Needs review (${feed.counts.review})`}).click();
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:row.title,exact:true})});
 await expect(card).toBeVisible();
 await expect(card.getByText('Needs review',{exact:true})).toBeVisible();
 expect(row.interviewHistory).toEqual({similarRoles:7,roleFamily:'software engineering'});
 await expect(card.getByText('Your history marks 7 similar software engineering roles as Interviewed or Offer.',{exact:true})).toBeVisible();
 await expect(card.getByRole('link',{name:'Read employer posting'})).toHaveAttribute('href',row.url);
 await card.getByText(`All fit notes (${row.reasons.length})`,{exact:true}).click();
 await expect(card.getByText(/code-review exposure/)).toBeVisible();
 await expect(card.getByText(/Confirm the complete education or equivalent-experience route/)).toBeVisible();
 await card.getByText('Posting requirements and resume evidence',{exact:true}).click();
 const js=row.requirements.find((r:any)=>r.quote?.includes('Javascript/Typescript'));
 const backend=row.requirements.find((r:any)=>r.quote?.includes('backend systems at scale'));
 const degree=row.requirements.find((r:any)=>r.quote?.includes('equivalent practical experience'));
 expect(js.status).toBe('satisfied');expect(backend.status).toBe('unclear');expect(degree.status).toBe('unclear');
 await expect(card.getByText(`${js.label} · Evidence found`,{exact:true})).toBeVisible();
 await expect(card.getByText(`${backend.label} · Needs confirmation`,{exact:true})).toBeVisible();
 await expect(card.getByText(`${degree.quote} · Needs confirmation`,{exact:true})).toBeVisible();
 await expect(card.getByText(`Resume: ${backend.evidence}`,{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:path.join(fixtureRoot!,`opportunity-ui-${width}.private.png`),fullPage:true});
});
