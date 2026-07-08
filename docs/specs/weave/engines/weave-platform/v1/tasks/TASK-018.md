---
type: Task Brief
title: "Task: TASK-018 — Connector sync scheduler + ingestion framework (E7-S3 core, PLAT-CONNECTOR-1)"
description: "Sync worker container: DB-driven due-poller (ADR-016), declarative mapping-profile
  ingestion engine emitting CE-WRITE-1 op batches under a connector-scoped principal (ADR-015),
  sync-run reporting, SHACL-fail notify+audit. Framework only — connector drivers land in
  TASK-019/020/021/022."
tags: [weave-platform, arch, task, v1, connectors]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-006]
unlocks: [TASK-019, TASK-021]
adr_refs: [ADR-015, ADR-016]
---

# Task: TASK-018 — Connector sync scheduler + ingestion framework (E7-S3 core)

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-007 E7-S3 / FR-033 ·
**Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`, `CE-WRITE-1`,
`CE-READ-1`, `PLAT-IDENTITY-1`, `PLAT-NOTIFY-1`, `PLAT-AUDIT-1` ·
**Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §1, §2, §4, §5

## Story

**Epic:** EPIC-007 Managed Connectors — E7-S3 ingestion core (framework; drivers are follow-on tasks)
**Priority:** Must

**As a** platform operator
**I want** a scheduled sync worker that turns connector data into SHACL-validated graph writes
**So that** external business data lands in the knowledge graph only through validated operations,
attributably and idempotently.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a connector row's `next_sync_at <= now()` AND `lifecycle_state = 'authorized'` AND `connector_health.status != 'disconnected'` (the poller gate — v1-delta §2), THE SYSTEM SHALL claim it with `FOR UPDATE SKIP LOCKED`, run the sync, write a `connector_sync_runs` row, and set `next_sync_at = now() + sync_frequency` — two workers SHALL never run the same row concurrently. `configured`/`error`/`revoked`/`disconnected` rows are never claimed; `degraded` rows ARE (skip-recovery requires it). | integration: `test_due_poller_claims_skip_locked_no_double_run`, `test_poller_skips_unauthorized_and_disconnected`, `test_degraded_still_syncs` |
| AC-2 | WHEN ingestion applies a batch, THE SYSTEM SHALL POST to `CE-WRITE-1 /api/operations/apply` with `actor` = the connector-scoped agent principal IRI (`PLAT-IDENTITY-1`) and a **content-stable** per-batch idempotency key `sha256(tenant_id, handle, batch_content_hash)` — `batch_content_hash` over the canonicalised source records (ids + change markers), **never `sync_run_id`** (a run-scoped key gives zero crash recovery); a user principal SHALL never appear as actor. Relies on the pinned CE-WRITE-1 semantics: replay in the 24 h window returns the original `201`; same key + different payload → `409` (treated as a batch failure + audited). | unit: `test_ingest_uses_connector_principal_never_user`, `test_batch_idempotency_key_content_stable` |
| AC-3 | WHEN a mapping-profile kind is absent from `GET /api/ontology/types`, THE SYSTEM SHALL skip those records, increment `kinds_skipped` in the sync-run report, and continue — the run SHALL NOT fail. The skipped count SHALL surface in the health read; WHEN the same kind is skipped over N consecutive runs (default 3, tunable) the connector status SHALL read `degraded`; a later resync SHALL recover the records once the kind exists. | unit: `test_unknown_kind_skipped_counted_not_failed`; integration: `test_sustained_skips_degrade_and_resync_recovers` |
| AC-4 | WHEN `CE-WRITE-1` returns `422 {violations}`, THE SYSTEM SHALL skip that batch only, record the violations to `connector_sync_runs.violations`, emit `PLAT-NOTIFY-1` (`connector-degraded`) + `PLAT-AUDIT-1`, and continue with the next batch. | integration: `test_ingest_422_skips_batch_notifies_audits` |
| AC-5 | WHEN a source record's `external_id` already exists in `connector_external_refs`, THE SYSTEM SHALL emit `update_node` against the stored `node_iri`; WHEN unseen, THE SYSTEM SHALL emit `add_node` carrying `weave:externalId = "<handle>:<source_id>"` (handle = the config's instance handle, UNIQUE per tenant, colon-free, default = connector type at v1; parse first-colon-only; NO tenant_id in the value) and record the minted IRI. Re-running a sync SHALL NOT duplicate nodes — **including pre-publish**: ingest lands in the tenant DRAFT graph (connector ingestion never publishes a version; publishing stays with a human publish-authority principal), so the CE-READ-1 fallback lookup on cache miss queries the current draft graph, and a re-sync between ingest and publish SHALL NOT re-mint draft nodes (v1-delta §2 draft-dedup rule). | integration: `test_resync_updates_not_duplicates`, `test_presync_draft_not_reminted` |
| AC-6 | IF a sync run crashes mid-way, THEN `last_sync_cursor` SHALL remain at its pre-run value (cursor advances only after the final batch resolves) and the post-crash re-pull SHALL reproduce the same content-stable keys (AC-2), so CE-WRITE-1 replays the original `201`s and nothing double-applies — verified by killing the run after batch 1 and asserting a single application with zero duplicate nodes. | integration: `test_crashed_run_repull_idempotent` |
| AC-7 | WHEN `POST /api/connectors/{type}/sync` is called by an admin, THE SYSTEM SHALL set `next_sync_at = now()` and return `202 {"queued": true}` within p95 100 ms (409 unless `lifecycle_state='authorized'`); the worker SHALL pick it up on the next tick (default 15 s). | integration: `test_sync_now_sets_next_sync_at_202` |
| AC-8 | WHEN a sync run exceeds the per-run timeout (default 10 min, tunable), THE SYSTEM SHALL abort it, mark the run `failed`, set connector status `degraded`, and emit `PLAT-NOTIFY-1` + `PLAT-AUDIT-1`. | integration: `test_sync_timeout_marks_failed_degraded` |
| AC-9 | WHEN any driver opens a connection to a tenant-supplied endpoint, THE SYSTEM SHALL route it through the shared `ssrf_guard` transport (v1-delta §2a): re-resolve + re-validate at connect, pin the validated IP (DNS-rebind aware), block loopback/link-local (incl. `169.254.169.254`)/RFC-1918/CGNAT/IPv6-ULA targets, abort + audit `security.connector_ssrf_blocked` on violation; cross-host redirects are re-validated. Fixture servers are reachable only under the `connectors.allow_private_endpoints` test flag (default off). | integration: `test_ssrf_connect_rebind_blocked` (parametrised ranges) |

## Pseudocode

```text
# packages/backend (new entrypoint: sync worker container — v1-delta §1)

