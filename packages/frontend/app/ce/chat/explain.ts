import type { AddNodeOp, KindEntry, Op } from "./types";

/** TASK-006 AC-006-12: one plain-language sentence per operation, so a
 * business user never has to read raw operation JSON. Exported for
 * TASK-013's ingest proposal cards (op-list-not-Turtle, AC-002-03) --
 * per-op rows reuse this instead of forking a second op->text mapping.
 */
export function describeOp(op: Op): string {
  switch (op.op) {
    case "add_node":
      return `Add a new ${op.kind} called "${op.label}".`;
    case "update_node":
      return `Update ${op.iri} with new property values.`;
    case "add_edge":
      return `Link ${op.subject_ref} to ${op.object_ref} via ${op.predicate}.`;
    case "delete_node":
      return `Remove ${op.iri}.`;
    case "delete_edge":
      return `Remove the ${op.predicate} link between ${op.subject} and ${op.object}.`;
    default:
      return "Unrecognised operation.";
  }
}

export function buildProposalExplanation(operations: Op[]): string {
  return operations.map(describeOp).join(" ");
}

/** TASK-006 AC-006-13: "Why?" -- what in the conversation prompted this
 * interpretation.
 */
export function buildWhyExplanation(sourceText: string | undefined, operations: Op[]): string {
  const basis = sourceText ? `You said: "${sourceText}". ` : "";
  return `${basis}I interpreted that as: ${buildProposalExplanation(operations)}`;
}

function isAddNode(op: Op): op is AddNodeOp {
  return op.op === "add_node";
}

function describeBoundedProperties(op: AddNodeOp, kinds: KindEntry[]): string {
  const kind = kinds.find((k) => k.iri === op.kind || k.label === op.kind);
  const bounded = kind?.properties.filter((p) => typeof p.max_count === "number") ?? [];
  if (bounded.length === 0) {
    return `${op.kind} has no maximum-cardinality constraints to worry about.`;
  }
  const names = bounded.map((p) => `${p.name} (max ${p.max_count})`).join(", ");
  return `${op.kind} has bounded properties: ${names}.`;
}

/** TASK-006 AC-006-14: "Consequences?" -- affected entities and whether any
 * SHACL constraints are near their limit.
 *
 * ponytail: reports the proposed kind's *shape* (its declared max_count
 * properties) rather than fetching live instance counts via CE-READ-1 --
 * a full "how close to the limit" check needs a resource round-trip per
 * affected node, which M1's chat surface doesn't yet do. Upgrade: fetch
 * `/api/ontology/resource/{iri}` for update/delete targets when this needs
 * to be exact rather than best-effort.
 */
export function buildConsequencesExplanation(operations: Op[], kinds: KindEntry[]): string {
  const addNodeOps = operations.filter(isAddNode);
  if (addNodeOps.length === 0) {
    return "This change does not add any new entities, so there are no new SHACL cardinality constraints to check.";
  }
  return addNodeOps.map((op) => describeBoundedProperties(op, kinds)).join(" ");
}
