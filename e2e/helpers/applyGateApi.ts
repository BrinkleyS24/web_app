import type {Page} from '@playwright/test';

// Shared read-only fixtures for current saved-resume/allowance dependencies.
// Individual tests register their analysis/action responses after this helper.
export async function mockApplyGateWorkspace(page:Page,text:string){
 // Keep optional analytics independent of customer workflow checks and offline.
 await page.route('https://cloud.umami.is/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 const id='11111111-1111-4111-8111-111111111111';
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  // Do not turn unrelated browser/extension telemetry into an application error.
  if(new URL(request.url()).origin!=='http://127.0.0.1:4010')return route.fallback();
  let body:unknown={success:true};
  const knownBackgroundPost=request.method()==='POST'&&['/api/user','/api/activity','/api/emails/stored-emails','/api/emails/followup-needed'].includes(path);
  if(!['GET','HEAD','OPTIONS'].includes(request.method())&&!knownBackgroundPost)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,error:'Unexpected write in the browser fixture: '+path})});
  if(path==='/api/resumes')body={success:true,variants:[{id,name:'Saved fixture resume',isDefault:true,charCount:text.length,createdAt:'2026-10-27T12:00:00Z'}]};
  else if(path==='/api/resumes/'+id)body={success:true,document:{id,name:'Saved fixture resume',text,fingerprint:'a'.repeat(64)}};
  else if(path==='/api/resumes/health')body={success:true,resumes:[]};
  else if(path==='/api/resumes/scoreboard')body={success:true,scoreboard:{minSample:5,perVariant:[]},recommendation:null,breakdown:{}};
  else if(path.endsWith('/apply-gate/allowance'))body={success:true,plan:'premium',unlimited:true};
  else if(path.endsWith('/apply-gate/history'))body={success:true,history:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
}
