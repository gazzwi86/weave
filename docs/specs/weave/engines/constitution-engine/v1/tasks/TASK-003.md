---
type: Task
title: "Task: TASK-003 — Document Corpus Store: Chunking, Embeddings, Retrieval, NL Citations"
description: "The read-side companion store (FR-043/FR-044 tail, E12-S6): per-format chunking
  with fixed-window fallback, Titan v2 embeddings into S3 Vectors (per-index model metadata),
  tenant-filtered top-k retrieval, and the additive citations array on NL query (per ADR-011,
  program ADR-003)."
tags: [constitution-engine, arch, task, milestone-v1, ingest, corpus, embeddings]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have (P1 within epic)
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-001, TASK-002]
unlocks: [TASK-008]
adr_refs: [ADR-011]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-043, E12-S6; FR-044
prompt-side lands in TASK-002) · Contracts: [contracts.md](../../../../contracts.md) (CE-READ-1
— citations array now canonical there) · v1 delta: [v1-delta.md](../../tech-spec/v1-delta.md)
§5 · ADRs: [ADR-011](../../decisions/ADR-011.md) (Accepted with pins 1a/2a), program
[ADR-003](../../../../decisions/ADR-003-document-corpus.md)

## Story

As an extraction agent or an NL-query user, I want ingested source documents retrievable as
cited passages, so proposals ground in source text and NL answers cite BOTH the graph IRI and
the passage the extraction rests on — without any retrieval path being able to write to the
graph.

## Scope

IN: the chunker (per-format simple splitters per ADR-011 §1: XML per-element-with-parent-context,
prose heading-based, mandatory fixed-window fallback — pin 1a), embed-on-ingest-commit via
Bedrock Titan v2, S3 Vectors index per tenant prefix with `embedding_model_id` + `dimensions`
metadata (pin 2a), `GET /api/corpus/search` + `GET /api/corpus/artefacts/{iri}`, the extractor's
related-passage lookup, the `citations` array on `POST /api/query/nl`, and lifecycle
(re-embed on re-ingest, delete on tenant deletion). OUT: re-ranker, ML layout parsing, batch
re-embed tooling beyond the swap job stub (all deferred per ADR-011).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-003-01 | WHEN an ingest commits THE SYSTEM SHALL chunk the artefact with its format's splitter (XML: per element/process with parent context; prose: heading-first; unrecognised: fixed-window-with-overlap — `unknown-format-still-chunks`), ~512-token target, ~15% overlap, each passage carrying a locator (page / heading-path / char-range). |
| AC-003-02 | WHEN passages are embedded THE SYSTEM SHALL call the index's configured model (default `amazon.titan-embed-text-v2:0`, 1024-dim) and write vectors under the tenant prefix; the index records `embedding_model_id` + `dimensions` metadata and the embed path SHALL assert the model matches before writing — never mixed models in one index (pin 2a). |
| AC-003-03 | WHEN `GET /api/corpus/search?q=&k=` is called THE SYSTEM SHALL return top-k (default 8, PLAT-SETTINGS-1 `corpus.retrieval_top_k`) cosine matches filtered by tenant prefix injected from request context — never caller-supplied — with optional metadata filters (source system, date-of-truth); p95 ≤ 500 ms. |
| AC-003-04 | WHEN tenant A searches THE SYSTEM SHALL never return tenant B's passages (release-gating cross-tenant vector-isolation test, ADR-001 rank). |
| AC-003-05 | WHEN an NL query's answer rests on entities extracted from a retained artefact THE SYSTEM SHALL include the additive `citations` array (per contracts.md CE-READ-1): each entry pairing `entity_iri` + `artefact_iri` + `passage_id` + locator + ≤300-char snippet (`citation-pairs-iri-and-passage`); the base response shape is unchanged. |
| AC-003-06 | WHEN an ingested document has been committed THE SYSTEM SHALL make it retrievable (`GET /api/corpus/artefacts/{iri}` → metadata + presigned S3 GET, p95 ≤ 300 ms) and its passages SHALL resolve to the entities they produced via `prov:used` links (FR-043 AC). |
| AC-003-07 | WHEN any corpus module executes THE SYSTEM SHALL have no path to graph mutation — CI structural assert: no import of the operations/apply pipeline under `corpus/`, no POST route under `/api/corpus/*` (ADR-003 read-side-only, CI-asserted). |
| AC-003-08 | WHEN the same artefact is re-ingested THE SYSTEM SHALL re-embed (replace its passages); WHEN a tenant is deleted THE SYSTEM SHALL delete its corpus prefix + vectors (rides the ADR-001 deletion path). |

## Pseudocode

```text
on_ingest_commit(job):                       # hook after TASK-001 marks proposals accepted
    passages = split(job.artefact)           # dispatch: xml|prose|fallback (pin 1a)
    index = vectors.index_for(tenant)        # creates with metadata {model_id, dims} (pin 2a)
    assert index.meta.model_id == settings.embedding_model_id   # never mix
    embed_batch = bedrock.embed(model=index.meta.model_id, texts=[p.text])
    index.put(tenant_prefix, ids=[p.id], vecs, meta={artefact_iri, locator, source_system, ...})
    s3.put(corpus_bucket, f"{tenant}/{hash}/passages.jsonl")

GET /api/corpus/search:
    vec = bedrock.embed(model=index.meta.model_id, [q])
    return index.query(vec, k, filter=tenant_prefix_from_ctx() + optional_meta)  # fail-closed

nl_query_citations(answer):                  # inside existing POST /api/query/nl handler
    for iri in answer.grounded_iris:
        artefact = prov.lookup_used(iri)     # SPARQL over prov graph
        if artefact: passages = corpus.search(answer.question, filter={artefact})
        citations += pair(iri, artefact, passages[0])
    return answer + {citations}              # additive; absent when no corpus source
```

