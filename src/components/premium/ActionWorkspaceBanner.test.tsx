import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { ActionWorkspaceBanner } from './ActionWorkspaceBanner';

const mocks=vi.hoisted(()=>({ complete:vi.fn(), source:vi.fn() }));
vi.mock('@/lib/interviewPrep',()=>({fetchInterviewSource:(...args:unknown[])=>mocks.source(...args)}));
vi.mock('@/lib/AuthContext.jsx',()=>({ useAuth:()=>({user:{uid:'original-owner'}}) }));
vi.mock('@/lib/emails',()=>({ completeQueueAction:mocks.complete }));
vi.mock('@/hooks/useWorkspaceAction',()=>({useWorkspaceAction:()=>({
  action:{id:'task',logicalKey:'aaaaaaaaaaaaaaaa',dedupeKey:'bbbbbbbbbbbbbbbb',title:'Review this role',effectiveStatus:'open'},
  queue:{isError:false,isPending:false,isFetching:false},
})}));

describe('task completion while leaving a linked workspace',()=>{
  test('an interview task without evidence still renders its compact context safely',async()=>{
    mocks.source.mockResolvedValue({kind:'general',sourceVersion:'a'.repeat(64)});
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/interview-prep?action=aaaaaaaaaaaaaaaa&version=bbbbbbbbbbbbbbbb']}><ActionWorkspaceBanner /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText('Why this practice task')).toBeVisible();expect(screen.getByText(/Mark done records practice progress/)).toBeVisible();
    await waitFor(()=>expect(screen.getByRole('button',{name:"I've finished this task"})).toBeEnabled());client.clear();
  });
  test('a confirmed late save refreshes its owner after unmount without touching another account',async()=>{
    let resolveSave:(value:unknown)=>void;
    mocks.complete.mockImplementation(()=>new Promise(resolve=>{resolveSave=resolve;}));
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const original=['dashboard','queue','original-owner'],other=['dashboard','queue','other-owner'];
    client.setQueryData(original,{saved:false});client.setQueryData(other,{saved:false});
    const view=render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/apply-gate?action=aaaaaaaaaaaaaaaa&version=bbbbbbbbbbbbbbbb']}><ActionWorkspaceBanner /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button',{name:"I've finished this task"}));
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async()=>resolveSave!({success:true,state:'completed'}));
    await waitFor(()=>expect(client.getQueryState(original)?.isInvalidated).toBe(true));
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    client.clear();
  });
});
