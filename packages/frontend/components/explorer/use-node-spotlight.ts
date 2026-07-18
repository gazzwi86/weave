"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { fetchNodeProps as defaultFetchNodeProps, type FetchNodePropsResult, type KeyProperty, type NeighbourProps } from "@/lib/explorer/fetch-node-props";
import type { GapEntry } from "@/lib/explorer/overlays/completeness-overlay";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export type SidePanelState =
  | { status: "closed" }
  | { status: "loading"; label: string; typeLabel: string }
  | {
      status: "loaded";
      label: string;
      typeLabel: string;
      /** refit: CE's `bpmo_kind`, threaded through for the inspector
       * header's kind-coloured swatch (inspector-view.ts's toBpmoKind) --
       * absent/unrecognised falls back to a plain-text header. */
      bpmoKind?: string;
      keyProperties: KeyProperty[];
      rawIri: string | null;
      /** TASK-005 AC-3: the tapped node's id and its already-fetched
       * neighbours -- neighbour expansion reuses this instead of a second
       * CE-READ-1 call (see renderer-adapter.ts's expandNode). */
      nodeId: string;
      neighbours: NeighbourProps[];
      /** TASK-027 AC-4: the completeness overlay's missing-link list for
       * this node, if any -- always present (empty when there's no active
       * gapIndex entry), never a raw predicate IRI (humanised upstream by
       * completeness-overlay.ts). */
      gaps?: GapEntry[];
    }
  | { status: "error"; label: string; typeLabel: string }
  | { status: "not-found" };

export interface UseNodeSpotlightOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** Test seam -- defaults to the real CE-READ-1 proxy fetch. */
  fetchNodeProps?: (iri: string, timeoutMs: number) => Promise<FetchNodePropsResult>;
  /** TASK-027: the active completeness overlay's gap index, keyed by
   * entity_iri -- undefined/absent-key both resolve to an empty gaps list. */
  gapIndex?: Record<string, GapEntry[]>;
}

export interface UseNodeSpotlightResult {
  panel: SidePanelState;
  openNode: (nodeId: string) => void;
  close: () => void;
  retry: () => void;
}

// AC-8 vs AC-3: a 404 is "Not found" (no label/type leaks through); any
// other failure keeps the already-loaded label/type with a generic notice.
function panelStateForError(status: number, label: string, typeLabel: string): SidePanelState {
  return status === 404 ? { status: "not-found" } : { status: "error", label, typeLabel };
}

async function loadNodeProps(
  fetchNodeProps: (iri: string, timeoutMs: number) => Promise<FetchNodePropsResult>,
  nodeId: string,
  timeoutMs: number,
  fallback: { label: string; typeLabel: string },
  gaps: GapEntry[]
): Promise<SidePanelState> {
  const result = await fetchNodeProps(nodeId, timeoutMs);
  if (result.type === "error") return panelStateForError(result.status, fallback.label, fallback.typeLabel);
  return {
    status: "loaded",
    label: result.data.label,
    typeLabel: result.data.typeLabel,
    bpmoKind: result.data.bpmoKind,
    keyProperties: result.data.keyProperties,
    rawIri: result.data.rawIri,
    nodeId,
    neighbours: result.data.neighbours,
    gaps,
  };
}

/** AC-1/AC-2/AC-3/AC-4/AC-8: wires node-click spotlight + the CE-READ-1
 * side-panel fetch onto the ADR-001 renderer-adapter seam. */
export function useNodeSpotlight({
  adapter,
  config,
  fetchNodeProps = defaultFetchNodeProps,
  gapIndex,
}: UseNodeSpotlightOptions): UseNodeSpotlightResult {
  const [panel, setPanel] = useState<SidePanelState>({ status: "closed" });
  const requestIdRef = useRef(0);
  const lastNodeIdRef = useRef<string | null>(null);

  const openNode = useCallback(
    (nodeId: string) => {
      if (!adapter || !adapter.spotlightNode(nodeId, config.spotlightDimOpacity)) return;
      lastNodeIdRef.current = nodeId;

      const known = adapter.getNodeData(nodeId);
      const label = known?.label ?? "";
      const typeLabel = known?.bpmoKind ?? "";
      const requestId = ++requestIdRef.current;
      setPanel({ status: "loading", label, typeLabel });

      loadNodeProps(fetchNodeProps, nodeId, config.ceTimeoutMs, { label, typeLabel }, gapIndex?.[nodeId] ?? []).then((next) => {
        if (requestId === requestIdRef.current) setPanel(next); // else a newer click superseded this one
      });
    },
    [adapter, config.spotlightDimOpacity, config.ceTimeoutMs, fetchNodeProps, gapIndex]
  );

  const close = useCallback(() => {
    adapter?.resetOpacity();
    lastNodeIdRef.current = null;
    setPanel({ status: "closed" });
  }, [adapter]);

  const retry = useCallback(() => {
    if (lastNodeIdRef.current) openNode(lastNodeIdRef.current);
  }, [openNode]);

  useEffect(() => {
    if (!adapter) return undefined;
    const unregisterNodeTap = adapter.onNodeTap(openNode);
    const unregisterBackgroundTap = adapter.onBackgroundTap(close);
    return () => {
      unregisterNodeTap();
      unregisterBackgroundTap();
    };
  }, [adapter, openNode, close]);

  // AC-4: Escape clears the spotlight and closes the panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return { panel, openNode, close, retry };
}
