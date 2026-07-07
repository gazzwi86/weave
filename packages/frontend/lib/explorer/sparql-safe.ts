/** AC-1/AC-6: shared guard for any IRI interpolated into a SPARQL term
 * (`<...>`). Domain/source IRIs and the configured predicate all pass
 * through here before reaching a query-builder template string, so a
 * malformed value can never break out of the `<...>` term (Law 13 --
 * validated at the boundary, never cast). */

const UNSAFE_IRI_TERM_CHARS = /[<>"{}\\\s]/;

export function isAbsoluteIri(iri: string): boolean {
  try {
    new URL(iri);
    return true;
  } catch {
    return false;
  }
}

/** Returns `iri` unchanged if it is safe to interpolate inside `<...>`;
 * throws otherwise. Callers (query builders) never need their own
 * sanitisation logic. */
export function assertSafeIriTerm(iri: string): string {
  if (!isAbsoluteIri(iri) || UNSAFE_IRI_TERM_CHARS.test(iri)) {
    throw new Error("unsafe or non-absolute IRI for SPARQL term");
  }
  return iri;
}
