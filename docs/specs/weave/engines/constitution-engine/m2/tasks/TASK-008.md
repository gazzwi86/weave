---
type: Task
title: "Task: TASK-008 — CE-EVENT-1 Change-Feed (Beta Transport)"
description: "Transactional graph-change event feed: append-only Aurora table written in the
  commit transaction, GET /api/events polling endpoint, 410-on-aged-cursor (FR-015, ADR-008)."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-009
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: [ADR-008]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-015, E9-S1)
Contracts: [contracts.md](../../../../contracts.md) (CE-EVENT-1) · ADR:
[ADR-008](../../decisions/ADR-008.md) · M2 delta: [m2-delta.md](../../tech-spec/m2-delta.md) §5

## Story

As a consuming engine (Events triggers, Platform activity widgets), I need one typed event per
graph change — never zero, never two — deliverable without new infrastructure, so I can react to
graph changes without re-diffing versions.

## Scope

FR-015 at beta per ADR-008: the `graph_change_events` table, the write hook in the CE-WRITE-1
commit path, and `GET /api/events`. Push fan-out (SNS/WebSocket) is post-v1 — OUT. Provides
**CE-EVENT-1 (beta)**.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-008-01 | WHEN a CE-WRITE-1 mutation commits THE SYSTEM SHALL append exactly one event row **in the same database transaction** — commit and event are atomic (one-commit-one-event, FR-015 AC). |
| AC-008-02 | WHEN a mutation is REJECTED by SHACL THE SYSTEM SHALL write a `constraint-violated` event in its own transaction (the mutation rolled back) — the one exception to same-txn (ADR-008). |
| AC-008-03 | WHEN an event is written THE SYSTEM SHALL populate the contract shape: `change_type ∈ added\|updated\|deleted\|constraint-violated`, `entity_iri`, `version_iri` (real CE-VERSION-1 IRI on publish events; **null on draft commits** — never a draft graph IRI), `last_published_version` (or null if never published), `actor` (principal IRI), `ts`, per-tenant monotonic `seq`. |
| AC-008-04 | WHEN `GET /api/events?since_seq={n}&limit={m}` is called THE SYSTEM SHALL return this tenant's events with `seq > n` in order, plus `latest_seq`; p95 ≤ 200 ms at 100k store (m2-delta §9). |
| AC-008-05 | WHEN `since_seq` predates the retention window (30 d default, tunable via PLAT-SETTINGS-1) THE SYSTEM SHALL return `410 Gone` — never a silently empty page — and the consumer re-baselines via CE-READ-1. |
| AC-008-06 | WHEN any caller attempts UPDATE/DELETE on `graph_change_events` THE SYSTEM SHALL be prevented at the DB level (no grants) — append-only like PLAT-AUDIT-1's constraint style. |
| AC-008-07 | WHEN tenant A polls the feed THE SYSTEM SHALL never return tenant B's events (RLS, same pattern as `ontology_versions`). |

## Pseudocode

```text
# In the CE-WRITE-1 commit function (ONE place — all mutations route through it):
with db.transaction():
    ...existing version-row / commit work...
    insert graph_change_events(tenant_id, seq=next_seq(tenant), change_type,
        entity_iri, version_iri=publish? version : NULL,
        last_published_version=latest_published(tenant), actor, ts=now())

# SHACL rejection path (after rollback):
insert graph_change_events(..., change_type='constraint-violated', version_iri=NULL, ...)

GET /api/events?since_seq&limit:
    rows = SELECT ... WHERE tenant=ctx AND seq > since_seq ORDER BY seq LIMIT m
    if since_seq < min_retained_seq(tenant): return 410
    return {events: rows, latest_seq}
```

## API Contracts

- **CE-EVENT-1** (canonical in [contracts.md](../../../../contracts.md)):
  `GET /api/events?since_seq={n}&limit={m}`. Errors: 401, 410 (aged cursor), 422 (bad params),
  500. p95 ≤ 200 ms.
