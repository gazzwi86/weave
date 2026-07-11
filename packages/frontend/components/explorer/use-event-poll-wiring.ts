"use client";

import { useCallback } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { fetchGraph as defaultFetchGraph } from "@/lib/explorer/fetch-graph";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";

import { useEventPoll } from "./use-event-poll";

export interface UseEventPollWiringOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** AC-7: draft-mode-only polling -- true while viewing the live draft
   * canvas (never while pinned to a read-only published version). */
  active: boolean;
  /** Test seam -- defaults real CE-READ-1 proxy fetch. */
  fetchGraph?: (timeoutMs: number) => Promise<CytoscapeElement[]>;
}

// Exported for direct unit testing.
export function matchesDelta(element: CytoscapeElement, ids: Set<string>): boolean {
  if (ids.has(element.data.id)) return true;
  const { source, target } = element.data;
  return source !== undefined && (ids.has(source) || (target !== undefined && ids.has(target)));
}

// ponytail: no IRI-filtered CE-READ-1 endpoint exists yet, so fetchDelta
// re-fetches the whole graph and filters to the changed ids client-side --
// correct, not incremental. Upgrade when CE-READ-1 grows an ids= filter.
// unsavedDragIds has no wired source either (use-layout-persistence.ts
// doesn't track a drag-in-progress set) so it's a permanent empty set for
// now -- a poll merge can overwrite a live drag until that's wired.
export function useEventPollWiring({ adapter, config, active, fetchGraph = defaultFetchGraph }: UseEventPollWiringOptions): void {
  const fetchDelta = useCallback(
    async (entityIris: string[]) => {
      const ids = new Set(entityIris);
      const all = await fetchGraph(config.ceTimeoutMs);
      return all.filter((element) => matchesDelta(element, ids));
    },
    [config.ceTimeoutMs, fetchGraph]
  );

  const reloadGraph = useCallback(async () => {
    if (!adapter) return;
    adapter.load(await fetchGraph(config.ceTimeoutMs));
  }, [adapter, config.ceTimeoutMs, fetchGraph]);

  useEventPoll({ adapter, active, fetchDelta, reloadGraph, unsavedDragIds: () => [] });
}
