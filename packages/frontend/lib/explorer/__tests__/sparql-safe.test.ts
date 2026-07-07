import { describe, expect, it } from "vitest";

import { assertSafeIriTerm, isAbsoluteIri } from "../sparql-safe";

describe("isAbsoluteIri", () => {
  it("accepts an absolute https IRI", () => {
    expect(isAbsoluteIri("https://weave.example/domain/finance")).toBe(true);
  });

  it("rejects a relative path", () => {
    expect(isAbsoluteIri("/domain/finance")).toBe(false);
  });
});

describe("assertSafeIriTerm", () => {
  it("returns the IRI unchanged when it is a safe absolute IRI", () => {
    const iri = "https://weave.example/domain/finance";
    expect(assertSafeIriTerm(iri)).toBe(iri);
  });

  it("throws for a non-absolute IRI", () => {
    expect(() => assertSafeIriTerm("not-an-iri")).toThrow();
  });

  it("throws for an IRI containing a `>` that would close the SPARQL term early", () => {
    expect(() => assertSafeIriTerm("https://weave.example/x>{DROP EVERYTHING}<y")).toThrow();
  });

  it("throws for an IRI containing embedded whitespace", () => {
    expect(() => assertSafeIriTerm("https://weave.example/x y")).toThrow();
  });
});
