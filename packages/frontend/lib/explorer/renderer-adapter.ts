import { EXPLORER_HIGHLIGHT_CLASS } from "./build-stylesheet";
import type { CytoscapeElement } from "./types";

/** TASK-005 AC-3: one immediate neighbour of an expanded node, as returned
 * by `GET /api/ontology/resource/{iri}`'s `neighbours` field. */
export interface NeighbourElement {
  iri: string;
  label: string;
  bpmoKind: string;
  edgePredicate: string;
  edgeDirection: "outgoing" | "incoming";
}

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
  /** TASK-005: right-click on a node, for the context menu ("Focus domain",
   * "Expand neighbours"/"Collapse neighbours") -- fires with the node's id
   * and its on-screen position so the menu can be placed there. */
  onNodeRightClick(handler: (nodeId: string, position: { x: number; y: number }) => void): () => void;
  getNodeData(nodeId: string): NodeData | undefined;
  listNodes(): ListedNode[];
  centerOn(nodeId: string, durationMs: number): void;
  /** TASK-004 AC-1: fires once a drag gesture releases, with the node's new
   * position -- the seam use-layout-persistence.ts saves against. */
  onNodeDragEnd(handler: (nodeId: string, position: { x: number; y: number }) => void): () => void;
  /** TASK-005 AC-3: attaches newly-discovered neighbours (nodes + edges) to
   * the canvas, highlights any already present instead of duplicating them,
   * and records the added node ids on the focus node's own data so a later
   * collapse (AC-5) knows what it added. Returns the added node ids. */
  expandNode(nodeId: string, neighbours: NeighbourElement[]): string[];
  /** TASK-005 AC-5: removes the nodes a prior `expandNode` call added for
   * `nodeId`, except any that gained a retained connection to something
   * outside that added set; the focus node itself is never removed. */
  collapseNode(nodeId: string): void;
  /** AC-5: whether a node currently has expanded neighbours -- reads the
   * same data expandNode/collapseNode maintain, so it's correct across
   * remounts of any consuming hook/component. */
  hasExpandedNeighbours(nodeId: string): boolean;
  /** TASK-020 AC-1/AC-3/AC-4/AC-7: applies a filter-state change as one
   * batched transaction -- hiddenNodeIds (+ their incident edges) get a
   * real hide (display:none, AC-1's entity-type-off); dimmedNodeIds get
   * opacity only, still visible (AC-3's orphaned-by-relationship-toggle
   * nodes, or AC-4's property-filter non-matches). Both sets are absolute:
   * every node not listed is shown / restored to full opacity, so a toggle
   * "back on" is just re-applying with a smaller set. */
  applyFilterVisibility(visibility: FilterVisibility, dimOpacity: number): void;
  /** TASK-020 AC-6: adds governed-layer nodes/edges, skipping any element
   * already on the canvas (a layer node may coincide with a base-graph
   * node) -- returns the ids actually added, so the caller can track
   * exactly what a later `removeElements` should undo. */
  addLayerNodes(elements: CytoscapeElement[]): string[];
  /** TASK-020 AC-6: removes elements by id (layer toggle-off). No-op for
   * an id not currently on the canvas. */
  removeElements(ids: string[]): void;
}

export interface FilterVisibility {
  hiddenNodeIds: string[];
  dimmedNodeIds: string[];
  /** AC-3: relationship-type-off edges, hidden directly by id -- these
   * connect two still-visible nodes, so they're not reachable via
   * hiddenNodeIds' incident-edge hide. Optional: callers with no
   * relationship toggles active can omit it. */
  hiddenEdgeIds?: string[];
}

export interface CyCollection {
  id(): string;
  data(key: string, value?: unknown): unknown;
  style(styles: Record<string, unknown>): void;
  not(other: CyCollection): CyCollection;
  length: number;
  map<T>(fn: (ele: CyCollection) => T): T[];
  filter(fn: (ele: CyCollection) => boolean): CyCollection;
  connectedEdges(): CyCollection;
  addClass(className: string): void;
  closedNeighborhood(): CyCollection;
  position(): { x: number; y: number };
  /** TASK-020 AC-1: real hide/show (display:none), distinct from the
   * opacity-based dim used elsewhere -- an entity-type-off node must not
   * still occupy layout space. */
  hide(): void;
  show(): void;
}

interface CyEvent {
  target: unknown;
  renderedPosition?: { x: number; y: number };
}

