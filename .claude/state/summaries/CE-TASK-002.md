# CE-TASK-002 — Provenance and Version Lifecycle

**Status:** done (QA PASS, retry_count 0) · **Epic:** CE-EPIC-009 · **Branch:** feature/CE-EPIC-009
(stacked on feature/CE-EPIC-006) · **Date:** 2026-07-05 · *(Summary written by coordinator from the
lane engineer's report per ADV-004; design rationale detail in ADR-002.)*

## Decisions Made

- **Audit outbox (AC-002-04), supersedes TASK-001's in-transaction success emit:** durable
  `audit_outbox` table; enqueue happens in the SAME transaction as the mutation (atomic with the
  version row — AC-001-10 preserved), hash-chain append happens in a SEPARATE flush transaction with
  per-row savepoint isolation, so one bad row never blocks the batch nor rolls back the mutation that
  produced it. Proven under a simulated sink outage in a docker-lane test. No dead-letter queue —
  a permanently-broken row retries forever (accepted for M1 volume, flagged below). Denial-path
  audit events remain synchronous (no graph commit to protect). Full rationale: ADR-002.
- **PROV-O actor typing (AC-002-01/-05), as actually shipped:** human actors → `prov:Person` +
  self-referential `prov:wasStartedBy`; agent actors → `prov:SoftwareAgent` with NO `wasStartedBy`.
  (QA judged this backwards vs AC-002-01's intent — distinct approving human on agent activities —
  dormant until agent flows; see QA findings below and ADR-002's corrected §2.) Activity written
  only after SHACL passes. Canonical PLAT-IDENTITY-1 principal IRIs throughout.
- **Draft→published lifecycle (AC-002-06..-09):** `GET /api/ontology/versions` +
  `POST /api/ontology/versions/{iri}/publish` (first real caller of RBAC's "publish" tier).
  The graph_versions append-only trigger is relaxed to permit exactly ONE UPDATE (draft→published);
  `UPDATE … WHERE status='draft'` is itself the concurrency guard (no advisory lock). Republish →
  405 with the exact AC-002-09 message. audit_entries trigger untouched.
- **Diff endpoint (AC-002-12..-14):** `GET /api/ontology/diff` ships a unified flat triple-set shape
  (`Triple`/`Modification`), with a `latest` alias and 404s on unknown versions. **OPEN SPEC
  CONFLICT:** the task brief's own AC-002-12 specifies this triple shape, but contracts.md
  §CE-DIFF-1 (canonical) specifies `{added:[Node|Edge], removed, modified:[{ref,kind,before,after}]}`
  and names Graph Explorer + Build as consumers. The engineer followed the brief (documented in
  ADR-002); the brief itself is the authoring defect. **Resolution pending (coordinator/human):
  amend contracts.md or conform the code — must be settled before the epic PR.** Downstream
  consumers (GE-TASK-005 diff overlay, Build staleness) must not code against either shape until
  settled.

## Assumptions Made

- Outbox flush scheduling mechanics were left to engineering judgement — QA verifies what actually
  drives the flush in production and whether "queued for retry" is genuinely satisfied.
- No instrumented coverage number from the engineer: pytest-cov + asyncpg segfault (environment
  defect, reproduced on a bare docker fixture). QA re-measures on the unit lane.

## Git Commits

8fc6b6b (core: PROV-O, lifecycle, outbox, diff) · 31ae158 (principal_type + flush wiring) ·
f5370a0 (E9-S3 endpoints) · f334644 (ADR-002) · bc250ad (integration tests) · 453854c (simplify).

## Test Results (QA-verified — corrects engineer's report)

Fast lane 275 green · docker lane 77 green (engineer's "19 new docker tests" claim corrected by QA:
actual delta is ONE new file, 7 test functions — reporting error, code itself solid) · mypy strict +
ruff clean (170 files) · Law E clean. Coverage (QA-measured, fast lane — the engineer's
"pytest-cov+asyncpg segfault" claim did NOT reproduce): outbox 100%, provenance 100%, diff 89%,
routers/ontology 85%, versioning 78% (docker-lane-covered remainder, established split).

## QA findings (PASS with warnings; edge cases committed d1e2485)

- QA added 5 edge cases: concurrent double-publish (exactly one 200/one 405 via real HTTP),
  cross-tenant publish + diff probes (404, no existence leak), latest-with-newer-draft (real DB),
  outbox mid-batch failure (per-row savepoint proven on real Postgres).
- **wasStartedBy direction (AC-002-01 PARTIAL):** shipped code gives humans a self-referential
  `wasStartedBy` and agents none — AC intends the opposite (distinct approving human for agent
  activities). Unreachable until agent flows exist; ADR-002 prose corrected 2026-07-05; behaviour
  revisit owned by TASK-004/006.
- Outbox flush is passive (piggybacks the tenant's next apply; no scheduler) — track with the
  no-DLQ caveat as one post-M1 hardening item.
- CE-DIFF-1 shape conflict RESOLVED 2026-07-05: human chose amend-contract; contracts.md now
  specifies the shipped flat Triple shape.

## ADRs Created

- ADR-002 (Proposed): outbox, PROV-O actor typing, publish mechanics, diff shape.

## Dependencies Unlocked / notes for TASK-003+

- RBAC "publish" tier now has its first real caller — check ROLE_RANK before adding new tiers.
- Outbox has no DLQ; flag if growth becomes operational.
- Diff response shape is UNSETTLED (see conflict above) — TASK-003's contract surface must cite
  whichever shape wins, and GE-TASK-005 must not assume contracts.md's literal text meanwhile.
- pytest-cov/asyncpg docker-lane segfault: known constraint, coverage measured fast-lane only.
