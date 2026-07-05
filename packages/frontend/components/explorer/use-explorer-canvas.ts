"use client";

import type { RefObject } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { ViewportIndicator } from "@/lib/explorer/minimap-geometry";
import type { CytoscapeElement, NodeKind } from "@/lib/explorer/types";
import type cytoscape from "cytoscape";

export type LoadState = "loading" | "ready" | "error";

/** Structural subset of `cytoscape.Core` this hook actually calls --
 * satisfied by both the real instance (create-cytoscape.ts) and a fake in
 * tests, so tests never import the real renderer (ADR-001 seam). */
export interface CyLike {
  container(): HTMLElement | null;
  json(spec: { elements: CytoscapeElement[] }): void;
  layout(options: Record<string, unknown>): { run(): void };
  zoom(): number;
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
  createCy?: (
    container: HTMLElement | null,
    elements: CytoscapeElement[],
    stylesheet: cytoscape.StylesheetStyle[],
  ) => CyLike;
}

export interface ExplorerCanvasState {
  loadState: LoadState;
  errorMessage: string | null;
  minimapIndicator: ViewportIndicator | null;
  containerRef: RefObject<HTMLDivElement | null>;
  retry: () => void;
}

// ponytail: stub -- red before green (TDD step 1).
export function useExplorerCanvas(_options?: UseExplorerCanvasOptions): ExplorerCanvasState {
  throw new Error("not implemented");
}
