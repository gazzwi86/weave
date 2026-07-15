---
type: Task Brief
title: "Task: TASK-021 — Read-only data connectors: Snowflake, Databricks, AWS, Azure Data Lake"
description: "Four read-only drivers on the TASK-018 framework: incremental pull + mapping
  profile each; metadata-level ingest (schemas/tables/jobs/buckets/paths as graph assets), not
  row-level data. sync_direction write/bidirectional rejected per ADR-017 allowlist."
tags: [weave-platform, arch, task, v1, connectors]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-018, TASK-019]
unlocks: []
adr_refs: [ADR-015, ADR-017]
---

# Task: TASK-021 — Read-only data connectors: Snowflake, Databricks, AWS, Azure Data Lake

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-007 E7-S1/S3 / FR-031/FR-033 ·
**Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`, `CE-WRITE-1` ·
**Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §2, §7

## Story

**Epic:** EPIC-007 Managed Connectors — E7-S3 (read-only families)
**Priority:** Must

**As a** workspace admin
**I want** my data platforms (Snowflake, Databricks, AWS, Azure Data Lake) visible in the graph
**So that** the company's data estate — warehouses, jobs, buckets, lakes — is modelled as graph
assets connected to the processes and systems that use them.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN each of the four drivers pulls, THE SYSTEM SHALL ingest **metadata-level assets** via its profile: Snowflake databases/schemas/tables (`information_schema`), Databricks jobs/clusters/schemas (REST 2.1), AWS S3 buckets (+ account identity via STS), Azure Data Lake filesystems/paths — each node carrying `weave:externalId` and mapped to grammar kinds from `GET /api/ontology/types`. | integration: 4 × `test_<type>_ingest_maps_profile` |
| AC-2 | WHEN a config for any of these four sets `sync_direction` `write` or `bidirectional`, THE SYSTEM SHALL reject it at save with 422 naming the allowlist (ADR-017 — these are read-only in v1). | integration: `test_readonly_quartet_rejects_write_direction` |
| AC-3 | WHEN `ping()` probes, THE SYSTEM SHALL use the cheapest authenticated call (Snowflake `SELECT 1`; Databricks `GET /api/2.1/clusters/list?limit=1`; AWS `sts:GetCallerIdentity`; Azure DL filesystem list, limit 1) and map auth failures to `disconnected`, timeout/5xx to `degraded` (TASK-006 semantics; canonical `connected/degraded/disconnected` enum). | unit: 4 × `test_<type>_ping_maps_status` |
| AC-4 | WHEN a pull page fails mid-run for one driver, THE SYSTEM SHALL follow TASK-018 framework semantics: run marked `partial`/`failed`, cursor not advanced past the last complete batch, notify + audit — other connectors' runs SHALL be unaffected. | integration: `test_one_driver_failure_isolated` |
| AC-5 | IF any of the four emits an error containing a credential, THEN stored `last_error`/audit text SHALL contain `[REDACTED]`. | unit: `test_quartet_errors_redact_credentials` (parametrised) |

## Pseudocode

```text
# packages/backend connectors/drivers/{snowflake,databricks,aws,azure_data_lake}.py
# All four implement ONLY the TASK-018 read interface: ping / pull / cursor / mapping_profile.
# No push() — write direction is rejected upstream at config (AC-2, ADR-017).

class SnowflakeDriver:
    mapping_profile = "profiles/snowflake.yaml"    # database->kind, schema->kind, table->kind,
                                                   # contains-edges; NO row-level data
    def ping():  execute("SELECT 1")               # snowflake-connector-python
    def pull(since):
        query information_schema.{databases,schemata,tables}
        where last_altered >= since                # change marker: last_altered (UTC-normalise)

class DatabricksDriver:
    mapping_profile = "profiles/databricks.yaml"   # job->kind, cluster->kind, schema->kind
    def pull(since):  REST 2.1 /jobs/list, /clusters/list, unity-catalog schemas (paged)

class AwsDriver:
    mapping_profile = "profiles/aws.yaml"          # account->kind, bucket->kind
    def ping():  sts.get_caller_identity()
    def pull(since):  s3.list_buckets (+ creation_date as marker); boto3, endpoint_url-aware
                      # endpoint_url from config so LocalStack works (Law F)

class AzureDataLakeDriver:
    mapping_profile = "profiles/azure_data_lake.yaml"  # account->kind, filesystem->kind, path->kind
    def pull(since):  DataLakeServiceClient list_file_systems / get_paths(recursive=False,
                      max depth from profile, default 2)   # bound the path explosion
