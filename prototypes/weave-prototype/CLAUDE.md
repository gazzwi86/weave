# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What Weave is

A web platform to **build, curate, and visualise detailed ontologies** as rich,
colourful, interactive knowledge graphs on open semantic-web standards
(RDF/RDFS/OWL/SKOS/PROV/Turtle). The graph is editable via **UI forms** and via
**natural language** (Claude, server-side tool-use). See [`README.md`](README.md)
for the product overview and [`ROADMAP.md`](ROADMAP.md) for the plan.

## Read these first, every session

1. **[`ROADMAP.md`](ROADMAP.md)** — milestones, the full task backlog, and the
   append-only **decision log (ADRs)**. This is our cross-session memory.
2. **[`docs/tree-of-thought.md`](docs/tree-of-thought.md)** — hypotheses,
   architecture, and the evolving plan of action.
3. **[`.claude/research/`](.claude/research/)** — deep-research reports
   (UX, visualisation, LLM-safety, schema-mapping) backing the ADRs.

## Working agreement (rules)

- **Keep the plan alive.** Before and after each task, update `ROADMAP.md`
  (tick/append tasks) and record non-trivial decisions as an **ADR** with
  rationale. Expand `docs/tree-of-thought.md` as understanding deepens.
- **End each phase with quality gates**, in order, before committing:
  `/simplify` → `/review` → `/verify`. Don't commit red.
- **Research before deep, hard-to-reverse design choices** (`/deep-research`),
  especially UI/UX and visualisation. Fold findings back into the roadmap.
- **Branch discipline.** Develop on the designated feature branch; never push to
  `main` without explicit permission. Do not open PRs unless asked.
- **Hide RDF mechanics** behind the node/edge API; the rest of the app speaks
  nodes, edges, kinds, and relationship types — not triples.
- **Keep complexity in check.** Functions stay under cyclomatic complexity 10
  (ruff C90); maintainability index stays in band A (radon mi).
- **Tests are part of done.** New behaviour ships with tests.

## Repository layout

```
backend/    FastAPI app — OntologyStore (Oxigraph), LLM service, REST API, tests
frontend/   React + TS + Vite app — dual canvas, forms, LLM bar, tests (WIP)
infra/      Terraform skeleton (AWS, target account TBD)               (WIP)
docs/       Tree of thought, design notes, AD? (ADRs live in ROADMAP.md)
.claude/    Claude Code settings + hooks; research/ holds deep-research reports
.github/    CI workflows                                               (WIP)
```

## Key commands

### Backend (`backend/`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload          # http://localhost:8000  (/docs for OpenAPI)
pytest                                 # unit tests
ruff check .                           # lint + import order + complexity (C90)
radon cc app -a -nc                    # cyclomatic complexity (expect A/B)
radon mi app                           # maintainability index (expect A)
```

### Frontend (`frontend/`) — once scaffolded
```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run test       # vitest
npm run test:e2e   # Playwright (e2e + visual)
```

### Whole stack
```bash
docker compose up --build              # frontend :5173, backend :8000
```

## Architecture notes

- **Store:** `backend/app/ontology/store.py` — `OntologyStore` wraps pyoxigraph.
  Everything lives in the default graph. Edges are direct triples; edges with
  comments/notes get a companion `rdf:Statement` (reification) for annotations.
- **Vocabulary:** `backend/app/namespaces.py` — node kinds, relationship types,
  and the `weave:` namespace. Add new kinds/relationships here; the frontend and
  LLM both read these registries via the API.
- **LLM:** `backend/app/llm/service.py` — Claude must return one
  `propose_mutations` tool call; `apply_operations` validates, resolves new-node
  refs, applies, and PROV-stamps. The Anthropic client is injectable for tests.
- **Config:** `backend/app/config.py` — `WEAVE_*` env vars; `ANTHROPIC_API_KEY`
  is read un-prefixed. Copy `.env.example` → `.env`.

## Claude model usage

When wiring or changing LLM calls, default to current Claude models (e.g.
`claude-sonnet-4-6`); the model id is configurable via `WEAVE_LLM_MODEL`. Do not
hard-code model ids in app logic beyond the documented default.

## Hooks

- **Claude:** `.claude/settings.json` runs `.claude/hooks/session-start.sh` on
  session start to bootstrap the backend venv (and frontend deps when present),
  so tests and linters are runnable immediately in web sessions.
- **Git:** `.pre-commit-config.yaml` runs ruff (lint+format) and hygiene checks
  on commit, and the backend test suite on push. Install with
  `pip install pre-commit && pre-commit install && pre-commit install -t pre-push`.
