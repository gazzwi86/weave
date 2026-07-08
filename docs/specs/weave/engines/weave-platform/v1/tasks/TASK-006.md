---
type: Task Brief
title: "Task: TASK-006 — Managed connector config and health monitoring (PLAT-CONNECTOR-1, v1.0)"
description: "Implement the 7-connector credential store, per-connector configuration UI, and health-status API (config + health only — ingestion E7-S3 lands with it at v1.0). Managed connectors are deferred from MVP to v1.0."
tags: [weave-platform, arch, task]
timestamp: 2026-06-30T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-06-30
blocked_by: [TASK-004]
unlocks: [TASK-018, TASK-022, TASK-023, TASK-025]  # v1 set: ingestion framework, Slack channel, E2-S8 widget rows, OAuth authcode flow
adr_refs: [ADR-016, ADR-017]
---

# Task: TASK-006 — Managed connector config and health monitoring (PLAT-CONNECTOR-1, v1.0)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-007 Connector Config & Health (E7-S1 + E7-S2 — the whole connector epic, incl. E7-S3 ingestion, is deferred from MVP to v1.0)
**Priority:** Must Have

**As a** workspace admin
**I want** to configure credentials for any of the seven managed connectors and see their live health status
**So that** the platform knows which data sources are available before the build and events engines attempt to use them.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN an admin submits connector credentials via `PUT /api/connectors/{type}/config`, THE SYSTEM SHALL store the credentials exclusively in AWS Secrets Manager (secret name: `weave/{tenant_id}/{connector_type}/credentials`; the returned **ARN** is stored in `connector_configs.secret_arn` — the single canonical column, no `secret_path` variant), return 200 with `{"stored": true}` but NEVER return the credential values in any API response. | unit: `test_connector_credentials_stored_in_secrets_manager` |
| AC-2 | WHEN credentials are submitted for an unsupported connector type, THE SYSTEM SHALL return 400 with `{"error":"unsupported_connector","supported":["snowflake","databricks","aws","azure_data_lake","atlassian","servicenow","slack"]}`. | unit: `test_unsupported_connector_returns_400` |
| AC-3 | WHEN `GET /api/connectors/{type}/health` is called, THE SYSTEM SHALL **read the stored `connector_health` row** (`{"status":"connected"\|"degraded"\|"disconnected","last_sync":…,"last_error":…,"error_count":n}`) and SHALL NOT probe any external system inline (v1-delta §5 stored-row read model — the inline-probe variant is superseded). Probes run (a) at config save (fail-closed, AC-4) and (b) worker-side on the sync cadence (TASK-018). | integration: `test_health_read_returns_stored_row_no_inline_probe` |
| AC-4 | WHEN the config-time probe fails (invalid credential), THE SYSTEM SHALL fail closed: `connector_health.status='disconnected'`, `lifecycle_state='error'`, `last_error` populated via `redact_credentials()` (never the raw credential or connection string), `error_count` incremented. WHEN the probe succeeds on a credential-based (non-OAuth) type, THE SYSTEM SHALL set `lifecycle_state='configured'→'authorized'` and initialise `next_sync_at` (OAuth types reach `authorized` only via TASK-025's callback). | unit: `test_connector_probe_fail_closed_and_authorize_transition` |
| AC-5 | WHEN `GET /api/connectors` is called, THE SYSTEM SHALL return a list of all seven connector types, each with configuration status (`configured` or `unconfigured`), health status (`connected/degraded/disconnected` from the stored row), `last_sync`, and `error_count`, scoped to the caller's tenant. | integration: `test_connector_list_scoped_to_tenant` |
| AC-6 | WHEN the Atlassian connector is configured, THE SYSTEM SHALL treat Jira and Confluence as a single OAuth family (one credential set, one health probe) — not as two separate connectors. | unit: `test_atlassian_single_oauth_family` |
| AC-7 | WHEN connector credentials are rotated (PUT called again), THE SYSTEM SHALL update the Secrets Manager value without deleting and re-creating the secret (to preserve IAM resource policies), and emit a PLAT-AUDIT-1 event. | integration: `test_connector_credential_rotation` |
| AC-8 | WHEN a connector is configured, THE SYSTEM SHALL capture and persist `sync_direction` (`read\|write\|bidirectional`), `sync_frequency` (interval), and the instance `handle` (default = `connector_type`; UNIQUE per tenant; **rejected with 400 if it contains a colon** — it prefixes `weave:externalId`, parsed first-colon-only) on the **unified `connector_configs` row (data-model.md canonical schema)**; `next_sync_at` is set at authorization (E7-S1/FR-031 — these fields feed the ADR-016 poller and ADR-017 allowlist and were previously uncaptured). | integration: `test_config_captures_sync_fields_and_handle` |
| AC-9 | WHEN `sync_direction` is `write` or `bidirectional` for a connector NOT in the ADR-017 allowlist (`atlassian`, `servicenow`), THE SYSTEM SHALL reject the save with 422 `{"error":"unsupported_writeback","allowlist":["atlassian","servicenow"]}`. | unit: `test_write_direction_rejected_off_allowlist` |
| AC-10 | WHEN a tenant-supplied host/account/instance URL is present in the config payload, THE SYSTEM SHALL validate it through the shared `ssrf_guard` (v1-delta §2a): HTTPS only, hostname within the connector type's allowed-domain suffix list, resolved IPs outside loopback/link-local (incl. `169.254.169.254`)/RFC-1918/CGNAT/IPv6-ULA ranges; violations → 422 `{"error":"endpoint_not_allowed"}` and the connector marked `disconnected`. Before the denylist check, the resolved address MUST be canonicalised — IPv4-mapped IPv6 literals (e.g. `::ffff:169.254.169.254`) unwrap to IPv4 form, and non-canonical encodings (decimal, octal, hex) are rejected outright rather than parsed. Private endpoints are reachable ONLY under the `connectors.allow_private_endpoints` settings flag (test/dev; default off). | unit: `test_ssrf_guard_rejects_private_and_metadata_endpoints` (parametrised); `test_ssrf_rejects_non_canonical_ip_encodings` (`::ffff:169.254.169.254`, decimal-encoded metadata IP) |

## Implementation

### Pseudocode

```text
# Connector config handler (packages/backend/connectors/config.py)
SUPPORTED_TYPES = ["snowflake", "databricks", "aws", "azure_data_lake",
                   "atlassian", "servicenow", "slack"]

def store_connector_config(tenant_id, connector_type, payload, actor_iri):
  # payload: { credentials, sync_direction, sync_frequency, handle? }
  if connector_type not in SUPPORTED_TYPES:
    raise BadRequest("unsupported_connector", supported=SUPPORTED_TYPES)
  handle = payload.handle or connector_type
  if ":" in handle: raise BadRequest("invalid_handle_colon")            # AC-8
  if payload.sync_direction in ("write","bidirectional") \
     and connector_type not in WRITEBACK_ALLOWLIST:                     # ADR-017, AC-9
    raise Unprocessable("unsupported_writeback", allowlist=WRITEBACK_ALLOWLIST)
  ssrf_guard.validate_config(connector_type, payload)                   # v1-delta §2a, AC-10

  secret_name = f"weave/{tenant_id}/{connector_type}/credentials"
  arn = secrets_manager.upsert(secret_name, payload.credentials,        # put_secret_value on
                               kms_key_id=WEAVE_KMS_KEY)                # existing (ARN preserved)
  row = upsert connector_configs(tenant_id, connector_type, handle,
          secret_arn=arn, sync_direction, sync_frequency,
          lifecycle_state='configured', updated_by_iri=actor_iri)       # unified schema
  # Config-time fail-closed probe (AC-4). OAuth types skip -> TASK-025 authorizes.
  if not is_oauth_type(connector_type):
      if probe(row) is OK:
          row.lifecycle_state = 'authorized'; row.next_sync_at = now()
          upsert connector_health(status='connected', last_checked_at=now())
      else:
          row.lifecycle_state = 'error'
          upsert connector_health(status='disconnected',
                 last_error_redacted=redact_credentials(err), error_count += 1)
  audit.emit(actor=actor_iri, event="platform.connector.configured",
             target=f"urn:weave:connector:{tenant_id}:{handle}")
  return {"stored": True}  # NEVER return credential values

# Health READ (packages/backend/connectors/health.py) — stored row, no inline probe (AC-3)
def read_health(tenant_id, connector_type) -> HealthStatus:
  row = connector_health row joined to config (RLS-scoped)
  if missing: return HealthStatus(status="disconnected", last_error="not_configured")
  return row  # status ∈ connected|degraded|disconnected; probe freshness = last_checked_at
# probes themselves: config-time (above) + worker-side on sync cadence (TASK-018)
```

### API Contracts

**Endpoint:** `PUT /api/connectors/{type}/config`

**Request:**

```json
{
  "credentials": {
    "account": "myorg.snowflakecomputing.com",
    "username": "weave_svc",
    "private_key_pem": "<key>"
  },
  "sync_direction": "read",
  "sync_frequency": "PT1H",
  "handle": "snowflake"
}
```

(`sync_direction`/`sync_frequency` required; `handle` optional, defaults to the type,
colon-free. `write`/`bidirectional` only for `atlassian`/`servicenow` → else 422
`unsupported_writeback`. SSRF-violating endpoints → 422 `endpoint_not_allowed`.)

**Response (200):** `{ "stored": true }`

**Response (400):**

```json
{
  "error": "unsupported_connector",
  "supported": ["snowflake", "databricks", "aws", "azure_data_lake", "atlassian", "servicenow", "slack"]
}
```

---

**Endpoint:** `GET /api/connectors/{type}/health` *(stored-row read — never an inline probe)*

**Response (200):**

```json
{
  "connector": "snowflake",
  "status": "connected",
  "last_sync": "2026-06-30T11:55:00Z",
  "last_checked_at": "2026-06-30T11:58:00Z",
  "last_error": null,
  "error_count": 0,
  "kinds_skipped": 0
}
```

(`status` enum is the canonical `connected | degraded | disconnected` —
data-model.md unified schema. p95 150 ms, v1-delta §5.)

---

**Endpoint:** `GET /api/connectors`

**Response (200):**

```json
{
  "connectors": [
    { "type": "snowflake",       "configured": true,  "status": "connected",    "last_sync": "2026-06-30T11:55:00Z", "error_count": 0 },
    { "type": "databricks",      "configured": true,  "status": "disconnected", "last_sync": null, "error_count": 3 },
    { "type": "aws",             "configured": false, "status": null },
    { "type": "azure_data_lake", "configured": false, "status": null },
    { "type": "atlassian",       "configured": true,  "status": "degraded",     "last_sync": "2026-06-30T10:12:00Z", "error_count": 1 },
    { "type": "servicenow",      "configured": false, "status": null },
    { "type": "slack",           "configured": true,  "status": "connected",    "last_sync": null, "error_count": 0 }
  ]
}
```

(`last_sync`/`error_count` included in the list shape — E2-S8/TASK-023 consumes this
endpoint as its ONLY source.)

### Diagram References

| Diagram | Notes |
|---------|-------|
| Credential flow | Inline Mermaid below |

```mermaid
sequenceDiagram
    participant Admin
    participant PlatAPI as Platform API
    participant SM as AWS Secrets Manager
    participant Connector as External Connector

    Admin->>PlatAPI: PUT /api/connectors/snowflake/config { credentials }
    PlatAPI->>SM: PutSecretValue (path: weave/{tid}/snowflake/credentials)
    SM-->>PlatAPI: ok (ARN preserved)
    PlatAPI-->>Admin: { stored: true }  (credentials NEVER echoed)

    Note over PlatAPI,Connector: config-time fail-closed probe (once, at save)
    PlatAPI->>PlatAPI: ssrf_guard.validate_config (v1-delta §2a)
    PlatAPI->>Connector: ping (timeout=8s)
    alt Probe succeeds (credential type)
        PlatAPI->>PlatAPI: lifecycle configured→authorized; health row status=connected
    else Probe fails
        PlatAPI->>PlatAPI: redact_credentials(error); health row status=disconnected; lifecycle=error
    end

    Admin->>PlatAPI: GET /api/connectors/snowflake/health
    PlatAPI->>PlatAPI: read stored connector_health row (NO inline probe)
    PlatAPI-->>Admin: { status: "connected|degraded|disconnected", last_checked_at, ... }
```

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| PLAT-CONNECTOR-1: exactly 7 connectors; Atlassian = one OAuth family | contracts.md | `SUPPORTED_TYPES` has 7 entries; Atlassian health probe tests both Jira + Confluence via one OAuth token |
| All connector credentials in AWS Secrets Manager only | spec security constraint | No `.env`, no Aurora, no config files — Secrets Manager path is canonical |
| Credential values never in API responses | spec security constraint | `stored: true` response; `redact_credentials()` on error messages |
| Health shape: `status, last_sync, last_error, error_count` — ONE enum `connected/degraded/disconnected` | contracts.md PLAT-CONNECTOR-1; data-model.md unified schema (2026-07-08) | Fixed shape, fields present (null when n/a); `healthy/offline` and `ok/unreachable` variants are superseded |
| Health read = stored-row model; probes are config-time + worker-side | v1-delta §5 (supersedes this brief's earlier inline-probe AC-3) | The HTTP read never touches an external system; no Redis health cache needed |
| Unified connector schema: M1 `connector_configs` + `connector_health` extended additively | data-model.md §Connector Config (canonical) | This task's migration ALTERs the M1 tables (adds handle/sync_direction/sync_frequency/next_sync_at/last_sync_cursor + health columns); no parallel table |
| Config captures the poller/allowlist inputs | ADR-016/ADR-017; red-team fix 2026-07-08 | `sync_direction`, `sync_frequency`, `handle`, `next_sync_at` are persisted HERE — TASK-018's poller and ADR-017's allowlist check depend on them |
| SSRF guard at config save | v1-delta §2a | Shared `ssrf_guard` module; drivers re-validate at connect (TASK-018) |
| Ingestion (E7-S3) deferred within v1.0 to TASK-018+ | spec EPIC-007 | This task covers config + health only; no data pipeline, no ingest trigger |

## Test Requirements

### Unit Tests (minimum 4)

- `test_connector_credentials_stored_in_secrets_manager` — mock Secrets Manager; call config endpoint; assert `PutSecretValue` called with correct path; assert response contains no credential fields
- `test_unsupported_connector_returns_400` — call with `type="oracle"`; assert 400 with `supported` list of exactly 7 types
- `test_connector_health_error_redacts_credentials` — mock probe to fail with error containing credential value; assert `last_error` does not contain the credential value
- `test_atlassian_single_oauth_family` — configure Atlassian; assert one Secrets Manager path created (`atlassian`), not two (`jira`, `confluence`)

### Integration Tests (minimum 4)

- `test_health_read_returns_stored_row_no_inline_probe` — seed health row; call health endpoint; driver.ping spy shows ZERO calls; stored shape returned (AC-3)
- `test_connector_probe_fail_closed_and_authorize_transition` — config with bad credential ⟹ `disconnected` + lifecycle `error`; good credential (non-OAuth) ⟹ lifecycle `authorized`, `next_sync_at` set (AC-4)
- `test_config_captures_sync_fields_and_handle` — PUT with direction/frequency/handle ⟹ persisted on the unified row; colon handle ⟹ 400 (AC-8)
- `test_connector_list_scoped_to_tenant` — configure connectors in tenant A; call `GET /api/connectors` from tenant B; assert tenant B sees all unconfigured (tenant A's configured state not visible)
- `test_connector_credential_rotation` — configure; configure again; assert single Secrets Manager secret updated (not re-created; ARN stable); assert PLAT-AUDIT-1 event emitted twice

### E2E Tests (minimum 1)

- `test_connector_config_ui_stores_and_shows_health` — Playwright: navigate to connector settings; enter Snowflake credentials; save; assert "Configured" status shown; health indicator appears within 15 s

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_connector_credentials_stored_in_secrets_manager` |
| AC-2 | Unit | `test_unsupported_connector_returns_400` |
| AC-3 | Integration | `test_health_read_returns_stored_row_no_inline_probe` |
| AC-4 | Unit + Integration | `test_connector_health_error_redacts_credentials`, `test_connector_probe_fail_closed_and_authorize_transition` |
| AC-5 | Integration | `test_connector_list_scoped_to_tenant` |
| AC-6 | Unit | `test_atlassian_single_oauth_family` |
| AC-7 | Integration | `test_connector_credential_rotation` |
| AC-8 | Integration | `test_config_captures_sync_fields_and_handle` |
| AC-9 | Unit | `test_write_direction_rejected_off_allowlist` |
| AC-10 | Unit | `test_ssrf_guard_rejects_private_and_metadata_endpoints`, `test_ssrf_rejects_non_canonical_ip_encodings` |

## Dependencies

- **blocked_by:** TASK-004 (M1 — RBAC and tenant context required for per-tenant Secrets Manager paths)
- **unlocks:** TASK-018 (sync framework consumes the unified config rows + captured sync
  fields), TASK-022 (Slack channel — the M1 in-app centre shipped independently; only the
  Slack add-on channel depends here), TASK-023 (E2-S8 widget reads `GET /api/connectors`),
  TASK-025 (OAuth auth-code flow authorizes OAuth-type configs created here).

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~35K input, ~18K output
- **Estimated cost:** ~$2

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (config capture, fail-closed probe, stored-row read, SSRF guard)
- [x] Secrets Manager naming + single `secret_arn` column documented (no secret_path variant)
- [x] 7 connector types listed (Atlassian = one family)
- [x] Unified schema cited (data-model.md canonical); status enum pinned
- [x] Ingestion (E7-S3) explicitly out of scope
- [ ] TASK-004 complete

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Credential values never appear in any API response or log
- [ ] `redact_credentials()` tested against all 7 connector error message formats
- [ ] Atlassian health probe validates both Jira and Confluence via one OAuth token
- [ ] Health read issues zero external calls (spy-verified); status enum is `connected/degraded/disconnected` everywhere
- [ ] `sync_direction`/`sync_frequency`/`handle` persisted; off-allowlist write direction 422s
- [ ] SSRF guard blocks metadata/private ranges in tests; `allow_private_endpoints` default off
- [ ] PLAT-AUDIT-1 emitted on every configure and rotate action
- [ ] Coverage ≥80% for connectors module
- [ ] Conventional commit: `feat: add connector config and health monitoring`

## Implementation Hints

- Use `boto3`'s `secretsmanager.put_secret_value` (not `create_secret`) for updates — this preserves the secret's ARN, which IAM policies bind to; `delete + create` breaks those policies.
- Each connector driver should implement a minimal `ping()` method that does the cheapest possible operation (e.g. Snowflake: `SELECT 1`; Atlassian: `GET /rest/api/3/myself`; AWS: `s3:ListBuckets` scoped to one bucket / `sts:GetCallerIdentity`); full data enumeration is ingestion, not health.
- `redact_credentials()` should use a regex that matches the actual credential values fetched from Secrets Manager (not just pattern matching on `password`, `key`, etc.) — iterate over all values in the secrets dict and replace them with `[REDACTED]` in the error string.
- No Redis health cache: the stored `connector_health` row IS the cache (v1-delta §5); the UI polls the row read, which never hammers external services by construction.
- `ssrf_guard`: resolve ALL A/AAAA records (an attacker mixes one public + one private); validate every one; for the connect path pin the validated IP into the transport (or re-validate per connection) so DNS rebind between check and connect cannot bypass it. Keep the allowed-domain suffix lists as data next to `SUPPORTED_TYPES`.
- The KMS key used for Secrets Manager encryption (`WEAVE_KMS_KEY`) should be a customer-managed key per tenant — this supports key revocation on offboarding.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
