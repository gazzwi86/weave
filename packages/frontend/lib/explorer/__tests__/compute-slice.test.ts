import { describe, expect, it } from "vitest";

import { computeSlice } from "../compute-slice";
import type { CytoscapeElement } from "../types";

const node = (id: string): CytoscapeElement => ({ data: { id, label: id } });
const edge = (source: string, target: string): CytoscapeElement => ({
  data: { id: `${source}|rel|${target}`, source, target, label: "rel" },
});

describe("computeSlice (ge-canvas-1.md rule 8)", () => {
  it("returns matched:false when filterByIri names no node", () => {
    const result = computeSlice([node("a"), node("b"), edge("a", "b")], "missing", 2);
    expect(result).toEqual({ elements: [], matched: false });
  });

  it("includes nodes reachable within hopDepth and their in-slice edges", () => {
    const elements = [node("a"), node("b"), node("c"), node("d"), edge("a", "b"), edge("b", "c"), edge("c", "d")];
    const result = computeSlice(elements, "a", 2);
    const nodeIds = result.elements.filter((el) => el.data.source === undefined && !el.data.stub).map((el) => el.data.id);
    expect(result.matched).toBe(true);
    expect(nodeIds.sort()).toEqual(["a", "b", "c"]);
    expect(nodeIds).not.toContain("d");
  });

  it("renders a boundary edge as a stub marker without pulling in the out-of-slice node", () => {
    const elements = [node("a"), node("b"), node("outside"), edge("a", "b"), edge("b", "outside")];
    const result = computeSlice(elements, "a", 1);

    const realNodeIds = result.elements.filter((el) => el.data.source === undefined && !el.data.stub).map((el) => el.data.id);
    expect(realNodeIds).not.toContain("outside");

    const stubEdges = result.elements.filter((el) => el.data.boundary_stub === true);
    expect(stubEdges).toHaveLength(1);
    expect(stubEdges[0]?.data.source).toBe("b");

    const stubNodes = result.elements.filter((el) => el.data.stub === true);
    expect(stubNodes).toHaveLength(1);
  });

  it("is deterministic for the same input", () => {
    const elements = [node("a"), node("b"), edge("a", "b")];
    expect(computeSlice(elements, "a", 2)).toEqual(computeSlice(elements, "a", 2));
  });
});
