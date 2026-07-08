---
type: Task Brief
title: "Task: TASK-025 — OAuth authorization-code connector auth (authorize + callback, v1.0)"
description: "The OAuth 2.0 authorization-code flow for OAuth-type connectors (Atlassian,
  ServiceNow, Slack): signed-state redirect to provider consent, callback code→token exchange,
  access+refresh tokens write-only to AWS Secrets Manager, lifecycle configured→authorized,
  refresh-token rotation for the sync worker. Closes the dangling authorized-transition edge
  referenced by data-model.md, v1-delta.md, TASK-006 and TASK-019."
tags: [weave-platform, arch, task, v1, connectors, oauth]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-006]
unlocks: [TASK-019]
adr_refs: [ADR-016, ADR-017]
---

# Task: TASK-025 — OAuth authorization-code connector auth (authorize + callback, v1.0)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Delta:** [v1-delta.md](../../tech-spec/v1-delta.md) ·
**Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-007 Connector Config & Health — E7-S1 / FR-031 (OAuth portion of connector
configuration; business-process.md Flow 6 "OAuth-based connector type? → Yes" branch)
**Priority:** Must Have

**As a** company admin configuring an OAuth-type connector (Atlassian, ServiceNow, Slack)
**I want** to authorize Weave against the provider through the standard consent screen
**So that** the connector reaches `authorized` and can sync, without Weave ever seeing or
storing my provider password.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN an admin calls `GET /api/connectors/{type}/oauth/authorize` for an OAuth type with a `configured` row (TASK-006), THE SYSTEM SHALL 302 to the provider consent URL with `response_type=code`, the pinned per-type scopes, PKCE `code_challenge` (S256), a **fixed registered redirect URI** (env config, never derived from the request), and `state` = a signed nonce binding `(tenant_id, connector_type, user_sub, expiry ≤ 10 min)`. | unit: `test_authorize_redirects_with_signed_state_and_pkce` |
| AC-2 | WHEN the provider calls back `GET /api/connectors/oauth/callback?code=…&state=…`, THE SYSTEM SHALL verify the state signature, expiry, and tenant binding BEFORE any token exchange; IF verification fails THEN THE SYSTEM SHALL return 400 `{"error":"invalid_state"}`, exchange nothing, and leave `lifecycle_state` unchanged. | unit: `test_callback_rejects_bad_or_expired_state` |
| AC-3 | WHEN state verifies, THE SYSTEM SHALL exchange the code (+ PKCE verifier) at the provider token endpoint and store the access + refresh tokens **exclusively in AWS Secrets Manager** (upsert into the existing `weave/{tenant_id}/{connector_type}/credentials` secret via `put_secret_value` — ARN in `connector_configs.secret_arn` preserved, TASK-006 AC-7 semantics); NO API response, log line, or audit entry SHALL ever contain a token value (reference/ARN only). | unit: `test_tokens_stored_write_only_never_echoed` |
| AC-4 | WHEN the token exchange succeeds, THE SYSTEM SHALL set `lifecycle_state = 'configured' → 'authorized'` (state machine in business-process.md), set `next_sync_at` (ADR-016 poller claim key), upsert `connector_health.status='connected'`, emit `platform.connector.authorized` to PLAT-AUDIT-1 (actor = the admin principal IRI from state), and redirect the browser to the connector settings page with a success banner. | integration: `test_callback_authorizes_and_sets_next_sync_at` |
| AC-5 | IF the provider returns an error (`error=access_denied`, token endpoint 4xx/5xx, or timeout) THEN THE SYSTEM SHALL fail closed: `lifecycle_state` stays `configured`, `connector_health.status='disconnected'` with `last_error_redacted` (via `redact_credentials()`), no partial secret write, and the settings page shows the named failure. | integration: `test_provider_error_fails_closed_no_partial_secret` |
| AC-6 | WHEN a driver requests a token via `oauth_token_manager.get_access_token(config)` and the access token is expired, THE SYSTEM SHALL refresh it with the stored refresh token; WHERE the provider rotates refresh tokens, THE SYSTEM SHALL persist the NEW refresh token in the same Secrets Manager upsert (rotation-safe); IF the refresh is rejected (revoked) THEN THE SYSTEM SHALL set `lifecycle_state='error'`, `connector_health.status='disconnected'`, and emit PLAT-NOTIFY-1 `connector-degraded`. | integration: `test_refresh_rotation_and_revoked_refresh_fails_closed` |
| AC-7 | WHEN any provider authorize/token endpoint URL is resolved (including tenant-supplied instance hosts, e.g. `https://{instance}.service-now.com`), THE SYSTEM SHALL validate it through the shared `ssrf_guard` (v1-delta §2a, TASK-006 AC-10): HTTPS only, per-type allowed-domain suffix list, resolved IPs outside loopback/link-local (incl. `169.254.169.254`)/RFC-1918/CGNAT/IPv6-ULA; violations → 422 `{"error":"endpoint_not_allowed"}`. | unit: `test_oauth_endpoints_ssrf_guarded` (parametrised) |
| AC-8 | WHEN authorize or callback is invoked for a non-OAuth type (`snowflake`, `databricks`, `aws`, `azure_data_lake`) THE SYSTEM SHALL return 400 `{"error":"not_oauth_type"}`; WHEN invoked by a caller whose tenant does not own the `configured` row THE SYSTEM SHALL return 403 with zero cross-tenant data (rows are RLS/tenant-scoped). | integration: `test_non_oauth_type_400_and_cross_tenant_403` |

