"use client";

import { useEffect, useState } from "react";

import { normalizeUrn } from "@/lib/build/normalize-urn";

import type { EpicRollupResponse } from "./dashboard-types";

/** B2 (docs/design/remediation-2-api-gaps.md G9/G10): fetches the epic
 * rollup once on mount, same fetch-on-mount shape as `use-board.ts`.
 */
export function useEpics(projectId: string): EpicRollupResponse | null {
  const [data, setData] = useState<EpicRollupResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const encoded = encodeURIComponent(normalizeUrn(projectId));
    fetch(`/api/build/projects/${encoded}/epics`)
      .then((res) => {
        if (!res.ok) throw new Error("epics_load_failed");
        return res.json() as Promise<EpicRollupResponse>;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        // ponytail: no error state -- an empty roadmap panel on failure
        // reads the same as "no epics yet", both are handled by the
        // panel's empty-copy branch, no separate error copy needed here.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return data;
}
