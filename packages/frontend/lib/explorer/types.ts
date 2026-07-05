/** Shapes consumed from CE-READ-1 (contracts documented in TASK-002's brief). */

export interface NodeKind {
  id: string;
  label: string;
  colour: string;
}

export interface GraphRow {
  subject: string;
  predicate: string;
  object: string;
  bpmo_kind?: string;
  label?: string;
  skos_pref_label?: string;
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
}

export interface CytoscapeElement {
  data: CytoscapeElementData;
  /** TASK-004 AC-3/AC-5: a restored saved position, merged in before initial
   * load -- Cytoscape's native sibling-to-`data` position slot. */
  position?: { x: number; y: number };
}
