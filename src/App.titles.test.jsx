import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, test, expect, vi } from 'vitest';
import App, { APP_PAGE_TITLES, appPageTitle } from './App.jsx';

// Designer review, 2026-10-15: every app tab kept the marketing <title>, and /pricing was a 404.
const { authState } = vi.hoisted(() => ({ authState: { current: null } }));
vi.mock('./lib/AuthContext.jsx', () => ({ AuthProvider: ({ children }) => children, useAuth: () => authState.current }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./pages/Upgrade.jsx', () => ({ default: () => <div>Upgrade page</div> }));
vi.mock('./pages/DashboardNew.tsx', () => ({ default: () => <div>Dashboard page</div> }));
vi.mock('./pages/FixSuggestions.tsx', () => ({ default: () => <div>Next Actions page</div> }));
vi.mock('./pages/ApplyGate.tsx', () => ({ default: () => <div>ApplyGate page</div> }));
vi.mock('./pages/InterviewPrep.tsx', () => ({ default: () => <div>Prep page</div> }));

afterEach(cleanup);
const premium = { user: { uid: 'u1' }, loading: false, planLoading: false, bridgeDone: true, plan: 'premium', planError: '', adminEmail: false };
function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

test('each workspace page names itself in the browser tab', () => {
  authState.current = premium;
  document.title = 'Applendium™ | Automatic Job Application Tracker for Gmail';
  const view = renderAt('/next-actions');
  expect(screen.getByText('Next Actions page')).toBeInTheDocument();
  expect(document.title).toBe('Next Actions · Applendium');
  view.unmount();
  renderAt('/apply-gate?action=0123456789abcdef&version=fedcba9876543210');
  expect(document.title).toBe('Apply Gate · Applendium');
});

test('every app page has a distinct title and public pages are left to set their own', () => {
  const titles = Object.keys(APP_PAGE_TITLES).map(appPageTitle);
  expect(new Set(titles).size).toBe(titles.length);
  expect(appPageTitle('/dashboard/')).toBe('Dashboard · Applendium');
  expect(appPageTitle('/interview-prep')).toBe('Interview Prep · Applendium');
  expect(appPageTitle('/')).toBeNull();
  expect(appPageTitle('/upgrade')).toBeNull();
});

test('/pricing redirects to the plans page instead of a 404', () => {
  authState.current = { ...premium, user: null };
  renderAt('/pricing');
  expect(screen.getByText('Upgrade page')).toBeInTheDocument();
});
