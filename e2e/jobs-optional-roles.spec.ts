import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) test(`Optional job titles can be cleared and stay resume-based after reload at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:1000});
  const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let preferences = {resumeId:id,resumeMode:'default',roleMode:'custom',roles:['Backend Engineer'],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
  let version = 2;
  const saves: typeof preferences[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = {success:true};
    if (path === '/api/resumes') body = {success:true,variants:[{id,name:'QA resume',isDefault:true}]};
    else if (path === '/api/jobs/preferences') {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON();
        expect(payload.expectedVersion).toBe(version);
        saves.push(payload.preferences);
        preferences = {...payload.preferences,roles:payload.preferences.roleMode === 'resume' ? ['QA Engineer','SDET'] : payload.preferences.roles};
        version++;
      }
      body = {success:true,preferences,version,setupRequired:null,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)}};
    } else if (path === '/api/jobs/feed') body = {success:true,version,resume:{id,name:'QA resume',fingerprint:'a'.repeat(64)},matchingMode:'resume_discovery',catalog:{revision:'fixture',capturedAt:'2026-10-24',stale:false,scope:'Test fixture.',sourcesAttempted:1,sourcesSuccessful:1,sourcesFailed:0,sourcesLimited:0},counts:{recent:0,review:0,older:0,excluded:0},recent:[],review:[],older:[],excluded:[]};
    if(new URL(route.request().url()).pathname==='/api/jobs/application-status')body={success:true,status:'available',checkedAt:'2026-10-24',matches:route.request().postDataJSON().jobs.map((job:any)=>({key:job.key,state:'none_known'}))};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/jobs');
  await page.getByRole('button',{name:'Adjust feed'}).click();
  const titles = page.getByRole('textbox',{name:/Target job titles/});
  await titles.fill('');
  await expect(titles).not.toHaveAttribute('required');
  await expect(page.getByText(/Leave blank to discover roles without a title filter/)).toBeVisible();
  await page.getByRole('button',{name:'Save preferences'}).click();
  await expect(page.getByText(/Resume-driven discovery.*No title filter/)).toBeVisible();
  expect(saves[0]).toMatchObject({roleMode:'resume',roles:[]});
  await page.reload();
  await expect(page.getByText(/Resume-driven discovery.*No title filter/)).toBeVisible();
  await page.getByRole('button',{name:'Adjust feed'}).click();
  await expect(page.getByRole('checkbox',{name:'Limit discovery to target titles'})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'Limit discovery to target titles'}).check();
  await expect(titles).toHaveValue('');
  await titles.fill('SDET');
  await page.getByRole('button',{name:'Save preferences'}).click();
  await expect(page.getByText(/Your target titles:/)).toBeVisible();
  expect(saves[1]).toMatchObject({roleMode:'custom',roles:['SDET']});
  await page.getByRole('button',{name:'Adjust feed'}).click();
  await titles.fill('   ');
  await page.getByRole('button',{name:'Save preferences'}).click();
  await expect(page.getByText(/Resume-driven discovery.*No title filter/)).toBeVisible();
  expect(saves[2]).toMatchObject({roleMode:'resume',roles:[]});
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({path:test.info().outputPath('resume-roles-restored.png'),fullPage:true});
});
