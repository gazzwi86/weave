import { useCallback, useEffect, useState } from "react";

import { isDismissed as isDismissedIn, type DismissalKind, type DismissalRecord } from "./dismissals";
import { fetchOnboardingStateOnce } from "./onboarding-state-client";
import type { ChecklistSignals } from "../../../shared/onboarding/derive-checklist";
import type { RolePath } from "../../../shared/onboarding/types";

export interface UseDismissalsResult {
  loading: boolean;
  isDismissed: (kind: DismissalKind, refId: string) => boolean;
  dismiss: (kind: DismissalKind, refId: string) => Promise<void>;
  restoreAllBeacons: () => Promise<void>;
  /** ONB-V1-TASK-003: same bootstrap payload's checklist signals -- callers
   * that need "is item X still open" derive it from these, no second fetch. */
  signals: ChecklistSignals;
  rolePath: RolePath | null;
}

interface BootstrapBody {
  dismissals?: DismissalRecord[];
  role_path?: RolePath;
  sandbox_workspace_id?: string | null;
  sandbox_forked_at?: string | null;
  tours?: ChecklistSignals["tours"];
  exercise_completions?: ChecklistSignals["exerciseCompletions"];
  activations?: ChecklistSignals["activations"];
}

const EMPTY_SIGNALS: ChecklistSignals = {
  sandboxWorkspaceId: null,
  sandboxForkedAt: null,
  tours: [],
  exerciseCompletions: [],
  activations: [],
};

function toSignals(body: BootstrapBody): ChecklistSignals {
  return {
    sandboxWorkspaceId: body.sandbox_workspace_id ?? null,
    sandboxForkedAt: body.sandbox_forked_at ?? null,
    tours: body.tours ?? [],
    exerciseCompletions: body.exercise_completions ?? [],
    activations: body.activations ?? [],
  };
}

/**
 * ONB-TASK-008: bootstraps dismissals once from `/api/onboarding/state`
 * (brief's "one query, no per-beacon fetches" hint) and persists
 * dismiss/restore actions optimistically against the proxy routes.
 * ONB-V1-TASK-003: also exposes checklist signals + rolePath from that same
 * fetch so beacon-gating logic never issues a second call to this endpoint.
 */
export function useDismissals(): UseDismissalsResult {
  const [dismissals, setDismissals] = useState<DismissalRecord[]>([]);
  const [signals, setSignals] = useState<ChecklistSignals>(EMPTY_SIGNALS);
  const [rolePath, setRolePath] = useState<RolePath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchOnboardingStateOnce()
      .then((body) => {
        if (cancelled || !body) return;
        const typed = body as unknown as BootstrapBody;
        setDismissals(typed.dismissals ?? []);
        setSignals(toSignals(typed));
        setRolePath(typed.role_path ?? null);
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
    signals,
    rolePath,
  };
}
