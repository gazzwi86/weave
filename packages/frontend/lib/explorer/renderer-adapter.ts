import { EXPLORER_HIGHLIGHT_CLASS, EXPLORER_TRACE_CLASS, readCssToken } from "./build-stylesheet";
import { applyNodeColoursOn, clearNodeColoursOn } from "./renderer-adapter-colour";
import { clearBadgesOn, setBadgesOn } from "./renderer-adapter-badge";
import { clearDiffOverlayOn, setDiffOverlayOn, type DiffOverlayAssignment } from "./renderer-adapter-diff";
import { allNodePositionsOn, applyPositionsOn, mergeInPlaceOn, setViewportOn } from "./renderer-adapter-views";
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
  /** TASK-023 AC-3: fires for a double-click on empty canvas (the quick-add
   * trigger), never for a double-click on a node or edge -- mirrors
   * onNodeRightClick's target-matching for the opposite target. */
  onBackgroundDoubleClick(handler: (position: { x: number; y: number }) => void): () => void;
  /** TASK-023 AC-6: fires once an edgehandles drag releases on a valid
   * target node, with the two node ids -- draw-edge's trigger, mirroring
   * onBackgroundDoubleClick's quick-add trigger. Discards edgehandles' own
   * auto-added edge immediately (the real edge, carrying the user's chosen
   * relationship type, is added later by commitOp once the rel-type picker
   * resolves) -- this method's sole job is signalling which two nodes to
   * connect. */
  onEdgeDrawComplete(handler: (sourceId: string, targetId: string) => void): () => void;
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
  /** TASK-023 AC-8: swaps a locally-ref'd optimistic element's identity for
   * the real IRI CE-WRITE-1 returned -- cytoscape element ids are immutable
   * after creation, so this is remove-then-add, carrying the element's
   * current position forward (a slow commit shouldn't cause a visible
   * jump). No-op if `localId` isn't on the canvas (already rolled back).
   * Dedups against an already-present real IRI the same way addLayerNodes
   * does (CE-WRITE-1's case-insensitive label+kind dedup can resolve a
   * quick-add to an existing node). */
  reconcileElement(localId: string, element: CytoscapeElement): void;
  /** TASK-020: every node + edge currently on the canvas, in the same
   * CytoscapeElement shape `load`/`addLayerNodes` accept -- the source
   * use-filter-panel.ts feeds computeFilterVisibility. Reads the adapter's
   * live state (not a cached copy of the initial load) so it reflects
   * later layer add/remove and neighbour expand/collapse. */
  listElements(): CytoscapeElement[];
  /** TASK-021 AC-4/AC-7: the colour overlay seam -- Overlay Engine is the
   * only caller. One batched pass groups nodes by target colour (bounded
   * by distinct colours, never a per-node loop); any node id not present
   * in `colourByNodeId` gets `fallbackColour`. */
  applyNodeColours(colourByNodeId: Record<string, string>, fallbackColour: string): void;
  /** TASK-021 AC-4: clears every inline colour override in one batched
   * pass -- this IS "restore prior colouring" (AC-4), since kind colouring
   * is stylesheet-driven (bpmo_kind selector), never an inline override
   * itself, and reasserts the moment the override is cleared. */
  clearNodeColours(): void;
  /** TASK-028 AC-3/AC-7: the pinned-impact trace seam -- a border class
   * (EXPLORER_TRACE_CLASS), deliberately separate from the "colour"
   * background-colour seam above, so a pin coexists with an active colour
   * overlay instead of competing for the same channel. */
  setTraceHighlight(nodeIds: string[]): void;
  /** TASK-028 AC-4: clears the trace class from every node. */
  clearTraceHighlight(): void;
  /** TASK-028 AC-5: live hidden state for the pin legend's hidden-by-
   * filters count -- reads cytoscape's actual rendered state, correct
   * after any filter apply without a separate subscription. */
  isHidden(nodeId: string): boolean;
  /** TASK-028 AC-4: native cytoscape `remove` event -- fires for any
   * removal path (explicit removeElements, layer toggle-off, a future
   * delete flow), so the pin's source-delete auto-clear doesn't need to
   * know which caller removed the node. Returns an unsubscribe. */
  onElementRemoved(handler: (id: string) => void): () => void;
  /** TASK-022 AC-3/AC-8: the diff overlay's border-colour + glyph seam --
   * deliberately separate from the "colour" background-colour seam
   * (applyNodeColours), so a diff coexists with the trace overlay and
   * shares only the OverlayEngine's "colour" exclusiveGroup with heatmap. */
  setDiffOverlay(assignments: DiffOverlayAssignment[]): void;
  /** TASK-022 AC-8: clears every diff class + glyph label in one batch. */
  clearDiffOverlay(): void;
  /** TASK-026 AC-1/AC-2: saved-view viewport restore -- writes zoom/pan
   * back onto the renderer (the inverse of getViewport). */
  setViewport(viewport: Viewport): void;
  /** TASK-026 AC-1: drag-state capture for a save -- every node's current
   * position, keyed by id. */
  allNodePositions(): Record<string, { x: number; y: number }>;
  /** TASK-026 AC-2: restores saved positions before the layout runs --
   * a position for an id no longer on the canvas is skipped. */
  applyPositions(positions: Record<string, { x: number; y: number }>): void;
  /** TASK-026 AC-7: poll-merge seam -- adds/refreshes delta elements in
   * place, never touching an id in `preserveIds` (unsaved drag). */
  mergeInPlace(delta: CytoscapeElement[], preserveIds: string[]): void;
  /** TASK-027 AC-1/AC-7: the completeness overlay's badge seam -- a
   * dedicated `gapBadgeLabel` data field/class, deliberately separate from
   * the "colour" background-colour seam, so a gap badge coexists with an
   * active colour overlay. Any node id not present in `countByNodeId` is
   * left un-badged (AC-1: neutral). */
  setBadges(countByNodeId: Record<string, number>): void;
  /** TASK-027: clears every gap badge in one batch (deactivating the
   * overlay). */
  clearBadges(): void;}

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
  /** TASK-028: clears a class -- the trace-highlight seam's un-apply. */
  removeClass(className: string): void;
  /** TASK-028 AC-5: true if this element (or an ancestor) is display:none
   * -- native cytoscape visibility read, source of truth for the pin
   * legend's hidden-by-filters count. */
  hidden(): boolean;
  closedNeighborhood(): CyCollection;
  /** No-arg reads the current position; with an argument, sets it (mirrors
   * cytoscape's own `.position()` overload) -- TASK-026's restore/merge
   * seam is the first caller of the setter form. */
  position(value?: { x: number; y: number }): { x: number; y: number };
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
  zoom(value?: number): number;
  pan(value?: { x: number; y: number }): { x: number; y: number };
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
// TASK-023 AC-6: cytoscape-edgehandles' "ehcomplete" fires with extra
// positional args (sourceNode, targetNode, addedEdge) beyond the usual evt
// object -- optional params here keep this assignable to AdaptableCy's
// generic `on`/`off` (evt: CyEvent) => void shape while still reading them.
function wireEdgeDrawComplete(cy: AdaptableCy, handler: (sourceId: string, targetId: string) => void): () => void {
  const listener = (_evt: CyEvent, sourceNode?: CyCollection, targetNode?: CyCollection, addedEdge?: CyCollection) => {
    if (!sourceNode || !targetNode) return;
    if (addedEdge) cy.remove(addedEdge);
    handler(sourceNode.id(), targetNode.id());
  };
  cy.on("ehcomplete", listener);
  return () => cy.off("ehcomplete", listener);
}

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

