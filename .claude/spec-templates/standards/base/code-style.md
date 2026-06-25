# Code style — universal base

**Stack-agnostic.** Per-stack overlays live in `templates/standards/<lang>/code-style.md`.

## General principles

- Write code for humans first, machines second.
- Prefer explicit over implicit.
- One responsibility per function; one concern per module.
- Descriptive names; code should read like prose.
- Complexity gates (see `base/complexity.md`): function ≤ 50 lines, file ≤ 300 lines, params ≤ 5, nesting ≤ 4.

## Naming convention (universal)

| Element | Guidance |
|---|---|
| Files | Match language idiom (PascalCase for TS components, snake_case for Python modules, PascalCase.java for Java classes). |
| Public APIs | Stable, descriptive, no abbreviations. `calculateInvoiceTotal`, not `calcTot`. |
| Constants | UPPER_SNAKE_CASE across all stacks. |
| Tests | Mirror source filename + language-idiomatic suffix (`.test.ts`, `_test.py`, `Test.java`). |

## Documentation

All public APIs must carry a docstring / JSDoc / Javadoc describing intent, inputs, outputs, and error modes. See `templates/standards/<lang>/tooling.md` for the syntax.

## Imports

Order imports: standard library / runtime, then external dependencies, then internal modules, then relative paths, then type-only imports. Enforce via the language-specific linter (eslint-plugin-import, isort, checkstyle ImportOrder).

## File structure

Keep a shallow, domain-oriented tree:

```
src/
  <domain>/          # feature / bounded-context
    <concern>.<ext>  # one concern per file
  shared/            # cross-cutting primitives
tests/               # mirror src/ layout
```

Domain-first beats technology-first — a newcomer can find "the checkout logic" by searching for `checkout`, not by guessing which of `controllers/`, `services/`, `repositories/` it lives in.

## Error handling

- Use the language's idiomatic error type (TS `Error` subclass, Python custom exception, Java checked/unchecked exception, Swift `Error` conforming enum).
- Never silently swallow errors.
- Log with structured fields (see `base/observability` guidance and the stack-equivalents matrix).

## Security headers (UI-bearing projects)

**Mandatory at scaffold time** per Engineer Law 18. Empty `headers()` arrays or "we'll add it later" comments are non-compliant.

### Next.js stanza (copy verbatim into `next.config.ts`)

```ts
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'" },
];

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

### Rate-limit middleware (auth-bearing endpoints)

**Mandatory** on every `/api/auth/**` route and any endpoint that triggers external side-effects (email send, payment session create). Default: 5 req/min per IP, 20 req/min per session.

- TS/Next.js: `@upstash/ratelimit` + `@upstash/redis` (or in-memory `LRUCache` for dev), called from middleware.ts.
- Python: `slowapi` (FastAPI) or Django's `django-ratelimit`.
- Java: `Bucket4j` + Spring filter.
- Swift/Vapor: `Vapor.RateLimit`.

**Required test pattern** (auth endpoint must have a rate-limit test):
```ts
test('magic-link request rate-limits after 5 calls/min', async () => {
  for (let i = 0; i < 5; i++) await POST('/api/auth/magic-link', { email: 'a@b' });
  const res = await POST('/api/auth/magic-link', { email: 'a@b' });
  expect(res.status).toBe(429);
});
```

If this test is absent, **Category 11 (security) of the QA report MUST be FAIL**.

---

*Override per stack in `templates/standards/<lang>/code-style.md`.*
