import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import { invalidateApplyGateViews, invalidateTaskViews } from './taskQueries';

describe('shared saved-task projections', () => {
  test('a late acknowledgement invalidates its original owner without affecting a new account', async () => {
    const client = new QueryClient();
    const previous=['dashboard','queue','previous-owner'],current=['dashboard','queue','current-owner'];
    client.setQueryData(previous,{saved:false});client.setQueryData(current,{saved:false});
    await invalidateTaskViews(client,'previous-owner');
    expect(client.getQueryState(previous)?.isInvalidated).toBe(true);
    expect(client.getQueryState(current)?.isInvalidated).toBe(false);
    client.clear();
  });
  test('refreshes task consumers without clearing unrelated work', async () => {
    const client = new QueryClient();
    const keys = [
      ['fix-suggestions', 'queue', 'owner'], ['dashboard', 'queue', 'owner'],
      ['strategy-alerts', 'owner'], ['interview-prep', 'source', 'owner', 'task'],
    ];
    for (const key of [...keys, ['resume-editor', 'draft'], ['apply-gate-history', 'owner']]) client.setQueryData(key, { saved: true });
    await invalidateTaskViews(client);
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['resume-editor', 'draft'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['apply-gate-history', 'owner'])?.isInvalidated).toBe(false);
    await invalidateApplyGateViews(client);
    expect(client.getQueryState(['apply-gate-history', 'owner'])?.isInvalidated).toBe(true);
    expect(client.getQueryData(['resume-editor', 'draft'])).toEqual({ saved: true });
    client.clear();
  });
});
