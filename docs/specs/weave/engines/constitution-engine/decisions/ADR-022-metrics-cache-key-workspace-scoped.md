---
type: Decision
title: "ADR-022: CE-METRICS-1 cache key is (tenant_id, workspace_id), not tenant_id alone"
description: "TASK-007's brief pseudocode frames the 60s cache as 'per-tenant'. The named graph
  counted by /api/metrics/ontology is per-workspace, so a tenant-only cache key would serve one
  caller another caller's workspace numbers whenever both share a tenant -- a cross-workspace data
  leak, not mere staleness. Implementation keys on (tenant_id, workspace_id) instead."
tags: [decision, adr, constitution-engine, metrics, cache, task-007]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-022-metrics-cache-key-workspace-scoped.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-11
owner: gazzwi86
coverage: constitution-engine
---

# ADR-022: metrics cache key includes workspace_id, not tenant_id alone

## Status

**Accepted** — 2026-07-11.

## Context

TASK-007 (CE-METRICS-1, `GET /api/metrics/ontology`) brief's pseudocode describes the 60s
response cache in "per-tenant" terms: cache the aggregate, serve it again for 60 seconds. Read
literally, that suggests a cache key of `tenant_id` alone.

`entity_count_by_kind` and `draft_published_delta` are computed from one workspace's named graph
(`workspace.named_graph_iri`), not from anything tenant-wide -- CE-METRICS-1 has no tenant-rollup
concept anywhere else in the contract. A tenant can have multiple workspaces (ADR on
tenancy-workspace alignment: workspace ~= company, a tenant can hold several). If the cache key
were `tenant_id` alone, caller A viewing workspace 1's metrics and caller B viewing workspace 2's
metrics -- both in the same tenant -- would read/write the same Redis key: whichever call landed
second within the 60s window would silently serve the other workspace's counts. That is a
cross-workspace data leak, not "stale by up to a minute" (which is what a per-tenant key would
actually buy if there were only ever one workspace per tenant).

## Decision

Cache key is `f"ce:metrics:agg:{tenant_id}:{workspace_id}"` (`operations/metrics_cache.py`).
Both `get_cached_metrics` and `store_metrics` take `(client, tenant_id, workspace_id)`. TTL stays
60s as specified (`METRICS_CACHE_TTL_SECONDS`) -- only the key shape changes from the brief's
literal wording, not the freshness budget.

## Consequences

- No cross-workspace leak: two workspaces in the same tenant never collide on a cache key.
- Slightly more Redis keys than a pure per-tenant scheme (one per active workspace instead of one
  per tenant) -- immaterial at 60s TTL and current traffic.
- `routers/metrics.py` already resolves a `Workspace` before touching the cache (workspace-or-404,
  then RBAC), so `workspace.id` is available at the cache call site for free -- no extra query
  needed to key correctly.

## Alternatives considered

- **Tenant-only key (brief's literal wording).** Rejected: cross-workspace data leak as above.
- **Cache disabled until the brief is clarified.** Rejected: AC-007-05 requires the 60s cache
  behaviour to exist and be tested now; correctly-scoped is strictly better than absent.
