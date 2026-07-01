---
type: TechSpec
title: "Weave Platform — Business Process (M1)"
description: "Core M1 flows, connector lifecycle state machine, and sequence diagrams for the Weave Platform shell: login, workspace switch, settings cascade, RBAC enforcement, revocation, connector OAuth, and audit-export with tenant-scope gate."
tags: [weave-platform, 04-arch, tech-spec, m1, business-process]
status: Draft
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/weave-platform/04-arch/tech-spec/business-process.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: weave-platform
---

# Weave Platform — Business Process (M1)

**Graph edges:**
[Engine spec](../../../weave-platform.md) ·
[contracts.md](../../../../contracts.md) ·
[ADR-001 Tenant Isolation](../../../../decisions/ADR-001-tenant-isolation.md) ·
[ADR-002 Authority Extension](../../../../decisions/ADR-002-authority-extension.md)

**Standards consumed (linked, not redefined):**
[rbac-multi-tenancy](../../../../../../standards/rbac-multi-tenancy.md) ·
[audit-immutability](../../../../../../standards/audit-immutability.md) ·
[api-conventions](../../../../../../standards/api-conventions.md) ·
[observability](../../../../../../standards/observability.md)

**Data model:** [data-model.md](data-model.md)

This document covers the M1 Platform flows. Every security-relevant path emits an
audit entry via [PLAT-AUDIT-1](../../../../contracts.md) and records a span per
[observability](../../../../../../standards/observability.md) (required attributes:
`weave.tenant_id`, `weave.engine = platform`, `weave.request_id`). Error envelopes and
status codes (403, 422, 429) follow
[api-conventions](../../../../../../standards/api-conventions.md) — not restated here.

## Flow 1: Cognito JWT Login

