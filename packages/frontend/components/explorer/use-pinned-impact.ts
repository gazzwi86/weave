"use client";

import { useEffect, useState } from "react";

import { OverlayEngine } from "@/lib/explorer/overlay-engine";
import { createPinnedImpactOverlay, type PinnedTraceResult } from "@/lib/explorer/overlays/pinned-impact-overlay";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

declare global {
  interface Window {
    /** Playwright-only test hook (TASK-028 AC-3 E2E) -- pins a
     * traceResult onto the real canvas. The traceResult is computed in
     * Node (walkClosure over a fixture graph, not a live fetch) and
     * passed in verbatim -- the M1 traversal client that would fetch
     * this from CE-READ-1 is out of this task's scope (team-lead scope
     * call, narrow TASK-028: config + guard + overlay primitive only).
     * Dev-only, never attached in production. */
    __explorerPinImpactTrace?: (sourceIri: string, memberIris: string[]) => void;
    __explorerUnpinImpactTrace?: (sourceIri: string) => void;
  }
}

export interface UsePinnedImpactOptions {
  adapter: RendererAdapter | null;
}

/** TASK-028: owns the pin overlay's own OverlayEngine instance -- kept
 * separate from useOverlayControls' colour-group engine because AC-3's
 * E2E only proves highlight persistence through pan/zoom/filter, not
 * cross-engine coexistence with a live colour overlay (that's AC-7,
 * unit-tested only per the task brief's AC-to-test mapping). A real
 * "pin this trace" UI action lands with the traversal-client follow-up;
 * this wires the primitive to a real canvas today via a dev-only hook,
 * mirroring use-overlay-controls.ts's __explorerOverlayApplyDurationMs
 * convention. */
export function usePinnedImpact({ adapter }: UsePinnedImpactOptions): void {
  const [engine] = useState(() => new OverlayEngine());

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    window.__explorerPinImpactTrace = (sourceIri, memberIris) => {
      if (!adapter) return;
      const traceResult: PinnedTraceResult = { sourceIri, memberIris };
      const notify = (message: string) => console.warn(`[explorer] ${message}`);
      engine.activate(createPinnedImpactOverlay(traceResult, engine, notify), adapter);
    };
    window.__explorerUnpinImpactTrace = (sourceIri) => {
      if (!adapter) return;
      engine.deactivate(`pinned-impact:${sourceIri}`, adapter);
    };
    return () => {
      delete window.__explorerPinImpactTrace;
      delete window.__explorerUnpinImpactTrace;
    };
  }, [adapter, engine]);
}
