import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GlossaryBrowseRow } from "@/lib/glossary/types";

import { buildGlossaryRows } from "../glossary-rows";

function row(overrides: Partial<GlossaryBrowseRow>): GlossaryBrowseRow {
  return {
    iri: "urn:term:apple",
    prefLabel: "Apple",
    definition: "A fruit.",
    isOwlClass: false,
    broaderIris: [],
    narrowerIris: [],
    ...overrides,
  };
}

function renderCell(rows: ReturnType<typeof buildGlossaryRows>, id: string, key: string) {
  const target = rows.find((r) => r.id === id);
  return render(<>{target?.cells[key]}</>);
}

describe("buildGlossaryRows", () => {
  it("shows the also-class badge only for owl:Class-punned terms", () => {
    const rows = buildGlossaryRows(
      [row({ iri: "a", prefLabel: "Apple", isOwlClass: true }), row({ iri: "b", prefLabel: "Berry", isOwlClass: false })],
      "all",
      ""
    );
    renderCell(rows, "a", "term");
    expect(screen.getByText("also class")).toBeInTheDocument();
    expect(screen.queryByText("Berry")).not.toBeInTheDocument();
  });

  it("truncates a definition over 140 chars with an ellipsis", () => {
    const long = "x".repeat(150);
    const rows = buildGlossaryRows([row({ iri: "a", definition: long })], "all", "");
    const cell = rows[0]!.cells.definition as string;
    expect(cell).toHaveLength(141);
    expect(cell.endsWith("…")).toBe(true);
  });

  it("renders an em dash placeholder for a missing definition", () => {
    const rows = buildGlossaryRows([row({ iri: "a", definition: null })], "all", "");
    expect(rows[0]!.cells.definition).toBe("—");
  });

  it("resolves a related-term chip to the loaded term's label, falling back to the IRI segment", () => {
    const rows = buildGlossaryRows(
      [
        row({ iri: "urn:term:apple", prefLabel: "Apple", broaderIris: ["urn:term:fruit"] }),
        row({ iri: "urn:term:fruit", prefLabel: "Fruit", broaderIris: [] }),
      ],
      "all",
      ""
    );
    renderCell(rows, "urn:term:apple", "related");
    expect(screen.getByText("Fruit")).toBeInTheDocument();
  });

  it("falls back to the IRI's last segment when the related term isn't in the loaded page", () => {
    const rows = buildGlossaryRows([row({ iri: "urn:term:apple", narrowerIris: ["urn:term:granny-smith"] })], "all", "");
    renderCell(rows, "urn:term:apple", "related");
    expect(screen.getByText("granny-smith")).toBeInTheDocument();
  });

  it("filters by alphabetic range on the preferred label", () => {
    const rows = buildGlossaryRows(
      [row({ iri: "a", prefLabel: "Apple" }), row({ iri: "l", prefLabel: "Ledger" })],
      "g-m",
      ""
    );
    expect(rows.map((r) => r.id)).toEqual(["l"]);
  });

  it("filters case-insensitively across prefLabel and definition", () => {
    const rows = buildGlossaryRows(
      [row({ iri: "a", prefLabel: "Apple", definition: "A fruit." }), row({ iri: "b", prefLabel: "Backorder", definition: "Stock." })],
      "all",
      "FRUIT"
    );
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });
});
