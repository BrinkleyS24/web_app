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
async function openRecordedCorrection() {
  await userEvent.click(await screen.findByText(/^Recorded on this page \(/));
  await userEvent.click(screen.getByRole('button', { name: 'Change submitted resume' }));
}
beforeEach(() => {
  vi.resetAllMocks();
  fetchResumeSubmissions.mockResolvedValue({ success: true, applications: [application], nextCursor: null, unlinkedSubmissions: 0 });
  confirmSubmittedResume.mockResolvedValue({ success: true });
});

function persistentService(initial = [application]) {
  let applications = structuredClone(initial) as Array<Record<string, any>>;
  fetchResumeSubmissions.mockImplementation(async () => ({ success: true, applications, nextCursor: null, unlinkedSubmissions: 0 }));
  confirmSubmittedResume.mockImplementation(async (id, body) => {
    applications = applications.map(a => a.id !== id ? a : { ...a, submission: {
      variantId: body.variantId, name: variants.find(v => v.id === body.variantId)?.name ?? null,
      revision: body.expectedRevision + 1, confirmedAt: '2026-11-12T16:00:00Z', source: 'user_confirmed',
      documentAvailable: body.variantId !== null, archived: false,
    } });
    return { success: true };
  });
  return () => applications;
}

test('persisted confirmation leaves the actionable list, moves focus and survives remount in history', async () => {
  persistentService([application, { ...application, id: '9007199254740992', role: 'Next role' }]);
  const view = setup();
  await userEvent.selectOptions(await screen.findByLabelText('Submitted resume for application ' + application.id), 'B');
  await userEvent.click(within(screen.getByTestId('submission-' + application.id)).getByRole('button', { name: 'Confirm submitted resume' }));
  await waitFor(() => expect(screen.queryByLabelText('Submitted resume for application ' + application.id)).not.toBeVisible());
  expect(screen.getByLabelText('Submitted resume for application 9007199254740992')).toHaveFocus();
  expect(screen.getByRole('list', { name: 'Applications needing resume confirmation' })).not.toHaveTextContent('QA Engineer');
  expect(screen.getByText(/Find it under Recorded on this page/)).toBeVisible();
  await openRecordedCorrection();
  expect(screen.getByLabelText('Submitted resume for application ' + application.id)).toHaveValue('B');
  expect(within(screen.getByTestId('submission-' + application.id)).getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
  view.unmount();
  setup();
  expect(await screen.findByLabelText('Submitted resume for application 9007199254740992')).toBeVisible();
  expect(screen.queryByLabelText('Submitted resume for application ' + application.id)).not.toBeVisible();
  expect(confirmSubmittedResume).toHaveBeenCalledTimes(1);
});

test('an explicit unknown completes the task without assigning resume credit', async () => {
  const stored = persistentService(); setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'unknown');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(await screen.findByText('No applications on this page need confirmation.')).toBeVisible();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(stored()[0].submission.variantId).toBeNull();
  await openRecordedCorrection();
  expect(screen.getByText(/Recorded as unknown/)).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('unknown');
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeDisabled();
});

test('correction uses the recorded revision and returns to compact history after saving', async () => {
  const initial = { ...application, submission: { variantId: 'A', name: 'Original saved version', revision: 3, documentAvailable: true } };
  persistentService([initial] as any); setup();
  await openRecordedCorrection();
  await userEvent.selectOptions(screen.getByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  expect(confirmSubmittedResume).toHaveBeenCalledWith(application.id, expect.objectContaining({ variantId: 'B', expectedRevision: 3 }));
  // The history disclosure stays open; the correction form closes on the new revision.
  await userEvent.click(screen.getByRole('button', { name: 'Change submitted resume' }));
  expect(screen.getByRole('combobox')).toHaveValue('B');
});

test('clearing the current page still offers older applications without a global all-done claim', async () => {
  fetchResumeSubmissions.mockResolvedValueOnce({ success: true, applications: [{ ...application, submission: { variantId: null, name: null, revision: 1 } }], nextCursor: '9007199254740992' })
    .mockResolvedValue({ success: true, applications: [{ ...application, id: '9', role: 'Older role' }], nextCursor: null });
  setup();
  expect(await screen.findByText(/No applications on this page need confirmation/)).toHaveTextContent('Older applications are available below');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More applications' }));
  expect(await screen.findByLabelText('Submitted resume for application 9')).toBeVisible();
  expect(fetchResumeSubmissions).toHaveBeenLastCalledWith('9007199254740992');
});

test('a false save acknowledgment preserves the task and retry request', async () => {
  confirmSubmittedResume.mockResolvedValue({ success: false }); setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('save was not confirmed');
  expect(screen.getByRole('combobox')).toHaveValue('B');
  expect(screen.queryByText(/^Recorded on this page/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  expect(confirmSubmittedResume.mock.calls[1]).toEqual(confirmSubmittedResume.mock.calls[0]);
});

test('a failed read after a committed write reports the limitation instead of inventing completion', async () => {
  persistentService(); setup();
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  fetchResumeSubmissions.mockRejectedValue(new Error('Refresh unavailable'));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(await screen.findByText(/updated list could not be verified yet/)).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
  expect(screen.queryByText('No applications on this page need confirmation.')).not.toBeInTheDocument();
});

test('a named unavailable document stays actionable even though a prior choice exists', async () => {
  fetchResumeSubmissions.mockResolvedValue({ success: true, applications: [{ ...application, submission: { variantId: 'A', name: 'Changed saved document', revision: 2, documentAvailable: false } }], nextCursor: null });
  setup();
  expect(await screen.findByRole('combobox')).toHaveValue('A');
  expect(screen.getByRole('button', { name: 'Confirm submitted resume' })).toBeEnabled();
  expect(screen.getByText(/document is unavailable or changed/)).toBeVisible();
  expect(screen.queryByText(/^Recorded on this page/)).not.toBeInTheDocument();
});

test('pagination waits for outstanding writes so the save and retry cannot be unmounted', async () => {
  fetchResumeSubmissions.mockResolvedValue({ success: true, applications: [application], nextCursor: '9' });
  let rejectSave: (error: Error) => void;
  confirmSubmittedResume.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  setup(); await userEvent.selectOptions(await screen.findByRole('combobox'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm submitted resume' }));
  expect(screen.getByRole('button', { name: 'More applications' })).toBeDisabled();
  await act(async () => rejectSave!(new Error('Lost response')));
  expect(screen.getByRole('button', { name: 'More applications' })).toBeEnabled();
  expect(screen.getByRole('combobox')).toHaveValue('B');
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
  fetchResumeSubmissions.mockResolvedValue({ success: true, nextCursor: null, applications: [{ ...application, submission: { variantId: 'A', name: 'QA at submission', revision: 3, documentAvailable: true } }] });
  setup(); await openRecordedCorrection(); await userEvent.selectOptions(await screen.findByRole('combobox'), 'unknown');
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
  fetchResumeSubmissions.mockResolvedValue({ success: true, nextCursor: null, applications: [{ ...application, submission: { variantId: 'A', name: 'QA saved elsewhere', revision: 1, documentAvailable: true } }] });
  await userEvent.click(screen.getByRole('button', { name: 'Reload saved choice' }));
  await openRecordedCorrection();
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
  fetchResumeSubmissions.mockResolvedValueOnce({ success: true, applications: [application], nextCursor: '9007199254740993', unlinkedSubmissions: 1 }).mockResolvedValue({ success: true, applications: [], nextCursor: null });
  setup(); expect(await screen.findByText(/application link that changed/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More applications' }));
  await waitFor(() => expect(fetchResumeSubmissions).toHaveBeenLastCalledWith('9007199254740993'));
  expect(await screen.findByRole('button', { name: 'Previous applications' })).toBeInTheDocument();
});
test('archived confirmation keeps its original name and is not silently replaced with the default', async () => {
  fetchResumeSubmissions.mockResolvedValue({ success: true, nextCursor: null, applications: [{ ...application, submission: { variantId: 'archived', name: 'Version actually sent', revision: 1, documentAvailable: true, archived: true } }] });
  setup(); await openRecordedCorrection(); expect(await screen.findByText(/Confirmed submitted: Version actually sent/)).toBeVisible();
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
  expect(await screen.findByText(/1 needing confirmation/)).toBeVisible();
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
  await screen.findByText(/1 needing confirmation/);
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
    await act(async () => finish!({ success: true, applications: [application], nextCursor: null }));
    await screen.findByRole('combobox');
    expect(scrolledWhileHidden).toEqual([false]);
    await userEvent.click(screen.getByRole('button', { name: 'Hide application confirmations' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review submitted resumes' }));
    expect(scrolledWhileHidden).toEqual([false]);
  } finally { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScroll }); }
});
