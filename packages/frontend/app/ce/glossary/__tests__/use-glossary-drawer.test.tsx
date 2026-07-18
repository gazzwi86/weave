import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GlossaryBrowseRow } from "@/lib/glossary/types";

import { useGlossaryDrawer } from "../use-glossary-drawer";

const TERM: GlossaryBrowseRow = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: "A billing document.",
  isOwlClass: true,
  broaderIris: ["urn:term:financial-document"],
  narrowerIris: [],
};

const LABELS = new Map([["urn:term:financial-document", "Financial Document"]]);

describe("useGlossaryDrawer", () => {
  it("opens blank for a new term", () => {
    const { result } = renderHook(() => useGlossaryDrawer());
    act(() => result.current.openNew());

    expect(result.current.open).toBe(true);
    expect(result.current.term).toBeNull();
    expect(result.current.label).toBe("");
    expect(result.current.definition).toBe("");
    expect(result.current.rels).toEqual([]);
  });

  it("opens prefilled for an existing term, seeding relationships from broader/narrower IRIs", () => {
    const { result } = renderHook(() => useGlossaryDrawer());
    act(() => result.current.openEdit(TERM, LABELS));

    expect(result.current.term).toBe(TERM);
    expect(result.current.label).toBe("Invoice");
    expect(result.current.definition).toBe("A billing document.");
    expect(result.current.rels).toEqual([{ predicate: "broader", target: "Financial Document" }]);
  });

  it("tracks label/definition edits", () => {
    const { result } = renderHook(() => useGlossaryDrawer());
    act(() => result.current.openNew());
    act(() => result.current.setLabel("Obligation"));
    act(() => result.current.setDefinition("A binding duty."));

    expect(result.current.label).toBe("Obligation");
    expect(result.current.definition).toBe("A binding duty.");
  });

  it("adds and removes relationship chips", () => {
    const { result } = renderHook(() => useGlossaryDrawer());
    act(() => result.current.openNew());
    act(() => result.current.addRel("related to", "Credit Note"));

    expect(result.current.rels).toEqual([{ predicate: "related to", target: "Credit Note" }]);

    act(() => result.current.removeRel(0));
    expect(result.current.rels).toEqual([]);
  });

  it("closes", () => {
    const { result } = renderHook(() => useGlossaryDrawer());
    act(() => result.current.openNew());
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });
});
