"use client";

import { useCallback, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { NeighbourElement, RendererAdapter } from "@/lib/explorer/renderer-adapter";

export type NeighbourExpansionState =
  | { status: "idle" }
  | { status: "confirm"; nodeId: string; neighbours: NeighbourElement[]; newCount: number };

export interface UseNeighbourExpansionOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
}

export interface UseNeighbourExpansionResult {
  state: NeighbourExpansionState;
  requestExpand: (nodeId: string, neighbours: NeighbourElement[]) => void;
  confirmExpand: () => void;
  cancelExpand: () => void;
  collapse: (nodeId: string) => void;
}

// AC-4: nodes already present on the canvas don't count toward the
// confirmation threshold -- expanding onto an already-visible neighbour is
// just a highlight, not a new node.
function countNewNodes(adapter: RendererAdapter, neighbours: NeighbourElement[]): number {
  const existingIds = new Set(adapter.listNodes().map((node) => node.id));
  return neighbours.filter((neighbour) => !existingIds.has(neighbour.iri)).length;
}

/**
 * TASK-005 AC-3/AC-4/AC-5: drives neighbour expand/collapse on an already
 * spotlighted node. Expansion reuses the neighbours already fetched by
 * useNodeSpotlight (see fetch-node-props.ts) -- there is no CE-READ-1 call
 * here, so the AC-4 confirmation gate only ever guards the canvas mutation
 * (adapter.expandNode), never a fetch.
 */
export function useNeighbourExpansion({ adapter, config }: UseNeighbourExpansionOptions): UseNeighbourExpansionResult {
  const [state, setState] = useState<NeighbourExpansionState>({ status: "idle" });

  const requestExpand = useCallback(
    (nodeId: string, neighbours: NeighbourElement[]) => {
      if (!adapter) return;
      const newCount = countNewNodes(adapter, neighbours);
      if (newCount > config.expandConfirmThreshold) {
        setState({ status: "confirm", nodeId, neighbours, newCount });
        return;
      }
      adapter.expandNode(nodeId, neighbours);
    },
    [adapter, config.expandConfirmThreshold]
  );

  const confirmExpand = useCallback(() => {
    if (!adapter || state.status !== "confirm") return;
    adapter.expandNode(state.nodeId, state.neighbours);
    setState({ status: "idle" });
  }, [adapter, state]);

  const cancelExpand = useCallback(() => setState({ status: "idle" }), []);

  const collapse = useCallback((nodeId: string) => adapter?.collapseNode(nodeId), [adapter]);

  return { state, requestExpand, confirmExpand, cancelExpand, collapse };
}
