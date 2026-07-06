"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type cytoscape from "cytoscape";

import { buildStylesheet } from "@/lib/explorer/build-stylesheet";
import { CeReadError } from "@/lib/explorer/ce-read-error";
import { DEFAULT_EXPLORER_CONFIG, type ExplorerConfig } from "@/lib/explorer/config";
import { createCytoscapeInstance } from "@/lib/explorer/create-cytoscape";
import { fetchGraph as defaultFetchGraph, fetchPalette as defaultFetchPalette } from "@/lib/explorer/fetch-graph";
import { registerKeyBindings } from "@/lib/explorer/key-bindings";
import {
  applySavedPositions,
  fetchLayoutPositions as defaultFetchLayoutPositions,
  type SavedLayoutPosition,
} from "@/lib/explorer/layout-client";
import { computeViewportIndicator, type ViewportIndicator } from "@/lib/explorer/minimap-geometry";
import { rafThrottle } from "@/lib/explorer/raf-throttle";
import { createRendererAdapter, type AdaptableCy, type RendererAdapter } from "@/lib/explorer/renderer-adapter";
import { applySemanticZoom } from "@/lib/explorer/semantic-zoom";
import type { CytoscapeElement, NodeKind } from "@/lib/explorer/types";

export type LoadState = "loading" | "ready" | "error";

const MINIMAP_SIZE = { width: 160, height: 100 };

declare global {
  interface Window {
    /** Playwright-only introspection hook (AC-4 E2E spec) -- Cytoscape
     * renders labels to <canvas>, so there's no DOM text to assert on;
     * exposes the already-fetched elements instead of the renderer itself.
     * Dev-only, never attached in a production build. */
    __explorerElements?: CytoscapeElement[];
    /** Playwright-only introspection hook -- flips true once the fcose
     * entrance-animation layout genuinely settles ("layoutstop"), so an E2E
     * spec can wait for real settle instead of polling the DOM and risking
     * a false-stable read mid-animation. Dev-only, never in production. */
    __explorerLayoutSettled?: boolean;
    /** Playwright-only introspection hook (AC-8 perf spec) -- wall-clock ms
     * from the start of a load() pass to fcose's "layoutstop" (first
     * interactive render complete), measured in-browser via
     * performance.now() so IPC round-trips don't skew the reading.
     * Dev-only, never in production. */
    __explorerRenderDurationMs?: number;
    /** Playwright-only introspection hook (TASK-003 E2E) -- Cytoscape
     * renders to <canvas>, so a node has no DOM element a test can click or
     * inspect computed style on. Exposes the node's real on-screen pixel
     * centre (for a genuine `page.mouse.click`) and its current opacity
     * (for asserting AC-1/AC-6 spotlight dimming) by id. Dev-only, never in
     * production. */
    __explorerNodeInfo?: (nodeId: string) => { x: number; y: number; opacity: number } | undefined;
  }
}

/** Structural subset of the real `cytoscape.Core` needed for the
 * `__explorerNodeInfo` dev hook -- not part of `CyLike`/`AdaptableCy`
 * (production call sites never need it), bridged the same way as
 * `AdaptableCy` above: both describe the same real instance at runtime. */
interface CyNodeIntrospection {
  getElementById(id: string): { length: number; renderedPosition(): { x: number; y: number }; style(prop: string): string };
}

/** Structural subset of `cytoscape.Core` this hook actually calls --
 * satisfied by both the real instance (create-cytoscape.ts) and a fake in
 * tests, so tests never import the real renderer (ADR-001 seam). */
export interface CyLike {
  container(): HTMLElement | null;
  json(spec: { elements: CytoscapeElement[] }): void;
  layout(options: { name: string } & Record<string, unknown>): { run(): void };
  zoom(): number;
  pan(): { x: number; y: number };
  extent(): { x1: number; y1: number; x2: number; y2: number };
  elements(): { boundingBox(): { x1: number; y1: number; x2: number; y2: number } };
  on(event: string, handler: () => void): void;
  fit(): void;
  nodes(): { style(props: Record<string, number>): void };
  edges(): { style(props: Record<string, number>): void };
  destroy(): void;
}