Two identity paths: **Human** authenticates via Cognito (JWT, TTL ≤ 60 s, enforced by
`token_validity_seconds = 60` in the Cognito Terraform module). **Agent** authenticates
via AWS STS (AssumeRole, short-lived credentials, never raw secret values). Both paths
converge on principal IRI minting and session-version validation before the request
proceeds. See [Sequence: Login](#sequence-login) for the full call sequence.

```mermaid
flowchart TD
    A([Incoming request]) --> B{Identity type?}
    B -->|Human| C["Cognito: verify credentials\nmint JWT — TTL ≤ 60 s\nclaims: sub, tenant_id, session_version"]
    B -->|Agent| D["STS: AssumeRole on iam_role_arn\nmint short-lived credentials\nnever raw secret values"]
    C --> E["Backend: verify JWT signature\nextract cognito_sub → principal_iri\nurn:weave:principal:user:{sub}"]
    D --> F["Backend: STS GetCallerIdentity\nlookup service_principal_registry\nby iam_role_arn → principal_iri"]
    E --> G["Redis: HGET session_versions\n{tenant_id}:{user_id}"]
    F --> G
    G --> H{JWT session_version\n== Redis version?}
    H -->|Mismatch — token revoked| I["401 Unauthorized\naudit: auth.session_version_mismatch"]
    H -->|Match| J["Inject tenant context\nset active named graph:\nframework ∪ tenant:{tenant_id}"]
    J --> K([Request proceeds])
```

**Invariants:**

- Token TTL ≤ 60 s (Cognito); agents use STS TTL ≤ 60 s — no long-lived secrets.
- `principal_iri` is immutable once minted; derived from Cognito `sub` (human) or
  `sha256(iam_role_arn)[:12]` (agent).
- The named-graph scope is set from the verified JWT `tenant_id` claim — never from the
  request payload.
- OTel span attributes must not include `email` or any PII.

## Flow 2: Workspace Switch

A workspace switch updates the RBAC context, not the isolation boundary. The tenant
named graph stays constant across workspaces for the same tenant. A switch to a workspace
in a different tenant is rejected with 403 and zero cross-tenant data in the response body.

```mermaid
flowchart TD
    A(["User: switch to workspace W"]) --> B["Next.js: update workspace_id in session\nsend PATCH /api/session/workspace"]
    B --> C["Backend: verify JWT + session_version\n(Redis check)"]
    C -->|Invalid token| D["401 Unauthorized"]
    C -->|Valid| E["Lookup role_binding:\nprincipal_iri + workspace W + tenant_id"]
    E -->|No active binding| F["403 Forbidden\nbody: empty (zero cross-tenant data)\naudit: rbac.workspace_switch_denied"]
    E -->|Binding found| G{workspace.tenant_id\n== ctx.tenant_id?}
    G -->|No — cross-tenant attempt| H["403 Forbidden\naudit: security.cross_tenant_attempt\nnotify: security.* channel"]
    G -->|Yes| I["Update session: new workspace_id\nnamed graph unchanged — still\nurn:weave:g:tenant:{tenant_id}"]
    I --> J(["Workspace switched"])
```

**Invariant:** the named-graph isolation boundary is the **tenant**, not the workspace.
A workspace switch never changes the active `FROM` clause graph scope. Zero cross-tenant
data is returned on any rejection path — the response body is empty, not filtered.

## Flow 3: Settings-Cascade Resolution

The four cascade levels (Company → Domain → Workspace → Project) are resolved by
walking from the tightest scope outward; the first non-null value wins. This implements
[PLAT-SETTINGS-1](../../../../contracts.md). Billing caps use the same cascade logic via
[PLAT-BILLING-1](../../../../contracts.md).

```mermaid
flowchart TD
    A(["resolve(key K, project P)"]) --> B["Query setting_values WHERE\ntenant_id = ctx.tenant_id AND key = K\nORDER BY tighter_rank ASC"]
    B --> C{Project-level value\nexists for P?}
    C -->|Yes| R1(["Return project value\nresolved_at: project"])
    C -->|No| D{Workspace-level value\nexists?}
    D -->|Yes| R2(["Return workspace value\nresolved_at: workspace"])
    D -->|No| E{Domain-level value\nexists?}
    E -->|Yes| R3(["Return domain value\nresolved_at: domain"])
    E -->|No| F{Company-level value\nexists?}
    F -->|Yes| R4(["Return company value\nresolved_at: company"])
    F -->|No| R5(["Return null → system default\nresolved_at: system"])
```

**Invariants:**

- All four levels are queried in one Aurora call (single `WHERE tenant_id = ctx.tenant_id`
  with `ORDER BY tighter_rank ASC` and `LIMIT 1`).
- `tighter_rank`: 0 = project (tightest) … 3 = company; `LIMIT 1` returns the winner.
- Budget-cap cascade: same logic with `cap_type` and `period` as additional dimensions.
- An 80% consumed threshold emits a warning notification (PLAT-BILLING-1); 100% rejects
  the triggering call synchronously before the metering record is written.

## Flow 4: RBAC Deny → 403 → Audit

The RBAC middleware runs on every authenticated API request. It resolves the effective
authority level for the requesting principal against the required level for the target
endpoint. A deny always emits an audit entry; `security.*` events also trigger a
notification. See [rbac-multi-tenancy](../../../../../../standards/rbac-multi-tenancy.md)
for the `require(level, area)` contract and the authority-level rank table.

```mermaid
flowchart TD
    A(["API request"]) --> B["RBAC middleware: extract\nprincipal_iri, workspace_id, area"]
    B --> C["Lookup active role_binding:\ntenant_id + workspace_id + principal_iri\nAND revoked_at IS NULL"]
    C -->|No active binding| D{event_type\n∈ security.*?}
    C -->|Binding found| E["Compare rank:\nbinding.authority_level vs required"]
    E -->|Insufficient rank| D
    E -->|Sufficient rank| F(["Request proceeds"])
    D --> G["Emit audit_entry:\nengine=platform, event_type=rbac.deny\nactor_principal_iri, target_iri"]
    G --> H{security.* event?}
    H -->|Yes| I["PLAT-NOTIFY-1: dispatch\nin_app always\n+ configured channels (max 3 Slack retries)"]
    H -->|No| J
    I --> J["Return 403 Forbidden\nerror envelope per api-conventions"]
```

**Invariants:**

- RBAC check runs **after** JWT/session-version validation (Flow 1) — a revoked token
  never reaches the RBAC layer.
- `diff_summary` is redacted in any 403 response body — the audit entry stores the full
  value but it is not exposed to the denied actor.
- `security.*` notifications are always delivered regardless of user channel preferences.

## Flow 5: Revocation

**ONE mechanism** (per
[rbac-multi-tenancy §Revocation](../../../../../../standards/rbac-multi-tenancy.md)):
short access-token TTL (≤ 60 s) plus a per-request session-version check against Redis.
There is no token blacklist and no separate logout endpoint that must reach all replicas.
At worst, a revoked user retains access for the remainder of the current token's TTL.

```mermaid
flowchart TD
    A(["Admin: revoke user U"]) --> B["DB: INCREMENT principal_users.session_version\nfor user U, tenant_id = ctx.tenant_id"]
    B --> C["Redis: HSET session_versions\n{tenant_id}:{user_id} version {n+1}\n(atomic — single write, no distributed lock)"]
    C --> D(["Revocation recorded\n(takes effect within ≤ 60 s)"])
    E(["User U: next request\nwith existing JWT"]) --> F["Backend: verify JWT signature\n(Cognito JWKS — still valid)"]
    F --> G["Extract session_version claim\nfrom JWT payload"]
    G --> H["Redis: HGET session_versions\n{tenant_id}:{user_id}"]
    H --> I{JWT claim ==\nRedis version?}
    I -->|Yes — token still live| J(["Request proceeds"])
    I -->|No — token stale| K["401 Unauthorized\naudit: auth.token_revoked"]
    L(["TTL ≤ 60 s"]) -.->|"residual window —\nby design, acceptable"| I
```

**Invariants:**

- `session_version` is stored in both Aurora (`principal_users.session_version`) and
  Redis (`HSET session_versions …`). Redis is the hot path; Aurora is the durable source
  for cache warm-up on Redis miss or restart.
- There is no second revocation mechanism — do not add a token blacklist or a separate
  revoke-and-drain endpoint. Two mechanisms diverge.
- Role binding soft-revoke (`role_bindings.revoked_at`) is enforced by the RBAC lookup
  (Flow 4) — it is a separate control from session revocation.

## Flow 6: Connector OAuth and Ingest Write-Path

M1 scope is **configuration and health** only. Connector ingestion (the `syncing` state)
activates post-M1 when CE-WRITE-1 is available. The isolation invariant — that all writes
land in the requesting tenant's graph only — is defined here for M1 so that the release
gate test can be written now. See the [Connector Lifecycle](#state-machine-connector-lifecycle)
state machine for lifecycle transitions.

```mermaid
flowchart TD
    A(["Admin: configure connector type T\nPUT /api/connectors/{type}/config"]) --> B["Validate body\n(no credential values in payload)"]
    B --> C["Store config to Secrets Manager\npath: weave/{tenant_id}/{type}/credentials\ncredential value never written to Aurora"]
    C --> D["Upsert connector_configs\nlifecycle_state = configured\n(tenant_id enforced by base layer)"]
    D --> E{OAuth-based\nconnector type?}
    E -->|Yes| F["Redirect to provider OAuth URL\n(Atlassian, ServiceNow, Slack)"]
    F --> G["OAuth callback received\nstore refresh token to Secrets Manager\nlifecycle_state = authorized"]
    E -->|No — credential-based| H["Probe health endpoint\nGET /api/connectors/{type}/health"]
    H --> I{Probe success?}
    I -->|Yes| J["lifecycle_state = authorized"]
    I -->|No| K["lifecycle_state = error\nlast_error_redacted (redact_credentials applied)"]
    G --> L(["Configuration complete"])
    J --> L
    K --> L
    M(["Ingest write — post-M1"]) -.-> N["Connector job carries STS-derived\ntenant context (not from payload)"]
    N -.-> O["CE-WRITE-1: write target =\nurn:weave:g:tenant:{ctx.tenant_id}\nderived from context"]
    O -.-> P{Payload names\ndifferent tenant graph?}
    P -.->|Yes — forged target| Q["Reject 403\naudit: security.connector_write_isolation_violation"]
    P -.->|No| R(["Write lands in tenant graph only"])
```

**Invariants:**

- `secret_arn` is stored in `connector_configs`; the credential value is never written
  to Aurora and never returned in any API response.
- `redact_credentials()` is applied before any error message is written to
  `connector_health.last_error_redacted` or returned in a response body.
- Atlassian (Jira + Confluence) = one OAuth family = one `connector_configs` row per tenant.
- The write-target derivation rule (context, not payload) is an M1 release gate —
  `test_connector_write_isolated` validates it (see
  [data-model.md §Isolation Invariants](data-model.md#isolation-invariants)).

## Flow 7: Audit-Export with Tenant-Scope Gate [SEC-5]

**SEC-5 (council backlog):** A workspace-admin exporting audit data sees only their own
tenant's entries. Cross-tenant export (for compliance/forensics at the platform level)
requires a Weave-operator IAM identity — registered in `service_principal_registry` with
`tenant_id IS NULL` and **never assignable** to a client tenant role binding.

```mermaid
flowchart TD
    A(["Principal: GET /api/audit/export\n?from=T1&to=T2"]) --> B["Verify JWT + session_version\n(Redis check)"]
    B -->|Invalid| C["401 Unauthorized"]
    B -->|Valid| D["RBAC: check authority_level ≥ admin\nfor area = platform"]
    D -->|Insufficient| E["403 Forbidden\naudit: rbac.deny (audit_export_attempt)"]
    D -->|Admin| F["Lookup principal in\nservice_principal_registry"]
    F --> G{tenant_id IS NULL\nin registry?}
    G -->|Yes — Weave-operator| H["Operator path:\naccept optional tenant_id param\nto scope export (or export all)"]
    G -->|No — client tenant admin| I["Enforce tenant scope:\nWHERE audit_entries.tenant_id\n= ctx.tenant_id (no override)"]
    H --> J["Query audit_entries\nwith time range + resolved tenant scope"]
    I --> J
    J --> K["Verify hash chain integrity\nbefore streaming"]
    K -->|Chain broken| L["500 Internal Error\nincident alert emitted\ndo not stream broken data"]
    K -->|Chain valid| M["Stream NDJSON export\ndiff_summary redacted\nif requesting role < admin"]
    M --> N(["Export delivered"])
```

**Invariants:**

- Client tenant admins cannot supply a `tenant_id` parameter to override scope —
  the value is always forced to `ctx.tenant_id` from the verified JWT.
- The Weave-operator IAM path (platform-internal identity) is the **only** mechanism
  for cross-tenant audit access. It is unreachable via client tenant OAuth flows.
- Hash-chain verification runs before streaming — broken chain halts the export
  and triggers an incident; partial exports of unverified data are never sent.
- `diff_summary` is redacted at export time for non-admin roles; full content is stored
  in Aurora (see [data-model.md §Audit Entry](data-model.md#audit-entry)).

## State Machine: Connector Lifecycle

```mermaid
stateDiagram-v2
    [*] --> configured : PUT /api/connectors/{type}/config\ncredentials stored in Secrets Manager
    configured --> authorized : OAuth callback received\nOR credential probe succeeds
    configured --> revoked : admin revokes before authorizing
    authorized --> syncing : [post-M1] ingest job triggered
    syncing --> authorized : ingest run completes successfully
    syncing --> error : ingest run fails
    error --> authorized : manual retry OR auto-retry (≤ 3 attempts, exponential backoff)
    error --> revoked : admin revokes
    authorized --> revoked : admin revokes
    revoked --> [*]
```

**State notes:**

| State | Meaning | M1? |
|---|---|---|
| `configured` | Config stored in Secrets Manager; credentials not yet verified | yes |
| `authorized` | Credentials verified; connector ready | yes |
| `syncing` | Active ingest job running in tenant graph | **post-M1** |
| `error` | Last operation failed; `connector_health.last_error_redacted` populated | yes (health probe) |
| `revoked` | Admin-revoked; credentials deleted from Secrets Manager | yes |

## Sequence: Login

Two paths in one diagram — Human (Cognito JWT) and Agent (AWS STS). Both converge on the
Platform API's session-version gate and tenant-context injection.

```mermaid
sequenceDiagram
    participant H as Human browser
    participant NX as Next.js middleware
    participant CG as AWS Cognito
    participant BE as Platform API
    participant RD as Redis
    participant SPR as service_principal_registry

    Note over H,SPR: Human path (Cognito JWT)
    H->>CG: authenticate (credentials / IdP redirect)
    CG-->>H: JWT (TTL ≤ 60 s — sub, tenant_id, session_version)
    H->>NX: GET /dashboard (Authorization: Bearer jwt)
    NX->>BE: forward request + JWT
    BE->>BE: verify JWT signature via Cognito JWKS
    BE->>BE: extract cognito_sub → principal_iri
    BE->>RD: HGET session_versions {tenant_id}:{user_id}
    RD-->>BE: current version N
    alt JWT.session_version != N
        BE-->>NX: 401 Unauthorized + audit: auth.session_version_mismatch
        NX-->>H: redirect to login
    else matches
        BE->>BE: inject tenant context — active graph = framework ∪ tenant:{id}
        BE-->>NX: 200 + response payload
        NX-->>H: rendered page
    end

    Note over H,SPR: Agent path (AWS STS)
    participant AG as Agent process
    participant STS as AWS STS
    AG->>STS: AssumeRole(iam_role_arn)
    STS-->>AG: short-lived STS credentials (TTL ≤ 60 s)
    AG->>BE: POST /api/auth/agent-token (SigV4-signed)
    BE->>STS: GetCallerIdentity (verify STS credentials)
    STS-->>BE: confirmed ARN
    BE->>SPR: lookup by iam_role_arn
    SPR-->>BE: principal_iri + rbac_role
    BE-->>AG: platform token + principal_iri
    AG->>BE: subsequent requests with platform token
```

## Sequence: Audit-Export with Tenant-Scope Gate [SEC-5]

Full call sequence for the SEC-5 scoped export. Shows both the client-admin path
(own-tenant scope enforced) and the Weave-operator path (cross-tenant access).

```mermaid
sequenceDiagram
    participant AC as Actor (admin)
    participant BE as Platform API
    participant RD as Redis
    participant SPR as service_principal_registry
    participant DB as Aurora (audit_entries)

    AC->>BE: GET /api/audit/export?from=T1&to=T2
    BE->>RD: HGET session_versions {tenant_id}:{user_id}
    RD-->>BE: version N
    alt session_version mismatch
        BE-->>AC: 401 Unauthorized
    else valid session
        BE->>BE: RBAC check — authority_level ≥ admin
        alt insufficient authority
            BE-->>AC: 403 Forbidden + audit: rbac.deny
        else admin confirmed
            BE->>SPR: lookup actor principal_iri
            SPR-->>BE: registry row (tenant_id nullable)
            alt tenant_id IS NULL — Weave-operator
                BE->>DB: SELECT ... WHERE tenant_id = :param (or all)\nchain by seq ASC
            else client tenant admin
                BE->>DB: SELECT ... WHERE tenant_id = ctx.tenant_id\n(tenant_id param ignored)
            end
            DB-->>BE: audit_entries in [T1, T2]
            BE->>BE: verify hash chain (SHA-256 re-computation)
            alt chain broken
                BE-->>AC: 500 + incident alert (do not stream)
            else chain valid
                BE-->>AC: stream NDJSON\ndiff_summary redacted for non-admin
            end
        end
    end
```

## Deferred (M2+)

The following flows and interactions are post-M1 and must not be built into M1 Platform:

| Item | Reason |
|---|---|
| Connector ingest flow (syncing state) | Depends on CE-WRITE-1; post-M1 |
| Full ODRL Permission evaluation in RBAC middleware | ADR-002 M2 authority module |
| Multi-user CRDT conflict resolution (Graph Explorer collab) | Explorer Phase 2 |
| Per-user dashboard pin flows (drag/drop, persist) | FR-008 is M2 |
| Workspace widget library management | FR-011 is M2 |
| AI agent authority escalation (HITL Duty + automatable flag) | ADR-002 M2 |
