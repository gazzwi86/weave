"use client";

import { useCallback, useState } from "react";

import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";

export type VersionMode = "draft" | "version";

const DRAFT_LOAD_TIMEOUT_MS = 30_000;

export interface UseVersionModeResult {
  mode: VersionMode;
  readOnly: boolean;
  pinnedIri: string | null;
  error: string | null;
  loadVersion(versionIri: string): Promise<void>;
  returnToDraft(): Promise<void>;
}

/** TASK-022 AC-2/AC-5/AC-8: standalone hook (not folded into
 * use-explorer-canvas.ts, which is already at Law E's line budget) that
 * reloads the canvas pinned to a published version via the ADR-001
 * RendererAdapter seam (`load`/`setLayout`), read-only, and back again. */
export function useVersionMode(
  adapter: RendererAdapter | null,
  fetchGraph: (timeoutMs: number, version?: string) => Promise<CytoscapeElement[]>
): UseVersionModeResult {
  const [mode, setMode] = useState<VersionMode>("draft");
  const [pinnedIri, setPinnedIri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInto = useCallback(
    async (version: string | undefined, onSuccess: () => void) => {
      if (!adapter) return;
      try {
        const elements = await fetchGraph(DRAFT_LOAD_TIMEOUT_MS, version);
        adapter.load(elements);
        adapter.setLayout("fcose", { randomize: true });
        setError(null);
        onSuccess();
      } catch {
        setError(version ? "Unable to load that version." : "Unable to return to the draft graph.");
      }
    },
    [adapter, fetchGraph]
  );

  const loadVersion = useCallback(
    (versionIri: string) =>
      loadInto(versionIri, () => {
        setPinnedIri(versionIri);
        setMode("version");
      }),
    [loadInto]
  );

  const returnToDraft = useCallback(
    () =>
      loadInto(undefined, () => {
        adapter?.clearDiffOverlay();
        setPinnedIri(null);
        setMode("draft");
      }),
    [adapter, loadInto]
  );

  return { mode, readOnly: mode !== "draft", pinnedIri, error, loadVersion, returnToDraft };
}
