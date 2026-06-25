# backend/CLAUDE.md

FastAPI backend for Weave: ontology store, REST API, LLM mutation service, SHACL validation.

## Key commands (run from `backend/`)

```bash
source .venv/bin/activate          # activate venv (created by session-start hook)
uvicorn app.main:app --reload      # http://localhost:8000 — /docs for OpenAPI
pytest                             # unit tests (quiet, in-memory)
ruff check .                       # lint + import order + complexity gate (C90)
radon cc app -a -nc                # cyclomatic complexity — expect A/B
radon mi app                       # maintainability index — expect A
xenon app --max-absolute B         # fail if any module exceeds B
```

The session-start hook (`../.claude/hooks/session-start.sh`) creates the venv and installs `.[dev]` automatically.

## Directory layout

```
app/
  main.py            — create_app() factory; mounts routers, CORS
  config.py          — WEAVE_* env vars via pydantic-settings; ANTHROPIC_API_KEY un-prefixed
  namespaces.py      — weave: namespace; NODE_KIND_REGISTRY; RELATIONSHIP_TYPE_REGISTRY
  models.py          — Pydantic request/response models (NodeInput, EdgeInput, LlmOperation, …)
  api/
    routes.py        — all FastAPI routers (graph, projects, llm, schema, validate, rules)
  ontology/
    store.py         — OntologyStore: CRUD, TTL import/export, projection to nodes+edges
    seed.py          — Monsters Inc. demo ontology (verbatim Turtle; E501 suppressed)
  llm/
    service.py       — Claude tool-use call; propose_mutations schema built from namespaces registry
  validation/
    shacl.py         — SHACL validation runner; shapes_graph() (lru_cache); _extract_results()
    shapes.py        — SHACL_SHAPES constant (inline Turtle shapes)
    rules.py         — schema_rules(): SPARQL-introspects shapes into structured if/then rules
  ingest/            — CSV/JSON-Schema parser → DataAsset + Field nodes
  projects/          — ProjectManager: per-project Oxigraph store + JSON manifest
tests/
  conftest.py        — store fixture (in-memory, demo-seeded); client fixture (TestClient)
  test_api.py
  test_store.py
  test_llm.py
  test_validation.py
  test_projects.py
  test_ingest.py
```

## Architecture rules

- **OntologyStore** owns all RDF. Nothing else writes triples directly.
- **Edges are direct triples.** Annotated edges additionally get a `rdf:Statement` reification to hold comments/notes.
- **Partial-update semantics** on `update_node`: only fields present in the payload are touched (`model_dump(exclude_unset=True)`). `rdf:type` is updated when `kind` is given.
- **Node IRI via query param** (`?node_id=`): IRIs contain `://` which breaks path segments.
- **Namespaces lists are the single source of truth** for kinds and relationship types: `NODE_KINDS` and `RELATIONSHIP_TYPES` in `namespaces.py` drive the LLM tool schema, the API response, and the Cytoscape palette. Use `KIND_BY_KEY` / `REL_BY_KEY` for lookups. Add new kinds/relationships there; nowhere else.

## Validation pipeline

1. `POST /api/llm/propose` — LLM returns a `propose_mutations` tool call; no graph mutation.
2. Frontend shows the diff for human review.
3. `POST /api/operations/apply` — calls `_validate_prospective()` (internal):
   - clones the store into a throwaway `OntologyStore(seed=False)`,
   - runs `apply_operations()` on the scratch copy,
   - validates via `validate_turtle()` (pyshacl + `shapes_graph()`),
   - if violations → HTTP 422 with violation details,
   - if clean → applies to the real store + PROV-stamps.
4. `GET /api/validate` — standalone SHACL check: calls `validate_turtle(store.export_turtle())`.
5. `GET /api/rules` — `schema_rules()` SPARQL-introspects the same shapes into human-readable if/then rules (ADR-017).

Key functions: `apply_operations(store, ops, agent=...)` in `llm/service.py`; `validate_turtle(ttl)` in `validation/__init__.py`; `schema_rules()` in `validation/rules.py`.

## Test patterns

- **Store tests** (`test_store.py`): use the `store` fixture directly; no HTTP layer.
- **API tests** (`test_api.py`, etc.): use the `client` fixture (FastAPI `TestClient`); in-memory, demo-seeded; no disk I/O.
- **LLM tests** (`test_llm.py`): call `apply_operations(store, ops)` directly to test mutation logic without a real LLM call; `LLMService` is tested by passing a mock `Anthropic` client to its constructor.
- Keep `WEAVE_DATA_DIR=""` and `WEAVE_SEED_DEMO=true` in conftest (already set) so tests are isolated and hermetic.
- New behaviour ships with tests. Minimum: one happy-path + one error/edge case per new endpoint or store method.

## Complexity budget

- Cyclomatic complexity: ≤ 10 per function (ruff C90 / radon).
- Maintainability index: band A (radon mi).
- `app/ontology/seed.py` has E501 suppressed (it is data, not code).
