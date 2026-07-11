---
type: ADR
title: "ADR-022: Ingest accept reuses the extractor's prov:Activity — one activity, two prov moments"
description: "CE-V1-TASK-012 accept-proposal flow reuses the ingest worker's activity_iri when
  committing through CE-WRITE-1, rather than minting a second prov:Activity — write_activity gains
  an ActivityExtra param that suppresses re-adding RDF.type/startedAtTime for a given activity_iri."
tags: [constitution-engine, adr, ingest, provenance, prov-o]
status: Accepted
timestamp: 2026-07-10T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-022-ingest-activity-reuse-two-prov-moments.md
date: 2026-07-10
entity: constitution-engine
---

# ADR-022: Ingest accept reuses the extractor's prov:Activity — one activity, two prov moments

## Status

Accepted *(made during CE-V1-TASK-012 GREEN implementation; documented retroactively per Law 10
during the docker-integration-tests / refactor pass)*.

## Context

CE-V1-TASK-012's ingest pipeline has two phases that both touch provenance for the same piece of
work: (1) the ingest worker starts extraction — `operations.ingest_provenance.start_ingest_activity`
mints a `prov:Activity`, records `prov:wasAssociatedWith` the extractor agent, `prov:used` the
source artefact, and `prov:startedAtTime`; (2) a human later reviews and accepts a proposal — the
accept route dispatches through CE-WRITE-1's `_run_apply` (ADR-006 reuse), which normally mints a
*fresh* `prov:Activity` per commit via `operations.provenance.write_activity`.

If accept minted a second activity, the same unit of work (extract → review → commit) would be
split across two disconnected `prov:Activity` records, breaking lineage: an auditor asking "what
produced this graph state" would see a commit activity with no link back to the artefact that was
actually extracted, and the extractor agent's involvement would be invisible on the committed
version.

## Decision

- The accept route (`routers/ingest.py::_accept_via_ce_write_1`) passes the job's existing
  `activity_iri` (minted at ingest-start, never a fresh one) into CE-WRITE-1 via a new
  `ProvExtra` dataclass (`operations/pipeline.py`), carrying `activity_iri`, `artefact_iri`, and
  `extractor_iri`.
- `operations/provenance.py::write_activity` gains an `ActivityExtra` param. When
  `extra.activity_iri` is given, `write_activity` **reuses** that IRI as the activity subject
  instead of minting `INSTANCES[f"activity-{uuid4().hex}"]`, and — critically — does **not**
  re-add `RDF.type` or `PROV.startedAtTime` for it (both already exist from
  `start_ingest_activity`). It does add the commit-time facts on the same activity:
  `PROV.generated` (the new version), `PROV.used` (extra used IRIs, e.g. the artefact),
  `PROV.wasAssociatedWith` (both the human actor and, if given, the extractor agent), and
  `PROV.endedAtTime`.
- Net effect: one `prov:Activity` individual, two moments recorded on it —
  `prov:startedAtTime` (worker) and `prov:endedAtTime` (accept) — never two competing
  `startedAtTime` literals for the same activity.
- Job/proposal DB rows never re-derive the activity IRI independently; `job.activity_iri` is the
  single source read at accept time (see `routers/ingest.py::_accept_via_ce_write_1`'s guard:
  `if job.activity_iri is None or job.extractor_iri is None: return 409`).

## Consequences

- Lineage is queryable in one hop: `prov:Activity` → `prov:used` the artefact →
  `prov:wasAssociatedWith` the extractor *and* the human reviewer → `prov:generated` the
  committed version. No join across two activities needed.
- `write_activity`'s signature grew one optional param (`extra: ActivityExtra | None = None`);
  every non-ingest CE-WRITE-1 caller is unaffected (extra defaults to `None`, behaviour
  unchanged — fresh activity per commit, as before).
- Test coverage for this exact invariant lives in
  `tests/integration/test_ingest_pipeline.py::test_accepted_proposal_carries_prov_used_and_reuses_activity`,
  which asserts exactly one `prov:startedAtTime` triple exists for the activity after accept
  (not two). Note: Oxigraph's Turtle GET groups triples by subject (semicolon-separated
  predicate lists), so the assertion counts the `startedAtTime` predicate globally rather than
  as a `<subject> <predicate>` adjacent substring — valid here because each test's named graph
  holds exactly one activity.

## Alternatives Considered

- **Mint a second `prov:Activity` for the commit, link via `prov:wasInformedBy`.** Rejected:
  technically valid PROV-O, but adds a second individual and a cross-activity join for every
  lineage query, for no benefit over reusing the one activity that already represents "the work
  of turning this artefact into a graph commit."
- **Have CE-WRITE-1 always take an optional `activity_iri` override for every caller, not just
  ingest.** Rejected (scope): no other caller currently has a pre-existing activity to reuse;
  adding the general capability now is speculative. `ActivityExtra` is ingest-specific and can
  generalise later if a second caller needs it.
- **Suppress `startedAtTime` re-add via a sentinel/flag param instead of the activity_iri
  presence check.** Rejected: an extra boolean is redundant — reuse and "don't restart the
  clock" are the same fact from the same signal (`extra.activity_iri is not None`).
