# Progress: CE-V1-TASK-009 — CE-FUNCTION-1 Registry (Definition Surface) (EPIC-010 root)

`constitution-engine` EPIC-010. LANE D worktree `../weave-CE-V1-EPIC-010`, branch `feature/CE-V1-EPIC-010` (off 67fc6ef —
restack onto ba818b9 at epic-close). Backend. Built across 5 passes (all committed, tree clean). Coordinator-authored from
commit log (finisher didn't deliver a final report — QA validates independently). HEAD `ea35da4`, not pushed.

## What shipped (8 commits)
- `functions/{__init__,converter,immutability,registry,signature}.py` + `schemas/functions.py` — CE-FUNCTION-1 registry
  (definition surface; punned function defs). `routers/functions.py` — the CE-FUNCTION-1 route (`c2249de`).
- **`b0e7c0d` enforces function immutability in the SHARED write pipeline** (`operations/pipeline.py` + `routers/operations.py`).
- `58cb5e3` registry reads surface newest DRAFT (not published-only). `d694004` jsonschema dev dep (AC-009-07 contract test).
- Tests: unit (contract roundtrip + route invariants `7f5c347`), integration (`7053d36` + fix `ea35da4`).

## QA MUST VERIFY (finisher gave no report — these are unconfirmed)
1. **Integration tests actually RUN + PASS with `-m "integration and docker and not stack"`** (PROJ-003 — without the marker
   they silently deselect → false green).
2. **Full backend unit-suite REGRESSION** — `b0e7c0d` changed the SHARED `operations/pipeline.py` (function-immutability gate)
   + `routers/operations.py`. Confirm NON-function writes (ingest accept, explorer edit, brand, glossary) still pass through
   the pipeline UNAFFECTED — an immutability gate wrongly blocking a normal write = Blocker.
3. Every AC in the brief has a test (count exactly). CE-FUNCTION-1 contract fidelity vs contracts.md.
4. jsonschema dep justified (AC-009-07) + mainstream.

## Migration
No new migration confirmed by engineer? (functions likely RDF individuals — QA confirm migrations/ diff empty or 0060).

## Commits (feature/CE-V1-EPIC-010, not pushed): 99059f6 · 58cb5e3 · b0e7c0d · c2249de · d694004 · 7f5c347 · 7053d36 · ea35da4 (HEAD).

## Epic status: EPIC-010 root. Restack onto ba818b9 at epic-close (also blocked on red-main PROJ-005). XT-WRITEPATH-1: pipeline.py change is a DIFFERENT function than the graph_ops _to_literal seam, but same file family — watch at merge.

## QA PASS (2026-07-11, a6aa4e6, retry 0) — CE-V1-TASK-009 CLOSES
All 8 ACs (AC-009-01..08, exact count) real tests. **Shared-pipeline immutability gate CORRECTLY SCOPED** — strict
conjunction (function-kind/signature-predicate AND pre-existing target AND published); short-circuits BEFORE version/graph
I/O for all other writes. QA added adversarial `test_a_normal_non_function_write_never_touches_the_immutability_gate`
(`fff2a18`) proving resolve_version+run_query never called on a normal published-node edit → non-function writes (ingest/
explorer/brand/glossary) unaffected. Full unit suite ~983 green, ruff/mypy 0/440, 5/5 integration RAN WITH marker (not
deselected). CE-FUNCTION-1 contract-faithful (2 GET routes, no POST/PUT, no per-fn semver — invariant-tested; roundtrip
= genuine pyshacl↔jsonschema cross-check). RDF-only, no migration, tenant scoping reused. WARN: coverage%/mutation not
numerically measured (met-by-inference). Minor: "grounding entity IRIs" surfaced as kind_iri/shape_iri per param (architect
confirm, non-blocking). retry=0.
