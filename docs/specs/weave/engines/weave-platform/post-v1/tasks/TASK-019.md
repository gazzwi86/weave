---
type: Task Brief
title: "Task: TASK-019 — Atlassian connector: ingest + bidirectional write-back reference implementation"
description: "First real driver on the TASK-018 framework: Atlassian (Jira + Confluence, one OAuth
  family) pull + mapping profile, plus the generic write-back executor (idempotency key, bounded
  retry 3, check-then-write reject-on-drift per ADR-017). The v1 demonstrable outcome."
tags: [weave-platform, arch, task, v1, connectors, atlassian]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-018, TASK-025]
unlocks: [TASK-020, TASK-021]
adr_refs: [ADR-015, ADR-017]
---

# Task: TASK-019 — Atlassian connector: ingest + bidirectional write-back reference implementation

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-007 E7-S3 / FR-033 ·
**Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`, `CE-WRITE-1`,
`PLAT-NOTIFY-1`, `PLAT-AUDIT-1` · **Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §2, §4, §7

## Story

**Epic:** EPIC-007 Managed Connectors — E7-S3 (Atlassian family; write-back executor)
**Priority:** Must

**As a** domain admin
**I want** Jira/Confluence data flowing into the graph and safe agent write-backs to Jira
**So that** the v1 demonstrable outcome holds: Atlassian data in the graph under a connector
principal, committed only on SHACL pass, with write-back idempotency and failure audit.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the Atlassian driver pulls, THE SYSTEM SHALL fetch Jira issues + Confluence pages incrementally (Jira JQL `updated >= cursor`; Confluence CQL `lastmodified >= cursor`) using ONE OAuth credential set from `weave/{tenant_id}/atlassian/credentials` — one connector family, not two. | integration: `test_atlassian_pull_incremental_one_credential` |
| AC-2 | WHEN Atlassian records are ingested, THE SYSTEM SHALL map them via the Atlassian YAML profile to BPMO-grammar kinds resolved from `GET /api/ontology/types`, each node carrying `weave:externalId = "<handle>:<id>"` (instance handle per TASK-018 AC-5; defaults to `atlassian` at v1) and the source change marker (`updated`) stored in `connector_external_refs.change_marker`. | integration: `test_atlassian_ingest_maps_profile_stores_marker` |
| AC-3 | WHEN a write-back is requested for a connector NOT in the allowlist (`atlassian`, `servicenow`), THE SYSTEM SHALL reject it with 422 naming the allowlist (ADR-017). | unit: `test_writeback_direction_rejected_for_nonallowlisted_connector` |
| AC-4 | WHEN a write-back executes, THE SYSTEM SHALL re-read the target record and compare its change marker to the stored one; IF they differ THEN THE SYSTEM SHALL reject the write (outcome `rejected_drift`), emit `PLAT-NOTIFY-1` + `PLAT-AUDIT-1` with both markers, and SHALL NOT overwrite. | integration: `test_writeback_drift_rejected_notified_audited` |
| AC-5 | WHEN the write-back target returns 4xx/5xx, THE SYSTEM SHALL retry with bounded backoff (default 3 attempts, tunable via settings cascade), then emit `connector-degraded` `PLAT-NOTIFY-1` + `PLAT-AUDIT-1` failure record. | integration: `test_writeback_retry_bounded_3` |
| AC-6 | WHEN a write-back is retried (crash or 5xx), THE SYSTEM SHALL NOT double-apply: the idempotency key `sha256(tenant_id, handle, external_id, operation_hash, base_change_marker)` suppresses a second application (`writeback_attempts.idempotency_key` UNIQUE), and **only an `applied` prior outcome suppresses** — a `rejected_drift`/`failed` row never blocks re-execution. The key is **marker-scoped** so the legitimate reject-on-drift → re-sync (new marker) → re-issue path mints a NEW key and proceeds (ADR-017 §3 as amended — a marker-free key would deadlock that path). | integration: `test_writeback_idempotency_suppresses_duplicate`, `test_writeback_reissue_after_drift_not_suppressed` |
| AC-7 | IF an Atlassian API error message contains a credential value, THEN stored `last_error` and audit entries SHALL contain `[REDACTED]` in its place. | unit: `test_atlassian_error_redacts_credentials` |

## Pseudocode

```text
# packages/backend connectors/drivers/atlassian.py (interface from TASK-018)
class AtlassianDriver:
    mapping_profile = "profiles/atlassian.yaml"   # jira issue->kind, confluence page->kind,
                                                  # project/space edges; NO hard-coded classes
    def ping():   GET /rest/api/3/myself (Jira) — cheapest probe (TASK-006 pattern)
    def pull(since):
        yield jira_search(jql=f"updated >= {since}", paged)      # capture issue.fields.updated
        yield confluence_search(cql=f"lastmodified >= {since}")  # capture version.when
        cursor = max(seen markers)
    def push(external_id, ops):                    # write-back primitive (Jira only, v1)
        PUT /rest/api/3/issue/{id} with mapped fields

# connectors/writeback.py (generic executor — ADR-017; reused by TASK-020)
def write_back(row, external_id, operation):
    row.connector_type not in WRITEBACK_ALLOWLIST:            # ["atlassian","servicenow"]
        raise 422 unsupported_writeback(allowlist)
    stored = connector_external_refs.get(tenant, type, external_id)
    key = sha256(tenant, row.handle, external_id, hash(operation), stored.change_marker)
    #     ^ marker-scoped (AC-6): after drift-reject + re-sync the marker changed -> new key
    existing = writeback_attempts.insert_or_get(key)
    existing and existing.outcome == 'applied': return existing          # only applied suppresses
    remote = driver.read(external_id)
    remote.change_marker != stored.change_marker:
        mark rejected_drift; notify + audit(both markers); return        # AC-4, never overwrite
    for attempt in 1..MAX_RETRIES(default 3):                            # AC-5
        try: driver.push(external_id, operation); mark applied; return
        except HTTP 4xx/5xx: backoff(attempt)
    mark failed; notify("connector-degraded") + audit
