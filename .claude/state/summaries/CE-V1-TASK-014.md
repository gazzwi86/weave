# CE-V1-TASK-014 — Document Corpus Storage — summary

Branch: `feature/CE-V1-EPIC-012` (worktree `weave-CE-V1-EPIC-012b`), base `main`.
Status: built and pushed, **partial** — AC-003-01's XML-notation chunking branch deferred (see below).

## What shipped

- `corpus/chunking.py` — chunks committed artefacts into `Passage`s (deterministic
  `passage_id` from `(artefact_hash, locator)` so re-ingest replaces, never duplicates,
  AC-003-08). Prose/markdown reuses `ingest/document_parsing.parse_simple()` (no second
  parser) + word-window token approximation (512 words, 15% overlap, ADR-011 pin 1a — no
  ML layout parsing). XML/notation path is a clean seam (`chunk_xml_notation`) that raises
  `NotationChunkingUnavailable` — see deferral below.
- `corpus/vectors.py` — in-memory `VectorIndex` (put/query/delete, tenant-scoped by
  construction, manual cosine similarity — no numpy). `ModelMismatch` guard enforces
  ADR-011 pin 2a (never mixed embedding models per index). Documented as the LocalStack-S3
  stand-in pattern; no local S3 Vectors emulator exists (Law F).
- `corpus/embeddings.py` — Titan v2 (`amazon.titan-embed-text-v2:0`, 1024-dim) via lazily
  constructed Bedrock client, mirroring `ai/providers.py::BedrockProvider`.
- `corpus/settings.py` — `corpus.retrieval_top_k` PLAT-SETTINGS-1 cascade (default 8),
  mirrors `ingest/confidence.py::resolve_confidence_threshold` exactly.
- `corpus/citations.py` — best-effort `Citation` builder + `build_citations_best_effort`
  (per-entity try/except, never fails the caller).
- `corpus/pipeline.py` — `embed_and_index_artefact` orchestration (chunk → embed → index →
  write passages.jsonl); degrades gracefully (logs + returns) on
  `NotationChunkingUnavailable` instead of crashing the commit path.
- `corpus/commit.py` — S3-wiring glue: fetches the committed artefact's bytes from the
  ingest corpus bucket, runs the pipeline with real Bedrock/S3 clients, writes
  `passages.jsonl` back to S3. Best-effort (try/except + log.warning) since it runs as a
  `BackgroundTasks` job after the accept response is already sent.
- `routers/ingest.py` — `accept_proposal_route` now takes `background_tasks:
  BackgroundTasks` and schedules `embed_artefact_on_commit` via
  `_schedule_embed_on_commit` after a successful accept, guarded on `job.corpus_key` being
  non-`None` (only document-ingest jobs have one).
- `corpus/retrieval.py` — `search()` (embed + tenant-scoped vector query) and
  `lookup_source_artefact()` (AC-003-06: SPARQL walk `?activity prov:generated <entity> ;
  prov:used ?artefact` against the tenant's `:prov` named graph — same activity links
  both predicates, confirmed against `operations/provenance.py::write_activity`).
- `routers/query.py` / `schemas/query.py` — `NlQueryResponse.citations` is a new additive
  field (`list[QueryCitation]`, default `[]`). After building `rows`, grounded row IRIs
  (matching the `urn:weave:instances:`/`https://weave.io/instances/` prefixes) are passed
  through `build_citations_best_effort`; a failure anywhere in the chain degrades to an
  empty list, never fails the NL query itself (AC-003-05).
- `tests/unit/test_corpus_no_mutation_path.py` — AC-003-07 CI structural assert (mirrors
  `test_ingest_no_second_mutation_path.py`): nothing under `corpus/` may import
  `operations.pipeline` / `routers.operations` (the CE-WRITE-1 mutation path), and no
  write-verb route may be registered under a `corpus` path anywhere in `routers/`.

## Deliberate scope decision: no standalone `/api/corpus/*` router

