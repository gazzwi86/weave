import { describe, expect, it } from "vitest";

import { paginate, standardsQuery, toStandardRow, toVoiceRuleRow, voiceRulesQuery } from "../queries";

describe("brand list SPARQL query builders", () => {
  it("standardsQuery requests one row past the page size, offset by page", () => {
    expect(standardsQuery(0)).toContain("LIMIT 51 OFFSET 0");
    expect(standardsQuery(2)).toContain("LIMIT 51 OFFSET 100");
  });

  it("voiceRulesQuery requests one row past the page size, offset by page", () => {
    expect(voiceRulesQuery(1)).toContain("LIMIT 51 OFFSET 50");
  });

  it("clamps a negative page to offset 0", () => {
    expect(standardsQuery(-3)).toContain("OFFSET 0");
  });
});

describe("paginate", () => {
  it("reports no more pages when exactly page-size rows come back", () => {
    const rows = Array.from({ length: 50 }, (_, i) => i);
    expect(paginate(rows)).toEqual({ pageRows: rows, hasMore: false });
  });

  it("drops the 51st probe row and reports hasMore when it's present", () => {
    const rows = Array.from({ length: 51 }, (_, i) => i);
    const { pageRows, hasMore } = paginate(rows);
    expect(pageRows).toHaveLength(50);
    expect(hasMore).toBe(true);
  });
});

describe("row mappers", () => {
  // Flat string rows -- real shape of POST /api/proxy/sparql's `{ rows }`
  // (already reshaped server-side from Oxigraph's raw bindings, see
  // route.ts's sparqlResultsToRows), not a raw `{ value }` term wrapper.
  it("maps a standard row, defaulting unbound OPTIONALs to null", () => {
    const row = toStandardRow({
      s: "urn:weave:instances:bs-1",
      contentType: "acme.tone",
      effectiveDate: "2026-01-01",
      owner: "Brand Team",
    });
    expect(row).toEqual({
      iri: "urn:weave:instances:bs-1",
      contentType: "acme.tone",
      contentBody: null,
      sourceUri: null,
      effectiveDate: "2026-01-01",
      owner: "Brand Team",
    });
  });

  it("maps a voice-rule row, falling back to 'normal' for an unrecognised severity", () => {
    const row = toVoiceRuleRow({
      s: "urn:weave:instances:vr-1",
      ruleId: "no-jargon",
      severity: "critical",
      assertion: "forbidden-term:synergy",
    });
    expect(row.severity).toBe("critical");

    const fallback = toVoiceRuleRow({ severity: "bogus" });
    expect(fallback.severity).toBe("normal");
  });
});
