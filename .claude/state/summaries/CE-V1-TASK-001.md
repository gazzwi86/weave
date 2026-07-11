# Progress: CE-V1-TASK-001 — SKOS Glossary Backend (Punned Term Model + SHACL) (EPIC-003 root)

`constitution-engine` EPIC-003. **PARALLEL LANE B** worktree `../weave-CE-V1-EPIC-003`, branch `feature/CE-V1-EPIC-003`
(off origin/main 67fc6ef — behind by EPIC-008, restack at close). Backend. Built across overflow + continuation.
Coordinator-authored from receipt, pre-QA. HEAD `23ee5ed`, not pushed.

## Outcome — engineer reports DONE (QA PENDING). 7 ACs, all PASS per engineer.

## What shipped (no new op/write/read endpoint — FR-003 design decision)
- **Punning via existing `add_node`** (`3979906`): `additional_types` (owl:Class pun), `{"value","lang"}` lang-literal
  marker (prefLabel), plain-string props (definition). SHARED literal-construction seam.
- **`weave:GlossaryTermShape`** (`968a08a`, framework.shacl.ttl ~225-267): `sh:uniqueLang`/`sh:minCount`/`sh:maxCount` —
  no hand-rolled counting; inline ADR-022 rationale.
- **SHACL message enrichment** (`f7205dc`): `shacl.py::_to_result` special-cases `sh:UniqueLangConstraintComponent` —
  re-scans data graph at `(focus,path)` with `Counter`, appends `(duplicate language tag: en)`. Zero behaviour change
  for other constraint types.

## Per-AC (engineer-reported — QA re-verify; brief has 7 ACs, counted exactly)
- **AC-001-01** punned IRI carries owl:Class + skos:Concept (one URI) — unit neg + integration reconcile test.
- **AC-001-02** SHACL cardinality (prefLabel lang, one definition) — unit + integration `test_second_definition_returns_422`.
- **AC-001-03** duplicate prefLabel@en → 422 NAMING the language — unit + integration.
- **AC-001-04** skos:broader/narrower target must be a glossary term — unit pos+neg.
- **AC-001-05** reconciliation returns OWL+SKOS from one URI (shared w/ AC-01).
- **AC-001-06** PROV-O stamped on commit via generic CE-WRITE-1 path.
- **AC-001-07** validation `inference='none'` (no owl:Class derived from rdfs:subClassOf).

## ⚠️ Blast-radius (QA MUST VERIFY) — shared `add_node` seam, XT-WRITEPATH-1
`3979906` extends the SAME literal-construction seam CE-003 modified for `sh:datatype` coercion (different branch).
Engineer: full backend unit suite 945 passed/0 failed (no other literal-writing caller regressed). QA re-verify.
**At merge (CE-001 + CE-003), reconcile add_node: UNION of datatype-coercion (CE-003) + punned/list/lang (CE-001).**

## Gates
ruff 0 · mypy 0/427 · bandit 0 High (2 pre-existing Medium `#noqa` uvicorn binds) · shacl.py coverage 96% ·
8 relevant unit + 4 integration (26/26 docker). E2E deferred to TASK-002 per brief. No new tables (no RLS).

## Flag
DoD references a "no-second-mutation-path CI assertion" that doesn't exist yet in the repo — engineer verified by
inspection (empty routers/ diff). Backlog note if that CI assertion is expected by TASK-002.

## Commits (feature/CE-V1-EPIC-003, not pushed): 3979906 · 968a08a · 86f6b59 · f7205dc · 23ee5ed (HEAD).

## Epic status
EPIC-003 root. TASK-002 (glossary UI/E2E) is next in epic (E2E deferred to it). Restack onto ba818b9 at epic-close.

## QA PASS (2026-07-11, a1bd327, retry 0) — CE-V1-TASK-001 CLOSES
Adversarial QA re-ran all gates: ruff 0, mypy 0/427, 950 unit (945+5 QA edge), 4/4 integration (fresh stack), coverage
graph_ops 100%/shacl 96%. All 7 ACs PASS w/ real e2e evidence. **Shared add_node seam blast-radius CLEAN** — grep-verified
no current caller (instances/imports/restrictions/seed_demo) passes list/lang props; added 2 regression tests (single-type
byte-unchanged, non-{value,lang} dict not mis-sniffed). QA edge commit `042fbfe` (5 edge tests). WARNs: mutmut not installed
(phase-gate concern, already queued), summary-header format (cosmetic). **XT-WRITEPATH-1 CONFIRMED un-auto-mergeable** by QA
source-diff: CE-003's `_to_literal(datatype=)` + no-fanout `_apply_add_node` vs CE-001's punning/list/lang rewrite the SAME
signature+loop incompatibly → MUST hand-union at merge (datatype-coercion AND punned/list/lang). retry=0.
