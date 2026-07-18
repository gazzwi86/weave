import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrandRulesTable } from "../brand-rules-table";
import type { VoiceRuleRow } from "../types";

const ROWS: VoiceRuleRow[] = [
  { iri: "urn:weave:instances:vr-1", ruleId: "no-jargon", severity: "critical", assertion: "forbidden-term:synergy" },
];

describe("BrandRulesTable", () => {
  it("renders a row per brand rule with severity + an Edit action", () => {
    const onEdit = vi.fn();
    render(<BrandRulesTable rows={ROWS} onEdit={onEdit} />);
    expect(screen.getByText("no-jargon")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
  });

  it("shows an empty state with zero brand rules", () => {
    render(<BrandRulesTable rows={[]} onEdit={vi.fn()} />);
    expect(screen.getByText(/no brand rules yet/i)).toBeInTheDocument();
  });

  // AC-004-03: per-row PROV-O attribution -- honest "unknown actor" when
  // this browser session didn't create the item (attribution.ts).
  it("shows the row's attribution when known", () => {
    const attributionFor = vi.fn(() => ({
      actorIri: "brand-owner@example.com",
      versionIri: "urn:v1",
      committedAt: "2026-01-01T00:00:00.000Z",
    }));
    render(<BrandRulesTable rows={ROWS} onEdit={vi.fn()} attributionFor={attributionFor} />);
    expect(screen.getByText(/brand-owner@example.com/)).toBeInTheDocument();
  });
});
