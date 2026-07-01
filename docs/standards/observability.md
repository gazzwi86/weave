---
type: Coding Standard
title: Observability — Coding Standard
description: "Application-wide OpenTelemetry conventions: span naming, required attributes, the ADOT pipeline, log correlation, and how PRD latency budgets map to span-based SLOs."
tags: [standards, observability, opentelemetry]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/observability.md
---

# Observability Standards

Every Weave service emits OpenTelemetry (OTel) traces, metrics, and structured logs. This
standard covers the **application-wide request/data plane** — FastAPI handlers, SPARQL queries,
SQLAlchemy calls, connector I/O, and the Next.js/RSC frontend. It defines span naming, required
attributes, the ADOT pipeline, log↔trace correlation, and how the PRD latency budgets become
span-based SLOs.

**Scope boundary.** Agent/LLM observability — Bedrock invocation metrics, eval scores,
hallucination/guardrail counters, token-budget control — lives in `testing-agents.md` and is
**out of scope here**. That standard owns `weave.agent.*` metrics and `AWS/Bedrock/*` alarms;
this standard owns `http.server`, `db.*`, SPARQL, connector, and frontend spans. A single agent
request produces spans in *both* planes joined by one trace id (see "Crossing the boundary").

## Stack

- **SDK:** OpenTelemetry SDK — Python (`opentelemetry-sdk` + `opentelemetry-instrumentation-*`
  for FastAPI, SQLAlchemy, `httpx`, `redis`) and TypeScript (`@opentelemetry/sdk-trace-web`,
  Next.js `instrumentation.ts`).
- **Pipeline:** instrumented service → OTLP/gRPC → **ADOT Collector** (already in the
  confirmed stack) → CloudWatch (traces via X-Ray exporter, metrics as EMF, logs to CloudWatch
  Logs). The ADOT Collector is the *only* egress path; services never write to CloudWatch
  directly.
- **Propagation:** W3C Trace Context (`traceparent`) across every HTTP and SPARQL hop, and
  from the browser through to the API.

## Span naming conventions

Span names are **low-cardinality** — the route template, never the resolved URL. Dynamic values
go in attributes, not the name.

| Plane | Span name pattern | Example |
|---|---|---|
| HTTP server | `{HTTP_METHOD} {route_template}` | `GET /api/brand/tokens` |
| HTTP client (connector/egress) | `{HTTP_METHOD} {host}{route_template}` | `GET snowflake/v1/query` |
| SPARQL | `sparql.{query|update} {operation_name}` | `sparql.query metrics_ontology` |
| Relational (SQLAlchemy) | `db.{operation} {table}` | `db.select widget_definitions` |
| Cache (Redis) | `cache.{op}` | `cache.get` |
| Business operation | `weave.{engine}.{operation}` | `weave.platform.render_widget` |
| Frontend (RSC/route) | `rsc.{segment}` / `nav.{route}` | `rsc.dashboard` |

Rules:

- Never interpolate IDs, IRIs, tenant ids, or query text into a span name — `GET
  /api/widgets/{id}`, not `GET /api/widgets/42`. High-cardinality names break aggregation and
  blow up cost.
- One span per logical unit of work. Wrap a meaningful business operation in a manual span
  (`weave.platform.render_widget`) so the latency SLO has a span to attach to; do not rely on
  the auto HTTP span alone when the budget is about the operation, not the transport.

## Required span attributes

Every span carries the OTel semantic-convention attributes plus the Weave-required set below.
Missing a required attribute on a production span is a review-blocking defect.

| Attribute | On | Notes |
|---|---|---|
| `weave.tenant_id` | every server span | tenant isolation is core; enables per-tenant SLO + cost slicing |
| `weave.user_id` | request-scoped spans | omit / null on machine (agent/STS) calls |
| `weave.engine` | every span | `platform` \| `constitution` \| `build` \| `events` \| `explorer` |
| `weave.request_id` | request-scoped spans | also emitted in correlated logs |
| `http.request.method`, `http.route`, `http.response.status_code` | HTTP spans | OTel semconv |
| `db.system`, `db.operation`, `db.sql.table` | relational spans | OTel semconv; **never** put raw SQL with interpolated user input in attributes (see Security) |
| `weave.sparql.operation` | SPARQL spans | `query` \| `update`; record graph/dataset name, never the full query string if it can contain PII |
| `weave.data_source_contract` | dashboard widget spans | e.g. `CE-METRICS-1` — backs the widget footer label (Platform E1-S1) |
| `weave.budget_capped` | spans halted by budget | boolean; set when generation halts mid-stream (Platform E1-S1) |

