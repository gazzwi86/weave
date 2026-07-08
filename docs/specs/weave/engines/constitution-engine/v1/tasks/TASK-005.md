---
type: Task
title: "Task: TASK-005 — Tenant-Scoped Governance Shapes (NL→SHACL, Isolation, Cache Invalidation)"
description: "Compliance officer describes a rule in plain English; AI generates a tenant-scoped
  sh:NodeShape stored in the tenant shapes graph, enforced on every later edit, with cross-worker
  cache invalidation and the cross-tenant shape-leak security test. Includes weave:automatable
  shape activation (E5-S1, FR-025, SS-EA-4)."
tags: [constitution-engine, arch, task, milestone-v1]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-005
milestone: v1
created: 2026-07-08
blocked_by: ["TASK-001"]
unlocks: ["TASK-006"]
adr_refs: [ADR-001]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-005, FR-025)
Contracts: [contracts.md](../../../../contracts.md) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §2–§3

## Story

As a compliance/risk officer, I need to describe a regulatory obligation in plain English and have
it become an enforced rule on every future edit — scoped to my organisation only — so compliance
is a live property of the graph, not a document nobody re-reads.

## Scope

EPIC-005 E5-S1: NL → AI-generated SHACL shape → human review → commit to the tenant shapes graph;
enforcement on subsequent CE-WRITE-1 commits; cross-worker cache invalidation; the cross-tenant
shape-leak test; `weave:automatable` shape activation (SS-EA-4). E5-S2 (self-audit scheduling) is
Phase 4 — OUT. The Rules & Policies browse screen is TASK-006.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-005-01 | WHEN a compliance officer describes a rule in plain English THE SYSTEM SHALL generate a candidate `sh:NodeShape`/`sh:PropertyShape`, present it for human review, and commit ONLY on explicit approval — via CE-WRITE-1 into `urn:weave:g:tenant:{id}:shapes`, PROV-O attributing the LLM as generator and the human as approver. |
| AC-005-02 | WHEN a shape commit lands THE SYSTEM SHALL bump the tenant's shapes-graph version hash so every worker's next validation uses the new shape set — the very next commit in that tenant is validated against the new rule (FR-025 "applies on very next commit"). |
| AC-005-03 | WHEN tenant A commits a shape THE SYSTEM SHALL leave tenant B's validations entirely unaffected — verified by the cross-tenant shape-leak test (tenant-A shape, tenant-B commit passes/fails identically to before). |
| AC-005-04 | WHEN validation runs THE SYSTEM SHALL load framework shapes ∪ this tenant's shapes graph only — never another tenant's (ADR-001 fail-closed scoping extended to shapes). |
| AC-005-05 | WHEN the AI cannot produce a valid shape from the description THE SYSTEM SHALL say so and offer the raw-SHACL editing path — never commit an unreviewed or invalid shape (SHACL syntax-validated before preview). |
| AC-005-06 | WHEN `weave:automatable` is asserted on an Activity/Process THE SYSTEM SHALL enforce `weave:AutomatableShape` (boolean, default-absent ⟹ route-to-human semantics downstream) from the tenant shapes graph. |
| AC-005-07 | WHEN the AI service is unavailable THE SYSTEM SHALL return 503 on the NL surface while the raw-SHACL path stays live. |

## Pseudocode

```text
POST (NL rule description) -> claude-sonnet-5 -> candidate shape (Turtle)
    -> syntax-validate (pyshacl parse) -> preview to human (diff-style)
    -> on approve: CE-WRITE-1 op batch targeting shapes graph
         urn:weave:g:tenant:{id}:shapes   (m2-delta §2 — the ONE new graph)
    -> commit txn also bumps shapes_version_hash (Redis key per tenant)

validate(commit):                                # existing M1 pipeline, changed lines only
    shapes = cache.get((tenant, shapes_version_hash))
             or load(framework_graph ∪ tenant_shapes_graph)   # never another tenant's
    ...unchanged...
```

## API Contracts

- Shape authoring rides the existing NL-authoring surface (M1 `POST /api/ontology/authoring/nl`
  family) with a shapes-graph target — same preview/approve flow as ADR-007; writes via
  **CE-WRITE-1** only. No new public contract (shapes are CE-internal governance, not a `CE-*`
  surface).
