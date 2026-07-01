---
type: Coding Standard
title: API Conventions — Coding Standard
description: "REST/OpenAPI 3.1 conventions for all Weave engines: resource naming, versioning, pagination, error-envelope shape, status codes (422/403/429), and rate limiting."
tags: [standards, api, rest, openapi, fastapi]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/api-conventions.md
---

# API Conventions

All Weave HTTP APIs are **REST, described by OpenAPI 3.1**, implemented with FastAPI +
Pydantic v2. SPARQL 1.1 is the graph-traversal surface and follows the
SELECT-only/`SERVICE`-blocked/paginated contract in `rbac-multi-tenancy.md` (CE
decision B3). These conventions gate generated code: a generated endpoint that
violates resource naming, the error envelope, or the status-code contract is a defect.

Grounded in the platform PRD (FR-024, FR-037, §6) and the prototype API
(`prototypes/weave-prototype/backend/app/api/routes.py`), which already follows the
`/api` prefix, 201/204/404/422 conventions, and a `?<resource>_id=` query-param
pattern for IRI-bearing path segments.

## Versioning

- All routes are mounted under an `/api` prefix (as in the prototype `APIRouter(prefix="/api")`).
- The API is versioned in the path: **`/api/v1/...`**. The major version changes only on
  a breaking change; additive changes (new optional fields, new endpoints) stay within
  the current major.
- The OpenAPI document declares `openapi: 3.1.0` and a semver `info.version`.
- Never break a published contract within a major version. Deprecate with a
  `Deprecation` + `Sunset` header before removing in the next major.

## Resource naming

- Resources are **plural nouns**, lower-case, kebab-case for multi-word collections:
  `/api/v1/projects`, `/api/v1/widgets`, `/api/v1/audit-entries`,
  `/api/v1/relationship-types`.
- Use standard HTTP verbs against collections and items:
  - `GET /api/v1/projects` — list
  - `POST /api/v1/projects` — create (**201**, returns the created resource)
  - `GET /api/v1/projects/{project_id}` — read
  - `PATCH /api/v1/projects/{project_id}` — partial update
  - `DELETE /api/v1/projects/{project_id}` — delete (**204**, empty body)
- **IRI-bearing identifiers go in a query parameter, not a path segment** — IRIs contain
  `://` which breaks path routing. The prototype does this for node ids
  (`?node_id=`); follow the same pattern: `GET /api/v1/resources?iri=<iri>`.
- Verbs as sub-resources only for genuine actions that are not CRUD:
  `POST /api/v1/snapshots/{id}/restore`, `POST /api/v1/operations/apply`.
- No trailing slashes; no verbs in collection names (`/getProjects` is wrong).

## Pagination

- List endpoints are **paginated with no silent row cap** (FR-037; CE B3). Never
  truncate silently — the prototype's hard 500-row cap is a prototype shortcut; the
  product paginates.
- Default page size is a **configurable default** (audit: ≤ 500/page, tunable — FR-037).
- Use page-based or cursor-based parameters consistently per engine; the response
  envelope always reports total/next so the client can page deterministically.

```jsonc
// GET /api/v1/audit-entries?page=2&page_size=500
{
  "items": [ /* ... */ ],
  "page": 2,
  "page_size": 500,
  "total": 4231,
  "next": "/api/v1/audit-entries?page=3&page_size=500"
}
```

## Error-envelope shape

Every error response (4xx/5xx) uses **one** envelope. FastAPI's default `{"detail": ...}`
(used throughout the prototype) is extended to this structured form so generated clients
parse errors uniformly.

```jsonc
{
  "error": {
    "code": "shacl_violation",          // stable machine-readable slug
    "message": "Every BusinessActor must have exactly one label.",
    "status": 422,
    "details": [                          // optional, error-type specific
      { "focus": "ex:actor-7", "path": "weave:label", "message": "minCount 1" }
    ],
    "request_id": "01J..."                // correlation id, also in logs/audit
  }
}
```

**Rules:**

- `code` is a stable slug (snake_case) — clients branch on `code`, never on
  `message` text.
- `message` is human-readable and **never contains secrets, tokens, or PII**
  (`rules/security.md`, PRD §6).
- `details` carries structured, machine-usable context (e.g. SHACL violation objects
  shaped as `{focus, path, message}` — matching the prototype validation surface).