# --- poller (ADR-016; gate per v1-delta §2) ---
loop every TICK (default 15s):
    rows = SELECT c.* FROM connector_configs c JOIN connector_health h ON h.connector_config_id=c.id
           WHERE c.next_sync_at <= now()
             AND c.lifecycle_state = 'authorized'          -- gate: OAuth callback / config probe
             AND h.status != 'disconnected'                -- gate: degraded still syncs (recovery)
           FOR UPDATE SKIP LOCKED LIMIT POOL_SIZE
    for row in rows:
        run = insert connector_sync_runs(started_at=now())
        try (timeout=SYNC_TIMEOUT default 10min):
            driver = DRIVERS[row.connector_type]          # registry; drivers land in 019/021/022
            report = ingest(row, driver, run)             # driver transport wraps ssrf_guard (AC-9)
            update run(outcome = ok|partial, counts from report)
            upsert health(status=connected|degraded, last_sync=now())   # canonical enum
        except Timeout | DriverError as e:
            update run(outcome=failed); health(status=degraded, last_error=redact(e), error_count+=1)
            notify(PLAT-NOTIFY-1, "connector-degraded"); audit(PLAT-AUDIT-1)
        finally:
            row.next_sync_at = now() + row.sync_frequency  # commit claim txn

# --- ingestion engine (ADR-015) ---
def ingest(row, driver, run):
    types = ce_read.get("/api/ontology/types")             # resolve profile kinds once per run
    profile = load_yaml(driver.mapping_profile)            # shipped with driver
    for page in driver.pull(since=row.last_sync_cursor):
        for batch in chunk(map_records(page, profile, types), BATCH=100):
            # batch items: known refs -> update_node(node_iri);
            # new -> add_node(weave:externalId = f"{row.handle}:{source_id}")
            #   cache miss -> CE-READ-1 lookup against the CURRENT DRAFT graph (AC-5:
            #   pre-publish re-sync must find the draft node, not re-mint it)
            key = sha256(tenant, row.handle, canonical_hash(batch.source_records))
            #     ^ content-stable: NO run.id, NO batch_seq (AC-2 — crash re-pull reuses keys)
            resp = ce_write.apply(ops=batch.ops, actor=connector_principal_iri(row),
                                  idempotency_key=key)
            if resp.status == 422:
                record violations; notify+audit; continue   # batch-scoped failure (AC-4)
            if resp.status == 409:                          # same key, different payload
                record + audit as batch failure; continue   # source moved inside window (AC-2)
            upsert connector_external_refs for new nodes (node_iri, change_marker)
    row.last_sync_cursor = driver.cursor                    # only after final batch (AC-6)
    return report(records_pulled, ops_applied, batches_rejected, kinds_skipped)
