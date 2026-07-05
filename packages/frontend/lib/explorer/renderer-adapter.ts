import type { CytoscapeElement } from "./types";

export interface Viewport {
  zoom: number;
  pan: { x: number; y: number };
}

/** ADR-001 renderer-adapter seam: TASK-002 needs only `load`, `getViewport`,
 * `setLayout` -- `onNodeClick` and `pin` are added by the tasks that need
 * them (TASK-003/TASK-004) -- so a future WebGL swap only touches
 * implementations of this interface, never call sites. */
export interface RendererAdapter {
  load(elements: CytoscapeElement[]): void;
  getViewport(): Viewport;
  setLayout(name: string, params: Record<string, unknown>): void;
}

export interface AdaptableCy {
  json(spec: { elements: CytoscapeElement[] }): void;
  zoom(): number;
  pan(): { x: number; y: number };
  layout(options: { name: string } & Record<string, unknown>): { run(): void };
}

export function createRendererAdapter(cy: AdaptableCy): RendererAdapter {
  return {
    load(elements) {
      cy.json({ elements });
    },
    getViewport() {
      return { zoom: cy.zoom(), pan: cy.pan() };
    },
    setLayout(name, params) {
      cy.layout({ name, ...params }).run();
    },
  };
}