export interface AdaptableCy {
  json(spec: { elements: CytoscapeElement[] }): void;
  zoom(): number;
  pan(): { x: number; y: number };
  layout(options: { name: string } & Record<string, unknown>): { run(): void };
  elements(): CyCollection;
  nodes(): CyCollection;
  edges(): CyCollection;
  getElementById(id: string): CyCollection;
  on(event: string, handler: (evt: CyEvent) => void): void;
  off(event: string, handler: (evt: CyEvent) => void): void;
  animate(position: { center: { eles: CyCollection } }, options: { duration: number }): void;
  add(elements: CytoscapeElement[]): void;
  remove(collection: CyCollection): void;
  /** TASK-020 AC-7: one render pass for every style/visibility mutation
   * inside `fn` -- required for the 300ms @ 10k-node filter-apply budget. */
  batch(fn: () => void): void;
}

function readNodeData(node: CyCollection): NodeData {
  return {
    label: node.data("label") as string,
    bpmoKind: node.data("bpmo_kind") as string,
  };
}

function wireEvent(
  cy: AdaptableCy,
  eventName: string,
  isMatch: (target: unknown) => boolean,
  handler: (evt: CyEvent) => void
): () => void {
  const listener = (evt: CyEvent) => {
    if (isMatch(evt.target)) handler(evt);
  };
  cy.on(eventName, listener);
  return () => cy.off(eventName, listener);
}

function wireTap(cy: AdaptableCy, isMatch: (target: unknown) => boolean, handler: (target: unknown) => void): () => void {
  return wireEvent(cy, "tap", isMatch, (evt) => handler(evt.target));
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

// TASK-020 AC-6: dedupe against what's already on the canvas (a layer node
// may coincide with a base-graph node) before adding.
function addLayerNodesOn(cy: AdaptableCy, elements: CytoscapeElement[]): string[] {
  const newElements = elements.filter((el) => cy.getElementById(el.data.id).length === 0);
  if (newElements.length > 0) cy.add(newElements);
  return newElements.map((el) => el.data.id);
}

function removeElementsOn(cy: AdaptableCy, ids: string[]): void {
  const idSet = new Set(ids);
  cy.remove(cy.elements().filter((el) => idSet.has(el.id())));
}

/** TASK-020 AC-1/AC-3/AC-4/AC-7: one batched pass -- hide/show operate on
 * whole node/edge collections (never a per-node loop), keeping the
 * 300ms @ 10k-node filter-apply budget. */
function applyFilterVisibilityOn(cy: AdaptableCy, visibility: FilterVisibility, dimOpacity: number): void {
  const hiddenIds = new Set(visibility.hiddenNodeIds);
  const dimmedIds = new Set(visibility.dimmedNodeIds);
  const hiddenEdgeIds = new Set(visibility.hiddenEdgeIds ?? []);

  const hiddenNodes = cy.nodes().filter((node) => hiddenIds.has(node.id()));
  const visibleNodes = cy.nodes().not(hiddenNodes);
  // AC-1: edges incident to a hidden node. AC-3: edges hidden directly by id
  // (relationship-type-off) -- their endpoint nodes stay visible, so
  // connectedEdges() alone never reaches them. Hidden separately, same batch.
  const incidentEdges = hiddenNodes.connectedEdges();
  const incidentEdgeIds = new Set(incidentEdges.map((edge) => edge.id()));
  const explicitHiddenEdges = cy.edges().filter((edge) => hiddenEdgeIds.has(edge.id()));
  const visibleEdges = cy.edges().filter((edge) => !incidentEdgeIds.has(edge.id()) && !hiddenEdgeIds.has(edge.id()));

  cy.batch(() => {
    hiddenNodes.hide();
    incidentEdges.hide();
    explicitHiddenEdges.hide();
    visibleNodes.show();
    visibleEdges.show();

    const dimmedNodes = visibleNodes.filter((node) => dimmedIds.has(node.id()));
    dimmedNodes.style({ opacity: dimOpacity });
    visibleNodes.not(dimmedNodes).style({ opacity: 1 });
  });
}

function neighbourEdgeData(nodeId: string, neighbour: NeighbourElement): { id: string; source: string; target: string; label: string } {
  const [source, target] = neighbour.edgeDirection === "outgoing" ? [nodeId, neighbour.iri] : [neighbour.iri, nodeId];
  return { id: `${source}|${neighbour.edgePredicate}|${target}`, source, target, label: neighbour.edgePredicate };
}

function neighbourToElements(nodeId: string, neighbour: NeighbourElement): CytoscapeElement[] {
  return [
    { data: { id: neighbour.iri, label: neighbour.label, bpmo_kind: neighbour.bpmoKind } },
    { data: neighbourEdgeData(nodeId, neighbour) },
  ];
}

function otherEndpoint(edge: CyCollection, candidateId: string): string {
  const source = edge.data("source") as string;
  const target = edge.data("target") as string;
  return source === candidateId ? target : source;
}

/** AC-5: a candidate is safe to remove only if every edge it still has
 * connects it to either the focus node or another node in the removed set
 * -- any edge to something else means some other still-visible part of the
 * canvas depends on this node, so it's retained. */
function hasExternalConnection(candidate: CyCollection, removableIds: Set<string>, focusId: string): boolean {
  const candidateId = candidate.id();
  return candidate
    .connectedEdges()
    .map((edge) => otherEndpoint(edge, candidateId))
    .some((otherId) => otherId !== focusId && !removableIds.has(otherId));
}

function expandNodeOn(cy: AdaptableCy, nodeId: string, neighbours: NeighbourElement[]): string[] {
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return [];

  const newElements: CytoscapeElement[] = [];
  const addedIds: string[] = [];
  for (const neighbour of neighbours) {
    const existing = cy.getElementById(neighbour.iri);
    if (existing.length > 0) {
      existing.addClass(EXPLORER_HIGHLIGHT_CLASS);
      continue;
    }
    newElements.push(...neighbourToElements(nodeId, neighbour));
    addedIds.push(neighbour.iri);
  }

  if (newElements.length > 0) cy.add(newElements);
  node.data("expandedNeighbourIds", addedIds);
  return addedIds;
}

function hasExpandedNeighboursOn(cy: AdaptableCy, nodeId: string): boolean {
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return false;
  const ids = (node.data("expandedNeighbourIds") as string[] | undefined) ?? [];
  return ids.length > 0;
}

function collapseNodeOn(cy: AdaptableCy, nodeId: string): void {
  const node = cy.getElementById(nodeId);
  if (node.length === 0) return;
  const addedIds = new Set((node.data("expandedNeighbourIds") as string[] | undefined) ?? []);
  if (addedIds.size === 0) return;

  const removable = cy
    .nodes()
    .filter((candidate) => addedIds.has(candidate.id()) && !hasExternalConnection(candidate, addedIds, nodeId));
  cy.remove(removable);
  node.data("expandedNeighbourIds", undefined);
}

type ViewportMethods = Pick<RendererAdapter, "load" | "getViewport" | "setLayout" | "centerOn">;
type OpacityMethods = Pick<RendererAdapter, "spotlightNode" | "resetOpacity" | "highlightNodes" | "applyFilterVisibility">;
type QueryMethods = Pick<
  RendererAdapter,
  "onNodeTap" | "onBackgroundTap" | "onNodeRightClick" | "getNodeData" | "listNodes"
>;

function createViewportMethods(cy: AdaptableCy): ViewportMethods {
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
    centerOn(nodeId, durationMs) {
      const node = cy.getElementById(nodeId);
      if (node.length === 0) return;
      cy.animate({ center: { eles: node } }, { duration: durationMs });
    },
  };
}

