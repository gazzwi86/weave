import { useEffect, useState } from "react";

import { currentMonthRange } from "./current-month-range";

export interface EventCounts {
  /** null until the fetch resolves one way or another. */
  counts: Record<string, number> | null;
  /** 403 from the tenant-admin-gated backend route -- distinct from
   * `loadError` so the caller can show "admins only" rather than "broken". */
  denied: boolean;
  loadError: boolean;
}

interface CountsResponse {
  counts: { event_type: string; count: number }[];
}

function toCountsMap(body: CountsResponse): Record<string, number> {
  const map: Record<string, number> = {};
  body.counts.forEach((entry) => {
    map[entry.event_type] = entry.count;
  });
  return map;
}

/** G6: fetches this month's `event_type` -> count breakdown from
 * `GET /api/audit/counts` (tenant-admin gated) once on mount. Powers the
 * Security/Governance/Budget/Reliability dashboard row -- callers pick the
 * specific `event_type`s each metric needs via `sumEventCounts`.
 */
export function useEventCounts(): EventCounts {
  const [state, setState] = useState<EventCounts>({ counts: null, denied: false, loadError: false });

  useEffect(() => {
    const controller = new AbortController();
    const { date_from, date_to } = currentMonthRange();
    const query = new URLSearchParams({ date_from, date_to });

    fetch(`/api/audit/counts?${query.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return null;
        if (res.status === 403) {
          setState({ counts: null, denied: true, loadError: false });
          return null;
        }
        if (!res.ok) {
          throw new Error("counts_failed");
        }
        return res.json() as Promise<CountsResponse>;
      })
      .then((body) => {
        if (controller.signal.aborted || !body) return;
        setState({ counts: toCountsMap(body), denied: false, loadError: false });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, loadError: true }));
      });

    return () => controller.abort();
  }, []);

  return state;
}

/** Sums one or more `event_type`s out of a loaded counts map. Takes an array
 * because `PLAT-AUDIT-1` has no fixed event_type enum (contracts.md) -- e.g.
 * "Access denied" is served by both the legacy `authz_denied` literal and
 * the newer dotted `access.rbac.denied`, so a metric may need to cover more
 * than one literal. A `null` map (still loading) or a missing key (a
 * successful fetch with no matching rows -- a real zero, not "pending")
 * both resolve to 0.
 */
export function sumEventCounts(counts: Record<string, number> | null, eventTypes: string[]): number {
  if (!counts) return 0;
  return eventTypes.reduce((total, key) => total + (counts[key] ?? 0), 0);
}
