import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext.jsx";

/** In-memory only. App.AccountQueryScope creates a new cache/remount on account change. */
export function useDraftSession<T>(key: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  const queryKey = ["outreach-draft-session", user?.uid || "signed-out", key];
  const query = useQuery({ queryKey, queryFn: () => ({} as Record<string, T>), initialData: {} as Record<string, T>, enabled: false, gcTime: 30 * 60_000 });
  const update = (fn: (current: Record<string, T>) => Record<string, T>) => {
    client.setQueryData<Record<string, T>>(queryKey, current => fn(current || {}));
  };
  return [query.data, update] as const;
}