function createOpacityMethods(cy: AdaptableCy): OpacityMethods {
  return {
    spotlightNode(nodeId, dimOpacity) {
      return applySpotlight(cy, nodeId, dimOpacity);
    },
    resetOpacity() {
      cy.elements().style({ opacity: 1 });
    },
    highlightNodes(nodeIds, dimOpacity) {
      applyHighlight(cy, nodeIds, dimOpacity);
    },
    applyFilterVisibility(visibility, dimOpacity) {
      applyFilterVisibilityOn(cy, visibility, dimOpacity);
    },
  };
}

function createQueryMethods(cy: AdaptableCy): QueryMethods {
  return {
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
    onNodeRightClick(handler) {
      return wireEvent(
        cy,
        "cxttap",
        (target) => target !== cy,
        (evt) => handler((evt.target as CyCollection).id(), evt.renderedPosition ?? { x: 0, y: 0 })
      );
    },
    getNodeData(nodeId) {
      const node = cy.getElementById(nodeId);
      return node.length === 0 ? undefined : readNodeData(node);
    },
    listNodes() {
      return cy.nodes().map((node) => ({ id: node.id(), ...readNodeData(node) }));
    },
  };
}

export function createRendererAdapter(cy: AdaptableCy): RendererAdapter {
  return {
    ...createViewportMethods(cy),
    ...createOpacityMethods(cy),
    ...createQueryMethods(cy),
    onNodeDragEnd(handler) {
      return wireDragFree(cy, handler);
    },
    expandNode(nodeId, neighbours) {
      return expandNodeOn(cy, nodeId, neighbours);
    },
    collapseNode(nodeId) {
      collapseNodeOn(cy, nodeId);
    },
    hasExpandedNeighbours(nodeId) {
      return hasExpandedNeighboursOn(cy, nodeId);
    },
    addLayerNodes(elements) {
      return addLayerNodesOn(cy, elements);
    },
    removeElements(ids) {
      removeElementsOn(cy, ids);
    },
  };
}