```

## API Contracts

- `POST /api/operations/apply` (`CE-WRITE-1`, contracts.md) — request
  `{operations:[Op], actor:<principal IRI>, target:"draft"}`; `201 {activity_iri, applied_count,
  version_iri}` | `422 {violations:[{focus_node, path, severity, message}]}`. Idempotency key
  supported. The ONLY graph mutation entry point.
- `GET /api/ontology/types` (`CE-READ-1`) — authoritative kind/relationship set; never hard-code.
- `POST /api/connectors/{type}/sync` (this task, platform API) — `202 {"queued": true}`;
  p95 100 ms. 404 unknown type; 409 if connector unconfigured.
- `GET /api/connectors/{type}/runs` (this task) — paged
  `{runs:[{id, started_at, finished_at, outcome, records_pulled, ops_applied, batches_rejected,
  kinds_skipped}]}`; p95 200 ms.

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Component delta | `../../tech-spec/v1-delta.md` §1 | Sync Worker container: poller → engine → drivers → CE |
| Ingestion sequence | `../../tech-spec/v1-delta.md` §2 | Normative claim→pull→map→apply→report flow incl. 422 branch |

## Design Decisions

- [ADR-015](../../decisions/ADR-015.md) (as amended 2026-07-08) — mapping profiles are YAML
  data shipped per driver; kinds resolved at runtime; external-id identity; batch-scoped SHACL
  failure; **content-stable idempotency key** (no run id) + draft-graph dedup. Impact: this
  task builds the engine + profile loader; NO domain classes in code.
- [ADR-016](../../decisions/ADR-016.md) — scheduling is the SKIP LOCKED due-poller; no
  EventBridge/APScheduler/SQS. Impact: worker is a plain loop, fully testable on Postgres.
- ADR-017 write-back is OUT of this task (lands with TASK-019).

## Test Requirements

Minimum: 4 unit, 6 integration, 0 E2E (framework has no UI; E2E rides TASK-019).

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_due_poller_claims_skip_locked_no_double_run` (two worker loops, one due row); `test_poller_skips_unauthorized_and_disconnected`; `test_degraded_still_syncs` |
| AC-2 | Unit | `test_ingest_uses_connector_principal_never_user`; `test_batch_idempotency_key_content_stable` (same records ⟹ same key across runs; contains no run id) |
| AC-3 | Unit + Integration | `test_unknown_kind_skipped_counted_not_failed`; `test_sustained_skips_degrade_and_resync_recovers` |
| AC-4 | Integration | `test_ingest_422_skips_batch_notifies_audits` (violating profile fixture vs real CE) |
| AC-5 | Integration | `test_resync_updates_not_duplicates` (run twice, assert node count stable); `test_presync_draft_not_reminted` (ingest → re-sync BEFORE any publish ⟹ node count stable) |
| AC-6 | Integration | `test_crashed_run_repull_idempotent` (kill after batch 1, re-run, assert single apply) |
| AC-7 | Integration | `test_sync_now_sets_next_sync_at_202` |
| AC-8 | Integration | `test_sync_timeout_marks_failed_degraded` |
| AC-9 | Integration | `test_ssrf_connect_rebind_blocked` (parametrised: 169.254.169.254, RFC-1918, loopback, ULA; rebind between check and connect) |