## Implementation

### Pseudocode

```text
# OAuth auth-code flow (packages/backend/connectors/oauth.py)
OAUTH_TYPES = {"atlassian", "servicenow", "slack"}          # Flow 6 OAuth branch
PROVIDERS = {  # per-type metadata, data not code (next to SUPPORTED_TYPES, TASK-006)
  "atlassian":  {auth_url, token_url, scopes: [...]},       # one family = Jira+Confluence
  "servicenow": {auth_url: f"https://{instance}.service-now.com/oauth_auth.do", ...},
  "slack":      {auth_url: "https://slack.com/oauth/v2/authorize", ...},
}

def authorize(tenant_id, connector_type, user_sub):
  cfg = connector_configs row (RLS-scoped)                   # 404 if absent; 400 if not OAUTH_TYPES
  provider = PROVIDERS[connector_type]
  ssrf_guard.validate_url(connector_type, provider.auth_url) # AC-7 (instance hosts vary)
  verifier, challenge = pkce_pair()                          # store verifier server-side w/ state
  state = sign({tenant_id, connector_type, user_sub, exp: now()+10min, nonce})
  cache.put(state.nonce, verifier, ttl=10min)
  return 302 provider.auth_url?response_type=code&client_id&scope&state
             &code_challenge=challenge&code_challenge_method=S256
             &redirect_uri=REGISTERED_REDIRECT_URI           # fixed per env, never from request

def callback(code, state):
  claims = verify_signature_and_expiry(state)                # AC-2: verify BEFORE exchange
  cfg = connector_configs row for (claims.tenant_id, claims.connector_type)
  ssrf_guard.validate_url(cfg.connector_type, provider.token_url)
  tokens = POST provider.token_url {grant_type: authorization_code, code,
                                    code_verifier: cache.pop(claims.nonce),
                                    redirect_uri: REGISTERED_REDIRECT_URI}   # timeout 8s
  if provider_error: fail_closed(cfg)                        # AC-5: no partial write
  secrets_manager.upsert(cfg.secret_name,                    # put_secret_value — ARN stable
      merge(existing, {access_token, refresh_token, expires_at}))
  cfg.lifecycle_state = "authorized"; cfg.next_sync_at = now()
  upsert connector_health(status="connected", last_checked_at=now())
  audit.emit(actor=claims.user_sub → principal IRI, event="platform.connector.authorized",
             target=f"urn:weave:connector:{claims.tenant_id}:{cfg.handle}")  # no token values
  return 302 /settings/connectors?authorized={type}

# Refresh-token rotation (consumed by TASK-018/019 drivers)
def get_access_token(cfg) -> str:
  secret = secrets_manager.get(cfg.secret_arn)
  if secret.expires_at > now() + 60s: return secret.access_token
  new = POST provider.token_url {grant_type: refresh_token, refresh_token: secret.refresh_token}
  if rejected: cfg.lifecycle_state="error"; health="disconnected"; notify connector-degraded  # AC-6
  secrets_manager.upsert(cfg.secret_name, merge(secret, new))  # rotated refresh token persisted
  return new.access_token
```

