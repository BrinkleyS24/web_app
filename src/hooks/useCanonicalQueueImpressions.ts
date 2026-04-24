import { useEffect } from "react";

import { recordQueueActionImpression, type RankedAction } from "@/lib/emails";
import { buildQueueImpressionPayload } from "@/lib/premiumTaskQueue";

const seenCanonicalQueueDedupeKeys = new Set<string>();

export function resetCanonicalQueueImpressionSession() {
  seenCanonicalQueueDedupeKeys.clear();
}

export function useCanonicalQueueImpressions(params: {
  enabled: boolean;
  actions: RankedAction[];
}) {
  const { enabled, actions } = params;

  useEffect(() => {
    if (!enabled || !Array.isArray(actions) || actions.length === 0) return;

    const payload = buildQueueImpressionPayload(actions).filter((item) => {
      const key = String(item.dedupeKey || item.logicalKey || "").trim();
      if (!key) return false;
      if (seenCanonicalQueueDedupeKeys.has(key)) return false;
      seenCanonicalQueueDedupeKeys.add(key);
      return true;
    });

    if (payload.length === 0) return;

    Promise.all(
      payload.map((item) => recordQueueActionImpression(item).catch(() => undefined)),
    ).catch(() => undefined);
  }, [actions, enabled]);
}