export interface UseExplorerCanvasOptions {
  config?: ExplorerConfig;
  fetchPalette?: () => Promise<NodeKind[]>;
  fetchGraph?: (timeoutMs: number) => Promise<CytoscapeElement[]>;
  createCy?: (container: HTMLElement | null, stylesheet: cytoscape.StylesheetStyle[]) => CyLike;
  /** TASK-004 AC-3/AC-5: test seam -- defaults to the real proxy fetch. */
  fetchLayoutPositions?: (graphId: string) => Promise<SavedLayoutPosition[]>;
}

export interface ExplorerCanvasState {
  loadState: LoadState;
  errorMessage: string | null;
  minimapIndicator: ViewportIndicator | null;
  containerRef: RefObject<HTMLDivElement | null>;
  retry: () => void;
  /** TASK-003: the ADR-001 renderer-adapter seam for the tapped node/search
   * overlay to drive spotlight/highlight -- null until the canvas is ready. */
  adapter: RendererAdapter | null;
}

function errorMessageFor(err: unknown): string {
  return err instanceof CeReadError ? err.message : "Unable to load the graph.";
}

/** AC-1/AC-5/AC-6/AC-7: wires semantic zoom, focus-scoped key bindings, and
 * rAF-throttled mini-map tracking onto a freshly-constructed canvas. Returns
 * the key-binding cleanup so the caller can unregister it on unmount. */
function wireCanvas(cy: CyLike, config: ExplorerConfig, onViewportChange: (indicator: ViewportIndicator) => void) {
  const thresholds = { nodeLabelThreshold: config.nodeLabelThreshold, edgeLabelThreshold: config.edgeLabelThreshold };
  cy.on("zoom", () => applySemanticZoom(cy, thresholds));

  const updateMinimap = rafThrottle(() => {
    onViewportChange(computeViewportIndicator(cy.elements().boundingBox(), cy.extent(), MINIMAP_SIZE));
  });
  cy.on("viewport", updateMinimap);
  updateMinimap();

  if (process.env.NODE_ENV !== "production") {
    cy.on("layoutstop", () => {
      window.__explorerLayoutSettled = true;
    });
  }

  return registerKeyBindings(cy);
}

/** Playwright-only introspection hooks (dev builds only) -- reset at the
 * start of every load() pass so a retry/reload doesn't leak stale readings
 * from a previous attempt. */
function resetDevIntrospection(): void {
  if (process.env.NODE_ENV === "production") return;
  window.__explorerLayoutSettled = false;
  delete window.__explorerRenderDurationMs;
  delete window.__explorerElements;
  delete window.__explorerNodeInfo;
}

function nodeInfoLookup(cy: CyLike): (nodeId: string) => { x: number; y: number; opacity: number } | undefined {
  return (nodeId: string) => {
    const rect = cy.container()?.getBoundingClientRect();
    if (!rect) return undefined;
    const element = (cy as unknown as CyNodeIntrospection).getElementById(nodeId);
    if (element.length === 0) return undefined;
    const position = element.renderedPosition();
    return { x: rect.left + position.x, y: rect.top + position.y, opacity: Number(element.style("opacity")) };
  };
}

/** Exposes the freshly-loaded elements and wires the AC-8 perf-mark
 * (load() start -> genuine fcose "layoutstop") for E2E specs. Dev builds
 * only -- never attached in production. */
function exposeDevIntrospection(cy: CyLike, elements: CytoscapeElement[], loadStartedAt: number): void {
  if (process.env.NODE_ENV === "production") return;
  window.__explorerElements = elements;
  window.__explorerNodeInfo = nodeInfoLookup(cy);
  cy.on("layoutstop", () => {
    window.__explorerRenderDurationMs = performance.now() - loadStartedAt;
  });
}

function clearDevIntrospection(): void {
  if (process.env.NODE_ENV === "production") return;
  delete window.__explorerElements;
  delete window.__explorerLayoutSettled;
  delete window.__explorerRenderDurationMs;
  delete window.__explorerNodeInfo;
}

