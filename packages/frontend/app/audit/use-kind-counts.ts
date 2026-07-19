import { useEffect, useState } from "react";

import type { AuditEntry, AuditLogPage } from "./logs/use-audit-log";
import { currentMonthRange } from "./current-month-range";

export interface KindCounts {
  /** null until the fetch resolves one way or another. */
  counts: Record<string, number> | null;
  /** 403 from the tenant-admin-gated backend route. */
  denied: boolean;
  loadError: boolean;
}

// ponytail: one page covers a tenant's monthly operations.applied volume for
// now (no aggregate endpoint exists server-side -- G5 only embeds per-batch
// kind_counts on the event, see pipeline.py). Page through if a tenant
// routinely exceeds this in a month.
const KIND_COUNTS_PAGE_SIZE = 200;

function extractKindCounts(entry: AuditEntry): Record<string, number> {
  const raw = entry.diff_summary?.kind_counts;
  return raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
}

function sumEntryKindCounts(entries: AuditEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  entries.forEach((entry) => {
    Object.entries(extractKindCounts(entry)).forEach(([kind, count]) => {
      totals[kind] = (totals[kind] ?? 0) + count;
    });
  });
  return totals;
}

/** G5: sums the `kind_counts` breakdown (pipeline.py) embedded in each
 * `operations.applied` audit entry's `diff_summary`, across this month's
 * entries -- no aggregate endpoint exists server-side, so the client-side
 * sum over one page of `GET /api/audit` (tenant-admin gated) is the whole
 * mechanism. Powers the "Model edits by kind" dashboard card.
 */
export function useKindCounts(): KindCounts {
  const [state, setState] = useState<KindCounts>({ counts: null, denied: false, loadError: false });

  useEffect(() => {
    const controller = new AbortController();
    const { date_from, date_to } = currentMonthRange();
    const query = new URLSearchParams({
      event_type: "operations.applied",
      per_page: String(KIND_COUNTS_PAGE_SIZE),
      date_from,
      date_to,
    });

    fetch(`/api/audit?${query.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return null;
        if (res.status === 403) {
          setState({ counts: null, denied: true, loadError: false });
          return null;
        }
        if (!res.ok) {
          throw new Error("kind_counts_failed");
        }
        return res.json() as Promise<AuditLogPage>;
      })
      .then((body) => {
        if (controller.signal.aborted || !body) return;
        setState({ counts: sumEntryKindCounts(body.entries), denied: false, loadError: false });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, loadError: true }));
      });

    return () => controller.abort();
  }, []);

  return state;
}
