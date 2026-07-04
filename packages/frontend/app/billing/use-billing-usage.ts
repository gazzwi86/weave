import { useCallback, useEffect, useState } from "react";

export interface WorkspaceUsage {
  workspace_id: string;
  total_tokens: number;
  total_runs: number;
  total_cost_usd: number;
}

export interface UsageSummary {
  period: string;
  total_tokens: number;
  total_runs: number;
  total_cost_usd: number;
  by_workspace: WorkspaceUsage[];
  cap_utilisation_pct: number;
}

export interface CapReachedError {
  effective_cap_usd: number;
  consumed_usd: number;
}

export interface BillingUsageState {
  usage: UsageSummary | null;
  /** True when the last usage fetch failed (network/upstream error). */
  loadError: boolean;
  /** Set when the last simulated AI call was rejected by the budget gate
   * (AC-2's 429 `budget_cap_reached`) -- null otherwise. */
  capError: CapReachedError | null;
  simulating: boolean;
  refresh: () => void;
  simulateAiCall: (workspaceId: string) => Promise<void>;
}

/** Fetches the tenant-wide usage summary whenever `version` changes --
 * split out of `useBillingUsage` to keep each hook under the function
 * length budget.
 */
function useUsageFetch(version: number): { usage: UsageSummary | null; loadError: boolean } {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/usage", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("usage_failed");
        }
        return res.json() as Promise<UsageSummary>;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        setUsage(data);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, [version]);

  return { usage, loadError };
}

/** AC-5/AC-2: fetches the tenant-wide usage summary for the minimal usage
 * dashboard, and drives the harness "Simulate AI call" button so the
 * pre-call budget gate's 429 rejection is visible in the browser.
 */
export function useBillingUsage(): BillingUsageState {
  const [capError, setCapError] = useState<CapReachedError | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [version, setVersion] = useState(0);
  const { usage, loadError } = useUsageFetch(version);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const simulateAiCall = useCallback(
    async (workspaceId: string) => {
      setSimulating(true);
      setCapError(null);
      try {
        const res = await fetch("/api/billing/simulate-ai-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            model_tier: "sonnet",
            input_tokens: 10,
            output_tokens: 10,
            cost_usd: 1.0,
          }),
        });
        if (res.status === 429) {
          const body = (await res.json()) as { detail: CapReachedError };
          setCapError(body.detail);
          return;
        }
        refresh();
      } finally {
        setSimulating(false);
      }
    },
    [refresh]
  );

  return { usage, loadError, capError, simulating, refresh, simulateAiCall };
}
