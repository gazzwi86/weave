---
id: EPIC-000
type: epic
entity: weave-platform
title: Foundation & Boilerplate
status: backlog
phase: 1
priority: must
mvp: true
depends_on: []
blocks: [EPIC-001, EPIC-002, EPIC-003, EPIC-004, EPIC-005, EPIC-006, EPIC-007, EPIC-008, EPIC-009]
provides: [dev-environment, ci-cd, design-system, app-shell, iac-state, auth-bootstrap]
consumes: []
prd_ref: ../prd.md#epic-0-foundation--boilerplate
owner: gazzwi86
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
coverage: n/a
---

# Epic: EPIC-000 - Foundation & Boilerplate

## Overview

**Phase:** Phase 1 (MVP) — **FIRST work item; every other epic, in every engine, depends on it.**
**PRD Reference:** [prd.md](../prd.md#epic-0-foundation--boilerplate)
**Status:** Backlog
**Priority:** Must Have

## Description

The shared platform foundation the whole program stands on: the codebase, infrastructure, CI/CD,
the design system, auth + model connectivity, the test + evaluation harness, and the quality
gates. Nothing else can start until this exists — it is the one-time shared scaffold that the
harness's per-project scaffolding step does **not** cover (audit gap C1). It also installs the
release gates (Lighthouse 100, WCAG 2.1 AA) and wires the model-routing provider abstraction
(Ollama/Bedrock/Anthropic) from `_dev-environment.md`.

## User Stories

| Task ID | Title | Status | Priority |
|---|---|---|---|
| E0-S1 | Monorepo + tooling scaffold (workspaces, package layout, uv + pnpm, conventional commits/husky, npm scripts) | Backlog | Must |
| E0-S2 | IaC + remote state — Terraform, **S3 state backend + DynamoDB lock**, base AWS (Cognito pool, Bedrock access, networking, Secrets Manager) | Backlog | Must |
| E0-S3 | Next.js 15 app shell + the **design system** (`docs/standards/design/`) + **Storybook** to view components | Backlog | Must |
| E0-S4 | CI/CD — GitHub Actions (OIDC to AWS, env protection) with the quality gates: lint, **complexity** (cyclomatic/maintainability), **SAST**, **secret-scan** | Backlog | Must |
| E0-S5 | Test harness — unit (vitest/pytest) + UI + **Playwright E2E** + **visual-regression** screenshots; **Lighthouse-100 (all 4)** + **WCAG 2.1 AA** release gates | Backlog | Must |
| E0-S6 | Auth + model-provider connectivity — Cognito bootstrap (OIDC/JWT/service principals) + the **Ollama/Bedrock/Anthropic** routing abstraction (`_dev-environment.md §3`) | Backlog | Must |
| E0-S7 | API + observability scaffold — **OpenAPI 3.1** baseline (`api-conventions.md`), **OpenTelemetry/ADOT** bootstrap, health route + smoke test | Backlog | Must |
| E0-S8 | AI evaluation harness — **promptfoo** CI evals + **Bedrock Model Evaluation** (`testing-agents.md`) | Backlog | Should |
| E0-S9 | Local dev environment — `docker-compose` (Oxigraph, Postgres, LocalStack S3/SQS/SNS, Redis, Ollama) per `_dev-environment.md`; `clone → up → working stack`, zero live AWS for the inner loop | Backlog | Must |

## Acceptance Criteria (Epic Level)

- [ ] A new contributor runs one documented command and gets a working local stack with seed data
      and **zero live AWS** for the inner loop (`_dev-environment.md` DX1/DX4).
- [ ] CI is **red** on any of: lint error, complexity over budget, SAST high finding, detected
      secret, failing test, or a Lighthouse score < 100 / axe violation > 0 on the built app.
- [ ] `terraform apply` provisions the shared dev account (Cognito + Bedrock + state backend)
      reproducibly; state lives in S3 with DynamoDB locking; no secret is committed.
- [ ] A Storybook renders the design-system components from `docs/standards/design/` tokens; a
      visual-regression baseline exists and the diff gate is wired.
- [ ] The model-routing abstraction resolves provider+model per env (local→Ollama, cloud→Bedrock)
      from one config, with no AWS creds needed for the local inner loop.
- [ ] An OpenAPI 3.1 contract is generated and validated in CI; OTel spans emit to the collector.

## Dependencies

- **Blocked by:** none (this is the root).
- **Blocks:** every other Platform epic (EPIC-001…009) and, transitively, every engine — no
  engine work can begin until the foundation, CI, and design system exist.

## Technical Notes

Cross-cutting: consumes the standards `complexity.md`, `secrets-scanning.md`, `api-conventions.md`,
`observability.md`, `testing-ts.md`/`testing-py.md`/`testing-agents.md`, `accessibility.md`, and the
new `docs/standards/design/` design system. Realises the `_dev-environment.md` local-first model and
the Lighthouse-100/WCAG-AA gates. The dark factory's first phase builds this from this brief rather
than improvising a scaffold.
