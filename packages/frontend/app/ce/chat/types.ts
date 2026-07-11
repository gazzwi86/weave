/** Mirrors weave_backend.schemas.operations.Op (discriminated union on
 * `op`) and the CE-READ-1 kind catalogue -- kept local to the chat/form
 * surfaces rather than shared globally since no other part of the app
 * consumes CE-WRITE-1 shapes yet.
 */
export type Op =
  | {
      op: "add_node";
      ref: string;
      kind: string;
      label: string;
      properties?: Record<string, unknown>;
    }
  | { op: "update_node"; iri: string; properties?: Record<string, unknown> }
  | { op: "add_edge"; subject_ref: string; predicate: string; object_ref: string }
  | { op: "delete_node"; iri: string }
  | { op: "delete_edge"; subject: string; predicate: string; object: string };

export type AddNodeOp = Extract<Op, { op: "add_node" }>;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  operations?: Op[];
  status?: "proposed" | "confirmed" | "rejected";
  resultIri?: string;
}

export interface PropertyShape {
  path: string;
  name: string;
  is_relationship: boolean;
  min_count: number | null;
  max_count: number | null;
  severity: string;
}

export interface KindEntry {
  iri: string;
  label: string;
  properties: PropertyShape[];
  /** TASK-011: plain-language skos:definition, sourced from CE-READ-1 --
   * absent/null for a kind with no definition (e.g. a future client
   * extension kind), never invented copy. */
  description?: string | null;
}
