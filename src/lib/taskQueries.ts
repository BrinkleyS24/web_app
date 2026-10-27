import type { QueryClient } from "@tanstack/react-query";

/** All projections of saved task progress and its supporting evidence. */
export function invalidateTaskViews(client: QueryClient, ownerId?: string) {
  const predicate = ownerId ? (query: {queryKey: readonly unknown[]}) => query.queryKey.includes(ownerId) : undefined;
  return Promise.all([
    client.invalidateQueries({ queryKey: ["fix-suggestions"], predicate }),
    client.invalidateQueries({ queryKey: ["dashboard", "queue"], predicate }),
    client.invalidateQueries({ queryKey: ["strategy-alerts"], predicate }),
    client.invalidateQueries({ queryKey: ["interview-prep"], predicate }),
  ]);
}

export function invalidateApplyGateViews(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({queryKey:["apply-gate-history"]}),
    invalidateTaskViews(client),
  ]);
}
