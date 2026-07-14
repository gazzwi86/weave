/** TASK-024 AC-2/AC-3 (ADR-021): GE-side best-effort drift guard. CE-WRITE-1
 * carries no `expected_version`/`409` yet (planned additive v1 upgrade,
 * contracts.md CE-WRITE-1) -- so "has the draft changed since I opened this
 * edit" is approximated by a session-local counter, bumped once per
 * successful write (any op, anywhere on canvas), rather than a real
 * server-tracked version_iri.
 *
 * ponytail: module-singleton counter, not a real CE version handle --
 * upgrade to CE's `expected_version`/`409 {current_version_iri}` once that
 * contract lands (removes the need for this file entirely).
 */
let head = 0;

export function getDraftHead(): number {
  return head;
}

export function bumpDraftHead(): number {
  head += 1;
  return head;
}

/** Test seam only -- the module-level counter otherwise leaks across test
 * files sharing a vitest worker. */
export function resetDraftHeadForTests(): void {
  head = 0;
}