// TASK-023 AC-8: remove-then-add (cytoscape element ids are immutable),
// carrying the local ref's current position forward, then reusing
// addLayerNodesOn's dedup so a CE-WRITE-1 resolved-to-existing IRI never
// double-adds.
function reconcileElementOn(cy: AdaptableCy, localId: string, element: CytoscapeElement): void {
  const localRefEl = cy.getElementById(localId);
  if (localRefEl.length === 0) return;

  const position = element.position ?? localRefEl.position();
  cy.remove(localRefEl);
  addLayerNodesOn(cy, [{ ...element, position }]);
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
type ViewMethods = Pick<RendererAdapter, "setViewport" | "allNodePositions" | "applyPositions" | "mergeInPlace">;
type OpacityMethods = Pick<RendererAdapter, "spotlightNode" | "resetOpacity" | "highlightNodes" | "applyFilterVisibility">;
type QueryMethods = Pick<
  RendererAdapter,
  | "onNodeTap"
  | "onBackgroundTap"
  | "onNodeRightClick"
  | "onBackgroundDoubleClick"
  | "getNodeData"
  | "listNodes"
  | "listElements"
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
    onBackgroundDoubleClick(handler) {
      return wireEvent(
        cy,
        "dbltap",
        (target) => target === cy,
        (evt) => handler(evt.renderedPosition ?? { x: 0, y: 0 })
      );
    },
    getNodeData(nodeId) {
      const node = cy.getElementById(nodeId);
      return node.length === 0 ? undefined : readNodeData(node);
    },
    listNodes() {
      return cy.nodes().map((node) => ({ id: node.id(), ...readNodeData(node) }));
    },
    listElements() {
      const nodes = cy.nodes().map((node) => ({
        data: {
          id: node.id(),
          label: node.data("label") as string | undefined,
          bpmo_kind: node.data("bpmo_kind") as string | undefined,
          key_properties: node.data("key_properties") as Record<string, string> | undefined,
        },
      }));
      const edges = cy.edges().map((edge) => ({
        data: {
          id: edge.id(),
          label: edge.data("label") as string | undefined,
          source: edge.data("source") as string,
          target: edge.data("target") as string,
        },
      }));
      return [...nodes, ...edges];
    },
  };
}

