import { useQuery } from "@tanstack/react-query";
import { fetchRankedActionQueue } from "@/lib/emails";

export function useWorkspaceAction(logicalKey?: string, ownerId?: string) {
  const queue = useQuery({
    queryKey: ["fix-suggestions", "queue", ownerId],
    queryFn: async () => {
      const response = await fetchRankedActionQueue();
      if (!response.success || !Array.isArray(response.queue?.resolvedActions)) throw new Error("Your action could not be loaded.");
      return response;
    },
    enabled: Boolean(logicalKey && ownerId),
    staleTime: 0,
    retry: false,
  });
  const action = queue.data?.queue.resolvedActions?.filter(item => item.logicalKey === logicalKey && item.effectiveStatus !== "expired")
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime() || String(left.dedupeKey).localeCompare(String(right.dedupeKey)))[0];
  return { queue, action };
}