**Never** record secrets, raw credentials, full tokens, passwords, or PII as span attributes
(project security rules). Attribute values are sampled into traces and retained — treat them as
logged data.

## Log correlation

Logs are structured JSON and **always** carry the active `trace_id` and `span_id` so a log line
joins its trace in CloudWatch.

- Inject `trace_id` / `span_id` via the OTel logging integration
  (`LoggingInstrumentor` in Python; the Next.js logger wraps the active context).
- Every log line includes `weave.tenant_id`, `weave.request_id`, `weave.engine` and a `level`.
- Do not log sensitive data (passwords, tokens, PII) — same rule as span attributes.
- A request's `weave.request_id` is also returned in an `X-Request-Id` response header so a user
  / support can pivot from a UI error to the trace.

## PRD latency budgets → span-based SLOs

The Platform PRD §Performance budgets are **provisional product defaults**, not contractual
SLAs (PRD explicitly: "owner Architect, validated against real telemetry"). Each budget maps to
a named span; the SLO is measured on that span's duration percentile. The numeric thresholds
below are the PRD defaults — **tunable**, and to be validated in the tech spec.

| PRD budget (Platform §Performance) | SLO span | Threshold (default, provisional) |
|---|---|---|
| Dashboard initial load (CE-sourced starters, no prompt) | `weave.platform.dashboard_initial_load` | p95 ≤ 2 s |
| Generative widget — streaming header appears | `weave.platform.render_widget` (time-to-first-token child span) | p?? ≤ 1 s (header) |
| Generative widget — fully rendered (≤ 1,000 points) | `weave.platform.render_widget` | p95 ≤ 5 s |
| Global search | `GET /api/search` | p95 ≤ 300 ms (after 150 ms debounce) |
| Notification in-app delivery | `weave.platform.notify_deliver` | ≤ 30 s |
| Workspace switch | `weave.platform.workspace_switch` | p95 ≤ 2 s |

Conventions for the mapping:

- The budget is asserted on the **business span**, not the raw HTTP span, so retries/streaming
  framing don't distort it. Streaming "time-to-first-token" (the 1 s header budget) is a child
  span (`...render_widget → first_token`) so it is measured independently of full render.
- Each SLO is a CloudWatch alarm over the span-duration metric (latency p95/p99), sliced by
  `weave.tenant_id` and `weave.engine`. Alarm thresholds are configurable defaults; the alarm
  config records its window + aggregation, consistent with the Platform monitoring ACs
  (PRD E9 "every numeric threshold is a configurable default and provisional").
- A budget breach is a *signal*, not a hard failure — it feeds the Weave self-improvement
  signal set (Platform E9: "latency regression", "p99 latency > default 25% vs 7-day rolling
  p99"), not a user-facing 500.
- The agent-side latency SLO (`AWS/Bedrock/InvocationLatency` p99 > 10 s) stays in
  `testing-agents.md`; do not duplicate it here.

## Crossing the agent boundary

When a request invokes an agent (e.g. dashboard widget generation calls an LLM), the **same
trace id** spans both planes:

- The application span (`weave.platform.render_widget`, this standard) is the parent.
- The Bedrock invocation span and `weave.agent.*` metrics (testing-agents.md) are children of
  that trace.

This is the single join point: an SRE pivots from a slow `render_widget` span to the child
agent span without leaving the trace. Keep the boundary clean — application attributes on
application spans, agent attributes on agent spans, one trace id over both.

## Definition of done (per service / endpoint)

- [ ] FastAPI / SQLAlchemy / httpx / Redis auto-instrumentation enabled; exports via OTLP to
      the ADOT Collector (no direct CloudWatch writes).
- [ ] Span names are low-cardinality route templates; IDs/IRIs/query text are attributes.
- [ ] Every server span carries `weave.tenant_id`, `weave.engine`, `weave.request_id`.
- [ ] No secret / PII in any span attribute or log line.
- [ ] Logs are structured JSON with `trace_id` + `span_id`; `X-Request-Id` returned to client.
- [ ] Each endpoint with a PRD latency budget has its named business span and a CloudWatch p95
      alarm sliced by tenant/engine.
- [ ] W3C trace context propagates browser → API → SPARQL/DB and into agent child spans.
