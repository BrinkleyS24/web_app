import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { ResumeSubmissions } from './ResumeSubmissions';
const { fetchResumeSubmissions, confirmSubmittedResume } = vi.hoisted(() => ({ fetchResumeSubmissions: vi.fn(), confirmSubmittedResume: vi.fn() }));
vi.mock('@/lib/emails', async () => ({ ...await vi.importActual('@/lib/emails'), fetchResumeSubmissions, confirmSubmittedResume }));
const variants = [{ id: 'A', name: 'Default QA', isDefault: true, createdAt: '', charCount: 100 }, { id: 'B', name: 'Other version', isDefault: false, createdAt: '', charCount: 100 }];
const application = { id: '9007199254740993', company: 'Cedar', role: 'QA Engineer', source: 'manual', appliedAt: null, outcomeLabel: 'interviewed', submission: null };
function setup(owner = 'owner-a', openOnArrival = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><ResumeSubmissions key={owner} owner={owner} variants={variants} openOnArrival={openOnArrival} /></QueryClientProvider>);
  return { ...view, client };
}
beforeEach(() => {
  vi.resetAllMocks();
  fetchResumeSubmissions.mockResolvedValue({ success: true, applications: [application], nextCursor: null, unlinkedSubmissions: 0 });
  confirmSubmittedResume.mockResolvedValue({ success: true });
});
test('no default is selected for an application without a confirmed submission', async () => {
  setup();
  const select = await screen.findByRole('combobox');
  expect(select).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
  expect(screen.getByText(/Submitted resume unknown/)).toBeInTheDocument();
  await userEvent.selectOptions(select, 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(confirmSubmittedResume).toHaveBeenCalledWith(application.id, { variantId: 'B', expectedRevision: 0, requestId: expect.any(String) });
});

test('temporarily unverified library choices preserve selection and prevent confirmation until recovery', async () => {
  const { client, rerender } = setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  const content = (available: boolean) => <QueryClientProvider client={client}><ResumeSubmissions key="owner-a" owner="owner-a" variants={variants} openOnArrival choicesAvailable={available} /></QueryClientProvider>;
  rerender(content(false));
  expect(screen.getByRole('combobox')).toHaveValue('B');
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
  expect(confirmSubmittedResume).not.toHaveBeenCalled();
  rerender(content(true));
  expect(screen.getByRole('combobox')).toHaveValue('B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(confirmSubmittedResume).toHaveBeenCalledTimes(1);
  expect(confirmSubmittedResume).toHaveBeenCalledWith(application.id, expect.objectContaining({ variantId: 'B' }));
});
test('returning a confirmed application to unknown explicitly clears version credit', async () => {
  fetchResumeSubmissions.mockResolvedValue({ applications: [{ ...application, submission: { variantId: 'A', name: 'QA at submission', revision: 3, documentAvailable: true } }] });
  setup(); await userEvent.selectOptions(await screen.findByRole('combobox'), 'unknown');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(confirmSubmittedResume).toHaveBeenCalledWith(application.id, expect.objectContaining({ variantId: null, expectedRevision: 3 }));
});
test('a lost-response retry keeps its request identity and visible selection', async () => {
  confirmSubmittedResume.mockRejectedValueOnce(new Error('Could not confirm the save. Retry.')).mockResolvedValueOnce({ success: true });
  setup(); await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
  expect(screen.getByRole('combobox')).toHaveValue('B');
  await userEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  expect(confirmSubmittedResume.mock.calls[1]).toEqual(confirmSubmittedResume.mock.calls[0]);
});
test('conflict does not overwrite a saved choice; explicit reload adopts current revision', async () => {
  confirmSubmittedResume.mockRejectedValue(new Error('This confirmation changed in another request.'));
  setup(); await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('another request');
  fetchResumeSubmissions.mockResolvedValue({ applications: [{ ...application, submission: { variantId: 'A', name: 'QA saved elsewhere', revision: 1, documentAvailable: true } }] });
  await userEvent.click(screen.getByRole('button', { name: 'Reload saved choice' }));
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('A'));
  expect(screen.getByText(/Confirmed submitted: QA saved elsewhere/)).toBeInTheDocument();
});
test('an unavailable page offers retry and never pretends the application list is empty', async () => {
  fetchResumeSubmissions.mockRejectedValueOnce(new Error('Database unavailable'));
  setup(); expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  expect(screen.queryByText(/No tracked applications/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try loading applications again' }));
  expect(await screen.findByRole('combobox')).toHaveValue('');
});
test('pagination passes the exact cursor and unlinked history is disclosed without guessed credit', async () => {
  fetchResumeSubmissions.mockResolvedValueOnce({ applications: [application], nextCursor: '9007199254740993', unlinkedSubmissions: 1 }).mockResolvedValue({ applications: [], nextCursor: null });
  setup(); expect(await screen.findByText(/application link that changed/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More applications' }));
  await waitFor(() => expect(fetchResumeSubmissions).toHaveBeenLastCalledWith('9007199254740993'));
  expect(await screen.findByRole('button', { name: 'Previous applications' })).toBeInTheDocument();
});
test('archived confirmation keeps its original name and is not silently replaced with the default', async () => {
  fetchResumeSubmissions.mockResolvedValue({ applications: [{ ...application, submission: { variantId: 'archived', name: 'Version actually sent', revision: 1, documentAvailable: true, archived: true } }] });
  setup(); expect(await screen.findByText(/Confirmed submitted: Version actually sent/)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('archived');
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
});
test('switching account uses a separate cache and immediately removes the previous account selection', async () => {
  const { rerender, client } = setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  fetchResumeSubmissions.mockReturnValue(new Promise(() => {}));
  rerender(<QueryClientProvider client={client}><ResumeSubmissions key="owner-b" owner="owner-b" variants={[]} openOnArrival /></QueryClientProvider>);
  expect(screen.queryByText(/Cedar/)).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('Loading');
});

test('application forms stay out of the default view until explicitly opened', async () => {
  setup('owner-a', false);
  const toggle = screen.getByRole('button', { name: 'Review submitted resumes' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await screen.findByText(/1 application on this page/)).toBeVisible();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await userEvent.click(toggle);
  expect(screen.getByRole('combobox')).toHaveValue('');
});

test('collapsing a pending confirmation preserves its request and retry after a lost response', async () => {
  let rejectSave: (error: Error) => void;
  confirmSubmittedResume.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }))
    .mockResolvedValueOnce({ success: true });
  setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hide application confirmations' }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await act(async () => rejectSave!(new Error('Acknowledgement lost. Retry.')));
  await userEvent.click(screen.getByRole('button', { name: 'Review submitted resumes' }));
  expect(screen.getByRole('combobox')).toHaveValue('B');
  expect(screen.getByRole('alert')).toHaveTextContent('Acknowledgement lost');
  await userEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  expect(confirmSubmittedResume.mock.calls[1]).toEqual(confirmSubmittedResume.mock.calls[0]);
});

test('a newly received application deep link opens a previously collapsed panel', async () => {
  const { rerender, client } = setup('owner-a', false);
  await screen.findByText(/1 application on this page/);
  rerender(<QueryClientProvider client={client}><ResumeSubmissions key="owner-a" owner="owner-a" variants={variants} openOnArrival /></QueryClientProvider>);
  expect(await screen.findByRole('combobox')).toBeVisible();
});

test('a deep link waits for the expanded application rows before scrolling, and does not force later manual expansion', async () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  const scrolledWhileHidden: boolean[] = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: function(this: HTMLElement) {
    scrolledWhileHidden.push(Boolean((this.querySelector('#resume-submission-choices') as HTMLElement)?.hidden));
  } });
  let finish: (value: unknown) => void;
  fetchResumeSubmissions.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  try {
    setup();
    expect(scrolledWhileHidden).toEqual([]);
    await act(async () => finish!({ applications: [application], nextCursor: null }));
    await screen.findByRole('combobox');
    expect(scrolledWhileHidden).toEqual([false]);
    await userEvent.click(screen.getByRole('button', { name: 'Hide application confirmations' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review submitted resumes' }));
    expect(scrolledWhileHidden).toEqual([false]);
  } finally { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScroll }); }
});
