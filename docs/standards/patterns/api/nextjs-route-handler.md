---
type: Coding Standard
title: "API — Next.js 15 App Router Route Handler (typescript)"
description: "Golden pattern for an App Router route.ts handler: TS strict, zod-validated body/params, typed NextResponse, the Weave single error envelope, no secrets on the client."
tags: [standards, patterns, api, typescript]
timestamp: 2026-07-01
resource: docs/standards/patterns/api/nextjs-route-handler.md
topic: api
stack: typescript
verification: "esbuild 0.28.1 transform-mode syntax check of the 1 ts block via `npx esbuild <tmp>.ts --bundle=false` (extension-based loader) — PASS 2026-07-01. NOTE: esbuild checks syntax only, NOT types; tsc --strict conformance was reasoned by eye (no code changed this pass — deployment-model note added only)."
---

# API — Next.js 15 App Router Route Handler (typescript)

**Deployment model:** Weave's **primary API is the separate FastAPI backend**; the SPA
(`frontend/nextjs-shadcn-component.md`) is a static export on CloudFront + S3 with no per-request
Next.js server runtime. A Next.js route handler like this is therefore a **BFF / edge-adjacent
concern only** — a thin server-side proxy or token broker deployed on its own compute (e.g. Lambda
/ a Node server), **not** part of the static S3 bundle and **not** the place general application
logic lives. Because it reads secrets it pins `runtime = 'nodejs'` (never edge). Reach for it only
when the SPA genuinely needs a same-origin server hop; most calls go straight to FastAPI.

## Intent

A Next.js 15 App Router route handler (`app/api/**/route.ts`) is a server-only
boundary. It must: validate every input with zod before touching a service, return a
typed `NextResponse`, map failures to the **single Weave error envelope**
(`api-conventions.md`), honour the status-code contract (`422` = SHACL/validation,
`403` = RBAC denial, `429` = rate/quota with `Retry-After`), and never leak a secret,
stack trace, or PII into the response. Business logic lives in a service module, not the
handler — the handler stays under the 50-line budget and under cyclomatic 10.

```ts
// app/api/v1/projects/[projectId]/nodes/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs';

// -- error envelope (matches api-conventions.md) ------------------------------
interface ErrorEnvelope {
  error: {
    code: string; // stable snake_case slug — clients branch on this, never message
    message: string; // human-readable, never contains secrets/PII
    status: number;
    details?: unknown;
    request_id: string;
  };
}

class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function envelope(err: ServiceError, requestId: string): NextResponse<ErrorEnvelope> {
  const headers =
    err.status === 429 ? { 'Retry-After': '30', 'X-Request-Id': requestId } : { 'X-Request-Id': requestId };
  return NextResponse.json(
    { error: { code: err.code, message: err.message, status: err.status, details: err.details, request_id: requestId } },
    { status: err.status, headers },
  );
}

// -- schemas: validate at the boundary ----------------------------------------
const ParamsSchema = z.object({ projectId: z.string().uuid() });

const CreateNodeSchema = z.object({
  kindIri: z.string().url(), // weave:PascalCase class IRI, resolved via CE-READ-1
  label: z.string().min(1).max(200),
  properties: z.record(z.string(), z.unknown()).default({}),
});
type CreateNode = z.infer<typeof CreateNodeSchema>;

interface NodeResponse {
  id: string;
  kindIri: string;
  label: string;
}

// -- handler: thin; delegates to the service ----------------------------------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }, // Next.js 15: params is async
): Promise<NextResponse<NodeResponse | ErrorEnvelope>> {
  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  const params = ParamsSchema.safeParse(await ctx.params);
  if (!params.success) {
    return envelope(new ServiceError('invalid_path', 'projectId must be a UUID', 400, params.error.flatten()), requestId);
  }

  const body = CreateNodeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    // 422: well-formed transport, failed validation contract
    return envelope(new ServiceError('validation_failed', 'Request body failed validation', 422, body.error.flatten()), requestId);
  }

  try {
    const node = await createNode(params.data.projectId, body.data, requestId);
    return NextResponse.json(node, { status: 201, headers: { 'X-Request-Id': requestId } });
  } catch (err) {
    return envelope(toServiceError(err), requestId);
  }
}

function toServiceError(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err;
  // Never surface the raw error/stack to the client.
  return new ServiceError('internal_error', 'An unexpected error occurred', 500);
}

// Stub — real impl lives in a service module, injected/imported, never inline here.
declare function createNode(projectId: string, input: CreateNode, requestId: string): Promise<NodeResponse>;
```

**Why**

- `safeParse` on both the async `params` and the JSON body keeps all validation at the
  boundary — nothing unvalidated reaches `createNode`. In Next.js 15 `ctx.params` is a
  `Promise`; `await` it before parsing.
- One `ErrorEnvelope` shape (`{ error: { code, message, status, details?, request_id } }`)
  matches `api-conventions.md` so generated clients branch on the stable `code` slug, never
  on `message` text.
- The status-code contract is explicit: `400` malformed path, `422` failed validation
  (well-formed but breaks a constraint — the SHACL surface returns the same), `429` carries
  `Retry-After`, `201` returns the created resource. RBAC denials from the service surface as
  `403` (audited to `PLAT-AUDIT-1` server-side).
- `X-Request-Id` is echoed on every response so a UI error pivots to the trace/audit entry.
- The handler stays thin (well under 50 lines, cyclomatic < 10); business logic is delegated
  to a service module.

**Security**

- `route.ts` runs **only** on the server — secrets (Secrets Manager values, Cognito client
  secrets, Bedrock guardrail IDs) are read here and never serialised into the response body or
  a client component's props.
- `toServiceError` collapses any non-`ServiceError` into a generic `internal_error` 500: no
  stack trace, DSN, token, or PII ever reaches the client. `message` is human-readable only.
- Input is validated and typed before use — no `any`, no unchecked `req.json()`; a malformed
  body resolves to `null` and fails `safeParse` rather than throwing.
- `runtime = 'nodejs'` keeps this off the edge so Node-only secret retrieval works; never move
  a secret-reading handler to the edge runtime.

**Anti-patterns**

- Returning FastAPI-style `{ detail: ... }` or a bare `{ error: string }` — breaks the single
  envelope contract.
- Trusting `ctx.params` synchronously (Next.js 14 shape) — in 15 it is a Promise; using it
  unawaited is a type error under strict.
- Doing DB/SPARQL/service work inline in the handler — pushes it over the complexity/line
  budget and mixes the boundary with business logic.
- Leaking `err.message` or `err.stack` from an unknown error straight into the response.
- Omitting `Retry-After` on a `429`, or using `200` for a create instead of `201`.