- Event emission is internal to the CE-WRITE-1 pipeline — no write API.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Change-feed design + schema | [m2-delta.md](../../tech-spec/m2-delta.md) §5 | Full column table, retention, audit-log boundary |
| M2 component delta | [m2-delta.md](../../tech-spec/m2-delta.md) §10 | Change-Feed Writer/Reader wired to CE-WRITE-1 + Aurora + Events |
| Transport decision | [ADR-008](../../decisions/ADR-008.md) | Why change-feed; post-v1 outbox upgrade path |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Same-transaction insert, no relay | One commit = one event is a transactional guarantee, testable with a plain integration test | ADR-008 |
| Poll endpoint, no push at beta | Zero M2 consumers need push; every contracted consumer has a poll-degrade path anyway | ADR-008 alternatives |
| `version_iri` null on draft events + `last_published_version` | Version IRIs and graph IRIs are different namespaces; a dereferenced `version_iri` must never yield a draft graph IRI | HITL amendment 2026-07-08, contracts.md |
| Not the audit log | PLAT-AUDIT-1 is the system of record; this feed has finite retention and a delivery purpose | m2-delta §5 |

## Test Requirements

Minimum: 3 unit, 5 integration.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should map op types to change_type (add/update/delete) | AC-008-03 |
| Unit | should build draft event with null version_iri + last_published_version | AC-008-03 |
| Unit | should compute 410 when since_seq < min retained | AC-008-05 |
| Integration | should write exactly one event in the commit txn (commit + count) | AC-008-01 |
| Integration | should write zero data changes but one constraint-violated event on SHACL reject | AC-008-02 |
| Integration | should never emit an event for a failed commit's data (rollback leaves no orphan event of type added) | AC-008-01/02 |
| Integration | should return ordered events after since_seq with latest_seq; tenant-B rows invisible (two-tenant fixture) | AC-008-04, AC-008-07 |
| Integration | should reject UPDATE/DELETE on the table (grant test in migration test) | AC-008-06 |
| Perf | locust: GET /api/events p95 ≤ 200 ms | AC-008-04 |

## Dependencies

- **blocked_by**: none within M2 (hooks the existing CE-WRITE-1 commit path) — parallel
- **unlocks**: none in CE (unblocks Events M2 triggers + Platform widgets externally)

## Cost Estimate

**M** — est. **350k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). One migration, one insert in
an existing txn, one read endpoint; the care is in the rejection-path and RLS tests.

## DoR Checklist

- [x] Transport decided (ADR-008, human-approved)
- [x] Event shape incl. draft-event nulls canonical (contracts.md, HITL 2026-07-08)
- [x] Schema + retention pinned (m2-delta §5); p95 pinned (§9)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf)
- [ ] Same-txn atomicity verified (forced-failure test: txn abort ⟹ no event)
- [ ] Two-tenant RLS test green
- [ ] `min_retained_seq` / retention tunable via PLAT-SETTINGS-1 key (no hardcoded 30)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- The commit function is the single mutation entry point (FR-003) — the insert goes there once;
  do NOT add per-router emission.
- `seq`: use **one global bigserial** — ordering filtered per tenant satisfies "per-tenant
  monotonic" and is race-free. Do NOT use `INSERT ... SELECT COALESCE(MAX(seq),0)+1`: two
  concurrent commit transactions read the same MAX and collide (or deadlock under the PK) unless
  the tenant row is exclusively locked, which serialises all writes for the tenant.
  <!-- ponytail: global bigserial (gaps allowed); per-tenant gap-free numbering only if a
       consumer ever needs it -->
- Retention enforcement: a scheduled delete is Phase-4-adjacent; at M2 compute
  `min_retained_seq` from `ts > now()-retention` in the 410 check — rows age out logically
  before physically.
- Pitfall: the constraint-violated event has no committed entity — `entity_iri` is the
  attempted target from the op batch, and `version_iri` is always null for it.
