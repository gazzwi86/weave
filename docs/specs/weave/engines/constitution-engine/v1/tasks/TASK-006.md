---
type: Task
title: "Task: TASK-006 — Structured-Data Import: R2RML + RML (morph-kgc), OCEL Reference Mapping"
description: "E12-S4 (FR-041): morph-kgc executes user-supplied R2RML/RML mappings over uploaded
  dumps (SQLite/CSV/JSON/XML), per-row SHACL skip-and-report through CE-WRITE-1; ships the OCEL
  2.0 reference RML mapping (ADR-010). No live connection strings (ADR-012)."
tags: [constitution-engine, arch, task, milestone-v1, ingest, r2rml, rml, ocel]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Should Have
entity: constitution-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-001]
unlocks: [TASK-008]
adr_refs: [ADR-010, ADR-012]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-041, E12-S4) ·
Contracts: [contracts.md](../../../../contracts.md) (CE-WRITE-1) · v1 delta:
[v1-delta.md](../../tech-spec/v1-delta.md) §1–§2, §6 · ADRs:
[ADR-010](../../decisions/ADR-010.md) (materialised copy; OCEL rides this path),
[ADR-012](../../decisions/ADR-012.md) (morph-kgc; mappings are corpus artefacts;
uploaded-dumps-only)

## Story

As a data owner with CMDB exports, spreadsheets, or OCEL event logs, I want to run a W3C
R2RML/RML mapping over an uploaded dataset and get SHACL-validated graph rows, so structured
inventories seed the graph as a materialised, versioned copy.

## Scope

The RML extractor plugin (kind=`dataset`). IN: mapping upload (Turtle, a corpus artefact per
ADR-012), source upload (SQLite dump / CSV / JSON / XML), morph-kgc execution in the worker,
per-row SHACL with skip-and-report, datatype inference sampling (≥ 20 rows, settings
`ingest.datatype_inference_sample_rows`), committed-vs-skipped summary (FR-030-consistent),
and the shipped **OCEL 2.0 reference RML mapping** as a documented example (closes OQ-14's
build side). Deterministic — no LLM. OUT: live connection strings (ADR-012 — config schema has
no DSN field), visual mapping editor (deferred), query-time federation (ADR-010).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-006-01 | WHEN an import runs over an uploaded source + mapping THE SYSTEM SHALL materialise RDF committed through CE-WRITE-1 (batched), SHACL-validated per row, with PROV-O naming the source dataset AND the mapping via `prov:used`. |
| AC-006-02 | WHEN rows fail SHACL THE SYSTEM SHALL skip them with a per-row reason and commit the rest (`failing-rows-skip-and-report`), reporting a committed-vs-skipped summary consistent with the bulk-CSV flow (FR-030). |
| AC-006-03 | WHEN the mapping is malformed THE SYSTEM SHALL reject it before any commit with a clear error; the store is untouched. |
| AC-006-04 | WHEN datatype inference runs THE SYSTEM SHALL sample ≥ N rows (default 20, from settings) before typing a column. |
| AC-006-05 | WHEN a mapping config is submitted THE SYSTEM SHALL accept only uploaded-dump source references — no DSN/connection-string field exists in the schema (ADR-012; invariants delta). |
| AC-006-06 | WHEN an OCEL 2.0 JSON log is imported with the shipped reference mapping THE SYSTEM SHALL land events as `Event` individuals and object types as their mapped BPMO kinds, unmapped→Concept flagged (ADR-010) — no process-mining output of any kind. |
| AC-006-07 | WHEN mapped rows re-mention existing entities THE SYSTEM SHALL reuse via find-existing-node (CE-WRITE-1 dedup also backstops at commit). |
| AC-006-08 | WHEN the AI provider is down THE SYSTEM SHALL still run this import end-to-end (deterministic lane). |

## Pseudocode

```text
class RmlExtractor(Extractor):               # kind='dataset'; job carries mapping_artefact_iri
    def extract(job):
        mapping = corpus.fetch(job.mapping_artefact_iri)      # Turtle, ADR-012
        try: config = morph_kgc_config(source=local_path(job.artefact), mapping=mapping)
        except MappingError as e: fail_job(str(e))            # before any commit
        triples = morph_kgc.materialize(config)               # in-process
        for row_group in group_by_subject(triples):           # one proposal per subject row
            kind = kind_of(row_group) or (settings.unmapped_default, flag=True)
            yield Candidate(ops=to_ops(row_group), confidence=1.0,
                            matches=find_existing_node(label(row_group), kind),
                            reason=row_reason_if_flagged)
# per-row SHACL happens at accept via the normal prospective validation; the job-level
# "commit rest, skip failures" runs accepts in bulk mode: each subject-group is its own
# proposal, so a failing row 422s alone and the summary counts it as skipped.
```

