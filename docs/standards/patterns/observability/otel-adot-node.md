---
type: Coding Standard
title: "Observability — pino + OpenTelemetry Node SDK exported via ADOT (typescript)"
description: "Golden pattern for a Next.js Node service: bootstrap the OpenTelemetry Node SDK in instrumentation.ts exporting OTLP/gRPC to the ADOT Collector (the only egress to CloudWatch), wrap business work in a manual span carrying the Weave-required attributes (weave.tenant_id/user_id/engine/request_id) with low-cardinality names, and emit structured pino logs correlated by trace_id/span_id — never logging secrets or PII."
tags: [standards, patterns, observability, typescript]
timestamp: 2026-07-01
resource: docs/standards/patterns/observability/otel-adot-node.md
topic: observability
stack: typescript
verification: "esbuild 0.28.1 transform-mode syntax check of both ts blocks via `npx esbuild <tmp>.ts --bundle=false` (extension-based loader) — PASS 2026-07-01"
---

# Observability — pino + OpenTelemetry Node SDK exported via ADOT (typescript)

## Intent

Every Node service emits OTel traces/logs to the **ADOT Collector over OTLP/gRPC** — the only
path to CloudWatch; services never write CloudWatch directly (`observability.md`). The SDK is
bootstrapped once in Next.js `instrumentation.ts`. Business work is wrapped in a **manual span**
with a **low-cardinality name** (route template / `weave.{engine}.{operation}`, never a resolved
URL or IRI) and the Weave-required attributes: `weave.tenant_id` (every server span),
`weave.user_id` (null on machine calls), `weave.engine`, `weave.request_id`. Logs are structured
pino JSON carrying `trace_id`/`span_id` so a log line joins its trace. Secrets, tokens, raw SQL
with user input, and PII are never recorded as attributes or log fields.

```ts
// instrumentation.ts  — Next.js runs register() once before the app boots
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return; // OTel Node SDK is Node-only, not edge

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-grpc');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'weave-platform',
      [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '0.0.0',
      'weave.engine': 'platform',
    }),
    // OTLP/gRPC -> ADOT Collector -> CloudWatch. Endpoint is the collector, never CloudWatch.
    traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    instrumentations: [getNodeAutoInstrumentations()], // W3C traceparent propagation on by default
  });

  sdk.start();
}
```

```ts
// lib/observability.ts  — manual business span + correlated pino logger
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api';
import pino from 'pino';

const tracer = trace.getTracer('weave-platform');

// Structured JSON logs. A mixin injects the active trace ids so a log joins its trace.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: ['req.headers.authorization', '*.password', '*.token', '*.secret'], remove: true },
  mixin() {
    const span = trace.getSpan(context.active());
    const ctx = span?.spanContext();
    return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
  },
});

export interface RequestScope {
  tenantId: string;
  userId: string | null; // null on machine (STS/agent) calls
  requestId: string;
  engine: 'platform' | 'constitution' | 'build' | 'events' | 'explorer';
}

// Wrap a logical unit of work in one span carrying the Weave-required attributes.
export async function withBusinessSpan<T>(
  operation: string, // low-cardinality: e.g. 'render_widget' -> span 'weave.platform.render_widget'
  scope: RequestScope,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`weave.${scope.engine}.${operation}`, async (span) => {
    span.setAttributes({
      'weave.tenant_id': scope.tenantId,
      'weave.user_id': scope.userId ?? undefined,
      'weave.engine': scope.engine,
      'weave.request_id': scope.requestId,
      // Never set secrets, raw SQL with user input, IRIs, or PII as attributes.
    });
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      // Record the failure shape, not the sensitive payload.
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'operation_failed' });
      logger.error({ ...scope, event: 'operation_failed' }, 'business operation failed');
      throw err;
    } finally {
      span.end();
    }
  });
}
```

**Why**

- `register()` in `instrumentation.ts` is Next.js's official bootstrap hook; guarding on
  `NEXT_RUNTIME === 'nodejs'` keeps the Node-only SDK off the edge runtime, and the dynamic
  `import()` avoids bundling the SDK into edge/client output.
- The exporter is `OTLPTraceExporter` (gRPC) pointed at the **ADOT Collector** endpoint — the
  collector forwards to CloudWatch (X-Ray/EMF). Application code never talks to CloudWatch.
- Span names are low-cardinality: `weave.{engine}.{operation}`. Dynamic values (tenant, user,
  request id) go in **attributes**, never the name, so aggregation and cost stay bounded.
- The four required attributes are set on every business span; `weave.user_id` uses `undefined`
  (dropped by the SDK) for machine calls rather than a fake value.
- The pino `mixin` injects `trace_id`/`span_id` into every log line, so a UI error → request id
  → log → trace pivot works end to end. `auto-instrumentations-node` gives W3C `traceparent`
  propagation for free.

**Security**

- `redact` strips `authorization`, `*.password`, `*.token`, `*.secret` from logs before they
  are written — defence in depth even if a caller passes a sensitive field.
- Attribute-setting explicitly excludes secrets, raw SQL containing user input, full tokens,
  and PII: attribute values are sampled into traces and retained, so they are treated as logged
  data.
- On error the span status message and log use a generic `operation_failed` shape — the raw
  error/payload is not serialised into telemetry.
- The OTLP endpoint comes from env (the collector address); no CloudWatch credentials live in
  app code.

**Anti-patterns**

- Interpolating an id/IRI/tenant/query into the span name (`weave.platform.render_widget/42`) —
  high cardinality breaks aggregation and inflates cost.
- Exporting straight to CloudWatch or X-Ray from the app instead of through ADOT.
- Logging the raw request/response, an auth header, or a DB row with PII.
- Bootstrapping the SDK inside a request handler (re-inits per request) instead of once in
  `instrumentation.ts`.
- Omitting a required `weave.*` attribute on a server span — a review-blocking defect.
