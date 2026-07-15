---
type: Task Brief
title: "Task: TASK-020 — ServiceNow connector: ingest + write-back"
description: "Second bidirectional driver: ServiceNow Table API pull (incidents, catalog items)
  + mapping profile + write-back through the TASK-019 generic executor (sys_updated_on change
  marker). Completes the ADR-017 v1 write-back allowlist."
tags: [weave-platform, arch, task, v1, connectors, servicenow]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-019]
unlocks: []
adr_refs: [ADR-015, ADR-017]
---

# Task: TASK-020 — ServiceNow connector: ingest + write-back

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-007 E7-S3 / FR-033 ·
**Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`, `CE-WRITE-1` ·
**Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §2, §4, §7

## Story

**Epic:** EPIC-007 Managed Connectors — E7-S3 (ServiceNow family)
**Priority:** Must

**As a** workspace admin
**I want** ServiceNow records ingested into the graph and safe write-backs to ServiceNow
**So that** both confirmed bidirectional connector families (Atlassian + ServiceNow) work under
the same idempotent, drift-rejecting policy.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the ServiceNow driver pulls, THE SYSTEM SHALL fetch records incrementally via the Table API (`sysparm_query=sys_updated_on>=<cursor>`, paged via `sysparm_offset`) using credentials from `weave/{tenant_id}/servicenow/credentials`. | integration: `test_servicenow_pull_incremental_paged` |
| AC-2 | WHEN ServiceNow records are ingested, THE SYSTEM SHALL map them via the ServiceNow YAML profile to grammar kinds from `GET /api/ontology/types`, nodes carrying `weave:externalId = "<handle>:<sys_id>"` (instance handle per TASK-018 AC-5; defaults to `servicenow` at v1) and `sys_updated_on` stored as the change marker. | integration: `test_servicenow_ingest_maps_profile_stores_marker` |
| AC-3 | WHEN a ServiceNow write-back executes, THE SYSTEM SHALL route through the TASK-019 generic executor unchanged: allowlist pass, idempotency key, marker check-then-write, reject-on-drift, bounded retry 3 — no ServiceNow-specific policy fork. | integration: `test_servicenow_writeback_uses_generic_executor` |
| AC-4 | IF the stored `sys_updated_on` differs from the remote record's at write time, THEN THE SYSTEM SHALL reject the write (`rejected_drift`), emit `PLAT-NOTIFY-1` + `PLAT-AUDIT-1`, and SHALL NOT overwrite. | integration: `test_servicenow_writeback_drift_rejected` |
| AC-5 | IF a ServiceNow error payload contains a credential value, THEN stored `last_error`/audit text SHALL contain `[REDACTED]`. | unit: `test_servicenow_error_redacts_credentials` |
| AC-6 | WHEN `ping()` probes health, THE SYSTEM SHALL use the cheapest authenticated call (`GET /api/now/table/sys_user?sysparm_limit=1`) and map 401/403 to `disconnected`, timeouts/5xx to `degraded` (TASK-006 semantics; canonical `connected/degraded/disconnected` enum). | unit: `test_servicenow_ping_maps_status` |

## Pseudocode

```text
# packages/backend connectors/drivers/servicenow.py (interface from TASK-018)
class ServiceNowDriver:
    mapping_profile = "profiles/servicenow.yaml"   # incident->kind, catalog item->kind,
                                                   # assignment_group/assigned_to edges
    def ping():  GET /api/now/table/sys_user?sysparm_limit=1
    def pull(since):
        for table in profile.tables:               # e.g. incident, sc_cat_item — profile-driven
            page via sysparm_query=f"sys_updated_on>={since}", sysparm_offset+=limit
            yield records (capture sys_id, sys_updated_on)
        cursor = max(sys_updated_on seen)
    def read(external_id):  GET /api/now/table/{table}/{sys_id}    # for drift check
    def push(external_id, ops):  PATCH /api/now/table/{table}/{sys_id}

