---
type: Reference
title: Weave Dev Environment & Local DevEx
description: "Canonical local-first development model: minimal-AWS, Docker-substituted services, tiered Ollama+Bedrock model routing, and the local→HITL→deploy boundary. Resolves OQ-14."
tags: [reference, devex, local-dev, infrastructure, model-routing]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/_dev-environment.md
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# Weave Dev Environment & Local DevEx

> Resolves OQ-14 (local development experience). Cross-cutting; every engine PRD references this.
> **Principle:** local-first, minimal-AWS. A developer clones, runs `docker compose up`, and gets a
> full working stack with seed data and near-zero AWS. AWS is touched as little as possible and
> **Bedrock as little as possible** (cost). The full test pyramid runs locally before a HITL
> approval to deploy.

## 1. The AWS floor — "thin shared dev account" (decision DX1)

A single **shared dev AWS account** provides only the services that are painful or low-value to
fake. Everything else runs locally in Docker.

**In AWS (shared dev account — keep minimal):**

| Service | Why it's not local | Notes |
|---|---|---|
| **Cognito** | Auth/RBAC/JWT/agent service-principals; OIDC parity with prod | Shared dev user pool (decision DX3) |
| **Bedrock** | Heavy/complex agentic reasoning + planning (Claude tier) | Used **as little as possible**; tiered routing sends only complex work here (§3) |
| Secrets Manager *(small)* | Holds the few dev secrets incl. the dev-creds bootstrap | tech-spec to confirm |
| SES *(small, optional)* | Transactional email (workspace invites) | tech-spec to confirm; can be mocked locally |
| ECR *(small)* | Image registry for deploy artefacts | only needed at the deploy boundary, not the inner loop |

**Local (Docker — zero AWS):**

| Concern | Local substitute | Prod |
|---|---|---|
| RDF store | **Oxigraph** (in-memory for tests, dockerised for dev) — proven in the prototype | Neptune / Jena Fuseki |
| Relational | **PostgreSQL** (Docker) via SQLAlchemy async | Aurora PostgreSQL Serverless v2 |
| Object store / queues / topics | **LocalStack** (S3, SQS, SNS) | S3 / SQS / SNS |
| Cache | **Redis** (Docker) | ElastiCache |
| Small AI models | **Ollama** (quantized Qwen / Gemma / DeepSeek) | Bedrock (small models) or Ollama-on-ECS |
| Secrets (inner loop) | LocalStack Secrets Manager or `.env`-free local vault | AWS Secrets Manager |

Parity is preserved by standards: SPARQL 1.1 (Oxigraph↔Neptune), SQLAlchemy (Postgres↔Aurora),
OIDC (Cognito everywhere), the AWS SDK (LocalStack↔AWS).

## 2. Auth in dev (decision DX3)

Cognito (shared dev pool) is the dev auth surface — real OIDC, JWT role claims, and agent
service-principals (`PLAT-IDENTITY-1`). No separate local OIDC is needed because Cognito sits in
the thin shared account. A **mock/offline JWT issuer** is provided for fully-offline unit tests
(mints signed JWTs with chosen role claims) so unit tests need no network.

## 3. Model routing — tiered Ollama + Bedrock, configurable (decision DX2)

The single most important devex requirement: **a configurable provider+model routing layer.**

- **Tiering:**
  - **Heavy / complex agentic work with planning** (elicitation, architecture, multi-step
    generation, the dark factory's planning agents) → **Bedrock** (Claude Opus/Sonnet tier).
  - **Simpler agentic needs** (validation, formatting, classification, lint, simple transforms,
    sub-tasks) → **Ollama** quantized small models (Qwen / Gemma / DeepSeek) where capable.
  - **Minimise Bedrock** — route to Ollama wherever a small model is sufficient (cost control).
- **Provider abstraction:** one interface, three backends — **Ollama / Bedrock / Anthropic API**
  (the prototype already has a provider abstraction with Ollama). Anthropic-API is the dev opt-in
  for Claude quality without AWS.
- **Configuration:** a single config surface maps `{agent-role | task-tier | complexity} →
  {provider, model}`, resolvable **per environment** (local / dev / staging / prod) and overridable
  per workspace/role/task. "Set where and which model" lives here. This extends the CLAUDE.md model
  right-sizing matrix (Opus/Sonnet/Haiku) with a **provider + local** dimension.
- **Fidelity caveat:** a local quantized model is lower-capability than Claude. Local runs validate
  **plumbing and logic**, not model-output quality. Quality-sensitive paths (final generation,
  spec authoring, the conformance-graded output) must run against Bedrock/Anthropic before sign-off.

> This routing config is also a first-class **Build Engine** requirement (the dark factory's model
> right-sizing) and a **Platform** settings concern (per-workspace model/provider policy + budget).

## 4. The local → deploy boundary (decision DX4)

The inner loop runs the **full test pyramid + all gates** against the local substituted stack:

1. Unit + integration + **Playwright E2E** all green.
2. Quality gates green: SHACL validation, **secret-scan**, SAST, type-check, **mutation ≥ 70%
   (configurable default)**, package-existence / slopsquatting, brand/voice conformance
   (default ≥ 90%, configurable).
3. The dark factory **cannot request deploy** until 1–2 are green.
4. **HITL approval** (human gate) — the phase-gate ceremony.
5. A thin **smoke suite runs against the dev AWS** environment to catch parity gaps
   (Oxigraph↔Neptune, Postgres↔Aurora, Ollama↔Bedrock behaviour).
6. Promote.

No autonomous path crosses step 4. This mirrors the harness phase-gate Stop hook (HITL between
phases) and the Build Engine's always-HITL deploy.

## 5. Per-engine local profile (what each needs locally)

| Engine | Local stack (inner loop) | Shared-account touch |
|---|---|---|
| Constitution Engine | Oxigraph + FastAPI + Ollama/Bedrock routing | Bedrock (complex authoring only) |
| Graph Explorer | Next.js + CE (local) | — (reads CE) |
| Weave Platform | + Postgres, LocalStack (S3/SQS/SNS), Redis | Cognito (auth), Bedrock |
| Build Engine | + dark-factory agent runtime (local loop / Agent SDK), git, sandbox, LocalStack artefacts | Bedrock (planning agents), ECR (deploy) |
| Events & Actions | + LocalStack SQS/SNS (run engine), mock/sandbox connectors | Bedrock (agentic actions) |
| Onboarding | Hammerbarn seed via the local CE/Build/Events pipelines | inherits the above |

## 6. Open (tech-spec)

- Exact "couple of small entities" in the shared dev account (Secrets Manager / SES / ECR — confirm).
- Dev orchestration tool: docker-compose vs devcontainer vs Tilt/Skaffold.
- Ollama model selection + quantization per simpler-agent role (Qwen vs Gemma vs DeepSeek).
- Dev-AWS smoke-suite scope (which parity checks are mandatory pre-promote).
- Bedrock cost guardrails in dev (per-developer/day cap before falling back to Ollama).
