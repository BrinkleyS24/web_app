import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { mockApplyGateWorkspace } from './helpers/applyGateApi';
import { buildApplyGatePresentation, projectApplyGatePresentation } from '../../../backend/gmail-job-tracker-be/services/applyGatePresentation.js';

const resumeId = '11111111-1111-4111-8111-111111111111';
const posting = 'Fictional Cedar requires Python development and shipping web applications. React is helpful, not required.';
const projected = projectApplyGatePresentation(buildApplyGatePresentation({decision:{action:'APPLY'}, facts:{matchedSkills:['Python'], missingPreferred:['React']}}));
const verdict = (id = 'check-1') => ({
  success: true, id, historySaved: true, jobTitle: 'Software Engineer', companyName: 'Fictional Cedar',
  verdict: 'strong_fit', confidence: 'medium', reasons: ['Python and web delivery have supporting resume evidence.'],
  matchedSkills: ['python'], missingSkills: [], resumeDocument: {variantId: resumeId, name:'Saved fixture resume'},
  explanation: projected.explanation,
  scoringBreakdown: {totalScore:85, hardBlocker:false, riskFlags:[], applicationRiskLabel:'low', applicationRiskBasis:'deterministic_fit_components'},
});
type StoredCheck = Record<string, unknown> & {id:string};
const stored = (id:string, index=0): StoredCheck => ({
  id, job_title:`Software Engineer ${index}`, company_name:`Fictional Cedar ${index}`, job_url:null,
  created_at:`2026-11-${String(12-index).padStart(2,'0')}T12:00:00Z`,
  verdict:'strong_fit', score:85, hard_blocker:false, reasons:JSON.stringify(verdict().reasons),
  explanation_payload:verdict().explanation, user_action:null,
});

async function setup(page:Page) {
  await mockApplyGateWorkspace(page, 'Built and shipped Python web applications, with tests and database-backed APIs.');
  const state = {history:[] as StoredCheck[], requests:[] as Record<string,unknown>[], actions:[] as Record<string,unknown>[], historyReads:0, analyzeFailure:false, unsaved:false, negativeSave:false, historyFailure:false};
  await page.route('**/api/emails/profile/resume', route => route.fulfill({json:{success:true,resumeText:'Built Python web applications and automated tests.'}}));
  await page.route('**/api/emails/apply-gate/history', async route => {
    state.historyReads++;
    await route.fulfill({status:state.historyFailure?503:200,json:state.historyFailure?{success:false,error:'Synthetic history failure'}:{success:true,history:state.history}});
  });
  await page.route('**/api/emails/apply-gate/analyze', async route => {
    state.requests.push(route.request().postDataJSON());
    if(state.analyzeFailure) return route.fulfill({status:400,json:{success:false,error:'The public posting could not be read. Paste the complete description.'}});
    const id = `check-${state.requests.length}`;
    if(!state.unsaved) state.history.unshift({...stored(id),job_title:'Software Engineer',company_name:'Fictional Cedar'});
    await route.fulfill({json:{...verdict(id),...(state.unsaved?{id:null,historySaved:false}:{})}});
  });
  await page.route('**/api/emails/apply-gate/*/action', async route => {
    const body=route.request().postDataJSON(); state.actions.push(body);
    if(state.negativeSave)return route.fulfill({json:{success:false}});
    const id=new URL(route.request().url()).pathname.split('/').at(-2);
    state.history=state.history.map(row=>row.id===id?{...row,user_action:body.action,user_action_at:'2026-11-12T12:30:00Z'}:row);
    await route.fulfill({json:{success:true}});
  });
  return state;
}

async function check(page:Page) {
  await page.getByLabel('Job description',{exact:true}).fill(posting);
  await page.getByRole('button',{name:'Check this role',exact:true}).click();
  await expect(page.getByTestId('apply-gate-current-result')).toBeVisible();
}
async function capture(page:Page,name:string) {
  if(!process.env.APPLY_GATE_SHOT_DIR)return;
  await fs.mkdir(process.env.APPLY_GATE_SHOT_DIR,{recursive:true});
  // Reset the capture position; in-flight browser focus/scroll anchoring can
  // move it a few pixels afterward. That is not a workflow pass criterion.
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.documentElement.style.overflowAnchor='none';window.scrollTo({top:0,behavior:'instant'});});
  await page.screenshot({path:path.join(process.env.APPLY_GATE_SHOT_DIR,name+'.png'),fullPage:true,animations:'disabled'});
}

