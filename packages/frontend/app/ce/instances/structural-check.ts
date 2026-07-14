import type { PropertyShape } from "../chat/types";

/** AC-6 (structural half): cardinality check run purely against
 * already-fetched SHACL shape metadata (`PropertyShape` -- CE-READ-1's
 * kind catalogue, `min_count`/`max_count`/`is_relationship` only; there is
 * no `sh:datatype`/`sh:pattern` in the shipped catalogue response to check
 * against) -- no network call. Referential/cross-entity violations are
 * CE-WRITE-1's job at submit time (see AC-6's other half, `guided-form.tsx`'s
 * existing 422 -> field mapping, reused unchanged for the authoring
 * drawer). A relationship field's value being a well-formed IRI is
 * guaranteed by construction -- it's only ever set via `EntityPicker`
 * (AC-5), never free text -- so there is nothing further to check here.
 */
export function checkFieldStructural(shape: PropertyShape, value: string): string | null {
  if (shape.min_count !== null && shape.min_count >= 1 && value.trim() === "") {
    return `${shape.name} is required (min count ${shape.min_count}).`;
  }
  return null;
}