// TASK-026: pulled out alongside createViewportMethods/createOpacityMethods
// to keep createRendererAdapter under Law E's function-length budget.
function createViewMethods(cy: AdaptableCy): ViewMethods {
  return {
    setViewport(viewport) {
      setViewportOn(cy, viewport);
    },
    allNodePositions() {
      return allNodePositionsOn(cy);
    },
    applyPositions(positions) {
      applyPositionsOn(cy, positions);
    },
    mergeInPlace(delta, preserveIds) {
      mergeInPlaceOn(cy, delta, preserveIds);
    },
  };
}

type TraceMethods = Pick<RendererAdapter, "setTraceHighlight" | "clearTraceHighlight" | "isHidden" | "onElementRemoved">;

// TASK-028: pulled out for the same Law E reason as createViewMethods.
function createTraceMethods(cy: AdaptableCy): TraceMethods {
  return {
    setTraceHighlight(nodeIds) {
      cy.batch(() => {
        cy.nodes().removeClass(EXPLORER_TRACE_CLASS);
        nodeIds.forEach((nodeId) => cy.getElementById(nodeId).addClass(EXPLORER_TRACE_CLASS));
      });
    },
    clearTraceHighlight() {
      cy.nodes().removeClass(EXPLORER_TRACE_CLASS);
    },
    isHidden(nodeId) {
      return cy.getElementById(nodeId).hidden();
    },
    onElementRemoved(handler) {
      return wireEvent(cy, "remove", () => true, (evt) => handler((evt.target as CyCollection).id()));
    },
  };
}

export function createRendererAdapter(cy: AdaptableCy): RendererAdapter {
  return {
    ...createViewportMethods(cy),
    ...createOpacityMethods(cy),
    ...createQueryMethods(cy),
    ...createViewMethods(cy),
    ...createTraceMethods(cy),
    onNodeDragEnd(handler) {
      return wireDragFree(cy, handler);
    },
    onEdgeDrawComplete(handler) {
      return wireEdgeDrawComplete(cy, handler);
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
    reconcileElement(localId, element) {
      reconcileElementOn(cy, localId, element);
    },
    applyNodeColours(colourByNodeId, fallbackColour) {
      applyNodeColoursOn(cy, colourByNodeId, fallbackColour, readCssToken);
    },
    clearNodeColours() {
      clearNodeColoursOn(cy);
    },
    setDiffOverlay(assignments) {
      setDiffOverlayOn(cy, assignments);
    },
    clearDiffOverlay() {
      clearDiffOverlayOn(cy);
    },
    setBadges(countByNodeId) {
      setBadgesOn(cy, countByNodeId);
    },
    clearBadges() {
      clearBadgesOn(cy);
    },
  };
}
