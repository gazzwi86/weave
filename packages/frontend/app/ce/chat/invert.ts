import type { Op } from "./types";

function invertSingle(op: Op, refMap: Record<string, string>): Op | null {
  if (op.op === "add_node") {
    const iri = refMap[op.ref];
    return iri ? { op: "delete_node", iri } : null;
  }
  if (op.op === "add_edge") {
    const subject = refMap[op.subject_ref] ?? op.subject_ref;
    const object = refMap[op.object_ref] ?? op.object_ref;
    return { op: "delete_edge", subject, predicate: op.predicate, object };
  }
  // ponytail: update_node/delete_node inversion needs a pre-edit snapshot
  // this task does not capture -- documented gap (see decisions ADR),
  // not silently wrong: unsupported ops are dropped from the inverse batch.
  return null;
}

/** TASK-006 AC-006-04: undo is an inverse operation batch, not a snapshot
 * revert. Inverts in reverse order so a batch that e.g. added a node then
 * an edge to it undoes the edge first.
 */
export function invertOperations(operations: Op[], refMap: Record<string, string>): Op[] {
  return operations
    .map((op) => invertSingle(op, refMap))
    .filter((op): op is Op => op !== null)
    .reverse();
}
