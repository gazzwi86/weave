---
type: Task
title: "Task: TASK-012 — Ingest Foundation: Artefact Upload, Job Lifecycle, Proposal Store"
description: "The spine every EPIC-012 story rides: POST /api/ingest/artefacts (S3 corpus
  storage + FR-044 context capture), async job lifecycle, Aurora proposal store, and per-proposal
  accept/reject routed through the CE-WRITE-1 dispatch (FR-038/FR-044 plumbing)."
tags: [constitution-engine, arch, task, milestone-v1, ingest]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have (within epic)
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: [TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019]
adr_refs: [ADR-010, ADR-011, ADR-012]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-012 preamble,
FR-044) · Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1 — the ONLY mutation
path) · v1 delta: [v1-delta.md](../../tech-spec/v1-delta.md) §1–§2, §5–§6 · ADRs:
[ADR-010](../../decisions/ADR-010.md), program
[ADR-003](../../../../decisions/ADR-003-document-corpus.md)

## Story

As any EPIC-012 ingest path (document, model file, image, dataset), I need one shared spine —
upload an artefact with business context, run an async extraction job, hold candidate proposals
for per-proposal human review, and commit accepted ones through CE-WRITE-1 — so no story builds
its own pipeline and no second mutation path can exist.

## Scope

The pipeline spine ONLY — no extractors (TASK-013+), no embeddings/retrieval (TASK-014), no
frontend page (TASK-019). IN: `POST /api/ingest/artefacts`, S3 corpus write (tenant-prefixed),
`ingest_jobs` + `ingest_proposals` Aurora tables (tenant RLS), `GET /api/ingest/jobs/{id}`,
`GET /api/ingest/jobs/{id}/proposals`, `POST /api/ingest/proposals/{id}/accept|reject`, the
worker skeleton (job dequeue → pluggable extractor interface → proposal rows), FR-044 context
capture onto the ingest `prov:Activity`, and the PROV-O attribution builder (extractor + human
approver + `prov:used`).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-001-01 | WHEN a file (≤ 25 MB) is uploaded with optional FR-044 context fields (source system, owner, date-of-truth, sensitivity, free-text context) THE SYSTEM SHALL store the original at `s3://weave-corpus-{env}/{tenant_id}/{artefact_hash}/original.{ext}`, mint an artefact IRI as a `prov:Entity` in the tenant prov graph, and return `201 { artefact_iri, job_id }` — creating NO draft-graph individual. |
| AC-001-02 | WHEN context fields are supplied THE SYSTEM SHALL persist them as annotation properties on the ingest `prov:Activity`; WHEN skipped THE SYSTEM SHALL proceed with system-captured provenance only (FR-044). |
| AC-001-03 | WHEN a job runs THE SYSTEM SHALL expose status `queued|extracting|awaiting-review|failed|done` via `GET /api/ingest/jobs/{id}` (p95 ≤ 200 ms) with a committed-vs-skipped-vs-rejected summary once terminal. |
| AC-001-04 | WHEN `GET /api/ingest/jobs/{id}/proposals` is called THE SYSTEM SHALL return paginated proposal rows (op-list rendering, confidence, matched existing IRIs, per-element reason) for this tenant only (RLS; p95 ≤ 300 ms). |
| AC-001-05 | WHEN a proposal is accepted THE SYSTEM SHALL replay it through the M1 propose-mutations pipeline — prospective SHACL on a throwaway clone, then CE-WRITE-1 commit via the ADR-006 dispatch — with a PROV-O activity naming the extractor agent, the human approver (`principal_iri` from JWT), and the source artefact via `prov:used` (p95 ≤ 2.8 s). |
| AC-001-06 | WHEN an accepted proposal would produce `sh:Violation` THE SYSTEM SHALL return `422` with violations mapped to the proposal and leave the graph unchanged. |
| AC-001-07 | WHEN a proposal is rejected THE SYSTEM SHALL mark it rejected (kept for audit, counted in the job summary) and touch nothing else (p95 ≤ 200 ms). |
| AC-001-08 | WHEN any ingest module attempts graph mutation THE SYSTEM SHALL only be able to do so via the CE-WRITE-1 dispatch — CI structural assert: no store-level write import under `ingest/` (epic-level AC, PRD §10). |
| AC-001-09 | WHEN tenant A calls any ingest endpoint THE SYSTEM SHALL never expose tenant B's jobs, proposals, or artefacts (RLS + tenant-prefixed S3 keys per ADR-001). |
| AC-001-10 | WHEN the upload exceeds 25 MB or has no file THE SYSTEM SHALL return `422` with a clear message; nothing stored. |

## Pseudocode

```text
POST /api/ingest/artefacts (multipart + context fields):
    validate size/type basics -> 422 on fail
    key = f"{tenant}/{sha256(file)[:16]}"
    s3.put(corpus_bucket, key + "/original" + ext)
    artefact_iri = mint_iri("artefact", key)
    prov_graph.add(artefact_iri, rdf:type, prov:Entity; dcterms metadata)
    job = ingest_jobs.insert(tenant, artefact_iri, kind=detect(ext), status='queued',
                             context=context_fields)          # FR-044 raw hold
    enqueue(job.id)
    return 201 {artefact_iri, job_id}

worker(job):
    set status='extracting'
    activity_iri = start_prov_activity(job)                    # annotates FR-044 context here
    extractor = registry[job.kind]        # pluggable: doc|image|archimate|bpmn|rml (later tasks)
    for cand in extractor.extract(job):   # this task ships a no-op fixture extractor
        cand.matches = find_existing_node(cand.label, cand.kind)   # M1 reuse
        ingest_proposals.insert(job, cand.ops, cand.confidence, cand.matches, cand.reason)
    set status='awaiting-review'

POST /api/ingest/proposals/{id}/accept:
    p = load_row_for_tenant(id)           # RLS
    result = operations_dispatch(p.ops, actor=jwt.principal_iri,
                                 prov_extra={used: p.artefact_iri,
                                             extractor: p.extractor_iri,
                                             activity: p.activity_iri})   # ADR-006 dispatch
    if result.violations: return 422 {violations}
    mark accepted; bump job summary; return 201 {activity_iri, version_iri}
```

