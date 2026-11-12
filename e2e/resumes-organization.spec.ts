import { expect, test, type Page } from '@playwright/test';

async function capture(page: Page, name: string) {
  if (!process.env.RESUMES_SHOT_DIR) return;
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: 0, behavior: 'instant' }); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: `${process.env.RESUMES_SHOT_DIR}/${name}.png`, fullPage: true });
}

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const names = ['QA and automation — customer platform', 'Full stack — independently shipped web applications'];
const variants = [first, second].map((id, index) => ({ id, name: names[index], isDefault: index === 0, charCount: 500, createdAt: '2026-10-01' }));
const text = 'Fictional candidate. Built and tested web applications using TypeScript, Python and Playwright. candidate@example.test';

for (const width of [320, 390, 768, 1440]) {
  test(`Library and Outcomes remain distinct, recoverable and usable at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [], requests: string[] = [], confirmations: unknown[] = [];
    const roleFilters: Array<string | null> = [];
    let healthFailed = false, libraryFailed = false, outcomesFailed = false;
    let submitted: Record<string, unknown> | null = null;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      requests.push(path);
      let body: unknown = { success: true }, status = 200;
      if (path === '/api/resumes') {
        if (libraryFailed) { status = 503; body = { error: 'Saved versions unavailable.' }; }
        else body = { success: true, variants };
      } else if (path === '/api/resumes/health') {
        if (healthFailed) { status = 503; body = { error: 'Checks unavailable.' }; }
        else body = { success: true, resumes: variants.map(v => ({ variantId: v.id, name: v.name, isDefault: v.isDefault, document: { variantId: v.id, source: 'saved', fingerprint: 'a'.repeat(64), characters: 500 }, findings: [] })) };
      } else if (path === '/api/resumes/scoreboard') {
        roleFilters.push(url.searchParams.get('title'));
        if (outcomesFailed) { status = 503; body = { error: 'Outcome service unavailable.' }; }
        else body = { success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5, unknownApplications: 12, perVariant: [
          { variantId: first, name: names[0], sent: 7, matchedToOutcome: 5, interviewed: 1, offered: 0, rejected: 4, noResponse: 0, interviewRate: 20, sufficientSample: true },
          { variantId: second, name: names[1], sent: 1, matchedToOutcome: 0, interviewed: 0, offered: 0, rejected: 0, noResponse: 0, interviewRate: null, sufficientSample: false },
          { variantId: 'archived-version', name: 'Archived wording — original submission preserved', sent: 1, matchedToOutcome: 1, interviewed: 1, offered: 0, rejected: 0, noResponse: 0, interviewRate: 100, sufficientSample: false },
        ] }, recommendation: null, breakdown: { [first]: [{ applicationId: '100', role: 'QA Engineer', company: 'Fictional Cedar', outcome: 'interviewed' }] } };
      } else if (path === '/api/resumes/submissions') {
        body = { success: true, applications: [{ id: '100', role: 'QA Engineer', company: 'Fictional Cedar', submission: submitted, outcomeLabel: 'interviewed' }], nextCursor: null, unlinkedSubmissions: 0 };
      } else if (path.startsWith('/api/resumes/submissions/') && request.method() === 'PUT') {
        confirmations.push(request.postDataJSON());
        if (confirmations.length === 1) { status = 503; body = { error: 'Acknowledgment unavailable. Retry the same confirmation.' }; }
        else { const payload = request.postDataJSON(); submitted = { variantId: payload.variantId, name: variants.find(v => v.id === payload.variantId)?.name ?? null, revision: payload.expectedRevision + 1, confirmedAt: '2026-11-12T16:00:00Z', source: 'user_confirmed', documentAvailable: payload.variantId !== null, archived: false }; }
      } else if (path === `/api/resumes/${first}` || path === `/api/resumes/${second}`) {
        const index = path.endsWith(first) ? 0 : 1;
        body = { success: true, document: { id: variants[index].id, name: names[index], text, fingerprint: 'a'.repeat(64) } };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/resumes');
    await expect(page.getByRole('heading', { name: names[0], exact: true })).toBeVisible();
    await capture(page, `library-initial-${width}`);
    await page.goto('/resumes?action=0123456789abcdef&version=fedcba9876543210');
    await expect(page.getByRole('heading', { name: names[0], exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(requests).not.toContain('/api/resumes/scoreboard');
    expect(requests).not.toContain('/api/resumes/submissions');
    const library = page.getByRole('tabpanel', { name: 'Library', exact: true });
    await expect(library.getByText('Nothing flagged on this version.', { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Open and edit' }).first().click();
    await page.getByLabel('Resume text to save').fill(text + '\nUnsent draft retained.');
    await page.getByLabel('Compare wording for ' + names[0], { exact: true }).check();
    await page.getByRole('tab', { name: 'Library', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Outcomes & submissions' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Confirmed outcomes by version' })).toBeVisible();
    await expect(page.getByText('needs 5 more', { exact: true })).toBeVisible();
    await expect(page.getByText('Archived wording — original submission preserved')).not.toBeVisible();
    await page.getByText('Confirmed outcomes for past versions', { exact: true }).click();
    await expect(page.getByText('Archived wording — original submission preserved')).toBeVisible();
    await page.getByRole('button', { name: 'Review submitted resumes', exact: true }).first().click();
    await page.getByLabel('Submitted resume for application 100').selectOption(second);
    await page.getByRole('button', { name: 'Confirm submitted resume', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry confirmation' })).toBeVisible();
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await expect(page.getByLabel('Resume text to save')).toHaveValue(text + '\nUnsent draft retained.');
    await expect(page.getByLabel('Compare wording for ' + names[0], { exact: true })).toBeChecked();
    await page.getByRole('tab', { name: 'Outcomes & submissions' }).click();
    await expect(page.getByLabel('Submitted resume for application 100')).toHaveValue(second);
    await page.getByRole('button', { name: 'Retry confirmation' }).click();
    await expect(page.getByText(/Submitted version confirmed\. Find it under Recorded on this page/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Submitted resume for application 100' })).toHaveCount(0);
    expect(confirmations).toHaveLength(2);
    expect(confirmations[1]).toEqual(confirmations[0]);
    await page.getByLabel('Compare outcomes for a role (optional)').fill('QA Engineer');
    await page.getByRole('button', { name: 'Compare this role', exact: true }).click();
    await expect(page.getByText(/Showing the role family for QA Engineer/)).toBeVisible();
    await expect.poll(() => roleFilters.includes('QA Engineer')).toBe(true);
    await expect(page.getByText(/confirmations above include all applications/)).toBeVisible();
    await page.getByText('Applications behind these outcomes', { exact: true }).click();
    await page.getByRole('button', { name: 'Show 1 application', exact: true }).click();
    await expect(page.getByText('QA Engineer', { exact: true }).last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await capture(page, `outcomes-${width}`);

    // An exact outcome-row link changes view, preserves task context and opens its document.
    await page.getByRole('link', { name: names[0], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`view=library.*resume=${first}#resume-${first}`));
    expect(new URL(page.url()).searchParams.get('action')).toBe('0123456789abcdef');
    await expect(page.getByLabel('Resume text to save')).toHaveValue(text + '\nUnsent draft retained.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await capture(page, `library-${width}`);
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Outcomes & submissions' })).toHaveAttribute('aria-selected', 'true');
    await page.goForward();
    await expect(page.getByLabel('Resume text to save')).toHaveValue(text + '\nUnsent draft retained.');

    // Reloads trigger controlled source failures, never fabricated clean/empty outcomes.
    healthFailed = true;
    await page.reload();
    await expect(page.getByText('Resume checks did not load', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nothing flagged on this version.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open and edit' }).first()).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await capture(page, `checks-unavailable-${width}`);
    healthFailed = false;
    await page.getByRole('alert').filter({ hasText: 'Resume checks did not load' }).getByRole('button', { name: 'Try again' }).click();
    await expect(library.getByText('Nothing flagged on this version.', { exact: true })).toHaveCount(2);
    outcomesFailed = true;
    await page.getByRole('tab', { name: 'Outcomes & submissions' }).click();
    await page.reload();
    await expect(page.getByText('Resume outcomes could not be loaded', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Confirmed outcomes by version' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await capture(page, `outcomes-unavailable-${width}`);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open and edit' }).first()).toBeEnabled();
    libraryFailed = true;
    await page.reload();
    await expect(page.getByText('Your resumes did not load', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No resumes saved yet', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });
}
