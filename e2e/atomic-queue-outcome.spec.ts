import { expect, test } from '@playwright/test';
const logicalKey='aaaaaaaaaaaaaaaa',dedupeKey='bbbbbbbbbbbbbbbb',actionReference='j1.31.42.'+'c'.repeat(64);
const task={id:'close-task',logicalKey,dedupeKey,actionReference,primaryEntityId:'stale:thread',threadId:'thread',emailId:31,applicationId:42,
  actionType:'cleanup',legacyActionType:'close_stale_interview',actionCategory:'system',source:'strategy_pattern',queueSource:'stale',
  intent:'CLOSE_STALE_ROLE',intentLabel:'Close stale role',status:'open',effectiveStatus:'open',evidenceVersion:'v1',effortMinutes:5,
  urgencyLevel:'medium',confidenceLevel:'moderate',title:'Close the quiet Coordinator role',company:'Example Health',roleTitle:'Coordinator',
  whyNow:'This role has been quiet since your last exchange.',targetOutcome:'Clear this role from active focus.',createdAt:'2026-05-02T00:00:00Z',
  draftEligible:false,playbook:['Check the conversation for a newer reply.'],sourceLabel:'Ghosting risk',stageLabel:'Ghosting',routeHref:'/next-actions',routeLabel:'Open queue'};
for(const width of [320,1280]) test(`atomic close-out retries its exact reference and never splits writes at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000}); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let attempts=0,saved=false;const requests:unknown[]=[];const prohibited:string[]=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let status=200;let body:unknown={success:true};
    if(path.endsWith('/suggestions/queue'))body={success:true,queue:{doToday:saved?[]:[task],thisWeek:[],later:[],blocked:[],dismissed:[],expired:[],done:[],resolvedActions:saved?[]:[task]}};
    else if(path.endsWith('/queue/actions/close')){
      requests.push(route.request().postDataJSON());attempts++;
      if(attempts===1){status=503;body={success:false,code:'QUEUE_OUTCOME_UNAVAILABLE',error:'The save could not be confirmed. Retry this same task to check whether it saved.'};}
      else{saved=true;body={success:true,state:'completed',logicalKey,dedupeKey,replayed:true,recorded:true,application:{id:42,user_closed_reason:'No response'}};}
    }else if(path.endsWith('/queue/actions/complete')||path.includes('/applications/')&&path.endsWith('/close'))prohibited.push(path);
    else if(path.endsWith('/stored-emails'))body={success:true,emails:[]};
    else if(path.endsWith('/suggestions/states'))body={success:true,actions:[]};
    else if(path.endsWith('/followup-needed'))body={success:true,suggestions:[]};
    else if(path.endsWith('/apply-gate/history'))body={success:true,history:[]};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/next-actions');const close=page.getByRole('button',{name:'Close it out'});
  await expect(close).toBeVisible();
  const card=page.locator('article').filter({hasText:task.title});await expect(card.getByRole('button',{name:'Mark done'})).toHaveCount(0);
  await close.click();await expect(page.getByText(/save could not be confirmed/)).toBeVisible();await expect(close).toBeEnabled();
  await close.click();await expect(page.getByText('Application closed and removed from active focus.')).toBeVisible();
  await expect(close).toHaveCount(0);expect(requests).toEqual([{logicalKey,dedupeKey,actionReference},{logicalKey,dedupeKey,actionReference}]);
  expect(prohibited).toEqual([]);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
