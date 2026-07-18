"use client";

import { useCallback, useMemo, useReducer, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { OverlayEngine, type Overlay, type OverlayLegendModel } from "@/lib/explorer/overlay-engine";
import { createDomainColouringOverlay } from "@/lib/explorer/overlays/domain-colouring-overlay";
import { createHeatmapOverlay } from "@/lib/explorer/overlays/heatmap-overlay";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

declare global {
  interface Window {
    /** Playwright-only introspection hook (AC-5 perf spec) -- mirrors
     * use-filter-panel.ts's __explorerFilterApplyDurationMs: wall-clock ms
     * of the single engine.activate/deactivate call a toggle triggers.
     * Dev-only, never in production. */
    __explorerOverlayApplyDurationMs?: number;
  }
}

export interface OverlayToggle {
  id: string;
  label: string;
  active: boolean;
  /** AC-2: true while a different overlay in the same exclusiveGroup is
   * active -- the panel disables every sibling button rather than letting
   * a second click silently swap the active overlay underneath it. */
  disabled: boolean;
  /** refit deferred item 1: a toggle disabled for its own reason (e.g. no
   * data source, gap-tracked) rather than AC-2's mutual exclusion --
   * overrides the panel's generic "turn off the active overlay" tooltip. */
  disabledReason?: string;
}

export interface UseOverlayControlsOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
}

export interface UseOverlayControlsResult {
  toggles: OverlayToggle[];
  legend: OverlayLegendModel | null;
  toggleOverlay: (id: string) => void;
  /** TASK-022 AC-7: the diff overlay is built outside this hook (Versions
   * Panel) but must share this same engine instance so its "colour"
   * exclusiveGroup mutual exclusion with heatmap/domain-colouring actually
   * applies -- exposed rather than duplicating the engine. */
  engine: OverlayEngine;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// TASK-021: one Overlay per config-driven colour source -- a heatmap
// overlay per FR-015 dimension (config.heatmapMappings' keys), plus the
// single domain-colouring overlay. All share the "colour" exclusiveGroup,
// so OverlayEngine's mutual exclusion (AC-2) covers them with no extra
// bookkeeping here.
function buildOverlays(config: ExplorerConfig): { overlay: Overlay; label: string }[] {
  const heatmapOverlays = Object.keys(config.heatmapMappings).map((dimension) => ({
    overlay: createHeatmapOverlay(dimension, { noneColour: config.heatNoneColour, heatmapMappings: config.heatmapMappings }),
    label: `Heatmap: ${capitalise(dimension)}`,
  }));
  const domainOverlay = {
    overlay: createDomainColouringOverlay({
      membershipPredicate: config.domainMembershipPredicate,
      palette: config.domainPalette,
      noneColour: config.domainNoneColour,
    }),
    label: "Domain colouring",
  };
  return [...heatmapOverlays, domainOverlay];
}

/** TASK-021: thin React binding over the framework-agnostic OverlayEngine
 * (AC-2/AC-4 mutual exclusion + restore-on-deactivate live there, not
 * here -- this hook never duplicates active-overlay state into React,
 * it only forces a re-render after every engine mutation and reads the
 * engine back as the single source of truth). */
export function useOverlayControls({ adapter, config }: UseOverlayControlsOptions): UseOverlayControlsResult {
  // Lazy useState initializer (not useRef) -- reading a ref's .current
  // during render trips the react-hooks refs lint rule; useState's
  // initializer is the render-safe way to build one stable instance.
  const [engine] = useState(() => new OverlayEngine());
  const overlays = useMemo(() => buildOverlays(config), [config]);
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);

  const toggleOverlay = useCallback(
    (id: string) => {
      if (!adapter) return;
      const startedAt = performance.now();
      if (engine.isActive(id)) {
        engine.deactivate(id, adapter);
      } else {
        const entry = overlays.find((candidate) => candidate.overlay.id === id);
        if (!entry) return;
        engine.activate(entry.overlay, adapter);
      }
      // AC-5 perf trace -- dev-only, see the __explorerOverlayApplyDurationMs
      // hook doc comment above.
      if (process.env.NODE_ENV !== "production") window.__explorerOverlayApplyDurationMs = performance.now() - startedAt;
      forceRender();
    },
    [adapter, engine, overlays]
  );

  const activeInColourGroup = engine.activeInGroup("colour");
  const toggles: OverlayToggle[] = overlays.map(({ overlay, label }) => ({
    id: overlay.id,
    label,
    active: engine.isActive(overlay.id),
    disabled: activeInColourGroup !== undefined && activeInColourGroup !== overlay.id,
  }));
  const legend = activeInColourGroup ? (engine.legendFor(activeInColourGroup) ?? null) : null;

  return { toggles, legend, toggleOverlay, engine };
}
