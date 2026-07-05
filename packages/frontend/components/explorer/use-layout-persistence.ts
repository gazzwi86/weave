"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { resetLayoutPositions, saveLayoutPosition } from "@/lib/explorer/layout-client";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export interface UseLayoutPersistenceOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  graphId: string;
  /** Test seams -- default to the real proxy-backed layout-client calls. */
  save?: typeof saveLayoutPosition;
  reset?: typeof resetLayoutPositions;
}

export interface LayoutPersistenceState {
  /** AC-2: true once every retry delay is exhausted -- drives a non-blocking
   * toast; a single dropped request during a network blip must not
   * interrupt the user, so this never flips on the first failure. */
  saveFailed: boolean;
  dismissSaveFailure: () => void;
  /** AC-4: clears every saved position, then re-runs fcose with
   * `randomize: true` so the canvas visibly re-arranges. */
  resetLayout: () => Promise<void>;
}

async function saveWithRetry(
  save: typeof saveLayoutPosition,
  retryDelaysMs: number[],
  graphId: string,
  nodeId: string,
  position: { x: number; y: number }
): Promise<boolean> {
  for (const delayMs of [0, ...retryDelaysMs]) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await save(graphId, nodeId, position.x, position.y);
      return true;
    } catch {
      // fall through to the next retry delay (or exhaustion below)
    }
  }
  return false;
}

/** AC-1/AC-2/AC-4: wires drag-persist-with-retry and reset-layout onto the
 * ADR-001 renderer-adapter seam. */
export function useLayoutPersistence({
  adapter,
  config,
  graphId,
  save = saveLayoutPosition,
  reset = resetLayoutPositions,
}: UseLayoutPersistenceOptions): LayoutPersistenceState {
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!adapter) return undefined;
    return adapter.onNodeDragEnd((nodeId, position) => {
      saveWithRetry(save, config.layoutSaveRetryDelaysMs, graphId, nodeId, position).then((succeeded) => {
        if (!succeeded) setSaveFailed(true);
      });
    });
  }, [adapter, config.layoutSaveRetryDelaysMs, graphId, save]);

  const resetLayout = useCallback(async () => {
    await reset(graphId);
    adapter?.setLayout("fcose", { ...config.fcoseParams, randomize: true });
  }, [adapter, config.fcoseParams, graphId, reset]);

  const dismissSaveFailure = useCallback(() => setSaveFailed(false), []);

  return { saveFailed, dismissSaveFailure, resetLayout };
}
