import React from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, test, expect, vi } from 'vitest';
import App, { SIGNED_OUT_GRACE_MS } from './App.jsx';

// 2026-10-14: signed-out /dashboard showed a bare "Loading..." for 8-20 s, then redirected to
// /upgrade. These pin the new decision: fast and in place, and never away from a user who is
// still being signed in by the extension.
const { authState } = vi.hoisted(() => ({ authState: { current: null } }));
vi.mock('./lib/AuthContext.jsx', () => ({ AuthProvider: ({ children }) => children, useAuth: () => authState.current }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./pages/Upgrade.jsx', () => ({ default: () => <div>Upgrade page</div> }));
vi.mock('./pages/DashboardNew.tsx', () => ({ default: () => <div>Dashboard page</div> }));
vi.mock('./pages/ApplyGate.tsx', () => ({ default: () => <div>ApplyGate page</div> }));
vi.mock('./pages/Settings.tsx', () => ({ default: () => <div>Settings page</div> }));

const base = { user: null, loading: false, bridgeDone: false, extensionDetected: false, plan: null, planLoading: false, planError: '', adminEmail: false };
function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

test('a visitor with no extension gets the signed-out page within the grace period, not a long spinner', () => {
  authState.current = { ...base };
  renderAt('/dashboard');
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(SIGNED_OUT_GRACE_MS); });
  expect(screen.getByTestId('signed-out-workspace')).toHaveTextContent('Your Applendium™ workspace opens from the extension.');
  expect(screen.getByTestId('signed-out-checking')).toHaveTextContent('Checking for the Applendium™ extension');
  expect(screen.getByRole('link', { name: /See plans and Premium/ })).toHaveAttribute('href', '/upgrade?source=web_gate_dashboard');
  expect(screen.queryByText('Upgrade page')).toBeNull();
  expect(SIGNED_OUT_GRACE_MS).toBeLessThanOrEqual(2000);
});

test('once the bridge has finished with nobody signed in, the signed-out page shows at once', () => {
  authState.current = { ...base, bridgeDone: true };
  renderAt('/apply-gate');
  expect(screen.getByTestId('signed-out-workspace')).toBeInTheDocument();
  expect(screen.getByTestId('signed-out-checking')).toHaveTextContent('');
});

test('while the extension is signing someone in, they wait on a spinner and are never sent away', () => {
  authState.current = { ...base, extensionDetected: true };
  const view = renderAt('/dashboard');
  act(() => { vi.advanceTimersByTime(30000); });
  expect(screen.getByText(/Signing you in from the Applendium™ extension/)).toBeInTheDocument();
  expect(screen.queryByTestId('signed-out-workspace')).toBeNull();

  // The bridge signs them in: the page they asked for appears at the same URL.
  authState.current = { ...base, extensionDetected: true, bridgeDone: true, user: { uid: 'u1' }, plan: 'premium' };
  view.rerender(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
  expect(screen.getByText('Dashboard page')).toBeInTheDocument();
});

test('a late bridge sign-in after the signed-out page replaces it with the real page, no redirect', () => {
  authState.current = { ...base };
  const view = renderAt('/settings');
  act(() => { vi.advanceTimersByTime(SIGNED_OUT_GRACE_MS); });
  expect(screen.getByTestId('signed-out-workspace')).toBeInTheDocument();
  authState.current = { ...base, user: { uid: 'u1' }, plan: 'free', bridgeDone: true };
  view.rerender(<MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter>);
  expect(screen.getByText('Settings page')).toBeInTheDocument();
});

test('a signed-in premium user whose plan is still loading is held, not redirected', () => {
  authState.current = { ...base, user: { uid: 'u1' }, planLoading: true, bridgeDone: true };
  renderAt('/dashboard');
  act(() => { vi.advanceTimersByTime(30000); });
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByText('Upgrade page')).toBeNull();
});

test('a signed-in free user on a Premium page still goes to Upgrade', () => {
  authState.current = { ...base, user: { uid: 'u1' }, plan: 'free', bridgeDone: true };
  renderAt('/dashboard');
  expect(screen.getByText('Upgrade page')).toBeInTheDocument();
});

test('someone who already uses the extension can sign in on the signed-out page (2026-10-15)', async () => {
  vi.resetModules();
  vi.doMock('./lib/firebase.js', () => ({ firebaseConfigured: true, signInWithGoogle: vi.fn(() => Promise.reject(new Error('popup closed'))), auth: null }));
  const { default: SignedOutWorkspace } = await import('./components/landing/SignedOutWorkspace.jsx');
  const firebase = await import('./lib/firebase.js');
  vi.useRealTimers();
  render(<MemoryRouter><SignedOutWorkspace /></MemoryRouter>);
  const panel = screen.getByTestId('signed-out-web-sign-in');
  expect(panel).toHaveTextContent('Already use the extension?');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  expect(firebase.signInWithGoogle).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in did not finish');
  vi.doUnmock('./lib/firebase.js');
});
