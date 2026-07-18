import { describe, expect, it } from "vitest";

import { toAskAnswerView } from "../ask-view";

const RESULT = {
  sparql: "SELECT ?s WHERE { ?s a bpmo:Process }",
  rows: [{ s: "https://weave.example/entity/onboarding" }],
  groundedIris: ["https://weave.example/entity/onboarding"],
};

describe("toAskAnswerView", () => {
  it("resolves each grounded iri to a labelled, kinded entity chip via the supplied node-data lookup", () => {
    const getNodeData = (iri: string) =>
      iri === RESULT.groundedIris[0] ? { label: "Customer Onboarding", bpmoKind: "Process" } : undefined;

    const view = toAskAnswerView(RESULT, "which process onboards a customer?", getNodeData);

    expect(view.entities).toEqual([
      { iri: "https://weave.example/entity/onboarding", label: "Customer Onboarding", kind: "process" },
    ]);
    expect(view.sparql).toBe(RESULT.sparql);
  });

  it("falls back to the humanised iri segment and a null kind when the node isn't resolvable on the canvas", () => {
    const view = toAskAnswerView(RESULT, "which process onboards a customer?", () => undefined);
    expect(view.entities).toEqual([{ iri: RESULT.groundedIris[0], label: "onboarding", kind: null }]);
  });

  it("builds a grounded sentence naming the matched entities when there are rows", () => {
    const getNodeData = () => ({ label: "Customer Onboarding", bpmoKind: "Process" });
    const view = toAskAnswerView(RESULT, "which process onboards a customer?", getNodeData);
    expect(view.sentence).toContain("1 result");
    expect(view.sentence).toContain("Customer Onboarding");
  });

  it("builds a 'no results' sentence, never a grounded claim, when rows is empty", () => {
    const empty = { sparql: RESULT.sparql, rows: [], groundedIris: [] };
    const view = toAskAnswerView(empty, "does weave have a purple process?", () => undefined);
    expect(view.sentence).toMatch(/no results/i);
    expect(view.entities).toEqual([]);
  });
});
