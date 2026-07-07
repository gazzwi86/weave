import { describe, expect, it } from "vitest";

import { buildDomainMemberQuery } from "../build-domain-member-query";

const DOMAIN_IRI = "https://weave.example/domain/finance";
const PREDICATE = "https://weave.example/ontology/bpmo#memberOfDomain";

describe("buildDomainMemberQuery", () => {
  it("wraps the membership pattern in a GRAPH clause (CE-READ-1 requires GRAPH-scoped SELECT)", () => {
    const query = buildDomainMemberQuery(DOMAIN_IRI, PREDICATE);
    expect(query).toMatch(/GRAPH\s+\?g\s*\{/);
  });

  it("selects entity_iri and entity_label", () => {
    const query = buildDomainMemberQuery(DOMAIN_IRI, PREDICATE);
    expect(query).toMatch(/SELECT\s+\?entity_iri\s+\?entity_label/);
  });

  it("interpolates the given domain IRI and membership predicate", () => {
    const query = buildDomainMemberQuery(DOMAIN_IRI, PREDICATE);
    expect(query).toContain(`<${PREDICATE}>`);
    expect(query).toContain(`<${DOMAIN_IRI}>`);
  });

  it("does not hard-code any predicate IRI literal -- the predicate is entirely caller-supplied", () => {
    const query = buildDomainMemberQuery(DOMAIN_IRI, "https://weave.example/ontology/bpmo#totallyDifferentPredicate");
    expect(query).toContain("https://weave.example/ontology/bpmo#totallyDifferentPredicate");
    expect(query).not.toContain("memberOfDomain");
  });

  it("throws for an unsafe domain IRI rather than emitting an unparseable query", () => {
    expect(() => buildDomainMemberQuery("not-an-iri", PREDICATE)).toThrow();
  });
});