## API Contracts

No new endpoints — TASK-001 spine (upload accepts `mapping_artefact_iri` alongside the dataset;
both are ordinary corpus artefacts). Mutation: **CE-WRITE-1** only.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| Ingest component delta | [v1-delta.md](../../tech-spec/v1-delta.md) §1 | RML Runner position (worker, deterministic lane) |
| Mapping-layer decision | [ADR-012](../../decisions/ADR-012.md) | Engine choice, storage, dumps-only guard |
| OCEL decision | [ADR-010](../../decisions/ADR-010.md) | OCEL→BPMO reference mapping semantics |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One proposal per subject row-group | Makes "skip failing rows, commit rest" fall out of the per-proposal 422 path — no bespoke partial-commit machinery | FR-041 AC + TASK-001 spine |
| morph-kgc in-process, no sidecar | Only Python engine covering R2RML+RML; Law A/E | ADR-012 |
| Dumps-only source schema | No live credentials in CE; live sources are PLAT-CONNECTOR-1 | ADR-012 |
| OCEL ships as a reference mapping file, not code | Data not code — amendable like the TASK-004 tables; per-qualifier gaps land as flagged rows | ADR-010 |

## Test Requirements

Minimum: 4 unit, 5 integration.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should reject malformed mapping before materialisation | AC-006-03 |
| Unit | should group triples by subject into per-row proposals | AC-006-01/02 |
| Unit | should sample ≥ N rows (from settings) for datatype inference | AC-006-04 |
| Unit | should reject config containing any connection-string-shaped source (schema-level) | AC-006-05 |
| Integration | CSV fixture + RML mapping → committed rows with prov:used naming source AND mapping | AC-006-01 |
| Integration | fixture with 2 SHACL-failing rows → rest commit, summary counts skips with reasons (`failing-rows-skip-and-report`) | AC-006-02 |
| Integration | malformed mapping → store untouched (graph diff empty) | AC-006-03 |
| Integration | OCEL 2.0 sample log + shipped mapping → Event individuals + flagged unmapped object types | AC-006-06 |
| Integration | end-to-end with LLM mock down | AC-006-08 |

## Dependencies

- **blocked_by**: TASK-001 (spine; corpus artefact storage for mappings)
- **unlocks**: TASK-008

## Cost Estimate

**M** — est. **450k tokens** (S ≈ 200k, M ≈ 400k, L ≈ 700k). morph-kgc integration + row-group
proposal shaping + the OCEL reference mapping authoring + fixture matrix (CSV/SQLite/OCEL).

## DoR Checklist

- [x] Engine + storage + dumps-only pinned (ADR-012)
- [x] OCEL semantics pinned (ADR-010)
- [x] Sampling default + settings key pinned (v1-delta §6)
- [ ] TASK-001 merged (DAG)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass; named test verbatim: `failing-rows-skip-and-report`
- [ ] No DSN field anywhere in config schema (invariant verify-by green)
- [ ] OCEL reference mapping shipped + documented as the worked example
- [ ] Coverage ≥ 80%, mutation ≥ 60%; Law E budgets

## Implementation Hints

- morph-kgc reads a config INI/dict naming source + mapping paths — wrap it, don't shell out.
- Big datasets: cap v1 at the 25 MB upload bound; row volume beyond that is a re-import in
  slices. <!-- ponytail: no streaming/chunked import; revisit if real dumps exceed the cap -->
- The "bulk accept" UX for thousands of row-proposals: accept-all-unflagged is a client loop
  over TASK-001 accepts in v1 (per-proposal HITL stays intact — flagged rows always need
  explicit clicks).
- Pitfall: morph-kgc output IRIs come from the mapping's templates — run them through the IRI
  conventions check (semantic-web standards) before proposing; bad templates should read as
  per-row skip reasons, not 500s.
- Pitfall: OCEL `object` types are tenant-vocabulary, not BPMO — expect most to flag to Concept;
  that is correct behaviour, not a mapping bug (ADR-010 consequence).
