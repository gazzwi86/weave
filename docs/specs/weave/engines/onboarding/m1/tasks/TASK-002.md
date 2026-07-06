---
type: Task
title: "Task: TASK-002 — hammerbarn-seed CLI: compile + apply the canonical seed via CE-WRITE-1"
description: "The live-pipeline seed job: compile the Hammerbarn content brief into versioned
  CE-WRITE-1 operation batches, apply idempotently under the content-admin principal, publish a
  version; GitHub Actions workflow_dispatch + CE major-bump trigger behind the HITL publish gate."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-001
milestone: m1
created: 2026-07-06
blocked_by: []
unlocks: ["TASK-004"]
adr_refs: [ADR-002, ADR-007]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) · Contracts:
[contracts.md](../../../../contracts.md) · Content:
[hammerbarn-content-brief.md](../../../../hammerbarn-content-brief.md) · Flow:
[business-process.md](../../tech-spec/business-process.md) §Seed Publish Pipeline

## Story

As the onboarding content admin, I need the Hammerbarn seed compiled from the approved content
brief and applied through the real product write path, so the demo every new user learns from
can never drift from the product and every seed triple is SHACL-validated and PROV-attributed.

## Scope Note

Python CLI (`hammerbarn-seed`, uv-run) + one GitHub Actions workflow. **Compile:** content brief
§2–§12 (M1 scope: ontology, processes, actors, systems, data assets, punned Class/Concept
vocabulary, policies, glossary, brand — NOT §13 post-v1 stubs) → ordered CE-WRITE-1 op batches
with local `ref` resolution, emitted as a repo-committed versioned artefact. **Apply:** batches
to `POST /api/operations/apply` (`target=draft`) under the content-admin principal against a
named workspace, then publish a version. The same apply path is reused by TASK-004 for forking.
Per-tenant template materialisation orchestration is TASK-004's provisioning concern; this task
ships the CLI + workflow. No Build/Events seed portions (post-v1, owned by those engines).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-002-01 | WHEN compile runs THE SYSTEM SHALL validate every kind and relationship type against `GET /api/ontology/types` (CE-READ-1) and fail on any unknown — no hand-coded kind list exists in the CLI. |
| AC-002-02 | WHEN compile runs twice over the same brief THE SYSTEM SHALL emit byte-identical batch artefacts (deterministic ordering, stable refs, semver from the artefact manifest). |
| AC-002-03 | WHEN apply runs THE SYSTEM SHALL POST batches in order to CE-WRITE-1 with an idempotency key per batch; a 422 SHALL halt with the violations printed and the target's previous published version intact. |
| AC-002-04 | WHEN apply is re-run after any failure or success THE SYSTEM SHALL converge (CE-WRITE-1 label+kind dedup + idempotency keys) — no duplicate nodes, verified by an ASK count check. |
| AC-002-05 | WHEN apply completes THE SYSTEM SHALL publish a version (CE-VERSION-1 semver matching the batch artefact) and print `{version_iri, applied_count}`. |
| AC-002-06 | WHEN the GitHub Actions workflow runs THE SYSTEM SHALL require the HITL publish/generate gate (environment approval: content admin + Tech Lead) before any apply against a canonical target; triggers are `workflow_dispatch` and CE ontology MAJOR bump only (minor/patch → advisory job comment, no apply). |
| AC-002-07 | WHEN the CLI runs in CI THE SYSTEM SHALL use the in-process FastAPI app + in-memory Oxigraph — no real cloud calls (Law F). |

## API Contracts

Consumes `CE-READ-1` (`GET /api/ontology/types`; ASK verification), `CE-WRITE-1`
(`POST /api/operations/apply`, `target=draft`), `CE-VERSION-1` (publish + semver read),
`PLAT-IDENTITY-1` (content-admin service principal). Provides nothing (terminal consumer).

## Diagram

business-process.md §Seed Publish Pipeline (this task implements every arrow in it).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Batches via CE-WRITE-1, never Turtle bulk-load | Live pipeline (decision E2); SHACL + PROV on every triple | ADR-007 |
| Versioned batch artefact committed to repo | The artefact is what forks/resets replay — one path, three uses | ADR-002 §1, ADR-007 |
| Kind validation against the types endpoint | Ontology-standards rule: the endpoint is authoritative | ontology-standards.md |
| MAJOR bump = re-seed; minor/patch advisory | Seed-lifecycle contract | EPIC-001 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Compile determinism (golden artefact); ref resolution; unknown kind fails | AC-002-01/02 |
| Integration | Apply against in-process app: happy path publishes version | AC-002-03/05/07 |
| Integration | Re-run convergence (apply twice ⇒ ASK counts unchanged) | AC-002-04 |
| Integration | Induced 422 mid-run ⇒ halt; previous version intact | AC-002-03 |
| Static | Workflow YAML: gate + trigger conditions asserted by a lint test | AC-002-06 |

## Dependencies

- **blocked_by**: none (CE-WRITE-1/CE-READ-1 are landed M1 contracts)
- **unlocks**: TASK-004 (fork/reset replay the batch artefact)

## Cost Estimate

**L** — the compiler is the bulk (brief §2–§12 → ops with cross-references); apply/publish is
mechanical once batches exist. Care points: determinism, convergence, and the gate wiring.

## DoR Checklist

- [ ] ADR-007 approved; ADR-002 approved (batch-as-distribution-unit)
- [ ] Hammerbarn content brief status confirmed approved
- [ ] Content-admin service principal available via PLAT-IDENTITY-1
- [ ] HITL publish-gate environment exists in GitHub Actions settings

## DoD Checklist

- [ ] All ACs pass; golden-artefact test committed
- [ ] Batch artefact `hammerbarn-seed v1.0.0` committed and reviewed
- [ ] Workflow requires environment approval; no secrets in workflow files
- [ ] CLI documented (`--compile`, `--apply --workspace <id>`, `--verify`)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on compiler modules

## Implementation Hints

Compile order: Classes/Concepts → Actors/Systems/Services → DataAssets/Fields → Processes/
Activities/Events → edges (`performedBy`, `hasStep`, `triggeredBy`, `consumes`/`produces`,
`governedBy`, `realizes`, `servesGoal`) → Policies/Goals/Domains/Capabilities before the edges
that cite them — emit nodes before edges that reference their refs. Batch size ~50 ops keeps 422
messages readable. The `--verify` subcommand is just the ASK count set — reuse it in TASK-004's
fork test.
