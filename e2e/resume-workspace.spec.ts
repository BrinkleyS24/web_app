import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', other = '22222222-3333-4444-8555-666666666666', saved = '11111111-2222-4333-8444-555555555555';
const logicalKey = '0123456789abcdef', dedupeKey = 'fedcba9876543210';
const original = 'Managed appointment scheduling and patient records for a busy clinic. Supported reception and confidential records.';
const edited = original + '\nResolved customer complaints and coordinated appointment changes.';
const posting = 'Receptionist responsibilities at Example Health. Manage appointment scheduling and patient records. Welcome patients and coordinate with the clinical team.';
const task = { id: 'resume-task', logicalKey, dedupeKey, primaryEntityId: 'job:https://jobs.example.test/receptionist', actionType: 'tailor_resume', actionCategory: 'optimization', source: 'apply_gate', queueSource: 'resume', intent: 'TAILOR_RESUME', intentLabel: 'Tailor resume', title: 'Show your scheduling experience', company: 'Example Health', roleTitle: 'Receptionist', whyNow: 'This posting asks for appointment scheduling.', targetOutcome: 'Show relevant experience.', effortMinutes: 5, urgencyLevel: 'medium', confidenceLevel: 'strong', status: 'open', effectiveStatus: 'open', createdAt: '2026-10-07T00:00:00Z', evidenceVersion: 'v1', blockedByLogicalKeys: [], evidence: ['Scheduling appears in the posting.'], playbook: ['Review the actual role.'], sourceLabel: 'Recommended action', stageLabel: 'Open', routeLabel: 'Open', draftEligible: false, routeHref: '/apply-gate' };
for (const width of [320, 1280]) test(`resume compare edit save and use preserves posting and identity at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const creates: Record<string, unknown>[] = [], analyses: Record<string, unknown>[] = [], completions: unknown[] = [];
  const variants = [{ id, name: 'Front desk', isDefault: false, createdAt: '', charCount: original.length }, { id: other, name: 'Warehouse', isDefault: true, createdAt: '', charCount: 120 }];
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; } } }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method(); let body: unknown = { success: true };
    if (path.endsWith('/suggestions/queue')) body = { success: true, queue: { doToday: [task], thisWeek: [], later: [], blocked: [], dismissed: [], expired: [], done: [], resolvedActions: [task] } };
    else if (path.endsWith('/queue/actions/complete')) { completions.push(route.request().postDataJSON()); body = { success: true, state: 'completed' }; }
    else if (path.endsWith('/profile/resume')) body = { success: true, resumeText: 'Warehouse picking and stock control experience for evening operations.' };
    else if (path.endsWith('/apply-gate/history')) body = { success: true, history: [] };
    else if (path.endsWith('/resumes') && method === 'POST') { const payload = route.request().postDataJSON(); creates.push(payload); variants.push({ id: saved, name: String(payload.name), isDefault: false, createdAt: '', charCount: String(payload.text).length }); body = { success: true, id: saved }; }
    else if (path.endsWith('/resumes')) body = { success: true, variants };
    else if (path.endsWith(`/resumes/${id}`)) body = { success: true, document: { id, name: 'Front desk', text: original, fingerprint: 'a'.repeat(64) } };
    else if (path.endsWith(`/resumes/${other}`)) body = { success: true, document: { id: other, name: 'Warehouse', text: 'Picked warehouse orders and checked inventory counts. Loaded shipments safely and documented stock movements.', fingerprint: 'c'.repeat(64) } };
    else if (path.endsWith(`/resumes/${saved}`)) body = { success: true, document: { id: saved, name: 'Front desk revised', text: edited, fingerprint: 'b'.repeat(64) } };
    else if (path.endsWith('/resumes/health')) body = { success: true, resumes: [] };
    else if (path.endsWith('/resumes/scoreboard')) body = { success: true, scoreboard: { minSample: 5, perVariant: [] }, recommendation: null, breakdown: {} };
    else if (path.endsWith('/apply-gate/analyze')) { analyses.push(route.request().postDataJSON()); body = { success: true, insufficientProfile: true, insufficientProfileMessage: 'Synthetic acceptance stops after verifying the selected request.' }; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`/apply-gate?resume=${id}&action=${logicalKey}&version=${dedupeKey}`);
  await expect(page.getByLabel('Resume', { exact: true })).toHaveValue(id); await expect(page.getByLabel('Job title', { exact: true })).toHaveValue('Receptionist');
  await page.getByLabel('Job description', { exact: true }).fill(posting);
  await page.getByRole('link', { name: 'View or edit this version' }).click();
  await expect(page).toHaveURL(new RegExp(`/resumes\\?resume=${id}&action=${logicalKey}&version=${dedupeKey}`));
  await expect(page.getByLabel('Resume text to save')).toHaveValue(original);
  await page.getByLabel('Compare Front desk', { exact: true }).check(); await page.getByLabel('Compare Warehouse', { exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Compare saved wording' })).toBeVisible();
  expect(creates).toHaveLength(0); expect(analyses).toHaveLength(0); expect(completions).toHaveLength(0);
  await page.getByLabel('New version name').fill('Front desk revised'); await page.getByLabel('Resume text to save').fill(edited);
  await expect(page.getByLabel('Use this new version as my default for extension job checks')).not.toBeChecked();
  await page.getByRole('button', { name: 'Save as new version' }).click(); await expect(page.getByText('Ready to use: Front desk revised')).toBeVisible();
  expect(creates).toHaveLength(1); expect(creates[0]).toMatchObject({ name: 'Front desk revised', text: edited, defaultMode: 'none' }); expect(creates[0].requestId).toEqual(expect.any(String));
  await page.getByRole('button', { name: 'Copy saved text' }).click(); expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(edited);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download saved text' }).click(); const download = await downloaded; expect(download.suggestedFilename()).toBe('Front desk revised.txt'); expect(await fs.readFile((await download.path())!, 'utf8')).toBe(edited);
  await page.getByRole('link', { name: 'Use this version in Apply Gate' }).click(); await expect(page.getByLabel('Resume', { exact: true })).toHaveValue(saved);
  await expect(page.getByLabel('Job description', { exact: true })).toHaveValue(posting); await expect(page.getByLabel('Job title', { exact: true })).toHaveValue('Receptionist'); await expect(page.getByLabel('Company (optional)')).toHaveValue('Example Health');
  expect(analyses).toHaveLength(0); expect(completions).toHaveLength(0);
  await page.getByRole('button', { name: 'Check this role' }).click(); await expect.poll(() => analyses.length).toBe(1); expect(analyses[0]).toMatchObject({ variantId: saved, jobDescription: posting, jobTitle: 'Receptionist' });
  await page.getByRole('link', { name: 'View or edit this version' }).click(); await expect(page.getByLabel('Resume text to save')).toHaveValue(edited);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); expect(overflow).toBe(false); expect(errors).toEqual([]);
    await page.waitForFunction(() => {
      let element: HTMLElement | null = document.querySelector('h1');
      while (element) { if (Number(getComputedStyle(element).opacity) < 0.99) return false; element = element.parentElement; }
      return true;
    });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0); });
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
    await page.screenshot({ path: `C:/dev/intrackt-project-root/.codex_tmp/resume-workspace-${width}.png`, fullPage: true });
});