for(const width of [320,390,768,1440]) test(`complete check, failed choice, retry, fresh role and durable saved history at ${width}px`, async ({page})=>{
  await page.setViewportSize({width,height:900});
  const state=await setup(page); const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);
  await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);
  await expect(page.getByTestId('apply-gate-options')).not.toHaveAttribute('open');
  expect(await page.getByRole('button',{name:'Check this role',exact:true}).evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(900);
  expect(state.historyReads).toBe(0);
  await capture(page,`entry-${width}`);
  await page.getByLabel('Job description',{exact:true}).fill(posting);
  await page.getByRole('button',{name:'Saved checks',exact:true}).click();
  await expect(page.getByText('No saved checks yet')).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Job description',{exact:true})).toHaveValue(posting);
  await page.getByTestId('apply-gate-options').locator('summary').click();
  await page.getByLabel('Job title',{exact:true}).fill('Software Engineer');
  await page.getByLabel('Company (optional)').fill('Fictional Cedar');
  await page.getByLabel('Apply style').selectOption('conservative');
  await page.getByTestId('apply-gate-options').locator('summary').click();
  await page.getByRole('button',{name:'Check this role',exact:true}).click();
  await expect(page.getByTestId('apply-gate-current-result')).toBeVisible();
  expect(state.requests).toEqual([expect.objectContaining({jobTitle:'Software Engineer',companyName:'Fictional Cedar',riskTolerance:'conservative',variantId:resumeId,jobDescription:posting})]);
  await capture(page,`result-${width}`);
  state.negativeSave=true;
  await page.getByRole('button',{name:'Not applying',exact:true}).click();
  await expect(page.getByTestId('apply-gate-current-result').getByText('Choice not saved. Try again.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Review another role'})).toHaveCount(0);
  state.negativeSave=false;
  await page.getByRole('button',{name:'Not applying',exact:true}).click();
  await expect(page.getByRole('button',{name:'Review another role'})).toBeVisible();
  await page.getByRole('button',{name:'Review another role'}).click();
  await expect(page.getByLabel('Job description',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Job title',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Company (optional)')).toHaveValue('');
  await expect(page.getByLabel('Job posting link (optional)')).toHaveValue('');
  await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);
  await expect(page.getByLabel('Apply style')).toHaveValue('conservative');
  await expect(page.getByRole('button',{name:'Check this role',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Saved checks',exact:true}).click();
  await expect(page.getByTestId('apply-gate-history-check-1')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('apply-gate-history-check-1')).toContainText('You skipped it');
  await expect(page.getByTestId('apply-gate-history-check-1').getByRole('button',{name:'Not applying',exact:true})).toHaveCount(0);
  await capture(page,`saved-history-${width}`);
  expect(state.actions).toHaveLength(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  expect(errors).toEqual([]);
});

test('URL-only extraction failure preserves input and can recover with pasted text, with no title override',async({page})=>{
  const state=await setup(page);state.analyzeFailure=true;
  await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);
  await page.getByLabel('Job posting link (optional)').fill('https://jobs.example.test/engineer');
  await page.getByRole('button',{name:'Check this role',exact:true}).click();
  await expect(page.getByText('The public posting could not be read. Paste the complete description.')).toBeVisible();
  await expect(page.getByLabel('Job posting link (optional)')).toHaveValue('https://jobs.example.test/engineer');
  expect(state.requests[0]).toMatchObject({jobTitle:'',jobDescription:'',jobUrl:'https://jobs.example.test/engineer'});
  state.analyzeFailure=false;await check(page);
  expect(state.requests[1]).toMatchObject({jobTitle:'',jobDescription:posting});
});

test('empty-account resume setup preserves pasted text on an unconfirmed save and unlocks checking after retry',async({page})=>{
  await setup(page);
  const text='Built and tested Python web applications with database-backed APIs and continuous integration. '.repeat(4);
  let savedText:string|null=null,negative=true;
  await page.route('**/api/resumes',route=>route.fulfill({json:{success:true,variants:[]}}));
  await page.route('**/api/emails/profile/resume',async route=>{
    if(route.request().method()==='PUT'){
      if(negative)return route.fulfill({json:{success:false}});
      savedText=route.request().postDataJSON().resumeText;
      return route.fulfill({json:{success:true}});
    }
    await route.fulfill({json:{success:true,resumeText:savedText}});
  });
  await page.goto('/apply-gate');
  await expect(page.getByTestId('apply-gate-resume-required')).toBeVisible();
  await page.getByLabel('Your resume',{exact:true}).fill(text);
  await page.getByRole('button',{name:'Save resume',exact:true}).click();
  await expect(page.getByText('Your resume was not saved. Keep the text and try again.')).toBeVisible();
  await expect(page.getByLabel('Your resume',{exact:true})).toHaveValue(text);
  negative=false;await page.getByRole('button',{name:'Save resume',exact:true}).click();
  await expect(page.getByLabel('Job description',{exact:true})).toBeVisible();
  await page.getByLabel('Job description',{exact:true}).fill(posting);
  await expect(page.getByRole('button',{name:'Check this role',exact:true})).toBeEnabled();
});

test('view controls work by keyboard and preserve the unsent posting',async({page})=>{
  await setup(page);await page.goto('/apply-gate');
  await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);
  await page.getByLabel('Job description',{exact:true}).fill(posting);
  const saved=page.getByRole('button',{name:'Saved checks',exact:true});
  await saved.focus();await page.keyboard.press('Enter');
  await expect(saved).toHaveAttribute('aria-current','page');
  const current=page.getByRole('button',{name:'Check a role',exact:true});
  await current.focus();await page.keyboard.press('Enter');
  await expect(current).toHaveAttribute('aria-current','page');
  await expect(page.getByLabel('Job description',{exact:true})).toHaveValue(posting);
});

