---
type: Decision
title: "ADR-021: M2 edit concurrency = GE-side since-version drift guard; server-side conditional
  write (expected_version → 409) is CE-WRITE-1's planned v1 enhancement"
description: "FR-021 / E5-S3 originally demanded 'LWW-with-version-check, second writer gets 409'.
  CE-WRITE-1 M2 has NO conditional write — concurrent applies BOTH commit, each as a new version.
  M2 lost-update protection is therefore a client-side since-version drift warning in GE; the
  server-side expected_version → 409 lands additively in CE at v1, and GE swaps its re-check for
  it then. This ADR is the decision record behind the FR-021/E5-S3 rewording and the TASK-024
  drift-guard design."
tags: [decision, adr, graph-explorer, concurrency, fr-021, m2]
status: Accepted
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-021-m2-concurrency-client-drift-guard.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: constitution-engine
---

# ADR-021: M2 edit concurrency = client-side drift guard, not a CE 409

## Status

**Accepted** — 2026-07-08. Supersedes the `409`-based wording FR-021 / E5-S3 carried before this
date. Aligned to [contracts.md §CE-WRITE-1](../../../contracts.md) "Concurrency (M2 → v1)"
(settled contract — cited, not restated).

## Context

FR-021 and E5-S3 were written assuming CE could reject a stale write:
"LWW-with-version-check, else `409` notify". CE-WRITE-1's pinned M2 surface returns ONLY
`201 { activity_iri, applied_count, version_iri }` or `422 { violations }`. There is no
`expected_version` request field and no `409` conflict response in M2 — two concurrent applies
BOTH commit, each producing a new CE-VERSION-1 version. A compliant CE stub cannot return a
concurrency `409`, so any GE test hunting for one can never pass against the contract.

## Decision

1. **M2 lost-update protection is GE-side.** On edit start, GE captures the draft head
   (`version_iri` it already tracks from graph load / last `201` / the event-feed poll). On save,
   GE re-checks the head; if it moved, GE blocks the commit, shows a "graph changed since you
   started" conflict notice with the current server values, and requires the user to re-confirm
   against the fresh base (TASK-024 AC-2).
2. **No drift detected ⇒ last-write-wins.** Both concurrent commits succeed as successive CE
   versions; the guard is best-effort, its window minimised by re-checking at save time
   (TASK-024 AC-3).
3. **No bespoke server-side guard in GE.** CE-WRITE-1's planned additive v1 enhancement —
   optional `expected_version` → `409 { current_version_iri }` — is the real conditional write.
   When it ships, GE swaps the save-time re-check for the request field; the conflict UX is
   already shaped for it.

## Consequences

- FR-021 / E5-S3's "`409`" language is UX language in M2, not a CE response code; spec text and
  invariants assert the drift warning, not a `409`.
- The M2 release gate (TASK-030 via `invariants-explorer.md`) verifies
  `test_drift_guard_blocks_save_and_shows_current` and `test_lww_when_no_drift_detected` — it
  must NOT demand a concurrency `409` from a CE stub.
- A true lost update remains possible inside the drift-guard window in M2 (accepted; every
  commit is versioned and diffable, so nothing is destroyed — recovery via CE-DIFF-1).

## Alternatives Considered

- **Bespoke GE-side pessimistic lock (edit-lease table in Aurora):** rejected — invents a guard
  CE-WRITE-1 explicitly tells downstream editors not to invent; new infra for a v1-solved problem.
- **Demand `expected_version` in CE-WRITE-1 at M2:** rejected — contract change; contracts.md is
  settled and records it as planned v1, non-breaking.
- **No guard at all (pure LWW):** rejected — silent lost updates on the same property are a
  trust-killer for the editing surface; the drift warning is cheap.
