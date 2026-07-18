/** Shapes consumed from CE-READ-1 (contracts documented in TASK-002's brief). */

export interface NodeKind {
  id: string;
  label: string;
  colour: string;
}

/** TASK-023 AC-6: the relationship-type palette for the draw-edge picker. */
export interface RelKind {
  id: string;
  label: string;
}

export interface GraphRow {
  subject: string;
  predicate: string;
  object: string;
  bpmo_kind?: string;
}

export interface SparqlPage {
  rows: GraphRow[];
  columns: string[];
  has_more_pages: boolean;
  page: number;
}

export interface CytoscapeElementData {
  id: string;
  label?: string;
  bpmo_kind?: string;
  source?: string;
  target?: string;
  /** TASK-020 AC-4/AC-5: property-filter source data. Not populated by the
   * M1 bulk load (map-rows-to-elements.ts sets only id/label/bpmo_kind) --
   * optional here for forward-compatibility; evalFilter's "missing path is
   * non-matching" rule already covers a node with no key_properties at all. */
  key_properties?: Record<string, string>;
  /** ge-canvas-1.md rule 8: a synthetic pseudo-node cytoscape renders a dot
   * for -- the far end of a boundary edge, never a real out-of-slice node. */
  stub?: boolean;
  /** ge-canvas-1.md rule 8: marks an edge as a boundary-edge stub marker
   * (source = in-slice node, target = a `stub: true` pseudo-node). */
  boundary_stub?: boolean;
}

export interface CytoscapeElement {
  data: CytoscapeElementData;
  /** TASK-004 AC-3/AC-5: a restored saved position, merged in before initial
   * load -- Cytoscape's native sibling-to-`data` position slot. */
  position?: { x: number; y: number };
}
