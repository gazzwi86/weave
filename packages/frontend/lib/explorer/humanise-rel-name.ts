import type { OntologyRelationshipEntry } from "./validate-closure";

/** M1 IRI-hiding rule / TASK-027 AC-4: a predicate IRI is never rendered
 * raw. Local-segment fallback covers both an unnamed known entry (empty
 * `sh:name`) and a predicate CE's types list doesn't carry at all --
 * additive ontology growth is never a hard failure here (mirrors
 * validate-closure.ts's own "extra predicate is fine" stance). */
function localSegment(iri: string): string {
  const fragmentIndex = iri.lastIndexOf("#");
  if (fragmentIndex !== -1) return iri.slice(fragmentIndex + 1);
  return iri.slice(iri.lastIndexOf("/") + 1);
}

export function humaniseRelName(predicateIri: string, relationships: OntologyRelationshipEntry[]): string {
  const known = relationships.find((entry) => entry.path === predicateIri)?.name;
  return known && known.length > 0 ? known : localSegment(predicateIri);
}