Checked `docs/specs/weave/contracts.md` for a corpus-search contract ID before building
one — none exists. Per repo convention ("cite contract IDs, never invent endpoints"),
I did not add a `GET /api/corpus/search` or `GET /api/corpus/artefacts/{iri}` route. All
retrieval that's actually contract-grounded (`CE-READ-1`'s `NlQueryResponse.citations`)
is wired. If a dedicated corpus-browse UI/API is wanted, that needs its own contract entry
first — flagging as a possible gap for the architect, not building speculatively.

## Deviation from dispatch assumption: no DB migration

The dispatch note assumed "document corpus storage likely adds a table (migration
0103/0104)." Investigated: the corpus store is S3 (`passages.jsonl` per artefact) + an
in-memory vector index (LocalStack-S3-emulator-style fake, Law F — no local S3 Vectors
emulator exists). No Postgres table was needed. Migrations directory tops out at `0082`
on this branch; no `0103`/`0104` gap exists to fill.

## AC-003-01 deferred (coordinator-approved, Option 2)

The XML/notation chunking branch (ArchiMate/BPMN passages) depends on TASK-015's parsed
notation model. TASK-015 is scoped to **post-v1**, unbuilt. Building a second XML parser
to unblock TASK-014 would violate the brief's own "no second parser" rule and create
throwaway tech debt once TASK-015 ships its real parser.

Resolution (coordinator decision, Option 2): `chunk_xml_notation()` is a clean seam that
raises `NotationChunkingUnavailable` (message references TASK-015 explicitly). The
pipeline catches this and degrades gracefully — an XML/notation artefact commits fine, it
just isn't embedded/searchable yet. No fake parser, no silent wrong output.

Flagged to the architect via `.claude/state/overnight-queue.md` (brief/milestone mismatch
— TASK-014's v1 brief hard-requires a post-v1 dependency).

## Test coverage

Unit: `test_corpus_chunking.py` (4), `test_corpus_vectors.py` (6, including the
release-gating tenant-isolation case), `test_corpus_embeddings.py` (1),
`test_corpus_settings.py` (2), `test_corpus_citations.py` (2, including the named
`citation-pairs-iri-and-passage` test), `test_corpus_pipeline.py` (3),
`test_corpus_commit.py` (1), `test_ingest_accept_embed_schedule.py` (2),
`test_corpus_retrieval.py` (3), `test_query_router.py` (+1 citations-wiring test),
`test_corpus_no_mutation_path.py` (2, AC-003-07).

No docker-integration tests were added this pass (end-to-end embed→retrieve,
two-tenant vector isolation, prov:used resolution against real Oxigraph, NL-citations
end-to-end) — everything above is unit-level with injected/mocked collaborators (Law F:
no real Bedrock/S3/Oxigraph calls in unit tests). **Gap to flag**: the release-gating
two-tenant vector isolation test exists at the `VectorIndex` unit level only
(`test_corpus_vectors.py::test_tenant_isolation`), not as a docker-integration test
against a real multi-tenant deployment shape. Recommend a follow-up docker-integration
pass before this ships to production, using worktree-local `COMPOSE_PROJECT_NAME`
isolation per the coordinator's standing instruction.

## Gates run (all green)

- `cd packages/backend && uv run ruff check .` — clean
- `uv run mypy src/ tests/` — clean, 657 source files
- `uv run pytest tests/unit -q` — full unit suite green
- OKF (`docs/`) — conformant (pre-existing 171 warnings, all tolerated cross-link gaps,
  none introduced by this task)
- semgrep (pre-push) — passed
- No frontend changes — frontend gates not applicable

## Commits (chronological, feature/CE-V1-EPIC-012)

chunking → vectors → embeddings → settings → citations → pipeline → commit.py S3 glue →
accept-route wiring → retrieval.py (search + prov:used lookup) → NL query citations
wiring → AC-003-07 structural test. Each unit is a separate test-then-impl commit pair
(a couple of early commits ended up bundled during `git add`/`git commit` sequencing —
noted, not re-split, since RED-before-GREEN was still verified by running pytest before
each implementation was written).
