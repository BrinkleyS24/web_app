import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ResumeEditor, ResumeTextComparison } from './ResumeEditor';
const { fetchResumeDocument, createResumeVariant, useAuth } = vi.hoisted(() => ({ fetchResumeDocument: vi.fn(), createResumeVariant: vi.fn(), useAuth: vi.fn() }));
vi.mock('@/lib/resumeWorkspace', async () => ({ ...await vi.importActual('@/lib/resumeWorkspace'), fetchResumeDocument }));
vi.mock('@/lib/emails', () => ({ createResumeVariant }));
vi.mock('@/lib/AuthContext.jsx', () => ({ useAuth }));
const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', saved = '11111111-2222-4333-8444-555555555555', second = '22222222-3333-4444-8555-666666666666';
const text = 'Managed appointment scheduling and patient records for a busy clinic. Supported reception and confidential records.';
const edited = text + '\nResolved customer complaints and coordinated appointment changes.';
const doc = { id, name: 'Front desk', text, fingerprint: 'a'.repeat(64) };
const onSaved = vi.fn();
function view(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }), owner = 'owner') {
  return { client, ...render(<MemoryRouter><QueryClientProvider client={client}><ResumeEditor key={owner} id={id} owner={owner} search="?action=0123456789abcdef&version=fedcba9876543210" onSaved={onSaved} /></QueryClientProvider></MemoryRouter>) };
}
async function edit() { const user = userEvent.setup(); await user.clear(await screen.findByLabelText('New version name')); await user.type(screen.getByLabelText('New version name'), 'Front desk revised'); await user.clear(screen.getByLabelText('Resume text to save')); await user.type(screen.getByLabelText('Resume text to save'), edited); return user; }
beforeEach(() => { vi.clearAllMocks(); useAuth.mockReturnValue({ user: { uid: 'owner' } }); fetchResumeDocument.mockImplementation(async (value: string) => value === id ? doc : { id: saved, name: 'Front desk revised', text: edited, fingerprint: 'b'.repeat(64) }); createResumeVariant.mockResolvedValue({ success: true, id: saved }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
test('editing saves a new identity with default off and uses only verified saved text', async () => {
  const user = await (view(), edit()); expect(screen.getByLabelText(/Use this new version as my default/)).not.toBeChecked();
  expect(screen.queryByRole('link', { name: 'Use this version in Apply Gate' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText(/Saved and verified/);
  expect(createResumeVariant).toHaveBeenCalledWith({ name: 'Front desk revised', text: edited, defaultMode: 'none', requestId: expect.any(String) });
  expect(fetchResumeDocument).toHaveBeenCalledWith(saved); expect(onSaved).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Use this version in Apply Gate' })).toHaveAttribute('href', `/apply-gate?resume=${saved}&action=0123456789abcdef&version=fedcba9876543210`);
  expect(doc.text).toBe(text);
  const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await user.click(screen.getByRole('button', { name: 'Copy saved text' })); expect(clipboard).toHaveBeenCalledWith(edited);
  await user.type(screen.getByLabelText('Resume text to save'), ' Changed draft'); expect(screen.queryByRole('link', { name: 'Use this version in Apply Gate' })).not.toBeInTheDocument();
});
test('lost save response preserves draft and uses the same request ID on unchanged retry', async () => {
  createResumeVariant.mockRejectedValueOnce(new Error('Timed out; save not confirmed.')); view(); const user = await edit();
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText(/Timed out/); const requestId = createResumeVariant.mock.calls[0][0].requestId;
  expect(screen.getByLabelText('Resume text to save')).toHaveValue(edited);
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText(/Saved and verified/);
  expect(createResumeVariant.mock.calls[1][0].requestId).toBe(requestId);
});
test('confirmed save followed by a read outage retries verification without creating again', async () => {
  fetchResumeDocument.mockImplementation(async (value: string) => { if (value === id) return doc; throw new Error('Read unavailable'); }); view(); const user = await edit();
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText(/was saved, but its text could not be verified/);
  expect(screen.queryByRole('link', { name: 'Use this version in Apply Gate' })).not.toBeInTheDocument();
  fetchResumeDocument.mockResolvedValue({ id: saved, name: 'Front desk revised', text: edited, fingerprint: 'b'.repeat(64) });
  await user.click(screen.getByRole('button', { name: 'Retry verification' })); await screen.findByText(/Saved and verified/); expect(createResumeVariant).toHaveBeenCalledTimes(1);
});
test('a mismatched saved response never enables use and retains user edits', async () => {
  fetchResumeDocument.mockImplementation(async (value: string) => value === id ? doc : { ...doc, id: saved }); view(); const user = await edit();
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText(/was saved, but its text could not be verified/);
  expect(screen.getByLabelText('Resume text to save')).toHaveValue(edited); expect(screen.queryByRole('link', { name: 'Use this version in Apply Gate' })).not.toBeInTheDocument();
});
test('default replacement is opt-in and a failed save never changes it separately', async () => {
  createResumeVariant.mockRejectedValue(new Error('Unavailable')); view(); const user = await edit(); await user.click(screen.getByLabelText(/Use this new version as my default/));
  await user.click(screen.getByRole('button', { name: 'Save as new version' })); await screen.findByText('Unavailable'); expect(createResumeVariant.mock.calls[0][0].defaultMode).toBe('replace');
});
test('draft survives navigation and source refresh never overwrites it; explicit discard is confirmed', async () => {
  const first = view(); const user = await edit(); first.unmount(); fetchResumeDocument.mockResolvedValue({ ...doc, name: 'Renamed source', fingerprint: 'c'.repeat(64) });
  view(first.client); await screen.findByText(/source changed/); expect(screen.getByLabelText('Resume text to save')).toHaveValue(edited);
  await user.click(screen.getByRole('button', { name: 'Discard this draft' })); await user.click(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Resume text to save')).toHaveValue(edited);
  await user.click(screen.getByRole('button', { name: 'Discard this draft' })); await user.click(screen.getByRole('button', { name: 'Confirm discard' })); await waitFor(() => expect(screen.getByLabelText('Resume text to save')).toHaveValue(text));
});
test('an unavailable initial document never becomes an empty editable resume', async () => {
  fetchResumeDocument.mockRejectedValue(new Error('That resume is no longer available.')); view(); await screen.findByText('That resume is no longer available.');
  expect(screen.queryByLabelText('Resume text to save')).not.toBeInTheDocument(); expect(createResumeVariant).not.toHaveBeenCalled();
});
test('late save result after unmount cannot update another account or navigate', async () => {
  let finish!: (value: unknown) => void; createResumeVariant.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const first = view(); const user = await edit(); await user.click(screen.getByRole('button', { name: 'Save as new version' })); first.unmount();
  useAuth.mockReturnValue({ user: { uid: 'other' } }); view(first.client, 'other'); await screen.findByLabelText('Resume text to save'); expect(screen.getByLabelText('Resume text to save')).toHaveValue(text);
  await act(async () => finish({ success: true, id: saved })); expect(onSaved).not.toHaveBeenCalled(); expect(fetchResumeDocument).not.toHaveBeenCalledWith(saved); expect(screen.queryByText(/Saved and verified/)).not.toBeInTheDocument();
});
test('comparison loads exactly two documents and renders source HTML as text', async () => {
  fetchResumeDocument.mockImplementation(async (value: string) => ({ ...doc, id: value, name: value === id ? 'First' : 'Second', text: value === id ? text : `${text}\n<script>alert('test')</script>` }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}><ResumeTextComparison ids={[id, second]} owner="owner" /></QueryClientProvider>);
  await screen.findByText('Second'); expect(fetchResumeDocument.mock.calls.map(c => c[0]).sort()).toEqual([id, second].sort()); expect(document.querySelector('script')).toBeNull(); expect(screen.getByText(/lines only/)).toBeInTheDocument();
});