- Reads for review/preview: CE-READ-1.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Named-graph delta | [m2-delta.md](../../tech-spec/m2-delta.md) §2 | The tenant shapes graph and its isolation rule |
| Governance shapes design | [m2-delta.md](../../tech-spec/m2-delta.md) §3 | Authoring path, cache invalidation, security sub-gate |
| M1 validation pipeline | [architecture.md](../../tech-spec/architecture.md) (write path) | The pipeline whose shape-loading step this task modifies |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Version-keyed cache, not pub/sub invalidation | One Redis key per tenant; every worker misses stale keys naturally; no broadcast machinery. Ceiling: hash lookup per validation — upgrade to pub/sub only if it shows in perf traces | m2-delta §3 (ponytail note) |
| Shapes graph write goes through CE-WRITE-1 | Single mutation entry point (FR-003) covers shapes too; PROV-O for rules is a compliance requirement, not nice-to-have | EPIC-005 epic AC |
| LLM generates, human approves, syntax gate between | An invalid or unreviewed shape enforced on every commit is a tenant-wide outage; propose-then-confirm mirrors ADR-007 | AC-005-01/-05, ADR-007 pattern |
| Shape-leak test ranked with ADR-001 isolation test | FR-025 names it part of the security-review sub-gate; it is release-gating, not advisory | m2-delta §3, roadmap Phase 2 exit criteria |

## Test Requirements

Minimum: 4 unit, 5 integration (incl. the security test), 1 E2E.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should reject syntactically invalid generated shape before preview | AC-005-05 |
| Unit | should target the tenant shapes graph IRI (never draft graph) for shape ops | AC-005-01 |
| Unit | should compute cache key from (tenant, shapes_version_hash) | AC-005-02 |
| Unit | should include AutomatableShape in the tenant shape set when loaded | AC-005-06 |
| Integration | should enforce a newly committed shape on the very next commit (two-commit sequence) | AC-005-02 |
| Integration | **cross-tenant shape-leak: tenant-A shape does not change tenant-B validation outcome** | AC-005-03, AC-005-04 |
| Integration | should invalidate across workers: two app processes, shape commit in one, next validation in the other uses the new shape | AC-005-02 |
| Integration | should stamp PROV-O with LLM generator + human approver on shape commit | AC-005-01 |
| Integration | should 503 NL surface with raw-SHACL path live when AI is down | AC-005-07 |
| E2E | compliance officer describes "every Process must name an owner", approves, then an ownerless Process edit is 422-blocked | AC-005-01, AC-005-02 |

## Dependencies

- **blocked_by**: TASK-001 (EPIC-005 depends_on EPIC-003 per engine spec — glossary terms are
  referenceable in rules)
- **unlocks**: TASK-006 (rules browse screen reads what this task writes)

## Cost Estimate

**L** — est. **650k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). Touches the validation
pipeline (highest-risk M1 surface), adds a named graph, a security-gating test, and a multi-worker
integration test.

## DoR Checklist

- [x] Shapes-graph IRI + isolation rule pinned (m2-delta §2)
- [x] Cache-invalidation mechanism pinned (version-keyed, m2-delta §3)
- [x] NL preview/approve pattern exists (ADR-007, M1 TASK-006)
- [x] Shape-leak test ranked as security sub-gate (release-gating)
- [ ] TASK-001 merged
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] Cross-tenant shape-leak test green and marked release-gating in CI
- [ ] Multi-worker invalidation test green (two processes, shared Redis)
- [ ] No second mutation path (CI assertion still passes; shapes go via CE-WRITE-1)
- [ ] Prospective-validation p95 still < 2 s with governance shapes loaded (m2-delta §1)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Extend the M1 shape-loading step, do not fork it: one loader function gains
  `∪ tenant_shapes_graph`; the ADR-001 query-rewriting guard applies to the shapes graph read
  exactly as to data graphs.
- The two-process invalidation test: run two uvicorn workers against the same Postgres/Redis in
  the integration harness (Testcontainers pattern from testing-strategy.md) — do not simulate with
  in-process cache clears; the bug this catches is process-local caching (FR-025 names it).
- NL→SHACL prompt: constrain generation to `sh:NodeShape` with `sh:property` blocks over known
  predicates (feed `GET /api/ontology/types` output into the prompt); reject shapes referencing
  unknown predicates at the syntax gate.
- Pitfall: shape deletion/edit also bumps the hash — invalidation is on ANY shapes-graph commit,
  not just additions.
