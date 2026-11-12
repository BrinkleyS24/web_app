import { expect, test } from '@playwright/test';

const id='11111111-1111-4111-8111-111111111111';
const question='Production delivery has evidence; the employer’s unquantified scale expectation still needs confirmation.';
const generic='Communication and product judgment are assessed during interviews; they are not verified resume qualifications.';
const base={company:'Fictional Cedar',location:'US Remote',url:'https://jobs.example.test/software',publishedAt:'2026-11-10',lastCheckedAt:'2026-11-12',dateBasis:'first_published',window:'recent',provider:'fictional',availability:'accepting_applications',reasons:['Core delivery requirements have supporting resume passages.'],requirements:[]};
const recent={...base,key:'supported',title:'Software Engineer',decision:'supported'};
const review={...base,key:'review',url:'https://jobs.example.test/review',title:'Full Stack Engineer',decision:'review',reasons:[generic,question],requirements:[{label:'Backend delivery at scale',quote:'Previous experience launching backend systems at scale.',status:'unclear',evidence:'Built and shipped backend systems; scale was not established.'}]};
const older={...recent,key:'older',title:'Older Software Engineer',url:'https://jobs.example.test/older',publishedAt:'2026-09-25',window:'older'};
const excluded={...base,key:'excluded',title:'Degree-required Engineer',url:'https://jobs.example.test/degree',decision:'excluded',exclusionKind:'requirement_blocker',reasons:['A completed bachelor’s degree is required.'],requirements:[{label:'Completed bachelor’s degree',quote:'Completed bachelor’s degree required; no equivalent route.',blocking:true,status:'unclear',evidence:'Degree still in progress.'}]};

test('long saved names, role titles and locations stay readable at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:900});
 const name='CareerVersion'.repeat(8),title='BackendSoftwareEngineer'.repeat(5),location='RemoteLocation'.repeat(6);
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body:unknown={success:true};
  if(path==='/api/resumes')body={success:true,variants:[{id,name,isDefault:true}]};
  if(path==='/api/jobs/preferences')body={success:true,version:1,preferences:{resumeId:id,resumeMode:'default',roleMode:'resume',roles:[],workStyles:['remote'],remoteCountry:'US',remoteRegion:'NY',locations:[]},resume:{id,name,fingerprint:'a'.repeat(64)}};
  if(path==='/api/jobs/feed')body={success:true,version:1,matchingMode:'resume_discovery',resume:{id,name,fingerprint:'a'.repeat(64)},catalog:{revision:'long',capturedAt:'2026-11-12',stale:false,scope:'Fictional test inventory.'},counts:{recent:1,review:0,older:0,excluded:0},recent:[{...recent,title,location}],review:[],older:[],excluded:[]};
  if(path==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-11-12T12:00:00Z',matches:req.postDataJSON().jobs.map((job:{key:string})=>({key:job.key,state:'none_known'}))};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'View matching resume'})).toHaveText(name);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 expect((await page.getByRole('heading',{name:title,exact:true}).boundingBox())!.width).toBeGreaterThan(100);
});