```

## API Contracts

- Write-back is invoked internally (agent/automation path), not a new public endpoint at v1;
  its outcomes surface via `GET /api/connectors/{type}/runs` (TASK-018) and `PLAT-AUDIT-1`.
- Atlassian surface: Jira REST v3 (`/rest/api/3/search`, `/rest/api/3/issue/{id}`), Confluence
  REST (`/wiki/rest/api/content/search`). OAuth 2.0 token in Secrets Manager (TASK-006 path).
- Ingest writes: `CE-WRITE-1 POST /api/operations/apply` per TASK-018 framework (cited, not
  redefined).

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Ingestion sequence | `../../tech-spec/v1-delta.md` §2 | Pull→map→apply flow this driver plugs into |
| Component delta | `../../tech-spec/v1-delta.md` §1 | Write-back Executor position in Sync Worker |

## Design Decisions

- [ADR-017](../../decisions/ADR-017.md) — allowlist + check-then-write reject-on-drift; retry
  bounds; the race window is accepted and documented. Impact: this task builds the generic
  executor exactly to that policy.
- [ADR-015](../../decisions/ADR-015.md) — mapping is profile YAML; change markers stored at
  ingest feed the AC-4 conflict check.
- TASK-006 decided Atlassian = one OAuth family (single secret path, single health probe) —
  this driver honours it (AC-1).

## Test Requirements

Minimum: 3 unit, 5 integration, 1 E2E.

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_atlassian_pull_incremental_one_credential` |
| AC-2 | Integration | `test_atlassian_ingest_maps_profile_stores_marker` |
| AC-3 | Unit | `test_writeback_direction_rejected_for_nonallowlisted_connector` |
| AC-4 | Integration | `test_writeback_drift_rejected_notified_audited` (mutate fixture between ingest and write) |
| AC-5 | Integration | `test_writeback_retry_bounded_3` (fixture returns 503 ×4; assert 3 retries + notify) |
| AC-6 | Integration | `test_writeback_idempotency_suppresses_duplicate`; `test_writeback_reissue_after_drift_not_suppressed` (drift-reject → fixture re-synced → same operation re-issued ⟹ executes) |
| AC-7 | Unit | `test_atlassian_error_redacts_credentials` |

Plus unit: `test_atlassian_profile_translates_issue_and_page`. E2E (Playwright, per Law B):
`connector-ingest-demo.spec.ts` — configure Atlassian against the fixture server (UI), trigger
sync-now, assert the graph gained the fixture issue (via CE read API) AND the connector row
shows `healthy` with `last_sync` set — asserts backend state changed, per Law B. Doubles per
v1-delta §7: recorded-fixture mock HTTP server for Atlassian (stateful — write-back tests
mutate fixture state); real CE + Oxigraph in compose.

## Implementation Hints

- Fixture server: one small FastAPI app in `tests/fixtures/connector_server/` serving recorded
  Jira/Confluence JSON with mutable state; reused by TASK-020/021/022 — build it generic
  (routes + fixture dir per connector type) now, it is the shared Law-F backbone.
- Jira `updated` and Confluence `version.when` are the change markers (ADR-017) — normalise
  both to ISO-8601 UTC strings before storing/comparing; timezone drift is the classic false-drift bug.
- Backoff: `min(2^attempt, 30)` seconds with jitter; make MAX_RETRIES read the settings cascade
  (`PLAT-SETTINGS-1`) with default 3 — "tunable" in FR-033 means cascade-tunable, not env var.
- Do not map Jira/Confluence rich bodies into the graph at v1 — profile maps identity,
  status, relations (issue→project, page→space, assignee→person kind if present in tenant
  ontology). Bodies are CE document-corpus scope (boundary note, v1-delta §1).
- Complexity (Law E): keep `write_back()` under 50 lines by extracting `check_drift()` and
  `bounded_push()`.

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~50K input, ~28K output
- **Estimated cost:** ~$3.20

## Definition of Ready Checklist

- [x] ACs mapped to named tests; drift/retry/idempotency edge cases explicit (incl. the
  re-issue-after-drift path — marker-scoped key)
- [x] Pseudocode covers driver + generic write-back executor
- [x] ADR-015/017 (as amended) approved and linked; allowlist named
- [ ] TASK-025 complete (OAuth authcode — Atlassian reaches `authorized`)
- [x] Change-marker fields identified per source (Jira `updated`, Confluence `version.when`)
- [ ] TASK-018 complete (framework + driver interface + `connector_external_refs`)

## Definition of Done Checklist

- [ ] All ACs green; coverage ≥ 80 %, mutation ≥ 60 % (driver + writeback modules)
- [ ] E2E proves graph state changed via CE read (Law B)
- [ ] No credential in any log/run/audit entry (redaction sweep incl. AC-7)
- [ ] `WRITEBACK_ALLOWLIST` is data, grep-able (invariant, v1-delta §8)
- [ ] Fixture server checked in and documented for reuse by TASK-020/021/022
- [ ] Conventional commit: `feat: add atlassian connector with bidirectional write-back`

## Dependencies

- **blocked_by:** TASK-018 (framework, driver interface, external-refs table); TASK-025
  (Atlassian is an OAuth family — the driver needs the auth-code flow's `authorized` state +
  refresh-token machinery before it can pull)
- **unlocks:** TASK-020 (ServiceNow reuses the write-back executor + fixture server);
  TASK-021 (**hard** — its Snowflake/Databricks integration tests run on this task's shared
  fixture server)

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