## API Contracts

CE-internal UI surface (no contracts.md change). Shapes + p95 targets canonical in
[v1-delta.md](../../tech-spec/v1-delta.md) §2. Errors on all: 400/401/403/404/422/500; 413 on
oversize upload is acceptable in place of 422 if the framework default is used — pick one and
test it. Mutation itself: **CE-WRITE-1** (contracts.md), via the ADR-006 dispatch only.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | Orchestrator/worker/proposal-store wiring to CE-WRITE-1 |
| M1 propose-mutations flow | [business-process.md](../../tech-spec/business-process.md) | The clone-validate-commit sequence accept replays |
| Corpus layout | [v1-delta.md](../../tech-spec/v1-delta.md) §5 | S3 key scheme, prov-graph footprint |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One proposal flow for all five stories | Extractors plug in; review/commit path is written once — no second mutation path possible by construction | v1-delta §1, ADR-010 |
| Artefact = `prov:Entity` only, no draft-graph individual | Uploads must not pollute the model graph; extractor may *propose* a DataAsset through review | v1-delta §5 |
| Proposals in Aurora (RLS), not the graph | Review state is workflow data, not knowledge; mirrors `graph_change_events` pattern | v1-delta §1 |
| Accept = client loop, no batch endpoint | ponytail: add batch only if >50-proposal jobs are the review norm | v1-delta §2 |
| 25 MB cap, coordinator-acknowledged invented default | Tunable later; prevents unbounded S3/extraction cost at v1 | HITL 2026-07-08 |

## Test Requirements

Minimum: 4 unit, 6 integration, perf per endpoint table.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should build prov activity with context annotations when FR-044 fields present | AC-001-02 |
| Unit | should build prov activity with system-only provenance when context skipped | AC-001-02 |
| Unit | should reject oversize/missing file before any storage call | AC-001-10 |
| Unit | should compute job summary counts (committed/skipped/rejected) | AC-001-03 |
| Integration | should store artefact + prov:Entity + return 201 with no draft-graph individual (`artefact-upload-creates-no-draft-individual`) | AC-001-01 |
| Integration | should commit accepted proposal via CE-WRITE-1 with full PROV attribution incl. prov:used (`accepted-proposal-carries-prov-used`) | AC-001-05 |
| Integration | should 422 + unchanged graph on sh:Violation accept | AC-001-06 |
| Integration | should keep rejected proposal for audit and count it | AC-001-07 |
| Integration | two-tenant fixture: jobs/proposals/artefacts invisible cross-tenant | AC-001-09 |
| Integration (CI assert) | structural: no store-write import under `ingest/` (`no-second-mutation-path-ingest`) | AC-001-08 |
| Perf | upload ≤ 2 s; job GET ≤ 200 ms; proposals GET ≤ 300 ms; accept ≤ 2.8 s | AC-001-03/04/05 |

## Dependencies

- **blocked_by**: none (M1 dispatch + prov builder + find-existing-node all exist; M1 program
  gate green is the build precondition for the whole milestone)
- **unlocks**: TASK-013..TASK-019 (every extractor and the page plug into this spine)

## Cost Estimate

**L** — est. **650k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Two migrations, five endpoints, the
worker skeleton, prov plumbing, and the RLS + no-second-path test surface. It is the milestone's
riskiest task by construction — everything else is a plugin to it.

## DoR Checklist

- [x] Mutation path pinned (CE-WRITE-1 via ADR-006 dispatch; ADR-010)
- [x] Endpoint shapes + p95 pinned (v1-delta §2)
- [x] S3 layout + prov footprint pinned (v1-delta §5)
- [x] FR-044 fields enumerated (engine spec FR-044)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf)
- [ ] CI structural assert (`no-second-mutation-path-ingest`) wired into the pipeline, not just local
- [ ] Two-tenant isolation tests green (Aurora RLS + S3 prefix)
- [ ] Tunables read from PLAT-SETTINGS-1 keys (no literal 25 MB/thresholds in logic)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules; complexity within Law E budgets

## Implementation Hints

- Reuse the ADR-006 dispatch function directly — do NOT re-wrap validation; accept is a thin
  caller that adds prov extras.
- Job queue: v1 is a Postgres-backed queue (`SELECT ... FOR UPDATE SKIP LOCKED` on
  `ingest_jobs`) — no SQS/new infra; the worker is a Fargate task of the same codebase.
  <!-- ponytail: pg queue; move to SQS only if job volume/tenant fan-out demands it -->
- The pluggable extractor interface is one Protocol with `extract(job) -> Iterator[Candidate]`;
  this task ships only a fixture extractor for tests — resist implementing any real one here.
- Pitfall: prov activity must be started by the worker (extraction time), but the approver is
  attached at accept time — two prov moments, one activity; the M2 change-feed will emit on the
  accept commit automatically (no extra wiring).
- Pitfall: `find_existing_node` must run at proposal-build time so matched IRIs render in
  review — not at accept time.