```

## API Contracts

- No new public platform endpoints — these drivers ride TASK-018's framework and TASK-006's
  config/health endpoints. `sync_direction` validation extends
  `PUT /api/connectors/{type}/config` (TASK-006) with the ADR-017 allowlist check (422 body:
  `{"error": "unsupported_writeback", "allowlist": ["atlassian", "servicenow"]}`).
- Ingest writes: `CE-WRITE-1 POST /api/operations/apply` via framework (cited, not redefined).

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Ingestion sequence | `../../tech-spec/v1-delta.md` §2 | Shared flow; these drivers are `pull`-only participants |
| Component delta | `../../tech-spec/v1-delta.md` §1 | Driver registry position |

## Design Decisions

- [ADR-017](../../decisions/ADR-017.md) — these four are read-only in v1; the config-time
  rejection (AC-2) is the enforcement point, so no driver needs a write path at all.
- [ADR-015](../../decisions/ADR-015.md) — metadata-level scope: connectors model the data
  *estate* (assets + containment), not row-level content. Row-level ingest is a post-v1
  profile/product decision, deliberately out of scope.

## Test Requirements

Minimum: 8 unit (ping ×4, profile translate ×4 — parametrise where shapes allow),
6 integration, 0 E2E (no new UI; TASK-019's E2E covers the connector UX path).

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_snowflake_ingest_maps_profile` / `test_databricks_…` / `test_aws_…` / `test_azure_data_lake_…` |
| AC-2 | Integration | `test_readonly_quartet_rejects_write_direction` (parametrised over 4 types) |
| AC-3 | Unit | `test_<type>_ping_maps_status` ×4 |
| AC-4 | Integration | `test_one_driver_failure_isolated` |
| AC-5 | Unit | `test_quartet_errors_redact_credentials` (parametrised) |

Doubles per v1-delta §7: **AWS → LocalStack** (S3 + STS, real boto3 with `endpoint_url`);
**Azure DL → Azurite**; **Snowflake + Databricks → shared fixture server** (TASK-019 pattern;
Snowflake driver unit-tested with a mocked connector cursor, integration via fixture-served
REST where feasible). Coverage ≥ 80 %, mutation ≥ 60 %.

## Implementation Hints

- Ship the four drivers as four small stacked commits inside the epic PR (Plugin Law D) —
  they share zero code beyond the TASK-018 interface, so review them independently.
- boto3 and the Azure SDK must take endpoints from connector config, never hardcoded — that
  is what makes LocalStack/Azurite substitution free (Law F).
- Snowflake: use `snowflake-connector-python` with `login_timeout=8` to keep `ping()` inside
  the TASK-006 10 s health budget; `last_altered` is TZ-aware — reuse the TASK-019 UTC
  normaliser.
- Azure `get_paths` on a big lake is the runaway-cost trap: profile-bounded depth (default 2)
  and the framework batch size cap it — do not recurse fully.
- Databricks REST pagination uses `page_token`, not offset — store it inside the driver cursor
  string (cursor is driver-opaque by design, TASK-018).
- Keep each driver ≤ 150 lines; if one grows past that the profile is doing too little
  (Law E early-warning).

## Cost Estimate

- **Complexity:** L (four small drivers, wide but shallow)
- **Estimated tokens:** ~60K input, ~32K output
- **Estimated cost:** ~$3.80

## Definition of Ready Checklist

- [x] ACs mapped to named tests; per-driver ping/marker/pagination pinned
- [x] Metadata-level scope (assets, not rows) explicit with rationale
- [x] Emulator/fixture double named per driver (Law F)
- [x] ADR-015/017 approved and linked
- [ ] TASK-018 complete (framework + driver interface)
- [ ] TASK-019 complete (**hard dependency** — shared fixture server; Snowflake/Databricks fixtures extend it)

## Definition of Done Checklist

- [ ] All ACs green; coverage ≥ 80 %, mutation ≥ 60 %
- [ ] No `push()` method exists on any of the four drivers (read-only by construction)
- [ ] AWS/Azure tests run against LocalStack/Azurite only — no live endpoint in any test
- [ ] No credential in logs/run records/audit entries
- [ ] Four stacked commits, e.g. `feat: add snowflake connector (read-only)` …
- [ ] Conventional final commit: `feat: add read-only data-platform connectors`

## Dependencies

- **blocked_by:** TASK-018 (framework, driver interface); TASK-019 (**HARD** — the shared
  recorded-fixture server that the Snowflake/Databricks integration tests run on ships with
  TASK-019; without it those tests cannot exist, so this is a real DAG edge, not a
  coordination note)
- **unlocks:** — (v1 gate consumes it)

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
