"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import type { SidePanelState } from "./use-node-spotlight";

export interface NodeContextMenuState {
  nodeId: string;
  position: { x: number; y: number };
  canFocusDomain: boolean;
  isExpanded: boolean;
}

export interface UseNodeContextMenuOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  panel: SidePanelState;
}

export interface UseNodeContextMenuResult {
  menu: NodeContextMenuState | null;
  closeMenu: () => void;
}

/** TASK-005 AC-3/AC-5: right-click opens the context menu only for the
 * currently spotlighted node -- expand/collapse reuse the neighbours
 * already fetched for that node's side panel (use-node-spotlight.ts), so
 * there's nothing to offer for a node that hasn't been tapped yet. */
export function useNodeContextMenu({ adapter, config, panel }: UseNodeContextMenuOptions): UseNodeContextMenuResult {
  const [menu, setMenu] = useState<NodeContextMenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!adapter) return undefined;
    return adapter.onNodeRightClick((nodeId, position) => {
      const isSpotlighted = panel.status === "loaded" && panel.nodeId === nodeId;
      if (!isSpotlighted) {
        setMenu(null);
        return;
      }
      setMenu({
        nodeId,
        position,
        canFocusDomain: adapter.getNodeData(nodeId)?.bpmoKind === config.domainKind,
        isExpanded: adapter.hasExpandedNeighbours(nodeId),
      });
    });
  }, [adapter, config.domainKind, panel]);

  return { menu, closeMenu };
}