for(const width of [320,390,768,1440])test(`Jobs prioritizes roles and completes preference/history recovery at ${width}px`,async({page})=>{
 const errors:string[]=[],saves:unknown[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width,height:900});
 let version=1,historyUnavailable=false,tracked=false,failSave=true;
 let preferences={resumeId:id,resumeMode:'default',roleMode:'custom',roles:['Software Engineer'],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
 const feed=()=>({success:true,version,matchingMode:preferences.roleMode==='custom'?'custom_titles':'resume_discovery',resume:{id,name:'Fictional default resume',fingerprint:'a'.repeat(64)},catalog:{revision:'fictional',capturedAt:'2026-11-12',stale:false,scope:'Fictional public board inventory for UI tests.',sourcesSuccessful:10,sourcesAttempted:12,sourcesFailed:2,sourcesLimited:1},counts:{recent:1,review:1,older:1,excluded:22850},recent:[recent],review:[review],older:[older],excluded:[excluded]});
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let status=200,body:unknown={success:true};
  if(path==='/api/resumes')body={success:true,variants:[{id,name:'Fictional default resume',isDefault:true}]};
  else if(path==='/api/jobs/preferences'){
   if(request.method()==='PUT'){
    const value=request.postDataJSON();saves.push(value);expect(value.expectedVersion).toBe(version);
    if(failSave){failSave=false;status=503;body={success:false,error:'Preference save unavailable. Keep your edits and retry.'};}
    else {preferences=value.preferences;version++;}
   }
   if(status===200)body={success:true,preferences,version,setupRequired:null,resume:feed().resume};
  }else if(path==='/api/jobs/feed')body=feed();
  else if(path==='/api/jobs/application-status'){
   if(historyUnavailable){status=503;body={error:'History unavailable.'};}
   else body={success:true,status:'available',checkedAt:'2026-11-12T12:00:00Z',matches:request.postDataJSON().jobs.map((job:{key:string})=>({key:job.key,state:tracked&&job.key==='review'?'confirmed':'none_known',...(tracked&&job.key==='review'?{applicationId:'10',status:'applied'}:{})}))};
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/jobs');await expect(page.getByRole('heading',{name:'Software Engineer',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Excluded (22850)',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Check for updates',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'View matching resume',exact:true})).toHaveAttribute('href',`/resumes?view=library&resume=${id}#resume-${id}`);
 await page.getByRole('button',{name:'Needs review (1)',exact:true}).click();
 await expect(page.getByTestId('review-question')).toHaveText('Check before applying'+question);
 if(process.env.JOBS_SHOT_DIR){await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:`${process.env.JOBS_SHOT_DIR}/initial-review-${width}.png`,fullPage:true});}
 await page.getByText('All fit notes (2)',{exact:true}).click();await expect(page.getByText(generic,{exact:true})).toBeVisible();
 await page.getByText('Posting requirements and resume evidence',{exact:true}).click();await expect(page.getByText('Previous experience launching backend systems at scale.',{exact:true})).toBeVisible();
 if(process.env.JOBS_SHOT_DIR){await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:`${process.env.JOBS_SHOT_DIR}/review-${width}.png`,fullPage:true});}
 // A successful recovery must change the visible classification, not just show a toast.
 historyUnavailable=true;await page.getByText('Job sources and coverage',{exact:true}).click();await page.getByRole('button',{name:'Recheck applications',exact:true}).click();
 await expect(page.getByText('Application history could not be updated. Showing the last checked application status.',{exact:true})).toBeVisible();
 historyUnavailable=false;tracked=true;await page.getByRole('button',{name:'Retry application check',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Full Stack Engineer',exact:true})).toHaveCount(0);
 await expect(page.getByText('No recent jobs waiting for review',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View tracked postings',exact:true}).click();
 await expect(page.getByRole('button',{name:'Already applied (1)',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'Full Stack Engineer',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Open tracker',exact:true})).toHaveAttribute('href','/dashboard');
 await page.getByRole('button',{name:'Matches (1)',exact:true}).click();
 await page.getByRole('button',{name:'Adjust feed',exact:true}).click();
 await page.getByLabel('Target job titles').clear();
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.getByText('Your preferences were not saved',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Target job titles')).toHaveValue('');
 await expect(page.getByRole('heading',{name:'Software Engineer',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.getByText('Resume-driven discovery · No title filter',{exact:true})).toBeVisible();
 expect(preferences.roleMode).toBe('resume');expect(preferences.roles).toEqual([]);expect(saves).toHaveLength(2);
 await page.reload();await expect(page.getByRole('heading',{name:'Software Engineer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Adjust feed',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Limit discovery to target titles',exact:true})).not.toBeChecked();
 await page.getByRole('button',{name:'Hide preferences',exact:true}).click();
 await page.getByText('Other results',{exact:true}).click();await page.getByRole('button',{name:'Excluded (22850)',exact:true}).click();
 await expect(page.getByText('Requirement blocker',{exact:true})).toBeVisible();
 await page.getByText('Posting requirements and resume evidence',{exact:true}).click();
 await expect(page.getByText('Completed bachelor’s degree required; no equivalent route.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});
