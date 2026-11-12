import { expect, test } from '@playwright/test';

const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
const variants = [{ id: first, name: 'Saved QA', isDefault: true }, { id: second, name: 'Saved full stack', isDefault: false }];
const record = (variantId: string | null, revision = 1) => ({ variantId, revision, name: variants.find(v => v.id === variantId)?.name ?? null, confirmedAt: '2026-11-12T16:00:00Z', source: 'user_confirmed', documentAvailable: variantId !== null, archived: false });

for (const width of [320, 390, 768, 1440]) test(`confirmed work clears persistently and remains correctable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const applications = Array.from({ length: 10 }, (_, index) => ({ id: String(100 - index), role: `Fictional role ${100 - index}`, company: 'Fictional Cedar', outcomeLabel: 'pending', submission: index < 2 ? record(first) : null }));
  const older = { ...applications[0], id: '90', role: 'Older fictional role', submission: null as ReturnType<typeof record> | null };
  const receipts = new Map<string, string>(), writes: Array<{ id: string; body: Record<string, any> }> = [];
  let lostResponse = false;
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    let status = 200, body: unknown = { success: true };
    if (path === '/api/resumes') body = { success: true, variants };
    else if (path === '/api/resumes/health') body = { success: true, resumes: [] };
    else if (path === '/api/resumes/scoreboard') body = { success: true, scoreboard: { basis: 'confirmed_application_outcomes', minSample: 5, perVariant: [] }, recommendation: null };
    else if (path === '/api/resumes/submissions') body = { success: true, applications: url.searchParams.get('before') ? [older] : applications, nextCursor: url.searchParams.get('before') ? null : '91', unlinkedSubmissions: 0 };
    else if (path.startsWith('/api/resumes/submissions/') && req.method() === 'PUT') {
      const id = path.split('/').at(-1)!, payload = req.postDataJSON();
      writes.push({ id, body: payload });
      const application = [...applications, older].find(a => a.id === id)!;
      const signature = JSON.stringify(payload), previous = receipts.get(payload.requestId);
      if (previous === signature) body = { success: true, replayed: true };
      else if (previous || payload.expectedRevision !== (application.submission?.revision || 0)) { status = 409; body = { success: false, error: 'Confirmation changed. Reload saved choice.' }; }
      else {
        application.submission = record(payload.variantId, payload.expectedRevision + 1);
        receipts.set(payload.requestId, signature);
        if (!lostResponse) { lostResponse = true; status = 503; body = { success: false, error: 'Acknowledgment lost after commit. Retry safely.' }; }
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/resumes?view=outcomes#submitted-resumes');
  await expect(page.getByRole('heading', { name: 'Needs confirmation on this page (8)' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(8);
  // Already confirmed applications from the server are never editable tasks by default.
  await expect(page.getByRole('combobox', { name: 'Submitted resume for application 100' })).toHaveCount(0);
  for (const application of applications.slice(2)) {
    const item = page.getByTestId('submission-' + application.id);
    await item.getByRole('combobox').selectOption(second);
    await item.getByRole('button', { name: 'Confirm submitted resume' }).click();
    if (application.id === '98') {
      await expect(item.getByRole('button', { name: 'Retry confirmation' })).toBeVisible();
      await expect(item.getByRole('combobox')).toHaveValue(second);
      await item.getByRole('button', { name: 'Retry confirmation' }).click();
      expect(writes[1]).toEqual(writes[0]);
    }
    await expect(page.getByRole('combobox', { name: 'Submitted resume for application ' + application.id })).toHaveCount(0);
  }
  await expect(page.getByText(/No applications on this page need confirmation/)).toContainText('Older applications are available');
  await expect(page.getByText('Recorded on this page (10)', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Needs confirmation on this page (0)' })).toBeVisible();
  await page.getByText('Recorded on this page (10)', { exact: true }).click();
  const recorded = page.getByTestId('submission-100');
  await recorded.getByRole('button', { name: 'Change submitted resume' }).click();
  await expect(recorded.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
  await recorded.getByRole('combobox').selectOption(second);
  await recorded.getByRole('button', { name: 'Confirm submitted resume' }).click();
  await expect(recorded.getByRole('combobox')).toHaveCount(0);
  expect(writes.at(-1)).toMatchObject({ id: '100', body: { expectedRevision: 1, variantId: second } });
  await expect(recorded.getByText('Confirmed submitted: Saved full stack')).toBeVisible();
  await page.getByRole('button', { name: 'More applications' }).click();
  await page.getByLabel('Submitted resume for application 90').selectOption('unknown');
  await page.getByRole('button', { name: 'Confirm submitted resume' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  expect(older.submission?.variantId).toBeNull();
  await expect(page.getByRole('button', { name: 'More applications' })).toHaveCount(0);
  await page.getByText('Recorded on this page (1)', { exact: true }).click();
  await expect(page.getByText(/Recorded as unknown/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
  if (process.env.RESUMES_SHOT_DIR) {
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: `${process.env.RESUMES_SHOT_DIR}/completion-${width}.png`, fullPage: true });
  }
});