test('edited inputs retain evidence but block a stale choice until a new check',async({page})=>{
  const state=await setup(page);await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);await check(page);
  await page.getByLabel('Job description',{exact:true}).fill(posting+' More requirements.');
  await expect(page.getByText(/The inputs have changed since this check/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Not applying',exact:true})).toBeDisabled();
  expect(state.actions).toHaveLength(0);
  await page.getByRole('button',{name:'Check this role',exact:true}).click();
  await expect(page.getByText(/The inputs have changed since this check/)).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Not applying',exact:true})).toBeEnabled();
});

test('an unsaved verdict never claims a saved choice or sends an action write',async({page})=>{
  const state=await setup(page);state.unsaved=true;await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);await check(page);
  await page.getByRole('button',{name:'Not applying',exact:true}).click();
  await expect(page.getByText(/Choice not saved: this check has no saved history record/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Review another role'})).toHaveCount(0);
  expect(state.actions).toHaveLength(0);
});

test('history failure stays separate from a usable draft and retry recovers loaded records',async({page})=>{
  const state=await setup(page);state.historyFailure=true;
  await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);await page.getByLabel('Job description',{exact:true}).fill(posting);
  await page.getByRole('button',{name:'Saved checks',exact:true}).click();
  await expect(page.getByText(/Saved checks could not be loaded/)).toBeVisible({timeout:20000});
  await expect(page.getByText('No saved checks yet')).toHaveCount(0);
  state.historyFailure=false;state.history=[stored('recovered')];
  await page.getByRole('button',{name:'Try loading checks again'}).click();
  await expect(page.getByTestId('apply-gate-history-recovered')).toBeVisible();
  await page.getByRole('button',{name:'Check a role',exact:true}).click();
  await expect(page.getByLabel('Job description',{exact:true})).toHaveValue(posting);
});

test('pending work disables competing writers across views without inventing percent progress',async({page})=>{
  const state=await setup(page);state.history=[stored('old')];
  let finish!:()=>void;let rechecks=0;
  await page.route('**/api/emails/apply-gate/analyze',async route=>{
    state.requests.push(route.request().postDataJSON());
    await new Promise<void>(resolve=>{finish=resolve;});await route.fulfill({json:verdict()});
  });
  await page.route('**/api/emails/apply-gate/*/recheck',async route=>{rechecks++;await route.fulfill({json:verdict()});});
  await page.goto('/apply-gate');await expect(page.getByLabel('Resume',{exact:true})).toHaveValue(resumeId);await page.getByLabel('Job description',{exact:true}).fill(posting);
  await page.getByRole('button',{name:'Check this role',exact:true}).evaluate((button: HTMLButtonElement) => {button.click(); button.click();});
  try {
  const progress=page.getByTestId('apply-gate-progress');await expect(progress).toBeVisible();
  await expect(progress).toContainText('seconds elapsed');
  await expect(page.getByLabel('Job description',{exact:true})).toBeDisabled();
  expect(await progress.textContent()).not.toMatch(/\d+%|Writing your decision|Scoring fit/);
  await page.getByRole('button',{name:'Saved checks',exact:true}).click();
  await page.getByTestId('apply-gate-history-old').getByText('Review evidence and record a choice').click();
  await expect(page.getByTestId('apply-gate-history-old').getByRole('button',{name:'Not applying',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Check a role',exact:true}).click();
  await expect(progress).toBeVisible();
  finish();await expect(page.getByTestId('apply-gate-current-result')).toBeVisible();
  expect(state.requests).toHaveLength(1);expect(rechecks).toBe(0);expect(state.actions).toHaveLength(0);
  } finally { finish?.(); }
});

test('saved source identity and loaded history survive grouping, show more and a failed then successful recheck',async({page})=>{
  const state=await setup(page);
  state.history=Array.from({length:7},(_,i)=>stored(`old-${i}`,i));
  state.history.unshift({...stored('newer-source'),created_at:'2026-11-12T13:00:00Z'});
  let reject=true;
  await page.route('**/api/emails/apply-gate/old-0/recheck',async route=>{
    if(reject)return route.fulfill({status:409,json:{success:false,error:'Original saved posting is unavailable.'}});
    state.history.unshift({...stored('rechecked'),job_title:'Software Engineer'});
    await route.fulfill({json:verdict('rechecked')});
  });
  await page.goto('/apply-gate?verdict=old-0');
  await expect(page.getByTestId('apply-gate-linked-check')).toBeVisible();
  await expect(page.getByTestId('apply-gate-history-old-0')).toBeVisible();
  await expect(page.getByTestId('apply-gate-history-newer-source')).toHaveCount(0);
  await expect(page.getByText(/7 loaded postings/)).toBeVisible();
  await page.getByRole('button',{name:'Show more saved checks'}).click();
  await expect(page.getByTestId('apply-gate-history-old-6')).toBeVisible();
  await page.getByRole('button',{name:'Re-check this posting'}).click();
  await expect(page.getByText('Original saved posting is unavailable.')).toBeVisible();
  reject=false;await page.getByRole('button',{name:'Re-check this posting'}).click();
  await expect(page.getByTestId('apply-gate-current-result')).toBeVisible();
  await expect(page).toHaveURL(/verdict=rechecked.*view=check/);
  await expect(page.getByText('This result re-checks a saved posting. The form is your separate draft for a new check.')).toBeVisible();
  await expect(page.getByLabel('Job description',{exact:true})).toHaveValue('');
  await page.reload();
  await expect(page.getByTestId('apply-gate-history-rechecked')).toBeVisible();
  await expect(page.getByTestId('apply-gate-linked-check')).toBeVisible();
  await page.getByRole('button',{name:'Check a role',exact:true}).click();
  await expect(page).not.toHaveURL(/verdict=/);
  await expect(page.getByLabel('Job description',{exact:true})).toBeVisible();
});
