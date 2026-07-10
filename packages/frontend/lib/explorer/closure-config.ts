import { WEAVE_ONTOLOGY_NS } from "./map-rows-to-elements";

/** TASK-028 AC-1: one closure entry, normalised "dependent -> dependency"
 * per ADR-018. `orientation` says whether CE's stored predicate direction
 * already matches that reading (`forward`) or is the reverse of it
 * (`inverse`) -- the walk composer (build-traversal-path.ts) uses this to
 * decide when to emit `^predicate` in the SPARQL property path. */
export interface ClosurePredicateEntry {
  predicate: string;
  orientation: "forward" | "inverse";
}

function forward(localName: string): ClosurePredicateEntry {
  return { predicate: `${WEAVE_ONTOLOGY_NS}${localName}`, orientation: "forward" };
}

function inverse(localName: string): ClosurePredicateEntry {
  return { predicate: `${WEAVE_ONTOLOGY_NS}${localName}`, orientation: "inverse" };
}

/** ADR-018's 13-entry directed closure, copied verbatim (9 forward, 4
 * inverse) -- the ADR is the source of truth; if it changes, amend the ADR
 * first, then this array (the snapshot test enforces the pairing). No
 * predicate IRI appears as a literal anywhere in traversal code (AC-1) --
 * only here and in the ADR itself. */
export const OQ09_PREDICATE_CLOSURE: ClosurePredicateEntry[] = [
  forward("dependsOn"),
  forward("runsOn"),
  forward("accesses"),
  forward("consumes"),
  forward("triggeredBy"),
  forward("hasStep"),
  forward("hasField"),
  forward("performedBy"),
  forward("governedBy"),
  inverse("produces"),
  inverse("realizes"),
  inverse("servesGoal"),
  inverse("partOf"),
];
