---
type: Task Brief
title: "Task: TASK-001 — SPIKE: Cytoscape 10k-node Benchmark + Aurora Layout Schema Design"
description: "Benchmark Cytoscape.js + fcose at 10k nodes to gate OQ-01; produce WebGL escape-hatch
  go/no-go (OQ-05); design and approve the Explorer Aurora layout schema that unblocks TASK-004."
tags: [graph-explorer, arch, task, spike, benchmark, m1]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: []
unlocks: [TASK-002, TASK-004]
adr_refs: []
timestamp: 2026-07-01T00:00:00Z
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
---

# Task: TASK-001 — SPIKE: Cytoscape 10k-node Benchmark + Aurora Layout Schema Design

**Owner:** Architect · **Type:** Benchmark / Decision Spike

## Story

**Epic:** [EPIC-001](../../../graph-explorer.md#epic-001--whole-company-canvas-force-mode--m1)
**Status:** Backlog
**Priority:** Must Have

**As a** Technical Architect
**I want** to run the OQ-01 benchmark harness against Cytoscape.js + fcose at 1k / 5k / 10k nodes
and design the Explorer's Aurora layout-positions schema
**So that** the M1 gate has a signed go/no-go on the WebGL escape hatch (OQ-05) and TASK-004 has
an approved schema to build against before any production code is written.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the OQ-01 benchmark harness runs Cytoscape.js + fcose at 10k nodes on the reference hardware profile (desktop Chrome latest, 16 GB RAM, no GPU acceleration), THE SYSTEM SHALL produce a report containing p95 load time (ms), p95 drag FPS, and memory peak (MB) at 1k, 5k, and 10k nodes, with raw harness data attached. | `benchmark_report_delivered` (manual sign-off artefact) |
| AC-2 | WHEN the benchmark report shows initial render ≤ 8 s at 10k and drag ≥ 60 fps at ≤ 1,000 visible nodes (p95, tunable), THE SPIKE SHALL be marked "go" and TASK-002 AC-7 (performance) SHALL stand as written. | `benchmark_go_decision_signed` (Architect sign-off) |
| AC-3 | WHEN the benchmark report shows initial render > 8 s at 10k OR drag < 60 fps at ≤ 1,000 visible nodes, THE Architect SHALL produce a signed OQ-05 decision naming the WebGL renderer (sigma.js or G6) and TASK-002 AC-7 SHALL be suspended until the renderer decision is approved. | `benchmark_no_go_oq05_decision_signed` (Architect sign-off) |
| AC-4 | WHEN the Aurora layout schema design is complete, THE design document SHALL specify a `explorer_layout_positions` table with columns `(tenant_id UUID NOT NULL, workspace_id UUID NOT NULL, graph_id TEXT NOT NULL, node_iri TEXT NOT NULL, position_x DOUBLE PRECISION NOT NULL, position_y DOUBLE PRECISION NOT NULL, locked BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`, composite PK on `(tenant_id, workspace_id, graph_id, node_iri)`, and a row-level-security policy requiring `tenant_id = current_setting('app.current_tenant_id')::uuid`. | `layout_schema_design_document_approved` (Architect review) |
| AC-5 | WHEN the schema design is approved by the Architect, THE approved SQL migration SHALL be committed to the repository as a migration file and TASK-004 SHALL be marked unblocked. | `layout_schema_migration_committed` (git log confirms file) |

## Implementation

### Pseudocode

This is a research and design spike. The pseudocode describes the benchmark harness protocol and
schema design procedure — not production application code.

```
# OQ-01 Benchmark Harness — Architect-run protocol

STEP 1: Prepare synthetic graph fixtures
  generate_fixture(size=1_000,  edges_per_node=3)   # ~3k edges
  generate_fixture(size=5_000,  edges_per_node=3)   # ~15k edges
  generate_fixture(size=10_000, edges_per_node=3)   # ~30k edges
  # Each node: { node_iri, bpmo_kind, label }
  # Each edge: { source_iri, target_iri, predicate }
  # Fixture format: JSON matching CE-READ-1 SPARQL SELECT row shape
  # Loaded by harness page via CE-READ-1 stub (no live CE required)

STEP 2: Run load benchmark (5 repetitions per fixture size)
  for fixture in [1k, 5k, 10k]:
    for run in range(5):
      t_start = performance.now()
      cy = Cytoscape({ container, elements: fixture.elements, style: minimal_style })
      cy.layout({ name: "fcose", ...prototype_params })  # params from prototype-findings.md
        .run()
      await waitForLayoutStop(cy)
      t_end = performance.now()
      record: load_time_ms = t_end - t_start
      record: memory_peak_mb = performance.memory.usedJSHeapSize / 1_000_000
  report p95(load_time_ms) and p95(memory_peak_mb) per fixture size

STEP 3: Run drag benchmark (at 1k visible nodes only; 60 fps target)
  load fixture(1k)
  fps_readings = []
  start_raf_sampler():   # requestAnimationFrame loop, record delta each frame
    fps_readings.push(1000 / delta_ms)
  simulate_drag(node=random_node, dx=100, dy=100, duration_ms=3_000)
  stop_sampler()
  report p95(fps_readings)

STEP 4: Decision tree
  if p95_load_10k <= 8_000 AND p95_drag_fps >= 60:
    decision = "go"
    file: ADR-001.md { renderer: "cytoscape+fcose", status: "confirmed" }
  else:
    decision = "no-go"
    file: ADR-001.md {
      renderer: "sigma.js | G6",   # Architect chooses one
      rationale: gap_analysis,     # quantified: measured vs target
      status: "pending-approval"
    }
    suspend: TASK-002 AC-7         # performance AC held until renderer decided

STEP 5: Aurora layout schema design
  # Produce: migrations/NNNN_explorer_layout_positions.sql
  CREATE TABLE explorer_layout_positions (
    tenant_id     UUID              NOT NULL,
    workspace_id  UUID              NOT NULL,
    graph_id      TEXT              NOT NULL,
    node_iri      TEXT              NOT NULL,
    position_x    DOUBLE PRECISION  NOT NULL,
    position_y    DOUBLE PRECISION  NOT NULL,
    locked        BOOLEAN           NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, workspace_id, graph_id, node_iri)
  );
  ALTER TABLE explorer_layout_positions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON explorer_layout_positions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  # Note for TASK-004: FastAPI middleware must call
  #   SET LOCAL app.current_tenant_id = '{tenant_id}'
  # before every query on the same connection; failure bypasses RLS.
```

### API Contracts

N/A — internal design spike. No runtime API surface is created in this task.

The migration SQL produced here becomes the schema for TASK-004's Aurora endpoints.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|------------------|---------|
| Sequence | `../tech-spec/business-process.md` | `#graph-load` | Pending — to be added to tech-spec before implementation starts |
| State | `../tech-spec/business-process.md` | `#benchmark-decision` | Pending — to be added to tech-spec before implementation starts |
| Data Model | `../tech-spec/data-model.md` | `#layout-schema` | Pending — this task IS the schema design input; data-model doc updated after AC-5 |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|---------------------|
| Cytoscape.js + fcose for force layout (prototype-proven); WebGL escape hatch (sigma.js/G6) if 10k targets fail (SS-GE-1) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Benchmark must use the exact fcose params from `prototype-findings.md`; deviation from prototype params invalidates the comparison |
| Force canvas at 10k nodes is an unverified target (OQ-01 / OQ-05) | [graph-explorer.md §2.2](../../../graph-explorer.md#22-non-functional-requirements) | Performance ACs in TASK-002 are gated on this SPIKE; never assert 10k targets as settled before AC-2 or AC-3 is signed |
| Explorer-owned Aurora tables, tenant + workspace scoped, server-side layout (D2) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Schema must carry `tenant_id` + `workspace_id` on every row; row-level security required |
| Aurora PostgreSQL Serverless v2 + SQLAlchemy async (confirmed stack) | [CLAUDE.md](../../../../../CLAUDE.md) | Migration SQL must be compatible with Aurora PostgreSQL; no alternative stores |
| Secrets in AWS Secrets Manager only | [CLAUDE.md](../../../../../CLAUDE.md) | Database credentials for Aurora never in `.env` or source |

## Test Requirements

This is an Architect-owned spike. Deliverables are a benchmark report and a schema design document,
not tested production code. All verification is manual review at SPIKE sign-off.

### Unit Tests (minimum 0)

N/A — spike produces a report and migration SQL, not testable application logic.

### Integration Tests (minimum 0)

N/A — no runtime API surface in this task.

### E2E Tests (minimum 0)

N/A — no UI surface in this task.

### Verification Checklist (non-code)

- Benchmark report reviewed and signed by Architect (AC-1, AC-2, AC-3)
- OQ-01 / OQ-05 decision filed as `decisions/ADR-001.md` (Architect creates)
- Aurora migration SQL reviewed and approved by Architect + Tech lead (AC-4)
- Migration file parseable as valid PostgreSQL SQL (AC-5)
- `git log` confirms migration file committed before TASK-004 is started (AC-5)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Manual | `benchmark_report_delivered` — report present and reviewed at SPIKE sign-off |
| AC-2 | Manual | `benchmark_go_decision_signed` — Architect sign-off record filed |
| AC-3 | Manual | `benchmark_no_go_oq05_decision_signed` — Architect sign-off record filed |
| AC-4 | Manual | `layout_schema_design_document_approved` — schema SQL reviewed |
| AC-5 | Manual | `layout_schema_migration_committed` — `git log` confirms migration file |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-002 (AC-7 performance gate), TASK-004 (Aurora schema sign-off required to start)]
- **External:** "CE-READ-1 stub available for benchmark harness fixture loading"

## Cost Estimate

- **Complexity:** M (research + design; no production code)
- **Estimated tokens:** ~8k input, ~6k output
- **Estimated cost:** ~$0.60 (claude-fable-5 at time of writing; check Anthropic pricing for
  current rates before commitment)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests (manual artefact reviews)
- [x] Pseudocode provided (benchmark harness protocol + schema design procedure)
- [x] API contracts defined — N/A, internal design spike
- [ ] Diagram references included — Pending: tech-spec not yet written; known blocker (Architect
  owns tech-spec authoring post-SPIKE)
- [x] Design decisions noted
- [x] Test scenarios specified (manual verification checklist)
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] Benchmark report delivered and signed by Architect (AC-1)
- [ ] OQ-01 go/no-go decision filed as ADR-001.md (AC-2 or AC-3)
- [ ] Aurora migration SQL approved and committed (AC-4, AC-5)
- [ ] TASK-004 unblocked (schema approved)
- [ ] No production code written beyond benchmark harness page and migration SQL (YAGNI)
- [ ] Conventional commit(s) created
- [ ] PR references this task and EPIC-001

## Implementation Hints

- Use the fcose layout params verbatim from `prototype-findings.md` — any deviation voids the
  benchmark comparison against the prototype baseline; document the exact param set in the report.
- The `performance.memory` API is Chrome-only (not Firefox/Safari); note this constraint in the
  report and run all benchmark iterations in desktop Chrome as specified in AC-1.
- For Aurora schema: use `TEXT` (not `VARCHAR(N)`) for `node_iri` and `graph_id` — IRIs have no
  fixed maximum length; `VARCHAR` would require a migration later if a client uses long IRIs.
- The `SET LOCAL app.current_tenant_id` pattern must be documented in the schema design notes
  for TASK-004: `SET LOCAL` is connection-scoped; SQLAlchemy async connection pools reuse
  connections, so `SET LOCAL` must be called inside every `async with session.begin()` block.
- File the OQ-01 / OQ-05 decision as `decisions/ADR-001.md` so TASK-002 and TASK-004
  can cite it; a dangling comment in code is not sufficient.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
