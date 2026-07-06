---
type: Task
title: "Task: TASK-008 — Webhook & Cron Triggers"
description: "The unauthenticated ingress (ADR-005): opaque-token tenant resolution, required HMAC,
  size caps, Redis rate limits, typed DLQ rejections, schema inference — plus EventBridge cron
  triggers with human-readable preview."
tags: [events-actions-engine, arch, task, phase-1, post-v1]
status: Backlog
priority: Must Have
entity: events-actions-engine
epic: EPIC-004
milestone: post-v1
created: 2026-07-06
blocked_by: ["TASK-004"]
unlocks: ["TASK-015"]
adr_refs: [ADR-005, ADR-001]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [events-actions-engine.md](../../../events-actions-engine.md)
Contracts: [contracts.md](../../../../contracts.md) · Flow:
[business-process.md §Webhook Ingestion](../../tech-spec/business-process.md)

## Story

As an integration engineer, I want to configure webhook and schedule triggers so that any system
that can POST HTTP — or the clock — can start an automation, without the endpoint becoming a
tenant-isolation or abuse hole.

## Scope Note

Implements E4-S1 (webhook) + the cron half of E4-S3 (ADR-005): the API Gateway + ingest Lambda
path with the ordered security checks, `webhook_endpoint` issuance at activation, event-schema
inference ("Send test event"), and EventBridge Scheduler integration (cron expression +
human-readable preview, interval, calendar modes) feeding the same SQS envelope. Connector-backed
triggers (Jira/ServiceNow/Slack) are TASK-009. Node-inspector UI rides TASK-014.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-008-01 | WHEN a webhook trigger is configured THE SYSTEM SHALL issue an endpoint URL whose path embeds an opaque tenant+automation token (≥ 128-bit, unguessable), resolved server-side BEFORE any tenant-scoped resource is touched; tenant SHALL never be inferred from the request body. |
| AC-008-02 | WHERE the automation drives a write or external action THE SYSTEM SHALL REQUIRE HMAC-SHA256 verification (secret in AWS Secrets Manager, referenced — never stored in the definition), constant-time compared; HMAC is optional only for read-only/no-side-effect automations. |
| AC-008-03 | WHEN an inbound payload fails a check THE SYSTEM SHALL reject and route to DLQ with the typed reason — `unknown_endpoint` (404, no existence oracle), `payload_too_large` (default 256 KB, tunable), `signature_invalid` (401), `rate_limited` (429; Redis counter, default 100 req/min per endpoint, tunable), `schema_mismatch` — in that check order. |
| AC-008-04 | WHEN a valid event is accepted THE SYSTEM SHALL enqueue the standard envelope (run_id derived from the trigger event ID) and return `202 {run_id}` — never executing inline; ingest ack p95 ≤ 150 ms. |
| AC-008-05 | WHEN "Send test event" is used THE SYSTEM SHALL infer the event schema from the first test (or accept a manual schema) and store it on the endpoint for subsequent validation. |
| AC-008-06 | WHEN a cron trigger is configured THE SYSTEM SHALL accept cron syntax with a human-readable preview, interval (every N min/hours), and calendar-based (first/next business day) modes, registering an EventBridge schedule that enqueues the same envelope; accuracy within ± 30 s (default, tunable). |
| AC-008-07 | WHEN an automation is deactivated/deleted THE SYSTEM SHALL disable its endpoints and schedules atomically with the status change (no orphaned live ingress). |

## API Contracts

No inter-engine contracts consumed at ingest (deliberately — the trust boundary touches nothing
until tenant resolution). Public surface: `POST /hooks/{opaque_token}`. Internal: endpoint/schedule
CRUD under `/api/automations/{id}/triggers`.

## Diagram

Flow diagram: [business-process.md §Webhook Ingestion Flow](../../tech-spec/business-process.md)
(ordered checks → typed DLQ → 202). Cron: EventBridge Scheduler → same SQS envelope.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| API GW + thin Lambda; checks in one handler | One auditable trust boundary; serverless at mid-market volume | ADR-005 |
| Token lookup FIRST, 404 without existence oracle | No tenant-scoped read before resolution; no endpoint enumeration | E4-S1, arch D3 |
| Redis fixed-window rate limit per endpoint | API GW cannot key on dynamic path token | ADR-005 §1 |
| Rejects are DLQ rows, not just status codes | Operators must inspect abuse/misconfig; typed reasons drive triage | E4 epic AC |
| Cron via EventBridge Scheduler, not a poller | Managed accuracy; zero always-on compute | stack / ADR-005 §Consequences |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Check ordering (token→size→HMAC→rate→schema); each rejection typed | AC-008-03 |
| Unit | Constant-time HMAC compare; secret loaded by reference only | AC-008-02 |
| Unit | Cron preview rendering + calendar-mode next-fire computation | AC-008-06 |
| Integration | Full path vs LocalStack + fakeredis: 202 + envelope on queue | AC-008-04 |
| Integration | Burst over rate limit → 429 + dlq rows; window resets | AC-008-03 |
| Integration | Schema inference on first test event; subsequent mismatch rejected | AC-008-05 |
| Integration | Deactivate → endpoint 404s and schedule disabled atomically | AC-008-07 |

## Dependencies

- **blocked_by**: TASK-004 (envelope + queue)
- **unlocks**: TASK-015 (activation issues endpoints/schedules)

## Cost Estimate

**M** — the checks are individually simple; the rigour is in ordering, the no-oracle property,
and load-profile testing (the reject path must stay cheap).

## DoR Checklist

- [ ] ADR-005 approved (transport + limits + ack contract)
- [ ] TASK-004 envelope schema frozen
- [ ] Secrets Manager naming convention for HMAC secrets agreed
- [ ] Rate-limit/body-cap defaults registered in the TASK-002 catalogue

## DoD Checklist

- [ ] All ACs pass (unit + integration)
- [ ] Locust profile: 200 rps with 10% invalid signatures — reject path ≤ accept path cost
- [ ] No payload logged at any level (hash only); no token logged beyond last 4 chars
- [ ] Semgrep/SAST clean on the handler (it is the public attack surface)
- [ ] Coverage ≥ 80%, mutation ≥ 70% on the check chain

## Implementation Hints

Generate tokens with `secrets.token_urlsafe(32)`. Verify `Content-Length` before reading the body
where present, and enforce the cap during streaming read regardless (a lying header must not
win). The HMAC secret is created at activation and stored in Secrets Manager by ARN on the
endpoint row — the definition carries nothing. Calendar-based cron ("next business day") needs a
tenant-timezone setting: add it to the TASK-002 catalogue rather than assuming UTC.