### API Contracts

**Endpoint:** `GET /api/connectors/{type}/oauth/authorize` — p95 **150 ms** (v1-delta §5)

**Response (302):** `Location: <provider consent URL>` (state = signed nonce, PKCE S256).
**Response (400):** `{"error":"not_oauth_type"}` · **(404):** no configured row ·
**(422):** `{"error":"endpoint_not_allowed"}` (SSRF guard).

---

**Endpoint:** `GET /api/connectors/oauth/callback?code=…&state=…` — p95 **800 ms**
(code→token exchange; v1-delta §5)

**Response (302):** redirect to `/settings/connectors` (success banner; no token in URL).
**Response (400):** `{"error":"invalid_state"}` · provider failure → fail-closed per AC-5.
Token values appear in NO response shape — Secrets Manager reference only.

### Diagram References

| Diagram | Notes |
|---------|-------|
| Flow 6: Connector OAuth and Ingest Write-Path | [`tech-spec/business-process.md`](../../tech-spec/business-process.md) — the "OAuth-based? → Yes" branch this task implements |
| Connector Lifecycle state machine | [`tech-spec/business-process.md`](../../tech-spec/business-process.md) — `configured → authorized` via "OAuth callback received" |
| Component delta (Connector Service, OAuth authcode box) | [`tech-spec/v1-delta.md`](../../tech-spec/v1-delta.md) §1 |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| OAuth types reach `authorized` ONLY via this callback; credential types via TASK-006's probe | data-model.md `lifecycle_state` note; v1-delta §3 poller gate | TASK-006 skips the probe for OAUTH_TYPES; this task owns their only authorized-transition |
| Tokens write-only to Secrets Manager; `secret_arn` is the single reference | data-model.md canonical schema; TASK-006 AC-1/AC-7 | `put_secret_value` upsert into the existing secret; ARN (and its IAM bindings) stable across authorize + every rotation |
| `next_sync_at` set at authorization | ADR-016 poller claim key | Poller claims the row only after this task's AC-4 transition |
| Shared `ssrf_guard` on all provider endpoints | v1-delta §2a; TASK-006 AC-10 | Same module, same allowed-domain suffix lists; no second validator |
| Atlassian = one OAuth family (Jira + Confluence) | contracts.md PLAT-CONNECTOR-1 | One consent, one token set, one config row per tenant |
| Slack bot token MAY also be supplied directly at config | TASK-022 (pinned bot scopes) | TASK-022 does not hard-depend on this task; this flow is the self-serve path |
| Write-back allowlist unchanged | ADR-017 | Authorization grants tokens; it never widens `sync_direction` |

## Test Requirements

### Unit Tests (minimum 4)

- `test_authorize_redirects_with_signed_state_and_pkce` — 302 carries state (verifiable
  signature, ≤ 10 min expiry, tenant binding), S256 challenge, registered redirect URI only
- `test_callback_rejects_bad_or_expired_state` — tampered signature / expired / nonce reuse
  ⟹ 400 `invalid_state`, zero token-endpoint calls (spy), lifecycle unchanged
- `test_tokens_stored_write_only_never_echoed` — mock exchange; assert `put_secret_value`
  payload has tokens; assert every response body/log/audit record contains none
- `test_oauth_endpoints_ssrf_guarded` — parametrised: private/metadata/HTTP/off-suffix
  provider URLs ⟹ 422 `endpoint_not_allowed`
- `test_non_oauth_type_returns_400` — `snowflake` authorize ⟹ 400 `not_oauth_type`

### Integration Tests (minimum 3)

- `test_callback_authorizes_and_sets_next_sync_at` — full authorize→callback against a local
  mock provider (Law F): lifecycle `configured→authorized`, `next_sync_at` set, health
  `connected`, PLAT-AUDIT-1 `platform.connector.authorized` emitted
- `test_provider_error_fails_closed_no_partial_secret` — token endpoint 500 / `access_denied`
  ⟹ lifecycle stays `configured`, health `disconnected`, `last_error_redacted` populated,
  Secrets Manager write count = 0
- `test_refresh_rotation_and_revoked_refresh_fails_closed` — expired access token ⟹ refresh;
  rotated refresh token persisted (next read returns it); revoked refresh ⟹ `error` +
  `disconnected` + PLAT-NOTIFY-1 `connector-degraded`
