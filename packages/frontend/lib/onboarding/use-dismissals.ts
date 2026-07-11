import { useCallback, useEffect, useState } from "react";

import { isDismissed as isDismissedIn, type DismissalKind, type DismissalRecord } from "./dismissals";

export interface UseDismissalsResult {
  loading: boolean;
  isDismissed: (kind: DismissalKind, refId: string) => boolean;
  dismiss: (kind: DismissalKind, refId: string) => Promise<void>;
  restoreAllBeacons: () => Promise<void>;
}

/**
 * ONB-TASK-008: bootstraps dismissals once from `/api/onboarding/state`
 * (brief's "one query, no per-beacon fetches" hint) and persists
 * dismiss/restore actions optimistically against the proxy routes.
 */
export function useDismissals(): UseDismissalsResult {
  const [dismissals, setDismissals] = useState<DismissalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/state")
      .then((res) => res.json())
      .then((body: { dismissals?: DismissalRecord[] }) => {
        if (!cancelled) setDismissals(body.dismissals ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async (kind: DismissalKind, refId: string) => {
    setDismissals((prev) => [...prev, { kind, ref_id: refId }]);
    await fetch(`/api/onboarding/dismissals/${kind}/${refId}`, { method: "PUT" });
  }, []);

  const restoreAllBeacons = useCallback(async () => {
    setDismissals((prev) => prev.filter((d) => d.kind !== "beacon"));
    await fetch("/api/onboarding/dismissals/beacon", { method: "DELETE" });
  }, []);

  return {
    loading,
    isDismissed: (kind, refId) => isDismissedIn(dismissals, kind, refId),
    dismiss,
    restoreAllBeacons,
  };
}
