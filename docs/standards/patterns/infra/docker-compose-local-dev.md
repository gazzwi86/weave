---
type: Coding Standard
title: "Infra — local-dev stack: Oxigraph + Postgres + Redis 7 (compose)"
description: "Golden docker-compose.yml for the Weave inner loop: Oxigraph (RDF), PostgreSQL (Aurora substitute), and Redis 7 (ElastiCache substitute), each with a healthcheck and a named volume — the zero-AWS local substitute stack from the dev-environment doc, used for Law F synthetic verification."
tags: [standards, patterns, infra, docker]
timestamp: 2026-07-01
resource: docs/standards/patterns/infra/docker-compose-local-dev.md
topic: infra
stack: docker
verification: "python3 yaml.safe_load OK (valid YAML). docker not running in this environment, so `docker compose config` was not run; yaml-parse is the achieved verification level."
---

# Infra — local-dev stack: Oxigraph + Postgres + Redis 7 (compose)

**Intent.** Stand up the Weave inner-loop dependencies with a single `docker compose up`, matching
the "Local (Docker — zero AWS)" table in the dev-environment doc: **Oxigraph** as the RDF store
(SPARQL 1.1 parity with prod Neptune/Fuseki), **PostgreSQL** as the local substitute for Aurora
Serverless v2 (SQLAlchemy async parity), and **Redis 7** as the local substitute for ElastiCache.
Each service has a healthcheck so tests and dependent services wait for readiness, and a named
volume so data survives restarts.

```yaml
name: weave-local

services:
  oxigraph:
    image: ghcr.io/oxigraph/oxigraph:0.4.4
    command: ["serve", "--location", "/data", "--bind", "0.0.0.0:7878"]
    ports:
      # Bind to loopback only — never expose the dev store on the LAN/Wi-Fi.
      - "127.0.0.1:7878:7878"
    volumes:
      - oxigraph-data:/data
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:7878/ >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: weave
      # Local-dev-only credential. NEVER used outside the inner loop — prod DB
      # credentials come exclusively from AWS Secrets Manager (see the
      # terraform-aws-lambda-aurora pattern). No .env, no real secret here.
      POSTGRES_PASSWORD: weave_local_dev
      POSTGRES_DB: weave
    ports:
      - "127.0.0.1:5432:5432"  # loopback only — not reachable from the LAN
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U weave -d weave"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    ports:
      - "127.0.0.1:6379:6379"  # loopback only — unauthenticated Redis must not face the LAN
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  oxigraph-data:
  postgres-data:
  redis-data:
```

**Why.**
- **Parity, not fidelity.** Standards keep local↔prod interchangeable: SPARQL 1.1 (Oxigraph↔Neptune),
  SQLAlchemy (Postgres↔Aurora), the same Redis client (Redis 7↔ElastiCache). The inner loop runs the
  full test pyramid against these substitutes — Law F synthetic verification — before the deploy
  boundary.
- **Pinned image tags** (`0.4.4`, `postgres:16`, `redis:7-alpine`) keep the stack reproducible; a
  floating `latest` would let a base-image bump break the inner loop silently.
- **Named volumes + healthchecks** mean integration tests can gate on `service_healthy` and data
  persists across `up`/`down` without a rebuild.
- **Redis 7** specifically — the confirmed cache version — with a minimal RDB save policy so local
  state survives a restart.

**Security.**
- **No real secrets in the file.** The only credential is the Postgres local-dev password, clearly
  annotated as inner-loop-only; production credentials live in **AWS Secrets Manager exclusively**
  and are never committed here or in a `.env`. This file must never carry an AWS key, an Anthropic
  `sk-ant-` key, or a real DB DSN.
- **Localhost-only exposure.** Every published port is bound to `127.0.0.1`, so the unauthenticated
  Redis and the local-password Postgres are reachable only from the developer's machine, never from
  the LAN/untrusted Wi-Fi. This compose file is a dev artefact and must not run internet-facing services.
- **Least surface.** Only the three inner-loop stores are defined — no admin UIs or extra services
  that widen the local attack surface.

**Anti-patterns.**
- Floating `:latest` image tags — non-reproducible builds.
- A real secret, AWS key, or production DSN embedded here or pulled from a committed `.env`.
- `redis:6` or an unversioned `redis` image — the stack is pinned to Redis 7.
- Publishing ports as bare `"5432:5432"` (binds `0.0.0.0`) — exposes the store to the LAN; bind
  `127.0.0.1:` on every published port.
- Omitting healthchecks, then racing tests against a not-yet-ready Postgres.
- Adding LocalStack/Ollama into this same file when a task only needs the core three — keep the base
  stack minimal and layer extras via a compose override.
