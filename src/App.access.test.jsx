import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { afterEach, test, expect, vi } from 'vitest';
import App from './App.jsx';
const { authState } = vi.hoisted(() => ({ authState: { current: null, clients: [] } }));
vi.mock('./lib/AuthContext.jsx', () => ({ AuthProvider: ({children}) => children, useAuth: () => authState.current }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./pages/Landing.jsx', () => ({ default: () => <div>Landing</div> }));
vi.mock('./pages/Privacy.jsx', () => ({ default: () => <div>Privacy</div> }));
vi.mock('./pages/Terms.jsx', () => ({ default: () => <div>Terms</div> }));
vi.mock('./pages/Upgrade.jsx', () => ({ default: () => <div>Upgrade</div> }));
vi.mock('./pages/DashboardNew.tsx', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('./pages/PaymentSuccess.tsx', () => ({ default: () => <div>PaymentSuccess</div> }));
vi.mock('./pages/PaymentCancel.tsx', () => ({ default: () => <div>PaymentCancel</div> }));
vi.mock('./pages/ApplyGate.tsx', () => ({ default: () => <div>ApplyGate</div> }));
vi.mock('./pages/Resumes.tsx', () => ({ default: () => {
  const client = useQueryClient();
  authState.clients.push(client);
  const previous = client.getQueryData(['fixture-private']);
  client.setQueryData(['fixture-private'], authState.current.user.uid);
  return <div>Resumes {previous || 'empty'}</div>;
} }));
vi.mock('./pages/FixSuggestions.tsx', () => ({ default: () => <div>FixSuggestions</div> }));
vi.mock('./pages/StrategyAlerts.tsx', () => ({ default: () => <div>StrategyAlerts</div> }));
vi.mock('./pages/WeeklySummary.tsx', () => ({ default: () => <div>WeeklySummary</div> }));
vi.mock('./pages/Settings.tsx', () => ({ default: () => <div>Settings</div> }));
vi.mock('./pages/AdminAnalytics.tsx', () => ({ default: () => <div>AdminAnalytics</div> }));
vi.mock('./pages/AdminDebug.tsx', () => ({ default: () => <div>AdminDebug</div> }));
vi.mock('./pages/AdminJobs.tsx', () => ({ default: () => <div>AdminJobs</div> }));
vi.mock('./pages/AdminReview.tsx', () => ({ default: () => <div>AdminReview</div> }));
vi.mock('./pages/AdminUsers.tsx', () => ({ default: () => <div>AdminUsers</div> }));
vi.mock('./pages/NotFound.tsx', () => ({ default: () => <div>NotFound</div> }));
afterEach(cleanup);
const signedIn = (uid = 'account-a') => ({ user: { uid }, plan: 'free', loading: false, planLoading: false, bridgeDone: true });
function tree() { return <MemoryRouter initialEntries={['/resumes']}><App /></MemoryRouter>; }
test('a signed-in free user can reach resume management', () => {
  authState.current = signedIn(); render(tree());
  expect(screen.getByText('Resumes empty')).toBeInTheDocument();
  expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
});
test('signed-out users still cannot access resume management', () => {
  authState.current = { ...signedIn(), user: null }; render(tree());
  expect(screen.getByText('Upgrade')).toBeInTheDocument();
});
test('account changes remount page state and isolate the query cache', () => {
  authState.clients = [];
  authState.current = signedIn();
  const result = render(tree());
  expect(screen.getByText('Resumes empty')).toBeInTheDocument();
  const oldClient = authState.clients[0];
  authState.current = signedIn('account-b'); result.rerender(tree());
  expect(screen.getByText('Resumes empty')).toBeInTheDocument();
  const newClient = authState.clients.at(-1);
  expect(newClient).not.toBe(oldClient);
  oldClient.setQueryData(['fixture-private'], 'late private response');
  expect(newClient.getQueryData(['fixture-private'])).toBe('account-b');
});
