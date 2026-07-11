import { describe, expect, it } from "vitest";

import { groupTriples } from "../group-triples";
import type { DiffResponse } from "../types";

const REL_PREDICATE = "https://weave.example/ontology/bpmo#dependsOn";
const RELATIONSHIP_PREDICATES = new Set([REL_PREDICATE]);

describe("groupTriples", () => {
  // AC-3: flat diff triples group into node-prop vs edge changes using the
  // config relationship-predicate set (never a literal), per the brief's
  // groupTriples pseudocode.
  it("should group flat diff triples into node and edge changes using config relationship predicates", () => {
    const diff: DiffResponse = {
      added: [
        { subject: "n1", predicate: "https://weave.example/ontology/bpmo#label", object: "N1" },
        { subject: "n2", predicate: REL_PREDICATE, object: "n3" },
      ],
      removed: [{ subject: "n4", predicate: "https://weave.example/ontology/bpmo#label", object: "N4" }],
      modified: [],
    };

    const grouped = groupTriples(diff, RELATIONSHIP_PREDICATES);

    expect(grouped.addedNodeIds).toEqual(["n1"]);
    expect(grouped.addedEdgeRefs).toEqual([{ id: "n2|" + REL_PREDICATE + "|n3", source: "n2", target: "n3", predicate: REL_PREDICATE }]);
    expect(grouped.removedNodeGhosts.map((el) => el.data.id)).toEqual(["n4"]);
    expect(grouped.counts).toEqual({ added: 2, removed: 1, modified: 0 });
  });

  // AC-3: a modified triple whose predicate is a relationship predicate is
  // an edge modification (renders amber on the edge, not a node).
  it("should classify a modified relationship triple as an edge modification (amber)", () => {
    const diff: DiffResponse = {
      added: [],
      removed: [],
      modified: [{ subject: "n1", predicate: REL_PREDICATE, before: "n2", after: "n3" }],
    };

    const grouped = groupTriples(diff, RELATIONSHIP_PREDICATES);

    expect(grouped.modifiedNodeIds).toEqual([]);
    expect(grouped.modifiedEdgeRefs).toEqual([
      { id: "n1|" + REL_PREDICATE + "|n3", source: "n1", target: "n3", predicate: REL_PREDICATE },
    ]);
  });

  // A modified triple on a non-relationship predicate is a node-property
  // change -- the subject itself is the modified element (amber node).
  it("classifies a modified non-relationship triple as a node modification", () => {
    const diff: DiffResponse = {
      added: [],
      removed: [],
      modified: [{ subject: "n1", predicate: "https://weave.example/ontology/bpmo#label", before: "Old", after: "New" }],
    };

    const grouped = groupTriples(diff, RELATIONSHIP_PREDICATES);

    expect(grouped.modifiedNodeIds).toEqual(["n1"]);
    expect(grouped.modifiedEdgeRefs).toEqual([]);
  });

  // AC-4: an empty diff (identical versions) groups to nothing -- the
  // "no differences" banner reads this shape directly.
  it("returns empty groups and zero counts for an empty diff", () => {
    const grouped = groupTriples({ added: [], removed: [], modified: [] }, RELATIONSHIP_PREDICATES);

    expect(grouped.counts).toEqual({ added: 0, removed: 0, modified: 0 });
    expect(grouped.addedNodeIds).toEqual([]);
    expect(grouped.removedNodeGhosts).toEqual([]);
    expect(grouped.removedEdgeGhosts).toEqual([]);
  });

  // Removed relationship triples ghost an edge (plus minimal endpoint
  // ghost nodes so the edge has somewhere to attach on a canvas that never
  // loaded those endpoints).
  it("ghosts a removed relationship triple as an edge with endpoint ghost nodes", () => {
    const diff: DiffResponse = {
      added: [],
      removed: [{ subject: "n1", predicate: REL_PREDICATE, object: "n2" }],
      modified: [],
    };

    const grouped = groupTriples(diff, RELATIONSHIP_PREDICATES);

    expect(grouped.removedEdgeGhosts).toHaveLength(1);
    expect(grouped.removedEdgeGhosts.at(0)?.data).toMatchObject({ source: "n1", target: "n2" });
    expect(grouped.removedGhostNodes.map((el) => el.data.id).sort()).toEqual(["n1", "n2"]);
  });
});
