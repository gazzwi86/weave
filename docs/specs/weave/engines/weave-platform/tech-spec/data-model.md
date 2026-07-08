---
type: TechSpec
title: "Weave Platform — Data Model (M1)"
description: "Aurora relational schema, named-graph isolation scheme, RDF/OWL authority projection, service-principal registry, and tenant scoping for the Weave Platform shell (M1)."
tags: [weave-platform, arch, tech-spec, m1, data-model]
status: Draft
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/weave-platform/tech-spec/data-model.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: weave-platform
---

# Weave Platform — Data Model (M1)

**Graph edges:**
[Engine spec](../../../weave-platform.md) ·
[contracts.md](../../../../contracts.md) ·
[ADR-001 Tenant Isolation](../../../../decisions/ADR-001-tenant-isolation.md) ·
[ADR-002 Authority Extension](../../../../decisions/ADR-002-authority-extension.md)

**Standards consumed (linked, not redefined):**
[rbac-multi-tenancy](../../../../../../standards/rbac-multi-tenancy.md) ·
[audit-immutability](../../../../../../standards/audit-immutability.md) ·
[semantic-web](../../../../../../standards/semantic-web.md) ·
[api-conventions](../../../../../../standards/api-conventions.md) ·
[observability](../../../../../../standards/observability.md)

The Platform shell owns the six PLAT-\* contracts
([PLAT-IDENTITY-1](../../../../contracts.md),
[PLAT-AUDIT-1](../../../../contracts.md),
[PLAT-SETTINGS-1](../../../../contracts.md),
[PLAT-NOTIFY-1](../../../../contracts.md),
[PLAT-BILLING-1](../../../../contracts.md),
[PLAT-CONNECTOR-1](../../../../contracts.md))
and is the authoritative home of the tenant isolation boundary and the `urn:weave:g:*`
named-graph scheme.