- `request_id` correlates the error to logs and, for denials, to the `PLAT-AUDIT-1`
  entry.

## Status codes

Use the narrowest correct code. The contract-critical ones:

| Status | When | Source |
|--------|------|--------|
| `200` | Successful read / update returning a body | — |
| `201` | Resource created; body is the new resource | prototype `create_project`, `create_node` |
| `204` | Successful delete / no-content | prototype `delete_*`, returns empty `Response` |
| `400` | Malformed request (bad Turtle, invalid query, parse error) | prototype `import_ttl`, `sparql_query` |
| `403` | **RBAC denial** — authenticated but not permitted; **always** audited to `PLAT-AUDIT-1` | FR-024, PRD §6 |
| `404` | Unknown resource / tenant id | prototype `get_store` raises 404 on unknown project |
| `422` | **SHACL / validation violation** — well-formed request that fails a graph constraint | prototype `apply_ops`: blocking SHACL violation → 422 |
| `429` | **Quota / rate limit exceeded** | rate limiting below; budget cap (FR-035) |
| `503` | Upstream/provider unavailable (LLM 503, IdP outage, connector down) | prototype `_get_llm_service` → 503 |

**Specific contracts:**

- **422 = SHACL violation.** A request that is syntactically valid but breaks a
  `sh:Violation` constraint returns 422 with the violations in `details`. The prototype
  validates on a throwaway copy first and returns 422 without mutating the real graph
  (`routes.py:464-483`, `_validate_prospective`) — preserve this "validate before
  commit" behaviour. `sh:Warning`/`sh:Info` do **not** produce 422 (see `semantic-web.md`).
- **403 = RBAC denial.** Authenticated-but-unauthorised → 403, and the denial is
  recorded to `PLAT-AUDIT-1` (FR-024). Distinguish from 401 (no/invalid credentials);
  an IdP outage does **not** fall back to an unauthenticated session (FR-023).
- **429 = quota/rate limit.** Return with a `Retry-After` header. A budget cap hit
  (FR-035, 100%) hard-rejects **before any AI API call**; surface as 429 (or 402-class
  per billing design) with a clear `code`.

## Rate limiting

- Apply rate limits at the API boundary, **per (tenant, principal)** — not global —
  so one tenant cannot exhaust another's budget (multi-tenant isolation,
  `rbac-multi-tenancy.md`).
- On limit exceeded: **HTTP 429** with a `Retry-After` header and an error envelope
  (`code: "rate_limited"`).
- Budget enforcement **fails closed** under metering lag (PRD §6 Reliability); a 100%
  budget cap rejects before the upstream AI call (FR-035).
- Metering/quota events use a separate queue and are never dropped (FR-034).

## Input validation & security

- Validate and sanitise input at every API boundary (Pydantic models; `rules/security.md`).
- SPARQL reads inherit the CE surface: **SELECT-only, `SERVICE`-blocked, paginated** —
  the platform never issues unscoped or `SERVICE` queries (PRD §6; B3).
- Never concatenate user input into SQL/SPARQL — use parameterised queries / `VALUES`
  bindings (`semantic-web.md`, `rules/security.md`).
- Secrets never appear in request/response bodies, error messages, or logs (PRD §6).

## OpenAPI hygiene

- Every route declares `response_model` and explicit `status_code` (the prototype does
  this consistently). The generated OpenAPI is the contract — keep it accurate.
- Request/response bodies are Pydantic v2 models; no bare `dict` payloads on public
  routes.
- Document the error envelope as a shared component referenced by every error response.

## Checklist (generated code must satisfy)

- [ ] Routes mounted under `/api/v1`; OpenAPI declares `3.1.0` + semver `info.version`.
- [ ] Collections are plural kebab-case nouns; IRIs passed as query params, not path
      segments.
- [ ] List endpoints paginate with `{items, page, page_size, total, next}` — no silent cap.
- [ ] Every error uses the `{error: {code, message, status, details?, request_id}}`
      envelope; `code` is a stable slug.
- [ ] 201 on create (returns resource), 204 on delete, 422 on SHACL violation,
      403 on RBAC denial (audited), 429 on quota/rate limit (with `Retry-After`).
- [ ] SHACL-violating writes validate-before-commit and never mutate on 422.
- [ ] Rate limits are per (tenant, principal); budget enforcement fails closed.
- [ ] No secrets/PII in any response or error; inputs validated; queries parameterised.
