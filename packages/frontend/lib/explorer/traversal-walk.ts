import type { ClosurePredicateEntry } from "./closure-config";
import { isReversedLeg, type TraversalDirection } from "./build-traversal-path";

export interface TripleLike {
  subject: string;
  predicate: string;
  object: string;
}

/** TASK-028 AC-6: in-memory BFS over a triple set, sharing the exact same
 * `isReversedLeg` per-entry rule the SPARQL path composer uses -- so a
 * dependency walk and an impact walk over the same closure are
 * mirror-consistent by construction, not by two hand-kept-in-sync
 * implementations. `depthCap` bounds hop count (ADR-018 default 6). */
export function walkClosure(
  triples: TripleLike[],
  closure: ClosurePredicateEntry[],
  direction: TraversalDirection,
  sourceIri: string,
  depthCap: number,
): Set<string> {
  const reversedPredicates = new Set(
    closure.filter((entry) => isReversedLeg(entry, direction)).map((entry) => entry.predicate),
  );
  const forwardPredicates = new Set(
    closure.filter((entry) => !isReversedLeg(entry, direction)).map((entry) => entry.predicate),
  );

  const visited = new Set<string>();
  let frontier = new Set([sourceIri]);

  for (let depth = 0; depth < depthCap && frontier.size > 0; depth++) {
    const next = new Set<string>();
    for (const triple of triples) {
      const step = stepFrom(frontier, triple, forwardPredicates, reversedPredicates);
      if (step && !visited.has(step) && step !== sourceIri) next.add(step);
    }
    for (const iri of next) visited.add(iri);
    frontier = next;
  }

  return visited;
}

function stepFrom(
  frontier: Set<string>,
  triple: TripleLike,
  forwardPredicates: Set<string>,
  reversedPredicates: Set<string>,
): string | null {
  if (forwardPredicates.has(triple.predicate) && frontier.has(triple.subject)) return triple.object;
  if (reversedPredicates.has(triple.predicate) && frontier.has(triple.object)) return triple.subject;
  return null;
}