Plus unit: `test_mapping_profile_field_and_edge_rules` (profile → ops translation). Test stack per v1-delta §7: real CE + Oxigraph in compose,
a stub in-repo `FakeDriver` (no real connector needed — drivers land later), Postgres container.
Coverage ≥ 80 %, mutation ≥ 60 % on the connectors module.

## Implementation Hints

- Follow the M1 worker/RLS patterns: tenant context set per claim transaction (ADR-002/003);
  the poller must set the claimed row's tenant before any RLS-scoped access.
- `FOR UPDATE SKIP LOCKED` + "set `next_sync_at` in the same transaction as the run outcome"
  gives crash-safe re-fire for free — do not add a heartbeat/lease table.
- Driver interface (keep minimal): `ping()`, `pull(since) -> pages`, `cursor`,
  `mapping_profile` path. `push()` is added by TASK-019 — leave it out here.
- Redact anything resembling a credential in `last_error` (reuse TASK-006's
  `redact_credentials()`).
- `connector_external_refs` is a cache; the graph's `weave:externalId` property is authoritative
  (v1-delta §4). On cache miss, fall back to a CE-READ-1 lookup **against the current draft
  graph** before minting (published-only lookup re-mints pre-publish nodes — the AC-5 trap).
- `canonical_hash(batch.source_records)`: sort records by source id, hash id + change marker
  per record — stable across pagination jitter is NOT guaranteed, and that is fine: a changed
  batch is new content, and unchanged-node `update_node` ops are semantically idempotent anyway.
- Status writes use the canonical `connected|degraded|disconnected` enum (data-model.md unified
  schema) — no `healthy`/`offline` strings anywhere in worker code.
- Complexity budget (Plugin Law E): the map_records translator is the risk spot — split
  per-rule functions early.

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~55K input, ~30K output
- **Estimated cost:** ~$3.50

## Definition of Ready Checklist

- [x] User story + ACs mapped to named tests
- [x] Pseudocode covers poller, engine, crash/timeout paths
- [x] CE-WRITE-1 / CE-READ-1 shapes cited from contracts.md (not restated); pinned idempotency semantics relied on explicitly (24 h window, replay-201, 409-on-diff)
- [x] ADR-015/016 (as amended) approved and linked
- [x] DDL: unified `connector_configs`/`connector_health` in data-model.md (canonical); `connector_sync_runs`/`connector_external_refs`/`writeback_attempts` in v1-delta §4
- [ ] TASK-006 complete (config rows + secrets + health shape exist)
- [ ] CE GA in the compose stack (`CE-WRITE-1` pinned) — v1 milestone entry criterion

## Definition of Done Checklist

- [ ] All ACs green via mapped tests; coverage ≥ 80 %, mutation ≥ 60 % (connectors module)
- [ ] No SPARQL UPDATE anywhere in connector code (invariant: CE-WRITE-1 only — v1-delta §8)
- [ ] No credential value in any log, run record, or API response
- [ ] Worker container builds + runs in docker-compose alongside CE
- [ ] `PLAT-AUDIT-1` entries carry the connector principal IRI on every ingest activity
- [ ] Conventional commit: `feat: add connector sync scheduler and ingestion framework`

## Dependencies

- **blocked_by:** TASK-006 (connector config, Secrets Manager paths, health rows)
- **unlocks:** TASK-019 (Atlassian driver + write-back), TASK-021 (read-only driver quartet)

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
