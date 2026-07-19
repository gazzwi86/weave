"use client";

import { useEffect, useState } from "react";

import { normalizeUrn } from "@/lib/build/normalize-urn";

interface EpicTaskCounts {
  total: number;
  done: number;
}

interface EpicRollupResponse {
  epics: { task_counts: EpicTaskCounts }[];
}

/** B1 (docs/design/remediation-2-api-gaps.md): the Registry card's task
 * counts. A listing-level rollup field on `GET /api/projects` would be
 * heavy (one aggregate query per project on every grid page load), so
 * this fetches the existing per-project epic rollup (G9/G10, `use-epics.ts`'s
 * `/api/build/projects/{id}/epics` proxy) lazily -- one request per card,
 * only while it's mounted -- and sums `task_counts` client-side. `null`
 * is both "loading" and "failed": the card's honest-pending copy covers
 * both, same convention as `use-epics.ts`.
 */
export function useProjectTaskCounts(projectIri: string): { total: number; done: number } | null {
  const [counts, setCounts] = useState<{ total: number; done: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const encoded = encodeURIComponent(normalizeUrn(projectIri));
    fetch(`/api/build/projects/${encoded}/epics`)
      .then((res) => {
        if (!res.ok) throw new Error("epics_load_failed");
        return res.json() as Promise<EpicRollupResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        const totals = body.epics.reduce(
          (acc, epic) => ({
            total: acc.total + epic.task_counts.total,
            done: acc.done + epic.task_counts.done,
          }),
          { total: 0, done: 0 }
        );
        setCounts(totals);
      })
      .catch(() => {
        // ponytail: stays null -- the card renders the same honest-pending
        // copy for "still loading" and "failed", no separate error state.
      });
    return () => {
      cancelled = true;
    };
  }, [projectIri]);

  return counts;
}