# write-back: ZERO new policy code — call writeback.write_back(row, external_id, op)
# (generic executor from TASK-019; allowlist already contains "servicenow")
```

## API Contracts

- ServiceNow Table API: `GET/PATCH /api/now/table/{table}/{sys_id}`,
  query via `sysparm_query` / `sysparm_offset` / `sysparm_limit`. Basic auth or OAuth —
  credential shape opaque to the platform, held in Secrets Manager (TASK-006 path).
- Ingest writes: `CE-WRITE-1 POST /api/operations/apply` via TASK-018 framework (cited).
- No new public platform endpoints.

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Ingestion sequence | `../../tech-spec/v1-delta.md` §2 | Flow this driver plugs into |
| Component delta | `../../tech-spec/v1-delta.md` §1 | Driver + write-back executor positions |

## Design Decisions

- [ADR-017](../../decisions/ADR-017.md) — ServiceNow is the second (and last) v1 allowlist
  entry; marker = `sys_updated_on`; policy is the shared executor, no fork (AC-3 enforces this).
- [ADR-015](../../decisions/ADR-015.md) — which ServiceNow tables sync is profile data
  (default: `incident`, `sc_cat_item`), not code.

## Test Requirements

Minimum: 3 unit, 4 integration, 0 E2E (the TASK-019 E2E covers the connector UX path; this
driver adds no new UI surface).

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_servicenow_pull_incremental_paged` |
| AC-2 | Integration | `test_servicenow_ingest_maps_profile_stores_marker` |
| AC-3 | Integration | `test_servicenow_writeback_uses_generic_executor` (spy: executor invoked, no bypass) |
| AC-4 | Integration | `test_servicenow_writeback_drift_rejected` (mutate fixture between ingest and write) |
| AC-5 | Unit | `test_servicenow_error_redacts_credentials` |
| AC-6 | Unit | `test_servicenow_ping_maps_status` |

Plus unit: `test_servicenow_profile_translates_incident`. Doubles per v1-delta §7: the shared
fixture server (TASK-019) gains a `servicenow/` fixture set (stateful Table API subset).
Coverage ≥ 80 %, mutation ≥ 60 %.

## Implementation Hints

- `sys_updated_on` is `YYYY-MM-DD HH:MM:SS` in the instance timezone — normalise to ISO-8601
  UTC before storing/comparing (same false-drift trap as TASK-019; reuse its normaliser).
- Table names live in the mapping profile so adding a table is a profile change, not code —
  keep the driver table-agnostic.
- The Table API caps `sysparm_limit` at 10 000 but use the framework batch size (100) as the
  page size — keeps memory flat and matches ingest batching.
- Reuse the TASK-019 fixture-server pattern verbatim; do not build a second mock stack.
- Guard against `sysparm_query` injection: cursor is a timestamp you format, never
  user-supplied text interpolated into the query (security rule: sanitise at boundaries).

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~35K input, ~18K output
- **Estimated cost:** ~$2

## Definition of Ready Checklist

- [x] ACs mapped to named tests; drift + redaction + ping edge cases explicit
- [x] Pseudocode covers pull/read/push; write-back explicitly reuses TASK-019 executor
- [x] Change marker (`sys_updated_on`) + normalisation rule documented
- [x] ADR-015/017 approved and linked
- [ ] TASK-019 complete (generic executor + shared fixture server)

## Definition of Done Checklist

- [ ] All ACs green; coverage ≥ 80 %, mutation ≥ 60 %
- [ ] No ServiceNow-specific write-back policy code exists (AC-3 spy test proves routing)
- [ ] No credential in logs/run records/audit entries
- [ ] Fixture set added to the shared fixture server (no second mock stack)
- [ ] Conventional commit: `feat: add servicenow connector with write-back`

## Dependencies

- **blocked_by:** TASK-019 (generic write-back executor, shared fixture server)
- **unlocks:** — (completes the bidirectional pair; v1 gate consumes it)

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
