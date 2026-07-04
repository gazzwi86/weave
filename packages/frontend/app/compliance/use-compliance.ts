import { useEffect, useState } from "react";

export interface ActorCount {
  principal_iri: string;
  event_count: number;
}

export interface ComplianceSummary {
  chain_status: "valid" | "broken";
  entries_checked: number;
  first_broken_seq: number | null;
  by_event_category: Record<string, number>;
  top_actors: ActorCount[];
  period: string;
}

export interface ComplianceState {
  summary: ComplianceSummary | null;
  loadError: boolean;
}

/** AC-7: fetches the tenant's compliance summary once on mount. The
 * response shape never includes `diff_summary` (redaction is structural on
 * the backend), so there is nothing extra for this hook to strip.
 */
export function useCompliance(): ComplianceState {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/audit/compliance", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("compliance_failed");
        }
        return res.json() as Promise<ComplianceSummary>;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        setSummary(data);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  return { summary, loadError };
}
