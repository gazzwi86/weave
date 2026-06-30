# Epic: EPIC-009 - Immutable Audit (PLAT-AUDIT-1) & Weave-Product Self-Improvement

## Overview

**Phase:** Phase 1 (MVP) — Platform Shell & Cross-Cutting Foundations
**PRD Reference:** [prd.md](../prd.md#epic-9-immutable-audit-plat-audit-1--weave-product-self-improvement)
**Status:** Backlog
**Priority:** Must Have

## Description

The single immutable audit/provenance service (`PLAT-AUDIT-1`) every engine emits to, plus the
Weave-internal product self-improvement loop built on the shared `BE-SELFIMPROVE-1` component. Engines
emit typed events into one hash-chained, tamper-evident trail; Build's decision-log and Events' run-log
are views over it. The self-improvement loop collects Weave-product signals, drafts GitHub issues, and
dispatches approved ones to the dark factory — all gated to Weave-internal operators, never client
tenants.

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK-001 | Immutable, hash-chained audit trail — PLAT-AUDIT-1 (E9-S1) | Backlog | Must Have |
| TASK-002 | Collect Weave-product improvement signals — Weave-internal (E9-S2) | Backlog | Must Have |
| TASK-003 | Draft GitHub issues from signals — DRAFT, Weave-internal repo (E9-S3) | Backlog | Must Have |
| TASK-004 | Human approval + dark-factory dispatch — Weave-internal only (E9-S4) | Backlog | Must Have |

## Acceptance Criteria (Epic Level)

- [ ] Tamper-evidence is verifiable end to end, not per-entry only: each entry stores `prev_hash` and
      `hash` and a per-entry ed25519 signature over the canonicalised entry + prev_hash, deletes are
      rejected at the DB-constraint level with the attempt itself logged, and altering or deleting any
      historical entry fails chain verification at a named row — verified by the audit-tamper test
      (FR-036/FR-037), independent of any single emitter.
- [ ] The self-improvement loop is Weave-internal end to end and a client-tenant attempt fails closed at
      every stage: signal collection, the findings/draft surface, and approval/dispatch are visible and
      actionable only to the Weave-internal platform-operator identity, and a client-tenant
      approval/dispatch attempt is rejected with HTTP 403 and logged — verified by the self-improvement
      authz test (FR-043), proving no client RBAC scope reaches the Weave product repo or dark factory.
- [ ] Missing or insufficient telemetry never manufactures a false breach or a duplicate: a signal whose
      source is unavailable or under-sampled is marked stale/insufficient and emits no draft, and a new
      draft above the duplicate-similarity threshold appends evidence to the existing issue rather than
      creating a duplicate — one combined test covers the no-false-breach and dedup paths.
- [ ] Append-only history is preserved through the full status pipeline: a rejected draft is retained
      with reason + rejector identity and never deleted, and the lifecycle Draft → Approved/Rejected →
      Dispatched → Implemented is recorded — verified by asserting no state transition deletes a prior
      record.

## Dependencies

- **Blocked by:** EPIC-004 — every audit entry carries the canonical `actor_principal_iri` from
      `PLAT-IDENTITY-1`, and the platform-operator identity is established there; EPIC-003 — audit
      retention resolves through `PLAT-SETTINGS-1`. EPIC-005 — audit is exposed as a sub-view under the
      Compliance area. The `BE-SELFIMPROVE-1` shared component (configured separately for Weave-the-
      product, disjoint approval authority from Build's client-app self-healing). `PLAT-AUDIT-1` storage
      choice (OQ-05). Weave-bot GitHub credential in AWS Secrets Manager.
- **Blocks:** Every engine emits typed events into `PLAT-AUDIT-1`; Build's decision-log and Events'
      run-log are views over it. EPIC-002 sentiment (E2-S10) and agent-activity (E2-S11) widgets read
      `PLAT-AUDIT-1`; the self-improvement-findings widget (E2-S6) reads this loop.

## Technical Notes

- `PLAT-AUDIT-1` entry shape: `{ seq, ts, actor_principal_iri, engine, event_type, target_iri,
      diff_summary, signature }`, hash-chained (prev_hash → hash) with a per-entry ed25519 signature over
      the canonicalised entry + prev_hash — matches the prototype hash-chain audit.
- Queries are filterable by date/actor/event-type/resource/engine, paginated (default ≤ 500 rows/page,
      tunable), exportable as JSON/NDJSON with a chain-verification procedure. CE PROV-O remains semantic
      provenance and also writes a corresponding `PLAT-AUDIT-1` entry.
- Signal collection spans error/quality/performance/security/engagement dimensions; every numeric
      threshold is a configurable default and provisional — validated against baseline telemetry in the
      tech spec, owner Architect — each stating its data window + aggregation. Cadence is configurable
      (real-time errors < 5 min; hourly agent-quality; daily sentiment/adoption/CVE/RBAC).
- Drafting uses `claude-opus-4-8` into DRAFT state in Weave's own product repo via a Weave-bot service
      account (credential in Secrets Manager only). Duplicate detection embeds against open issues
      (S3 Vectors, cosine; default 0.85 similarity, provisional, OQ-09). GitHub-API-down → queued + retried.
- Self-improvement of Weave-the-product is disjoint from Build's client-app self-healing
      (`BE-SELFIMPROVE-1`, E11): same component, separate configuration, disjoint approval authorities.

---
*Generated by Weave Architect agent.*