## API Contracts

- **CE-READ-1** `POST /api/query/nl` — `citations` array now canonical in
  [contracts.md](../../../../contracts.md) (additive, applied by coordinator 2026-07-08).
- `GET /api/corpus/search`, `GET /api/corpus/artefacts/{iri}` — CE-internal, shapes + p95 in
  [v1-delta.md](../../tech-spec/v1-delta.md) §2. Errors: 400/401/403/404/422/500.
- NO write API under `/api/corpus/*` — its absence is itself an invariant (AC-003-07).

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | Corpus Retrieval wiring: extractor lookup + NL citations edges |
| Corpus layout + lifecycle | [v1-delta.md](../../tech-spec/v1-delta.md) §5 | S3 key scheme, prov footprint, re-embed/delete lifecycle |
| Decision detail | [ADR-011](../../decisions/ADR-011.md) | Chunking pins, model pin 2a, citation schema |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Titan v2, config-pinned per index (pin 2a) | Reversible two-way door: swap = re-embed/re-index job, never schema migration; multilingual PRD flips default to Cohere (recorded trigger) | ADR-011 (Fable-reviewed) |
| Simple splitters + mandatory fallback (pin 1a) | Every upload chunks, none errors; PDF/table fidelity is v-later behind evals | ADR-011 (Fable-reviewed) |
| No re-ranker in v1 | Cold-start corpora are small; add behind retrieval evals | ADR-011 |
| Citations additive on NL response | Base CE-READ-1 shape unchanged; M1/M2 consumers ignore harmlessly | contracts.md CE-READ-1 |
| Read-side-only, CI-asserted | CE-WRITE-1 stays the sole mutation path (PRD §10) | ADR-003, v1-delta §9 |

## Test Requirements

Minimum: 5 unit, 5 integration, 1 E2E-adjacent (rides TASK-008's E2E).

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should split prose by headings to ~512 tokens with overlap + locators | AC-003-01 |
| Unit | should split XML per element with parent context prepended | AC-003-01 |
| Unit | should fall back to fixed windows on unrecognised format (`unknown-format-still-chunks`) | AC-003-01 |
| Unit | should assert index model_id before embedding (mismatched model raises) | AC-003-02 |
| Unit | should build citation entries pairing iri + artefact + passage + snippet ≤ 300 chars | AC-003-05 |
| Integration | should embed + retrieve committed doc's passage (local emulator, Law F) | AC-003-02/06 |
| Integration | two-tenant fixture: tenant-A passage never in tenant-B results (**release-gating**) | AC-003-04 |
| Integration | should resolve passage→produced entities via prov:used | AC-003-06 |
| Integration | should re-embed on re-ingest (old passage ids replaced); delete on tenant deletion | AC-003-08 |
| Integration | NL query over extracted entity returns citations; over hand-authored entity returns none (`citation-pairs-iri-and-passage`) | AC-003-05 |
| CI assert | structural: no mutation import under `corpus/`, no POST /api/corpus route | AC-003-07 |
| Perf | search ≤ 500 ms; artefact GET ≤ 300 ms | AC-003-03/06 |

## Dependencies

- **blocked_by**: TASK-001 (artefact store, prov links), TASK-002 (structure parse the chunker
  reuses — ADR-011 "no second parser"; source_span locators in proposals)
- **unlocks**: TASK-008 (epic E2E asserts a citation end-to-end)

## Cost Estimate

**L** — est. **600k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). Three splitters + embed/retrieval
plumbing + NL-handler surgery + the isolation test rig on local emulators.

## DoR Checklist

- [x] All four deferred ADR-003 items decided (ADR-011 Accepted with pins, Fable-reviewed)
- [x] Citations shape canonical in contracts.md (coordinator applied 2026-07-08)
- [x] S3/Vectors layout + lifecycle pinned (v1-delta §5)
- [x] Locators flow from TASK-002 (source_span requirement written into its brief)
- [ ] TASK-001 + TASK-002 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass; cross-tenant vector-isolation test wired as release-gating in CI
- [ ] Index metadata (model_id, dims) written at creation + asserted pre-embed (pin 2a)
- [ ] Named tests exist verbatim: `unknown-format-still-chunks`, `citation-pairs-iri-and-passage`
- [ ] No cloud in tests: S3/Vectors emulated locally, Bedrock embed mocked with recorded vectors (Law F)
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- S3 Vectors local emulation: prefer LocalStack if it covers the API used; else a thin in-memory
  fake behind the vectors client interface — the interface is small (put/query/delete by
  prefix). <!-- ponytail: in-memory fake is fine; fidelity matters only for the filter semantics -->
- Citation lookup must be **best-effort and fast**: if the prov lookup or vector search misses
  its slice of the NL budget, return the answer without citations rather than blowing the NL
  p95 — citations are additive, absence is legal.
- Pitfall: passage ids must be deterministic per (artefact_hash, locator) so re-ingest replaces
  instead of duplicating.
- Pitfall: the tenant filter is constructed server-side from auth context — reject any `tenant`
  query param at the router (invariants delta: never caller-supplied).
- The model-swap "job" in v1 is a stub: a documented admin script that creates a new index with
  new metadata and re-embeds from `passages.jsonl` — do not build orchestration UI.
