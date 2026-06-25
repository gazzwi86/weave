---
topic: observability
stack: ts
references:
  - docs/stack-equivalents.md
---

# pino + OpenTelemetry — Node 20: trace correlation, redact config

pino 9, @opentelemetry/sdk-node 0.52+, @opentelemetry/auto-instrumentations-node.
Trace/span IDs are injected into every log line by the pino mixin.

```ts
// src/instrumentation.ts  — import FIRST via --require or NODE_OPTIONS
// Must be the first module loaded: node --require ./dist/instrumentation.js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]:    process.env.SERVICE_NAME    ?? "order-service",
    [SEMRESATTRS_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? "0.0.0",
  }),
  traceExporter:  new OTLPTraceExporter(),   // endpoint from OTEL_EXPORTER_OTLP_ENDPOINT
  metricReader:   new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 30_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http":     { enabled: true },
      "@opentelemetry/instrumentation-express":  { enabled: true },
      "@opentelemetry/instrumentation-pg":       { enabled: true },
      "@opentelemetry/instrumentation-fs":       { enabled: false },   // too noisy
    }),
  ],
});

sdk.start();
process.on("SIGTERM", () => sdk.shutdown().finally(() => process.exit(0)));
```

```ts
// src/logger.ts
import pino from "pino";
import { context, trace } from "@opentelemetry/api";

function otelMixin(): Record<string, string> {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const { traceId, spanId, traceFlags } = span.spanContext();
  return {
    traceId,
    spanId,
    traceSampled: String(traceFlags === 1),
  };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",

  // Inject trace IDs into every log record
  mixin: otelMixin,

  // Redact sensitive fields before writing (supports paths)
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.creditCard",
    ],
    censor: "[REDACTED]",
  },

  // Pretty-print in dev only
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
    : undefined,
});
```

```ts
// Usage
import { logger } from "./logger";

logger.info({ customerId: "cust-123", orderId: "ord-456" }, "order created");
// Output (JSON in prod):
// { "level": 30, "traceId": "abc...", "spanId": "def...", "customerId": "cust-123", "orderId": "ord-456", "msg": "order created" }
```

```bash
# Environment variables (12-factor)
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=order-service
LOG_LEVEL=info
NODE_OPTIONS="--require ./dist/instrumentation.js"
```

**Why:** Trace IDs in logs close the gap between distributed traces and log
lines — one `traceId` query in Grafana shows the full request path. Redact
config prevents credential leaks in structured logs without code changes.
