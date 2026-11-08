import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import type {JobFeed,JobApplicationStatuses,JobPreferences} from '../src/lib/jobFeed';

// Supply a local, private service-generated diagnostic fixture. This file must
// never contain a customer's resume, account identifiers or application history.
const path=process.env.JOB_FEED_CURRENT_FIXTURE;
test.skip(!path,'Requires a private current-matcher replay fixture.');
for(const width of [320,1280])test(`Current matcher evidence and prior-application uncertainty render at ${width}px`,async({page},testInfo)=>{
 const fixture=JSON.parse(readFileSync(path!,'utf8')) as {preferences:JobPreferences;version:number;resume:JobFeed['resume'];feed:JobFeed;statuses:JobApplicationStatuses};
 expect(fixture.feed.catalog.scope).toContain('Diagnostic replay');
 expect(fixture.feed.counts).toEqual({recent:1,review:4,older:0,excluded:0});
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const writes:string[]=[];
 // No external analytics/font/customer requests during a private fixture run.
 await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 await page.route('**/api/**',async route=>{
  const request=route.request(),pathname=new URL(request.url()).pathname;
  // The shell's web-open analytics event is intercepted too. It is unrelated
  // to a preference/application mutation and never reaches a real service.
  if(pathname==='/api/activity')expect(request.postDataJSON()).toEqual({event:'web_open'});
  else if(!['GET','HEAD'].includes(request.method())&&pathname!=='/api/jobs/application-status')writes.push(`${request.method()} ${pathname}`);
  let body:unknown={success:true};
  if(pathname==='/api/resumes')body={variants:[{...fixture.resume,isDefault:true}]};
  if(pathname==='/api/jobs/preferences')body={preferences:fixture.preferences,version:fixture.version,resume:fixture.resume};
  if(pathname==='/api/jobs/feed')body=fixture.feed;
  if(pathname==='/api/jobs/application-status')body=fixture.statuses;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');
 await expect(page.getByRole('button',{name:'Matches (1)',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Needs review (4)',exact:true})).toBeVisible();
 const supported=fixture.feed.recent[0];
 const article=page.getByRole('article').filter({has:page.getByRole('heading',{name:supported.title,exact:true})});
 await expect(article.getByText('Resume-supported',{exact:true})).toBeVisible();
 await article.getByText('Posting requirements and resume evidence',{exact:true}).click();
 await expect(article.locator('blockquote').first()).toBeVisible();
 await expect(article.getByText(/Resume: /).first()).toBeVisible();
 await page.getByText('Job sources and coverage',{exact:true}).click();
 await expect(page.getByText(/Five rechecked recommendations only/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('current-supported.private.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Needs review (4)',exact:true}).click();
 const previous=fixture.feed.review.find(job=>job.key.startsWith('greenhouse:affirm:'))!;
 const previousArticle=page.getByRole('article').filter({has:page.getByRole('heading',{name:previous.title,exact:true})});
 await expect(previousArticle.getByText(/A similar application is in your tracker/)).toBeVisible();
 await expect(previousArticle.getByText(/^Already applied/)).toHaveCount(0);
 await expect(previousArticle.getByRole('link',{name:'Read employer posting'})).toHaveAttribute('href',previous.url);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(writes).toEqual([]);expect(errors).toEqual([]);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('current-review.private.png'),fullPage:true,animations:'disabled'});
});
