"use client";

import { useCallback, useState } from "react";

import { fetchCoverageGaps as defaultFetchCoverageGaps, type FetchCoverageGapsResult } from "@/lib/explorer/fetch-coverage-gaps";
import type { OverlayEngine } from "@/lib/explorer/overlay-engine";
import { createCompletenessOverlay, type GapEntry } from "@/lib/explorer/overlays/completeness-overlay";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { OntologyRelationshipEntry } from "@/lib/explorer/validate-closure";

const COMPLETENESS_ID = "completeness";
const NO_GAPS_MESSAGE = "No coverage gaps found";

declare global {
  interface Window {
    /** Playwright-only perf trace (AC-7), mirrors use-overlay-controls.ts's
     * __explorerOverlayApplyDurationMs. Dev-only, never in production. */
    __explorerCompletenessApplyDurationMs?: number;
  }
}

export interface UseCompletenessOverlayOptions {
  adapter: RendererAdapter | null;
  engine: OverlayEngine;
  timeoutMs: number;
  relationships: OntologyRelationshipEntry[];
  /** Test seam -- defaults to the real CE-READ-1 proxy fetch. */
  fetchCoverageGaps?: (timeoutMs: number) => Promise<FetchCoverageGapsResult>;
}

export interface UseCompletenessOverlayResult {
  active: boolean;
  error: boolean;
  notice: string | null;
  gapIndex: Record<string, GapEntry[]>;
  toggle: () => Promise<void>;
  retry: () => Promise<void>;
}

/** AC-1/AC-2/AC-3/AC-7: fetches `coverage_gap` and only activates the
 * badge overlay on success -- an error/timeout simply never calls
 * `engine.activate`, so the canvas stays in its prior state (AC-3) without
 * any try/catch around a synchronous `apply()`. Shares the caller's
 * OverlayEngine instance (same one useOverlayControls/useVersionsPanel
 * use) so the diff-exclusion check below can see whether diff is active. */
export function useCompletenessOverlay({
  adapter,
  engine,
  timeoutMs,
  relationships,
  fetchCoverageGaps = defaultFetchCoverageGaps,
}: UseCompletenessOverlayOptions): UseCompletenessOverlayResult {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gapIndex, setGapIndex] = useState<Record<string, GapEntry[]>>({});

  const activate = useCallback(async () => {
    if (!adapter) return;
    const result = await fetchCoverageGaps(timeoutMs);
    if (result.type === "error") {
      setError(true); // AC-3: canvas untouched, retry offered
      setNotice(null);
      return;
    }
    setError(false);
    setNotice(result.rows.length === 0 ? NO_GAPS_MESSAGE : null); // AC-2

    // AC-7: badges coexist with a colour overlay, but not with diff --
    // diff has no shared exclusiveGroup with "completeness", so mutual
    // exclusion is this explicit check rather than the engine's own.
    if (engine.isActive("diff")) engine.deactivate("diff", adapter);

    const overlay = createCompletenessOverlay(result.rows, relationships);
    setGapIndex(overlay.gapIndex());
    const startedAt = performance.now();
    engine.activate(overlay, adapter);
    if (process.env.NODE_ENV !== "production") {
      window.__explorerCompletenessApplyDurationMs = performance.now() - startedAt;
    }
    setActive(true);
  }, [adapter, engine, fetchCoverageGaps, relationships, timeoutMs]);

  const toggle = useCallback(async () => {
    if (!adapter) return;
    if (engine.isActive(COMPLETENESS_ID)) {
      engine.deactivate(COMPLETENESS_ID, adapter);
      setActive(false);
      setError(false);
      setNotice(null);
      setGapIndex({});
      return;
    }
    await activate();
  }, [adapter, engine, activate]);

  return { active, error, notice, gapIndex, toggle, retry: activate };
}
