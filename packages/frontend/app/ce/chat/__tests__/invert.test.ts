import { describe, expect, it } from "vitest";

import type { Op } from "../types";
import { invertOperations } from "../invert";

// TASK-006 AC-006-04: undo is an inverse operation batch, not a snapshot
// revert -- `add_node` inverts to `delete_node` of the real minted IRI.
describe("invertOperations", () => {
  it("inverts an add_node into a delete_node of its minted IRI", () => {
    const ops: Op[] = [{ op: "add_node", ref: "p1", kind: "Process", label: "Onboarding" }];
    const refMap = { p1: "urn:weave:process:p1" };

    expect(invertOperations(ops, refMap)).toEqual([
      { op: "delete_node", iri: "urn:weave:process:p1" },
    ]);
  });

  it("inverts multiple add_node ops in reverse order", () => {
    const ops: Op[] = [
      { op: "add_node", ref: "p1", kind: "Process", label: "A" },
      { op: "add_node", ref: "p2", kind: "Process", label: "B" },
    ];
    const refMap = { p1: "urn:weave:process:p1", p2: "urn:weave:process:p2" };

    expect(invertOperations(ops, refMap)).toEqual([
      { op: "delete_node", iri: "urn:weave:process:p2" },
      { op: "delete_node", iri: "urn:weave:process:p1" },
    ]);
  });

  it("inverts an add_edge into a delete_edge", () => {
    const ops: Op[] = [
      { op: "add_edge", subject_ref: "p1", predicate: "urn:weave:bpmo:owns", object_ref: "p2" },
    ];
    const refMap = { p1: "urn:weave:process:p1", p2: "urn:weave:process:p2" };

    expect(invertOperations(ops, refMap)).toEqual([
      {
        op: "delete_edge",
        subject: "urn:weave:process:p1",
        predicate: "urn:weave:bpmo:owns",
        object: "urn:weave:process:p2",
      },
    ]);
  });

  // ponytail: update_node/delete_node inversion needs a pre-edit snapshot
  // that TASK-006 does not yet capture -- documented gap, not silently
  // wrong: these ops are simply dropped from the inverse batch.
  it("drops operations it cannot invert without a pre-edit snapshot", () => {
    const ops: Op[] = [{ op: "update_node", iri: "urn:weave:process:p1", properties: {} }];

    expect(invertOperations(ops, {})).toEqual([]);
  });
});