interface LoadCanvasParams {
  config: ExplorerConfig;
  fetchPalette: () => Promise<NodeKind[]>;
  fetchGraph: (timeoutMs: number) => Promise<CytoscapeElement[]>;
  fetchLayoutPositions: (graphId: string) => Promise<SavedLayoutPosition[]>;
  createCy: (container: HTMLElement | null, stylesheet: cytoscape.StylesheetStyle[]) => CyLike;
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: RefObject<CyLike | null>;
  unregisterRef: RefObject<(() => void) | null>;
  isCancelled: () => boolean;
  setLoadState: (state: LoadState) => void;
  setErrorMessage: (message: string | null) => void;
  setMinimapIndicator: (indicator: ViewportIndicator | null) => void;
  setAdapter: (adapter: RendererAdapter | null) => void;
}

// XT-008: pulled out of useExplorerCanvas's load effect to keep the hook
// under Law E's line budget -- one params object (not the individual refs
// and setters) so this stays a single-param function.
async function loadCanvas(params: LoadCanvasParams): Promise<void> {
  const {
    config,
    fetchPalette,
    fetchGraph,
    fetchLayoutPositions,
    createCy,
    containerRef,
    cyRef,
    unregisterRef,
    isCancelled,
    setLoadState,
    setErrorMessage,
    setMinimapIndicator,
    setAdapter,
  } = params;

  setLoadState("loading");
  setErrorMessage(null);
  const loadStartedAt = performance.now();
  resetDevIntrospection();
  try {
    const [palette, elements, savedPositions] = await Promise.all([
      fetchPalette(),
      fetchGraph(config.ceTimeoutMs),
      fetchLayoutPositions(config.layoutGraphId),
    ]);
    if (isCancelled()) return;
    const cy = createCy(containerRef.current, buildStylesheet(palette));
    // ADR-001: element loading and layout run through the renderer
    // adapter, not direct cytoscape calls, so a future WebGL swap only
    // touches the adapter's implementation, never this call site. The
    // cast bridges CyLike (this file's narrow, test-double-friendly
    // subset) to AdaptableCy (the fuller seam TASK-003 needs) -- both
    // describe the same real cytoscape.Core instance at runtime.
    const canvasAdapter = createRendererAdapter(cy as unknown as AdaptableCy);
    const positionedElements = applySavedPositions(elements, savedPositions);
    canvasAdapter.load(positionedElements);
    // TASK-004 AC-3/AC-5: a restored layout must not be re-randomized.
    canvasAdapter.setLayout("fcose", { ...config.fcoseParams, randomize: savedPositions.length === 0 });
    unregisterRef.current = wireCanvas(cy, config, setMinimapIndicator);
    cyRef.current = cy;
    exposeDevIntrospection(cy, elements, loadStartedAt);
    setAdapter(canvasAdapter);
    setLoadState("ready");
  } catch (err) {
    if (isCancelled()) return;
    setErrorMessage(errorMessageFor(err));
    setLoadState("error");
  }
}

export function useExplorerCanvas(options: UseExplorerCanvasOptions = {}): ExplorerCanvasState {
  const config = options.config ?? DEFAULT_EXPLORER_CONFIG;
  const fetchPalette = options.fetchPalette ?? defaultFetchPalette;
  const fetchGraph = options.fetchGraph ?? defaultFetchGraph;
  const createCy = options.createCy ?? createCytoscapeInstance;
  const fetchLayoutPositions = options.fetchLayoutPositions ?? defaultFetchLayoutPositions;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<CyLike | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [minimapIndicator, setMinimapIndicator] = useState<ViewportIndicator | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [adapter, setAdapter] = useState<RendererAdapter | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadCanvas({
      config,
      fetchPalette,
      fetchGraph,
      fetchLayoutPositions,
      createCy,
      containerRef,
      cyRef,
      unregisterRef,
      isCancelled: () => cancelled,
      setLoadState,
      setErrorMessage,
      setMinimapIndicator,
      setAdapter,
    });

    return () => {
      cancelled = true;
      unregisterRef.current?.();
      cyRef.current?.destroy();
      cyRef.current = null;
      setAdapter(null);
      clearDevIntrospection();
    };
  }, [config, fetchPalette, fetchGraph, fetchLayoutPositions, createCy, retryToken]);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  return { loadState, errorMessage, minimapIndicator, containerRef, retry, adapter };
}
