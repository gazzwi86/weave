import type { ClosurePredicateEntry } from "./closure-config";
import { assertSafeIriTerm } from "./sparql-safe";

export type TraversalDirection = "dependency" | "impact";

/** ADR-018: "impact path = swap each entry's effective direction, which is
 * exactly dependencyPath with orientation flipped" -- ONE rule, both
 * `buildTraversalPath` (SPARQL string) and `walkClosure` (in-memory graph
 * walk, used by the AC-6 property test) call this so mirror consistency
 * holds by construction rather than by two hand-kept-in-sync lists. */
export function isReversedLeg(entry: ClosurePredicateEntry, direction: TraversalDirection): boolean {
  return direction === "dependency" ? entry.orientation === "inverse" : entry.orientation === "forward";
}

function leg(entry: ClosurePredicateEntry, direction: TraversalDirection): string {
  const iri = assertSafeIriTerm(entry.predicate);
  return isReversedLeg(entry, direction) ? `^<${iri}>` : `<${iri}>`;
}

/** ADR-018: the property path is the alternation of the closure entries,
 * `^` applied to whichever entries are reversed for this walk direction. */
export function buildTraversalPath(closure: ClosurePredicateEntry[], direction: TraversalDirection): string {
  return closure.map((entry) => leg(entry, direction)).join("|");
}

/** FR-010/ADR-018 implementation hint: SPARQL 1.1 property paths have no
 * `{1,N}` bounded-repetition syntax -- N chained optional (`?`) single-hop
 * segments approximate "0 to N hops" (BFS up to depth N), which is the
 * standard workaround for this exact spec gap. */
export function buildDepthCappedPath(closure: ClosurePredicateEntry[], direction: TraversalDirection, depthCap: number): string {
  const alternation = `(${buildTraversalPath(closure, direction)})?`;
  return Array(depthCap).fill(alternation).join("/");
}
