# CE-TASK-002 — Provenance and Version Lifecycle

**Status:** engineer-complete, QA in progress · **Epic:** CE-EPIC-009 · **Branch:** feature/CE-EPIC-009
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
- **PROV-O actor typing (AC-002-01/-05):** human actors → `prov:Person`; agent actors →
  `prov:SoftwareAgent` + `prov:wasStartedBy` (the approving human). Activity written only after
  SHACL passes. Canonical PLAT-IDENTITY-1 principal IRIs throughout.
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

## Test Results (engineer-reported; QA re-verifying)

Unit 248 green (7 new for routers/ontology.py) · docker lane 19 green (7 new, 2 marked e2e per the
API-level convention) · mypy strict clean (170 files) · ruff clean.

## ADRs Created

- ADR-002 (Proposed): outbox, PROV-O actor typing, publish mechanics, diff shape.

## Dependencies Unlocked / notes for TASK-003+

- RBAC "publish" tier now has its first real caller — check ROLE_RANK before adding new tiers.
- Outbox has no DLQ; flag if growth becomes operational.
- Diff response shape is UNSETTLED (see conflict above) — TASK-003's contract surface must cite
  whichever shape wins, and GE-TASK-005 must not assume contracts.md's literal text meanwhile.
- pytest-cov/asyncpg docker-lane segfault: known constraint, coverage measured fast-lane only.