Most Platform entities persist in **Aurora PostgreSQL** with `tenant_id` row-level scoping.
The RBAC/authority projection and provenance trail are the only Platform-owned concepts
that land in the RDF named graphs (see [§ RDF/OWL Mapping](#rdfowl-mapping)).

## Named-Graph Scheme

**Platform is the authoritative owner of this scheme.**
Every other engine uses these IRIs; none may define an alternative or bypass the scheme.
Decision rationale in [ADR-001](../../../../decisions/ADR-001-tenant-isolation.md).

| Graph | IRI pattern | Written by | Read by |
|---|---|---|---|
| Shared upper ontology (BPMO ~13 kinds, SHACL, SKOS) | `urn:weave:g:framework` | Weave release pipeline only | every tenant (read-only) |
| Tenant instance graph | `urn:weave:g:tenant:{tenant_id}` | CE-WRITE-1; connector ingest (post-M1) | that tenant only |
| Tenant provenance graph (PROV-O) | `urn:weave:g:tenant:{tenant_id}:prov` | audit / PROV-O stamping | that tenant only |

The **framework graph** is the SSOT for the BPMO upper ontology, the `weave:AuthorityLevel`
SKOS ordered scheme, the `weave:dataClassification` SKOS scheme, and all shared SHACL shapes.
Tenant graphs extend it — they never copy triples into it.

Every SPARQL query reads `framework ∪ tenant:{ctx.tenant_id}` and nothing else. The mandatory
query-rewriter is the **single enforcement point** — see
[ADR-001 §Enforcement rules](../../../../decisions/ADR-001-tenant-isolation.md).
Unscoped queries are rejected (`UnscopedQueryRejected`); SELECT-only + SERVICE-blocked per
[rbac-multi-tenancy §RDF layer](../../../../../../standards/rbac-multi-tenancy.md).

### Workspace IRI vs Named-Graph IRI *(historical — workspace removed 2026-07-08)*

TASK-003 minted `urn:weave:tenant:{tid}:ws:{wid}` at intra-tenant workspace creation. The
2026-07-08 realignment removed intra-tenant workspaces (workspace ≡ company/tenant — see
§Workspace below); these IRIs are legacy resource identifiers to be folded into the
company graph by the migration. Either way they were never graph IRIs and must not be
used as a `FROM` clause scope. The isolation boundary is the per-tenant named graph.

## ER Diagram

```mermaid
erDiagram
    TENANT ||--o{ DOMAIN : "subdivides"
    TENANT ||--o{ PRINCIPAL_USER : "owns"
    TENANT ||--o{ PRINCIPAL_AGENT : "owns"
    TENANT ||--o{ AUDIT_ENTRY : "partitions"
    TENANT ||--o{ CONNECTOR_CONFIG : "configures"
    TENANT ||--o{ METERING_RECORD : "accrues"
    TENANT ||--o{ BUDGET_CAP : "caps"
    DOMAIN ||--o{ PROJECT : "scopes"
    TENANT ||--o{ ROLE_BINDING : "governs"
    PRINCIPAL_USER ||--o{ ROLE_BINDING : "holds"
    PRINCIPAL_AGENT ||--o{ ROLE_BINDING : "holds"
    PRINCIPAL_USER ||--o{ NOTIFICATION : "receives"
    PRINCIPAL_USER ||--o{ NOTIFICATION_PREFERENCE : "configures"
    AUDIT_ENTRY ||--o| AUDIT_ENTRY : "prev_hash chain"
    CONNECTOR_CONFIG ||--|| CONNECTOR_HEALTH : "tracked-by"
    SERVICE_PRINCIPAL_REGISTRY ||--o{ PRINCIPAL_AGENT : "mints IRI"
    TENANT ||--o{ SETTING_VALUE : "scopes (company)"
    DOMAIN ||--o{ SETTING_VALUE : "scopes (domain)"
    PROJECT ||--o{ SETTING_VALUE : "scopes (project)"

    TENANT {
        uuid id PK
        string slug UK
        string plan_tier
        timestamp created_at
    }
    DOMAIN {
        uuid id PK
        uuid tenant_id FK
        string name
        timestamp created_at
    }
    PROJECT {
        uuid id PK
        uuid tenant_id FK
        uuid domain_id FK
        string name
        timestamp created_at
    }
    PRINCIPAL_USER {
        uuid id PK
        uuid tenant_id FK
        string cognito_sub UK
        string principal_iri UK
        string email
        int session_version
        timestamp last_login_at
    }
    PRINCIPAL_AGENT {
        uuid id PK
        uuid tenant_id FK
        string principal_iri UK
        string iam_role_arn
        string default_role
        timestamp created_at
        timestamp expires_at
    }
    SERVICE_PRINCIPAL_REGISTRY {
        uuid id PK
        uuid tenant_id "nullable — NULL = platform-internal"
        string principal_iri UK
        string iam_role_arn
        string rbac_role
        string description
        timestamp registered_at
    }
    ROLE_BINDING {
        uuid id PK
        uuid tenant_id FK
        string scope_level
        uuid scope_id
        string principal_iri
        string authority_level
        string area
        string granted_by_iri
        timestamp granted_at
        timestamp revoked_at
    }
    SETTING_VALUE {
        uuid id PK
        uuid tenant_id FK
        string level
        uuid scope_id
        string key
        jsonb value
        int tighter_rank
        timestamp set_at
    }
    AUDIT_ENTRY {
        bigint seq PK
        uuid tenant_id
        timestamp ts
        string actor_principal_iri
        string engine
        string event_type
        string target_iri
        jsonb diff_summary
        varchar prev_hash
        varchar hash
        bytea signature
    }
    CONNECTOR_CONFIG {
        uuid id PK
        uuid tenant_id FK
        string connector_type
        string handle UK
        string secret_arn
        string lifecycle_state
        string sync_direction
        interval sync_frequency
        timestamp next_sync_at
        text last_sync_cursor
        timestamp updated_at
        string updated_by_iri
    }
    CONNECTOR_HEALTH {
        uuid connector_config_id PK
        uuid tenant_id FK
        string status
        timestamp last_checked_at
        timestamp last_sync
        text last_error_redacted
        int error_count
        int kinds_skipped
    }
    NOTIFICATION {
        uuid id PK
        uuid tenant_id FK
        string event_type
        string target_principal_iri
        jsonb payload
        jsonb delivered_channels
        timestamp created_at
    }
    NOTIFICATION_PREFERENCE {
        uuid id PK
        uuid tenant_id FK
        string principal_iri
        string event_type_pattern
        jsonb channel_prefs
    }
    METERING_RECORD {
        uuid id PK
        uuid tenant_id FK
        string record_type
        string engine
        string principal_iri
        bigint quantity
        jsonb metadata
        timestamp recorded_at
    }
    BUDGET_CAP {
        uuid id PK
        uuid tenant_id FK
        string level
        uuid scope_id
        string cap_type
        bigint cap_value
        string period
    }
```

## Entity Definitions

**Isolation rule:** every Aurora table (except `tenants` itself and platform-internal registry
rows with `tenant_id IS NULL`) carries a `tenant_id` column. A base-layer predicate
(`WHERE tenant_id = ctx.tenant_id`) is injected centrally by the connection pool before
any query reaches application logic. Application code must not add its own `tenant_id`
filters — the base layer is the single enforcement point. See
[rbac-multi-tenancy §Aurora base layer](../../../../../../standards/rbac-multi-tenancy.md).

### Tenant

Top isolation unit. Owns one named graph (`urn:weave:g:tenant:{id}`) and one provenance
graph (`urn:weave:g:tenant:{id}:prov`). `slug` is unique, URL-safe, and used for
subdomain routing. `plan_tier` gates billing caps and feature flags.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | used as `{tenant_id}` in all IRI and graph patterns |
| `slug` | varchar(63) | UK, NOT NULL | URL-safe; subdomain routing |
| `plan_tier` | varchar | NOT NULL | `starter \| growth \| enterprise` |
| `created_at` | timestamptz | NOT NULL | immutable after insert |
| `updated_at` | timestamptz | NOT NULL | last plan/slug change |

**No `tenant_id` FK** — this is the root isolation anchor; all other tables reference it.

### Domain

Organizational subdivision of a Tenant (e.g., a business unit). Provides the second
cascade level for settings and budget caps.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `name` | varchar | NOT NULL | unique within tenant |
| `description` | text | — | optional |
| `created_at` | timestamptz | NOT NULL | — |

### Workspace — REMOVED (2026-07-08 human decision)

**Workspace ≡ the company/tenant.** The intra-tenant `workspaces` table and its
`urn:weave:tenant:{tid}:ws:{wid}` resource IRIs are a divergence to migrate away from
(see `.claude/memory/decision_tenancy-workspace-alignment.md`): existing sub-workspace
rows fold into the company graph, the settings cascade drops the Workspace level
(former workspace-scoped values re-home to their enclosing Domain; on a re-home
collision the tighter value wins), and RBAC re-scopes to tenant-wide plus
project/domain grants. **M2/v1 briefs test this spec, not the residual M1 column** —
new tables MUST NOT add `workspace_id` FKs. The UI term "workspace" (switcher,
workspace admin) survives and means the company/tenant.

### Project

Scoped work unit within a Domain. The third (innermost) cascade level for settings.
*(Amended 2026-07-08: re-parented from the removed Workspace to Domain.)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `domain_id` | UUID | FK → domains, NOT NULL | was `workspace_id` pre-amendment; migration re-points to the enclosing Domain |
| `name` | varchar | NOT NULL | unique within domain |
| `created_at` | timestamptz | NOT NULL | — |

### Principal (User)

Human identity, minted from Cognito sub. `session_version` is the revocation counter —
it is incremented to invalidate all active JWTs for this user immediately. Every request
checks the JWT's `session_version` claim against the Redis store.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `cognito_sub` | varchar | UK, NOT NULL | from Cognito JWT `sub` claim |
| `principal_iri` | varchar | UK, NOT NULL | `urn:weave:principal:user:{cognito_sub}`; immutable |
| `email` | varchar | NOT NULL | from Cognito; must NOT appear as OTel span attributes |
| `session_version` | int4 | NOT NULL, DEFAULT 1 | revocation counter; mirrored to Redis |
| `last_login_at` | timestamptz | — | updated on each successful JWT exchange |

Redis key: `HSET session_versions {tenant_id}:{user_id} version {n}` — used for
per-request revocation check (see [business-process §Flow 5](business-process.md#flow-5-revocation)).

### Principal (Agent) and Service-Principal Registry

Machine identity, derived from IAM role ARN hash. Two tables serve distinct purposes.
See [PLAT-IDENTITY-1](../../../../contracts.md) and
[rbac-multi-tenancy §Service-principal conventions](../../../../../../standards/rbac-multi-tenancy.md).

**`principal_agents`** — per-tenant registered service agents:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `iam_role_arn` | varchar | NOT NULL | IAM role the STS token assumes |
| `principal_iri` | varchar | UK, NOT NULL | `urn:weave:principal:agent:{sha256(iam_role_arn)[:12]}` |
| `default_role` | varchar | NOT NULL | authority level at registration |
| `created_at` | timestamptz | NOT NULL | — |
| `expires_at` | timestamptz | — | nullable; max lifetime for non-permanent agents |

**`service_principal_registry`** — canonical cross-reference (IRI ↔ IAM role ↔ RBAC role).

Platform-internal Weave-operator principals are registered here with `tenant_id = NULL`.
They are **never assignable** to a client tenant role binding. This is the mechanism
behind SEC-5 (see [§ Audit Entry](#audit-entry)).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | nullable | NULL = platform-internal (Weave-operator); no RLS on these rows |
| `principal_iri` | varchar | UK, NOT NULL | canonical IRI |
| `iam_role_arn` | varchar | NOT NULL | AWS IAM role ARN |
| `rbac_role` | varchar | NOT NULL | authority level granted to this principal |
| `description` | text | NOT NULL | human-readable purpose statement |
| `registered_at` | timestamptz | NOT NULL | — |

### Role Binding

Assignment of an authority level to a principal within a scope (tenant-wide, domain, or
project — per the 2026-07-08 tenancy realignment: senior roles bind tenant-wide;
non-senior users work through project-scoped grants) and functional area.

`authority_level` ∈ `{ read, author, publish, admin }` — the SKOS ordered scheme defined once
in the framework graph per [ADR-002](../../../../decisions/ADR-002-authority-extension.md)
and [rbac-multi-tenancy](../../../../../../standards/rbac-multi-tenancy.md).
**Platform holds no second role-definition table.** The four levels are SSOT in the ontology.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `scope_level` | varchar | CHECK IN ('company','domain','project'), NOT NULL DEFAULT 'company' | was `workspace_id`; 'company' = tenant-wide grant |
| `scope_id` | UUID | NOT NULL | tenant/domain/project id matching `scope_level` (same pattern as `setting_values`) |
| `principal_iri` | varchar | NOT NULL | FK-by-IRI to user or agent principal |
| `authority_level` | varchar | CHECK IN ('read','author','publish','admin') | read ≺ author ≺ publish ≺ admin |
| `area` | varchar | NOT NULL | functional area or `*` for all areas |
| `granted_by_iri` | varchar | NOT NULL | auditable: who granted this binding |
| `granted_at` | timestamptz | NOT NULL | — |
| `revoked_at` | timestamptz | — | nullable; soft-revoke; NULL = active |

**Note on TASK-004 divergence:** TASK-004 references `viewer/editor/admin/owner` level names.
ADR-002 is authoritative — levels are `read ≺ author ≺ publish ≺ admin`. TASK-004 must be
reconciled to ADR-002 terminology during implementation (flagged in §Conflicts).

### Setting Value

A cascade-level key/value pair. `level` ∈ `{ company, domain, project }` (the
`workspace` level was removed 2026-07-08; existing workspace-level rows re-home to their
enclosing Domain, tighter value winning on collision).
`tighter_rank` drives resolution: 0 = project (tightest, wins) … 2 = company (broadest).
The resolver walks Project→Domain→Company and returns the first non-null value.
See [PLAT-SETTINGS-1](../../../../contracts.md) for the full resolver contract.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `level` | varchar | CHECK IN ('company','domain','project') | cascade level (workspace removed 2026-07-08) |
| `scope_id` | UUID | NOT NULL | references the relevant tenant/domain/project id |
| `key` | varchar | NOT NULL | namespaced key e.g. `billing.token_cap` |
| `value` | jsonb | NOT NULL | typed JSON value |
| `tighter_rank` | int4 | NOT NULL | 0 = tightest (project) … 2 = broadest (company) |
| `set_at` | timestamptz | NOT NULL | — |
| `set_by_iri` | varchar | NOT NULL | audit trail: who set this value |

**Unique constraint:** `(tenant_id, level, scope_id, key)` — one value per key per scope level.

### Audit Entry

Append-only, hash-chained, ed25519-signed audit log. Append-only enforced by PostgreSQL
trigger + REVOKE UPDATE/DELETE at the DB level. Chain mechanism, signing scheme, and
export format are defined in
[audit-immutability](../../../../../../standards/audit-immutability.md) — do not redefine here.

**SEC-5 — Audit export scoping (council backlog):** `tenant_id` partitions the chain.
A workspace-admin (`authority_level = admin`) may export audit entries **only for their own
tenant** (`WHERE tenant_id = ctx.tenant_id`). Cross-tenant export requires a Weave-operator
IAM path (principal registered in `service_principal_registry` with `tenant_id IS NULL`).
The Weave-operator identity is platform-internal and is **never assignable** to any client
tenant role binding. Export flow is in
[business-process §Flow 7](business-process.md#flow-7-audit-export-with-tenant-scope-gate-sec-5).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `seq` | bigint | PK | monotonically increasing per tenant partition |
| `tenant_id` | UUID | NOT NULL | partition key; no FK (append-only, no cascade delete) |
| `ts` | timestamptz | NOT NULL | event timestamp |
| `actor_principal_iri` | varchar | NOT NULL | who performed the action |
| `engine` | varchar | NOT NULL | source engine: `platform \| constitution \| build \| events` |
| `event_type` | varchar | NOT NULL | e.g. `auth.login`, `rbac.deny`, `settings.updated` |
| `target_iri` | varchar | — | resource acted upon (nullable for system events) |
| `diff_summary` | jsonb | — | stored in full; **redacted at export-time** for non-admin roles |
| `prev_hash` | varchar(64) | NOT NULL | SHA-256 of previous entry; `"0" × 64` for genesis |
| `hash` | varchar(64) | NOT NULL | SHA-256(canonical_json(entry) \|\| prev_hash) |
| `signature` | bytea | NOT NULL | ed25519_sign(hash \|\| prev_hash) |

**Indexes:** `(tenant_id, seq)`, `(tenant_id, ts DESC)`, `(tenant_id, actor_principal_iri, ts)`.

### Connector Config *(UNIFIED SCHEMA — canonical, 2026-07-08)*

Handle to a managed connector. Credentials are stored exclusively in AWS Secrets Manager.
`secret_arn` is the reference — **the credential value is never stored in this table and
is never returned in API responses** (PLAT-CONNECTOR-1). `redact_credentials()` must be
applied before writing any error messages (see `connector_health.last_error_redacted`).

Seven supported connector types (**managed connectors are deferred from MVP to v1.0** — config + health
probe and ingestion all activate at v1.0):
`snowflake`, `databricks`, `aws`, `azure_data_lake`, `atlassian`, `servicenow`, `slack`.

Atlassian covers Jira + Confluence as one OAuth family (one config row per tenant).

> **Canonical-schema rule.** This table + `connector_health` below are THE connector
> schema. The v1 delta (`v1-delta.md` §4) and every task brief (TASK-006/018–023) extend
> or cite this definition — no fold-in of health columns, no parallel `secret_path` /
> `status`-on-config variants. The prior v1-delta draft that folded health into the
> config row is superseded.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `connector_type` | varchar | NOT NULL | one of the seven types above |
| `handle` | varchar | NOT NULL; UK `(tenant_id, handle)`; CHECK `position(':' in handle) = 0` | connector **instance handle**; defaults to `connector_type` at v1; prefixes `weave:externalId` (`"<handle>:<source_id>"`, parse first-colon-only — hence no colon allowed in the handle) |
| `secret_arn` | varchar | NOT NULL | full Secrets Manager **ARN** returned at create; the secret *name* follows `weave/{tenant_id}/{connector_type}/credentials` (single canonical column — no `secret_path` variant) |
| `lifecycle_state` | varchar | NOT NULL | `configured \| authorized \| syncing \| error \| revoked` (state machine in `business-process.md`); OAuth types reach `authorized` via the auth-code callback (TASK-025); credential types on a successful fail-closed config probe |
| `sync_direction` | varchar | NOT NULL DEFAULT 'read' | `read \| write \| bidirectional`; `write`/`bidirectional` valid only for the ADR-017 allowlist (`atlassian`, `servicenow`) — 422 otherwise, enforced at config save (TASK-006) |
| `sync_frequency` | interval | NOT NULL DEFAULT '1 hour' | captured at config (E7-S1 / FR-031) |
| `next_sync_at` | timestamptz | — | ADR-016 poller claim key; partial index WHERE NOT NULL; set at authorization, cleared on revoke |
| `last_sync_cursor` | text | — | driver-opaque incremental cursor (advances only after a run's final batch — TASK-018 AC-6) |
| `created_at` | timestamptz | NOT NULL | — |
| `updated_at` | timestamptz | NOT NULL | — |
| `updated_by_iri` | varchar | NOT NULL | last actor principal IRI |

**Unique constraint:** `(tenant_id, connector_type)` — one active config per type per tenant
(v1; the `handle` UK future-proofs multi-instance).

**SSRF guard (config-time):** any tenant-supplied host/account/instance URL in the
credential/config payload is validated before storage — HTTPS only, hostname must match the
connector type's allowed-domain suffix list (e.g. `*.snowflakecomputing.com`,
`*.atlassian.net`, `*.service-now.com`, `*.azuredatabricks.net`/`*.cloud.databricks.com`,
`*.dfs.core.windows.net`, `slack.com`), and its resolved IPs must not fall in loopback,
link-local (incl. `169.254.169.254`), RFC-1918, CGNAT, or IPv6 ULA/link-local ranges.
Runtime connections re-validate and pin the resolved IP (DNS-rebind aware). Test/dev
fixture endpoints are permitted only via an explicit `connectors.allow_private_endpoints`
settings flag (default **off**; never on in production). See v1-delta §2a and TASK-006/018.

### Connector Health *(UNIFIED SCHEMA — canonical, 2026-07-08)*

Cached health status for a connector — 1:1 with `connector_config`. Populated by the
**worker-side probe** (sync cadence) and the config-time fail-closed probe; the HTTP
health read (`GET /api/connectors/{type}/health`) **reads this stored row and never
probes an external system inline** (TASK-006).

**ONE status enum** (canonical; supersedes `ok|degraded|unreachable` and
`healthy|degraded|offline` variants): `connected \| degraded \| disconnected` — matching
E7-S2. `disconnected` = credentials invalid / unreachable / not authorized (fail-closed);
`degraded` = partial (sustained kind-skips, timeouts, retry exhaustion) — still syncs so
resync recovery works; `connected` = last probe + run clean. A health-read outage renders
"health unknown" client-side — that is a render state, never a stored value.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `connector_config_id` | UUID | PK, FK → connector_configs | 1:1 with connector_config |
| `tenant_id` | UUID | NOT NULL | RLS anchor |
| `status` | varchar | NOT NULL | CHECK IN (`connected`,`degraded`,`disconnected`); default `disconnected` |
| `last_checked_at` | timestamptz | NOT NULL | — |
| `last_sync` | timestamptz | — | last successful sync run (PLAT-CONNECTOR-1 health shape) |
| `last_error_redacted` | text | — | credential-scrubbed error message (API field name: `last_error`) |
| `error_count` | int4 | NOT NULL DEFAULT 0 | PLAT-CONNECTOR-1 health shape |
| `kinds_skipped` | int4 | NOT NULL DEFAULT 0 | latest-run skipped-kind count (ADR-015 §2); sustained skips (default 3 runs) ⟹ `degraded` |

### Notification

Persisted notification event. `in_app` delivery is always mandatory.
`delivered_channels` records which channels delivered successfully.
See [PLAT-NOTIFY-1](../../../../contracts.md).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `event_type` | varchar | NOT NULL | from the open event_type taxonomy (TASK-007) |
| `target_principal_iri` | varchar | NOT NULL | recipient |
| `payload` | jsonb | NOT NULL | message content |
| `delivered_channels` | jsonb | NOT NULL, DEFAULT '["in_app"]' | channels that delivered |
| `created_at` | timestamptz | NOT NULL | — |
| `delivered_at` | timestamptz | — | nullable; time of first delivery |

### Notification Preference

Per-user, per-event-type channel preferences. `security.*` events are always delivered
regardless of preference (see TASK-007 §Invariants).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `principal_iri` | varchar | NOT NULL | user principal |
| `event_type_pattern` | varchar | NOT NULL | exact or glob; e.g. `security.*` |
| `channel_prefs` | jsonb | NOT NULL | e.g. `{ "slack": true, "email": false }` |

### Metering Record

Per-token AI usage or per-run automation billing record. Gate check (`enforce_budget`)
is synchronous pre-call; recording (`record_token_usage`, `record_run_metering`) is async
queue write. Redis holds real-time consumed total; Aurora holds the durable record.
See [PLAT-BILLING-1](../../../../contracts.md).

80% cap → warning notification emitted. 100% cap → request rejected synchronously.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `record_type` | varchar | NOT NULL | `token_usage \| run_metering` |
| `engine` | varchar | NOT NULL | source engine |
| `principal_iri` | varchar | NOT NULL | who incurred the cost |
| `quantity` | bigint | NOT NULL | token count or run count |
| `metadata` | jsonb | — | model id, run id, etc. |
| `recorded_at` | timestamptz | NOT NULL | — |

### Budget Cap

Cascade-resolved spending limit. Resolution follows the same Project→Domain→Company
order as settings (tighter scope wins, `tighter_rank` ascending).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | — |
| `tenant_id` | UUID | FK → tenants, NOT NULL | RLS anchor |
| `level` | varchar | CHECK IN ('company','domain','project') | cascade level (workspace removed 2026-07-08) |
| `scope_id` | UUID | NOT NULL | id of the scoping entity |
| `cap_type` | varchar | NOT NULL | `token \| run` |
| `cap_value` | bigint | NOT NULL | — |
| `period` | varchar | NOT NULL | `daily \| monthly` |

## RDF/OWL Mapping

Platform-owned concepts that land in the RDF named graphs. All other Platform entities
are Aurora-only. See [semantic-web](../../../../../../standards/semantic-web.md) for
IRI naming patterns, Turtle serialisation, SHACL conventions, and SKOS/PROV-O usage.

| Domain concept | OWL/SKOS/ODRL/PROV-O class | Key predicates | Graph | Source |
|---|---|---|---|---|
| Tenant boundary | — (Aurora only; the named graph IS the RDF tenant boundary) | — | `urn:weave:g:tenant:{id}` | [ADR-001](../../../../decisions/ADR-001-tenant-isolation.md) |
| Any principal | `prov:Agent` | `weave:principalIRI`; `prov:wasAssociatedWith` | tenant graph | PROV-O; [PLAT-IDENTITY-1](../../../../contracts.md) |
| Role | `weave:Role` (OWL Class) | `weave:holdsRole` (bpmo:Actor → weave:Role) | tenant graph | [ADR-002](../../../../decisions/ADR-002-authority-extension.md) |
| Authority level scheme | `skos:OrderedCollection` (`weave:AuthorityLevel`) | `skos:memberList` [read author publish admin] | framework graph | [ADR-002](../../../../decisions/ADR-002-authority-extension.md) |
| Permission (M2) | `odrl:Permission` | `odrl:assignee` (Role); `odrl:action`; `odrl:target`; `odrl:constraint` | tenant graph | [ADR-002](../../../../decisions/ADR-002-authority-extension.md) |
| Data classification | `skos:ConceptScheme` (`weave:dataClassification`) | `skos:exactMatch` → DPV term | framework graph | [ADR-002](../../../../decisions/ADR-002-authority-extension.md) |
| Audit event (provenance) | `prov:Activity` | `prov:wasAssociatedWith`; `prov:startedAtTime`; `prov:endedAtTime` | `urn:weave:g:tenant:{id}:prov` | PROV-O; [PLAT-AUDIT-1](../../../../contracts.md) |

**Role and authority vocabulary — illustrative Turtle (not prescriptive; Platform delivers
these triples to the framework graph via the Weave release pipeline):**

```turtle
# In urn:weave:g:framework — read-only; Weave release process only
weave:Role a owl:Class .

weave:holdsRole a owl:ObjectProperty ;
    rdfs:domain bpmo:Actor ;
    rdfs:range  weave:Role .

weave:AuthorityLevel a skos:OrderedCollection ;
    skos:memberList ( weave:read weave:author weave:publish weave:admin ) .

weave:dataClassification a skos:ConceptScheme .
weave:confidential a skos:Concept ;
    skos:inScheme weave:dataClassification ;
    skos:exactMatch <https://w3id.org/dpv#Confidential> .
```

**M1 degrade:** the RBAC boundary reads the ontology-derived authority level from the
`weave:AuthorityLevel` SKOS collection in the framework graph. Full ODRL
`Permission`/`Prohibition` instances are M2 (ADR-002 §Status). The base framework
degrades honestly — authority() returns `coverage_gap` + deny when no Permission graph
is present.

## Isolation Invariants

### Named-Graph Enforcement

- Every SPARQL query passes through the rewriter — fail-closed; no bypass path.
- Active graph set is always `framework ∪ tenant:{ctx.tenant_id}` and no more.
- A query naming a different tenant graph, or unscoped where scope is required, raises
  `UnscopedQueryRejected`. Queries are never silently broadened.
- LLM-generated SPARQL from `POST /api/query/nl` ([CE-READ-1](../../../../contracts.md))
  passes through the **same** rewriter — there is no special bypass for NL-generated queries.
- Writes never issue raw triples — they go through CE-WRITE-1, which derives the target
  graph from request context, not from the payload. A payload naming another tenant's graph
  is a 403 + audit entry.

### Aurora Row-Level Security

- All tenant-scoped tables carry `tenant_id`; base-layer predicate injected by the
  connection pool before any query reaches application logic.
- Application code must not add its own `tenant_id` filters — the base layer is the
  single enforcement point. Redundant filters create inconsistency risk.
- `service_principal_registry` rows with `tenant_id IS NULL` (Weave-operator) are exempt
  from the tenant predicate and are accessible only to the platform-internal identity path.

### S3 Vectors Tenant Prefix

All S3 Vectors keys carry a `{tenant_id}/` prefix. Cross-tenant prefix access is blocked
by IAM condition key `s3:prefix`. Tenant context is injected by the Platform — no client
code specifies its own prefix.

### Cross-Tenant + Connector-Write Isolation Test (M1 Release Gate)

Mandatory before M1 ships per [ADR-001 §Release gate](../../../../decisions/ADR-001-tenant-isolation.md):

1. `test_cross_tenant_read_returns_zero_rows` — seed data in tenant A; assert tenant B
   query returns empty.
2. `test_unscoped_query_is_rejected` — assert `UnscopedQueryRejected` is raised.
3. `test_connector_write_isolated` — seed a connector write targeting tenant A context;
   assert the write is invisible in tenant B's named graph; assert a write with a forged
   tenant B graph IRI from tenant A's context is rejected (403 + audit entry emitted).

## Indexes

| Table | Index columns | Purpose |
|---|---|---|
| `domains` | `(tenant_id, name)` | tenant domain listing |
| `projects` | `(tenant_id, domain_id)` | domain project listing |
| `role_bindings` | `(tenant_id, scope_level, scope_id, principal_iri)` | RBAC lookup |
| `role_bindings` | `(tenant_id, principal_iri, revoked_at)` | active binding check |
| `setting_values` | `(tenant_id, level, scope_id, key)` | cascade resolver |
| `audit_entries` | `(tenant_id, seq)` UNIQUE | chain traversal; PK covers this |
| `audit_entries` | `(tenant_id, ts DESC)` | time-range export |
| `audit_entries` | `(tenant_id, actor_principal_iri, ts)` | actor audit view |
| `connector_configs` | `(tenant_id, connector_type)` UNIQUE | one config per type per tenant |
| `metering_records` | `(tenant_id, record_type, recorded_at)` | billing aggregation |
| `budget_caps` | `(tenant_id, level, scope_id, cap_type, period)` | cascade resolver |
| `notifications` | `(tenant_id, target_principal_iri, created_at DESC)` | inbox query |

## Deferred (M2+)

The following entities are post-M1 and must not appear in the M1 schema:

| Entity | Owner | Reason deferred |
|---|---|---|
| `dashboard_widgets` (per-user pin table) | Platform | FR-008 is M2; M1 dashboard is fixed CE-sourced view |
| `dashboard_library` (tenant-shared widgets) | Platform | FR-011 is M2 |
| `connector_ingest_jobs` | Platform / CE | Connector ingestion (E7-S3) needs CE-WRITE-1; connectors deferred to v1.0 |
| Full ODRL `Permission` / `Prohibition` instances | Platform / CE | ADR-002 M2 authority module |
| `weave:Activity` HITL duty triples | Platform / CE | ADR-002 M2 |
| `weave:AutomationRun` provenance triples | Events / CE | Events engine post-M1 |

## Conflicts and Assumptions

| Item | Conflict | Resolution |
|---|---|---|
| RBAC level names | TASK-004 previously used `viewer/editor/admin/owner`; ADR-002 + rbac-multi-tenancy + the weave-platform.md role table use `read/author/publish/admin` | **Resolved (2026-07-01):** TASK-004 reconciled to the SSOT `read/author/publish/admin` (positional-by-rank: viewer→read, editor→author, admin→publish, owner→admin). |
| Workspace IRI vs named-graph IRI | TASK-003 mints `urn:weave:tenant:{tid}:ws:{wid}` (no `g:` segment); ADR-001 scheme uses `urn:weave:g:tenant:{id}` for graph IRIs | ADR-001 is authoritative for graph IRIs. Workspace IRI is a resource identifier within the tenant graph, not a graph IRI. Clarified in §Named-Graph Scheme. |
| `syncing` connector state in M1 | Connector ingest is post-M1, yet lifecycle model includes `syncing` | State is defined in the schema now (schema migration cheaper than data migration later); the `syncing` state only activates when ingest ships post-M1. |