- `test_non_oauth_type_400_and_cross_tenant_403` — tenant B calls tenant A's callback state
  ⟹ 403, zero cross-tenant rows

### E2E Tests (minimum 1)

- `test_connector_oauth_connect_ui` — Playwright + mock provider: connector settings →
  "Connect" on Atlassian → consent (mock) → redirected back → status chip "Authorized";
  backend row asserts `lifecycle_state='authorized'` (Plugin Law B: UI + backend state)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_authorize_redirects_with_signed_state_and_pkce` |
| AC-2 | Unit | `test_callback_rejects_bad_or_expired_state` |
| AC-3 | Unit | `test_tokens_stored_write_only_never_echoed` |
| AC-4 | Integration + E2E | `test_callback_authorizes_and_sets_next_sync_at`, `test_connector_oauth_connect_ui` |
| AC-5 | Integration | `test_provider_error_fails_closed_no_partial_secret` |
| AC-6 | Integration | `test_refresh_rotation_and_revoked_refresh_fails_closed` |
| AC-7 | Unit | `test_oauth_endpoints_ssrf_guarded` |
| AC-8 | Unit + Integration | `test_non_oauth_type_returns_400`, `test_non_oauth_type_400_and_cross_tenant_403` |

## Dependencies

- **blocked_by:** TASK-006 (config rows, Secrets Manager upsert plumbing, `ssrf_guard`,
  health rows — this task authorizes OAuth-type configs TASK-006 creates)
- **unlocks:** TASK-019 (Atlassian ingest/write-back needs an `authorized` row; ServiceNow
  TASK-020 reaches this transitively via TASK-019; Slack TASK-022 can alternatively use a
  directly-configured bot token, so it does not hard-depend here)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~45K input, ~20K output
- **Estimated cost:** ~$3

## Definition of Ready Checklist

- [x] User story clear (E7-S1/FR-031 OAuth portion; Flow 6 OAuth branch)
- [x] All ACs have mapped tests
- [x] Pseudocode provided (authorize, callback, fail-closed, rotation)
- [x] Endpoints + p95 targets pinned (v1-delta §5: 150 ms authorize, 800 ms callback)
- [x] Secrets handling pinned (write-only upsert, ARN stable, never echoed)
- [x] SSRF guard reuse pinned (v1-delta §2a, shared module)
- [ ] TASK-006 complete

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Token values appear in zero API responses, logs, and audit entries (grep + spy verified)
- [ ] State is signed, expiring, tenant-bound, single-use (nonce cache popped)
- [ ] Fail-closed on every provider error path — no partial secret, lifecycle honest
- [ ] Refresh rotation persists the new refresh token; revoked refresh degrades honestly
- [ ] `ssrf_guard` covers authorize + token + instance-host URLs (parametrised test)
- [ ] Mock provider only in tests — no real provider calls (Plugin Law F)
- [ ] Connector settings page (Connect button, success/failure banners) passes the E0-S5 gate:
      Lighthouse 100, axe-core 0 violations (WCAG 2.1 AA)
- [ ] Coverage ≥ 80%; mutation ≥ 60% for the oauth module
- [ ] Conventional commit: `feat: add OAuth authorization-code connector auth`

## Implementation Hints

- Sign `state` with the platform's existing session-signing key (HMAC-SHA256) — no new key
  infrastructure; the nonce cache is the existing Redis (TTL 10 min, `GETDEL` for single-use).
- Merge tokens into the existing credentials secret rather than a second secret: one ARN per
  connector keeps IAM policies and TASK-006's rotation semantics intact.
- ServiceNow instance hosts are tenant-supplied — build the auth/token URLs from the stored
  config's validated instance value, then re-validate through `ssrf_guard` at use (DNS-rebind
  aware: pin the resolved IP into the transport, same as TASK-006 hint).
- Clock-skew: treat `expires_at - 60 s` as expired so a token never dies mid-request.
- Keep provider metadata (URLs, scopes) as data beside `SUPPORTED_TYPES`; drivers never
  hard-code endpoints.
- The callback is unauthenticated by nature (browser redirect) — the signed state IS the auth;
  never trust query params beyond `code` + verified `state`.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
