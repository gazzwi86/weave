# Progress: CE-V1-TASK-003 — Brand & Voice Model + CE-BRAND-1 Projections (EPIC-004, root)

`constitution-engine` EPIC-004. **PARALLEL LANE F** worktree `../weave-CE-V1-EPIC-004`, branch `feature/CE-V1-EPIC-004`
(off origin/main). Backend. Built across prior overflow + continuations. Coordinator-authored from receipt, pre-QA.
HEAD `5cf3d7d`, not pushed.

## Outcome — engineer reports DONE (QA PENDING)

## What shipped
- **BrandStandard / VoiceRule** as RDF individuals (no new tables/migration — RDF-only), `weave:BrandStandardShape` +
  `weave:VoiceRuleShape` SHACL, excluded from BPMO catalogue (`55ee518`).
- **Brand projection + CE-BRAND-1 read endpoint**: `brand/{projection,cache,queries}.py`, `routers/brand.py`,
  `schemas/brand.py` — derived-on-read (no second store), version-scoped `?version=latest|{iri}`, closed-core keys
  (`color/typography/spacing/radius`) always present + open `extensions`, voice-rule `{id,severity,assertion}`.
  Contract-faithful to contracts.md CE-BRAND-1.
- **XT-CE003-1 fix (SHARED WRITE PATH — QA must verify blast radius):** `graph_ops.py` `_resolve_datatype` coerces a
  literal from the predicate's `sh:datatype` on the target NodeShape, DEFAULT `xsd:string` (`7edd357`). Plus
  `InvalidLiteralError` → `400 {"error":"invalid_literal_value"}` mapping in `routers/operations.py` (`2824144` — the
  fix's docstring claimed this existed; it didn't → engineer found+fixed).

## Per-AC (engineer-reported — QA re-verify)
- **AC-003-01** reachable end-to-end via REAL HTTP: `test_effective_date_string_coerces_to_xsd_date_and_commits` POSTs a
  BrandStandard through `POST /api/operations/apply` → 201 → parses committed Turtle → `effectiveDate.datatype==XSD.date`,
  value `"2026-01-01"`. Through the real pipeline/BPMO-guard/SHACL (not the graph_ops unit shortcut).
- **AC-003-02/05** missing-required-prop → 422; **AC-003-03/04** commit+publish+GET closed-core+extensions+voice shape.
- **AC-003-06** contract half ✓ (flat JSON). **Perf half (p95 ≤400ms @100k triples, locust) NOT built** — flagged:
  the only perf harness (`scripts/benchmarks/ce-perf/`) is scoped to CE-008's spike; wiring brand in = real extension.
  DECISION NEEDED (queue): extend that harness with a brand corpus, or defer to CE-BRAND-1's M2 Build-conformance gate
  (contracts.md already scopes that gate to M2). NOT a unilateral drop.
- **AC-003-07** 401 no-bearer / 404 unknown-version, both endpoints.

## Blast-radius (datatype fix) — engineer claims clean, QA MUST RE-VERIFY
Full backend unit suite 947 passed/0 failed; explicit `test_add_node_with_a_plain_string_property_is_unaffected_by_the_coercion`;
malformed date → 400 (not 500) via `test_malformed_effective_date_returns_400_not_500` (asserts graph untouched).
**This is the shared literal-construction seam — also being extended by CE-001 (XT-WRITEPATH-1) → reconcile at merge.**

## Gates
ruff 0 · mypy 0/434 · bandit 0 High (2 pre-existing Medium `# noqa` uvicorn binds) · coverage 87% · 9/9 integration
(fresh `weave-ce004` stack, PG 5446/Redis 6393, no --cov PROJ-013). ADR-022-brand-token-encoding added.

## Commits (feature/CE-V1-EPIC-004, not pushed)
55ee518 · 5a2d139 · 67c8b8f · 7edd357 · 2824144 · 5cf3d7d (HEAD).

## Epic status
EPIC-004 root task. Check epic-check for remaining tasks. XT-CE003-1 fix landed here (shared write path).
