---
type: Task
title: "Task: TASK-001 — Onboarding State Store & /api/onboarding/* Router Foundation"
description: "The foundation row: Aurora tables (onboarding_state, tour_progress, dismissal,
  exercise_completion, activation, outbox) with fail-closed RLS, and the state CRUD router inside
  the existing FastAPI backend. No analytics tables (EPIC-008 deferred)."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-001
milestone: m1
created: 2026-07-06
blocked_by: []
unlocks: ["TASK-004", "TASK-006", "TASK-007", "TASK-008", "TASK-010", "TASK-011", "TASK-012"]
adr_refs: [ADR-003]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) · Contracts:
[contracts.md](../../../../contracts.md) · Data model:
[data-model.md](../../tech-spec/data-model.md)

## Story

As a new user, I need my onboarding progress (path, tour resume points, dismissals, checklist,
exercise completion, activation) persisted server-side per `(tenant, user)`, so that onboarding
survives sign-out and device switches and every later surface reads one source of truth.

## Scope Note

Backend only. Creates the six tables from data-model.md §Relational Schema with fail-closed RLS
(ADR-003), Alembic migrations in the existing `packages/backend` migration stream, and the
`/api/onboarding/state` router (read + partial-update of the caller's OWN rows only). Identity
resolves via the app's existing auth middleware backed by PLAT-IDENTITY-1. NO analytics tables,
NO SQS, NO new service (EPIC-008 deferred; ADR-003 scope note). Activation *recording* logic is
TASK-011 — this task ships the tables and constraint only. Sandbox provisioning is TASK-004.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-001-01 | WHEN migrations run THE SYSTEM SHALL create `onboarding_state`, `tour_progress`, `dismissal`, `exercise_completion`, `activation`, `outbox` exactly per data-model.md, with RLS policies applied in the same migration. |
| AC-001-02 | WHEN any onboarding table is queried without RLS session context THE SYSTEM SHALL return zero rows (fail-closed), and a tenant-A principal SHALL never receive a tenant-B row. |
| AC-001-03 | WHEN a caller reads or writes state THE SYSTEM SHALL scope to their own `(tenant_id, user_id)` — a request naming another user's id is rejected 403; user scoping is application-layer on every route. |
| AC-001-04 | WHEN `GET /api/onboarding/state` is called THE SYSTEM SHALL return the caller's spine row plus tour progress, dismissals, exercise completions, and activations in one response (the SPA's single bootstrap read). |
| AC-001-05 | WHEN a resume point, dismissal, or checklist timestamp is upserted THE SYSTEM SHALL persist it server-side; localStorage is never the system of record (PRD §2.4). |
| AC-001-06 | WHEN a duplicate `activation` insert occurs THE SYSTEM SHALL be prevented by the primary key `(tenant_id, user_id, milestone_id)` — verified at the constraint level in this task. |
| AC-001-07 | WHEN an unauthenticated request hits any `/api/onboarding/*` route THE SYSTEM SHALL reject 401 before any DB read. |

## API Contracts

Engine-internal REST (OpenAPI 3.1): `GET /api/onboarding/state`,
`PATCH /api/onboarding/state` (spine fields), `PUT /api/onboarding/tours/{tour_id}/progress`,
`PUT /api/onboarding/dismissals/{kind}/{ref_id}`, `DELETE /api/onboarding/dismissals/beacon`
("Show all hints"). Consumes PLAT-IDENTITY-1 (identity via existing middleware). No inter-engine
calls otherwise.

## Diagram

architecture.md §Level 3 — the `state` repository component; ERD in data-model.md
§ER diagram (this task builds that diagram's tables verbatim).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One Aurora store, RLS fail-closed, no new service | Same isolation pattern as CE/Events; single migration stream and fixture | ADR-003 |
| Single bootstrap read endpoint | Overlays render on every screen; one read beats N | data-model.md |
| Activation PK is the idempotency mechanism | Constraint-level exactly-once; TASK-011 builds on it | ADR-003 |
| No analytics tables | EPIC-008 descoped from M1 slice (human decision 2026-07-06) | architecture.md D9 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Integration | Migrations create schema + policies; `test_rls_fail_closed` over every table | AC-001-01/02 |
| Integration | Two-tenant + two-user scoping (403 on foreign user id) | AC-001-02/03 |
| Integration | Bootstrap read aggregates all state kinds | AC-001-04 |
| Unit | Upsert semantics per state kind; 401 before DB | AC-001-05/07 |
| Integration | Duplicate activation insert violates PK | AC-001-06 |

## Dependencies

- **blocked_by**: none (foundation row)
- **unlocks**: TASK-004, TASK-006, TASK-007, TASK-008, TASK-010, TASK-011, TASK-012 (direct
  state consumers; TASK-005/TASK-009 inherit via TASK-004)

## Cost Estimate

**M** — tables + CRUD are mechanical; the care points are RLS migrations, the user-scoping
guard on every route, and the bootstrap-read shape.

## DoR Checklist

- [ ] ADR-003 approved (storage + idempotency)
- [ ] data-model.md table shapes reviewed
- [ ] RLS pattern confirmed identical to the existing backend's fail-closed `current_setting`
- [ ] Auth middleware + Alembic baseline confirmed present in `packages/backend`

## DoD Checklist

- [ ] All ACs pass (unit + integration)
- [ ] RLS exercised by the two-tenant test; zero rows without session context
- [ ] OpenAPI schema generated and committed for the router surface
- [ ] No PII beyond ids/timestamps stored; nothing sensitive logged
- [ ] Coverage ≥ 80%, mutation ≥ 60% on the repository/scoping modules

## Implementation Hints

Reuse the backend's existing RLS session-context dependency — do not re-implement it. Composite
PKs double as the only indexes you need (data-model.md §Index strategy); add the two partial
indexes in the same migration. Keep the bootstrap read to one query per table, assembled in the
router — no ORM relationship magic across RLS boundaries.
