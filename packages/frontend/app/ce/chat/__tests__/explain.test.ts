import { describe, expect, it } from "vitest";

import type { AddNodeOp, KindEntry, Op } from "../types";
import {
  buildConsequencesExplanation,
  buildProposalExplanation,
  buildWhyExplanation,
} from "../explain";

const ADD_PROCESS: AddNodeOp = {
  op: "add_node",
  ref: "p1",
  kind: "Process",
  label: "Customer Onboarding",
};

// TASK-006 AC-006-12: every proposal is accompanied by a plain-language
// explanation of what it will add/change/remove.
describe("buildProposalExplanation", () => {
  it("describes an add_node operation in plain language", () => {
    expect(buildProposalExplanation([ADD_PROCESS])).toContain(
      'Add a new Process called "Customer Onboarding"'
    );
  });

  it("describes a delete_node operation in plain language", () => {
    const ops: Op[] = [{ op: "delete_node", iri: "urn:weave:process:p1" }];
    expect(buildProposalExplanation(ops)).toContain("Remove urn:weave:process:p1");
  });
});

// TASK-006 AC-006-13: "Why?" explains what in the conversation prompted the
// proposed kind/relationship.
describe("buildWhyExplanation", () => {
  it("quotes the original prompt alongside the interpretation", () => {
    const result = buildWhyExplanation("Add a Process called Customer Onboarding", [ADD_PROCESS]);
    expect(result).toContain('You said: "Add a Process called Customer Onboarding"');
    expect(result).toContain("Process");
  });

  it("omits the quote when no source text is known", () => {
    expect(buildWhyExplanation(undefined, [ADD_PROCESS])).not.toContain("You said");
  });
});

// TASK-006 AC-006-14: explains affected entities and whether any SHACL
// constraints are near their limit.
describe("buildConsequencesExplanation", () => {
  const kinds: KindEntry[] = [
    {
      iri: "urn:weave:bpmo:Process",
      label: "Process",
      properties: [
        {
          path: "urn:weave:bpmo:owner",
          name: "owner",
          is_relationship: true,
          min_count: 1,
          max_count: 1,
          severity: "Violation",
        },
        {
          path: "urn:weave:bpmo:label",
          name: "label",
          is_relationship: false,
          min_count: 1,
          max_count: null,
          severity: "Violation",
        },
      ],
    },
  ];

  it("reports bounded properties for the proposed kind", () => {
    const result = buildConsequencesExplanation([ADD_PROCESS], kinds);
    expect(result).toContain("owner (max 1)");
  });

  it("reports no constraints when nothing is being added", () => {
    const ops: Op[] = [{ op: "delete_node", iri: "urn:weave:process:p1" }];
    expect(buildConsequencesExplanation(ops, kinds)).toContain("does not add any new entities");
  });
});
