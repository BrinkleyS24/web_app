import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApplyGateHistory, fetchResumeVariants } from "@/lib/emails";
import { alignApplyGateActions } from "@/lib/applyGateActionLink";
import type { QueueItem } from "@/lib/premiumTaskQueue";

/**
 * Apply Gate history and resume versions for aligning Apply Gate tasks with their latest check
 * (2026-10-15). Same query keys as the Apply Gate page, so opening a task's link finds both warm.
 * Either request failing only leaves the tasks as the backend wrote them.
 */
export function useApplyGateTaskAlignment(enabled: boolean) {
  const history = useQuery({
    queryKey: ["apply-gate-history"],
    queryFn: fetchApplyGateHistory,
    enabled,
    staleTime: 30_000,
  });
  const variants = useQuery({
    queryKey: ["resume-variants"],
    queryFn: fetchResumeVariants,
    enabled,
    staleTime: 60_000,
  });
  const historyItems = history.data?.history;
  const variantItems = variants.data?.variants;
  const align = useCallback(
    <T extends QueueItem>(items: T[]) => alignApplyGateActions(items, historyItems, variantItems),
    [historyItems, variantItems],
  );
  return { align, history };
}
