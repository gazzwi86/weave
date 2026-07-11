import type { ClosurePredicateEntry } from "./closure-config";

/** Shape drawn from the backend's `PropertyShapeModel` (relationships entry
 * of `GET /api/ontology/types`, CE-READ-1) -- `path` (the full predicate
 * IRI) drives drift checking; `name` (TASK-027) is the sh:name-derived
 * human label, consumed by humanise-rel-name.ts for the completeness
 * overlay's missing-link list (never a raw predicate IRI, AC-4). */
export interface OntologyRelationshipEntry {
  path: string;
  name?: string;
}

export interface ClosureValidationResult {
  ok: boolean;
  missing: string[];
}

/** TASK-028 AC-2: boot-time drift guard. Every closure predicate must
 * resolve against CE-READ-1's live relationship list; extra/unknown CE
 * predicates never fail this (additive ontology growth is fine) -- only a
 * closure entry CE no longer serves is drift (ADR-018). */
export function validateClosure(
  closure: ClosurePredicateEntry[],
  relationships: OntologyRelationshipEntry[],
): ClosureValidationResult {
  const known = new Set(relationships.map((entry) => entry.path));
  const missing = closure.filter((entry) => !known.has(entry.predicate)).map((entry) => entry.predicate);
  return { ok: missing.length === 0, missing };
}

/** AC-2: loud banner text -- "never a silent empty trace". */
export function describeDrift(missing: string[]): string {
  return `Ontology drift: ${missing.join(", ")} not served by CE`;
}
