import type { CytoscapeElement } from "./types";

export interface Viewport {
  zoom: number;
  pan: { x: number; y: number };
}

export interface NodeData {
  label: string;
  bpmoKind: string;
}

export interface ListedNode extends NodeData {
  id: string;
}

/** ADR-001 renderer-adapter seam: TASK-002 needs only `load`, `getViewport`,
 * `setLayout` -- `onNodeClick` and `pin` are added by the tasks that need
 * them (TASK-003/TASK-004) -- so a future WebGL swap only touches
 * implementations of this interface, never call sites.
 *
 * TASK-003 (AC-1/AC-4/AC-5/AC-6) adds the spotlight/search operations to this
 * same seam: dim/restore opacity, tap wiring, and reading already-loaded node
 * data for the search overlay and the side panel's instant first paint. */
export interface RendererAdapter {
  load(elements: CytoscapeElement[]): void;
  getViewport(): Viewport;
  setLayout(name: string, params: Record<string, unknown>): void;
  spotlightNode(nodeId: string, dimOpacity: number): boolean;
  resetOpacity(): void;
  highlightNodes(nodeIds: string[], dimOpacity: number): void;
  onNodeTap(handler: (nodeId: string) => void): () => void;
  onBackgroundTap(handler: () => void): () => void;
  getNodeData(nodeId: string): NodeData | undefined;
  listNodes(): ListedNode[];
  centerOn(nodeId: string, durationMs: number): void;
  /** TASK-004 AC-1: fires once a drag gesture releases, with the node's new
   * position -- the seam use-layout-persistence.ts saves against. */
  onNodeDragEnd(handler: (nodeId: string, position: { x: number; y: number }) => void): () => void;
}

export interface CyCollection {
  id(): string;
  data(key: string): unknown;
  style(styles: Record<string, unknown>): void;
  not(other: CyCollection): CyCollection;
  length: number;
  map<T>(fn: (ele: CyCollection) => T): T[];
  closedNeighborhood(): CyCollection;
  position(): { x: number; y: number };
}

export interface AdaptableCy {
  json(spec: { elements: CytoscapeElement[] }): void;
  zoom(): number;
  pan(): { x: number; y: number };
  layout(options: { name: string } & Record<string, unknown>): { run(): void };
  elements(): CyCollection;
  nodes(): CyCollection;
  getElementById(id: string): CyCollection;
  on(event: string, handler: (evt: { target: unknown }) => void): void;
  off(event: string, handler: (evt: { target: unknown }) => void): void;
  animate(position: { center: { eles: CyCollection } }, options: { duration: number }): void;
}

function readNodeData(node: CyCollection): NodeData {
  return {
    label: node.data("label") as string,
    bpmoKind: node.data("bpmo_kind") as string,
  };
}

function wireTap(cy: AdaptableCy, isMatch: (target: unknown) => boolean, handler: (target: unknown) => void): () => void {
  const listener = (evt: { target: unknown }) => {
    if (isMatch(evt.target)) handler(evt.target);
  };
  cy.on("tap", listener);
  return () => cy.off("tap", listener);
}

// TASK-004 AC-1: cytoscape's "dragfree" event only ever fires with the
// dragged node as evt.target (never the core), so -- unlike wireTap -- no
// isMatch filter is needed here.
function wireDragFree(
  cy: AdaptableCy,
  handler: (nodeId: string, position: { x: number; y: number }) => void
): () => void {
  const listener = (evt: { target: unknown }) => {
    const node = evt.target as CyCollection;
    handler(node.id(), node.position());
  };
  cy.on("dragfree", listener);
  return () => cy.off("dragfree", listener);
}

// XT-008: pulled out of createRendererAdapter's returned object to keep that
// function under Law E's line budget -- same shape wireTap/wireDragFree
// already use (standalone fn taking `cy`, thin delegator below).
function applySpotlight(cy: AdaptableCy, nodeId: string, dimOpacity: number): boolean {
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return false;
  const neighbourhood = node.closedNeighborhood();
  cy.elements().not(neighbourhood).style({ opacity: dimOpacity });
  neighbourhood.style({ opacity: 1 });
  return true;
}

function applyHighlight(cy: AdaptableCy, nodeIds: string[], dimOpacity: number): void {
  cy.elements().style({ opacity: dimOpacity });
  nodeIds.forEach((nodeId) => cy.getElementById(nodeId).style({ opacity: 1 }));
}

function centerOnNode(cy: AdaptableCy, nodeId: string, durationMs: number): void {
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return;
  cy.animate({ center: { eles: node } }, { duration: durationMs });
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
    spotlightNode(nodeId, dimOpacity) {
      return applySpotlight(cy, nodeId, dimOpacity);
    },
    resetOpacity() {
      cy.elements().style({ opacity: 1 });
    },
    highlightNodes(nodeIds, dimOpacity) {
      applyHighlight(cy, nodeIds, dimOpacity);
    },
    onNodeTap(handler) {
      return wireTap(
        cy,
        (target) => target !== cy,
        (target) => handler((target as CyCollection).id())
      );
    },
    onBackgroundTap(handler) {
      return wireTap(
        cy,
        (target) => target === cy,
        () => handler()
      );
    },
    getNodeData(nodeId) {
      const node = cy.getElementById(nodeId);
      return node.length === 0 ? undefined : readNodeData(node);
    },
    listNodes() {
      return cy.nodes().map((node) => ({ id: node.id(), ...readNodeData(node) }));
    },
    centerOn(nodeId, durationMs) {
      centerOnNode(cy, nodeId, durationMs);
    },
    onNodeDragEnd(handler) {
      return wireDragFree(cy, handler);
    },
  };
}
