"use client";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { resetLayoutPositions, saveLayoutPosition } from "@/lib/explorer/layout-client";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export interface UseLayoutPersistenceOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  graphId: string;
  save?: typeof saveLayoutPosition;
  reset?: typeof resetLayoutPositions;
}

export interface LayoutPersistenceState {
  saveFailed: boolean;
  dismissSaveFailure: () => void;
  resetLayout: () => Promise<void>;
}

export function useLayoutPersistence(_options: UseLayoutPersistenceOptions): LayoutPersistenceState {
  return {
    saveFailed: false,
    dismissSaveFailure: () => undefined,
    resetLayout: async () => undefined,
  };
}
