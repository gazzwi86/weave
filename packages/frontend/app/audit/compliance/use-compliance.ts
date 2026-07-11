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
  shacl_validated: number;
  shacl_rejections: number;
}

export interface ComplianceState {
  summary: ComplianceSummary | null;
  previous: ComplianceSummary | null;
  loadError: boolean;
}

/** Current month and the one before it, as "YYYY-MM" -- callers must only
 * call this from inside a mount effect, never during render or a useState
 * initializer (this codebase was bitten twice by `new Date()` causing SSR
 * hydration divergence).
 */
function currentAndPreviousMonth(): { current: string; previous: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const format = (y: number, m: number): string => `${y}-${String(m + 1).padStart(2, "0")}`;
  const prev = new Date(Date.UTC(year, month - 1, 1));
  return {
    current: format(year, month),
    previous: format(prev.getUTCFullYear(), prev.getUTCMonth()),
  };
}

async function fetchSummary(
  period: string,
  signal: AbortSignal
): Promise<ComplianceSummary> {
  const res = await fetch(`/api/audit/compliance?period=${period}`, { signal });
  if (!res.ok) {
    throw new Error("compliance_failed");
  }
  return res.json() as Promise<ComplianceSummary>;
}

/** AC-7: fetches the tenant's compliance summary for the current and
 * previous month on mount, so the page can show month-over-month deltas.
 * The response shape never includes `diff_summary` (redaction is structural
 * on the backend), so there is nothing extra for this hook to strip.
 * A previous-month fetch failure degrades silently to no deltas -- only the
 * current month's failure surfaces as a load error.
 */
export function useCompliance(): ComplianceState {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [previous, setPrevious] = useState<ComplianceSummary | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { current, previous: previousMonth } = currentAndPreviousMonth();

    Promise.all([
      fetchSummary(current, controller.signal),
      fetchSummary(previousMonth, controller.signal).catch(() => null),
    ])
      .then(([currentSummary, previousSummary]) => {
        if (controller.signal.aborted) {
          return;
        }
        setSummary(currentSummary);
        setPrevious(previousSummary);
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

  return { summary, previous, loadError };
}
