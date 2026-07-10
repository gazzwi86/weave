/** TASK-028 AC-1: one closure entry, normalised "dependent -> dependency"
 * per ADR-018. `orientation` says whether CE's stored predicate direction
 * already matches that reading (`forward`) or is the reverse of it
 * (`inverse`) -- the walk composer (build-traversal-path.ts) uses this to
 * decide when to emit `^predicate` in the SPARQL property path. */
export interface ClosurePredicateEntry {
  predicate: string;
  orientation: "forward" | "inverse";
}

// ponytail: stub value only -- real ADR-018 table lands in the next commit
// (type-complete stub keeps tsc green while the test is red on assertion).
export const OQ09_PREDICATE_CLOSURE: ClosurePredicateEntry[] = [];
