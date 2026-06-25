# Weave

**Build, curate, and visualise detailed ontologies as rich, colourful,
interactive knowledge graphs** — using open semantic-web standards
(RDF · RDFS · OWL · SKOS · PROV · Turtle) and an LLM that can edit the graph
from natural language.

> Status: **Milestone 1 — vertical slice.** See
> [`docs/tree-of-thought.md`](docs/tree-of-thought.md) for the living plan.

## What it does

- 🎨 **Dual-mode canvas** — explore the graph as a force-directed, colour-by-type
  picture (Cytoscape.js), or model it IcePanel / C4-style on a draggable canvas
  with labelled, orthogonal relationships (React Flow).
- ✍️ **Edit by form or by language** — add/edit nodes and labelled relationships
  through UI forms, or describe a change in plain English and let **Claude**
  translate it into valid RDF mutations (with a reviewable diff).
- 🏷️ **Annotate everything** — nodes and edges carry labels, comments, notes,
  and structured detail.
- 🧭 **Associate with the business** — link terms to business domains,
  capabilities, and (soon) uploaded data schemas.
- 📖 **Produce a glossary & service inventory** from the same graph.
- 🔁 **Open & portable** — import/export Turtle at any time; nothing is locked in.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite, Cytoscape.js, React Flow, TanStack Query |
| Backend | Python 3.11, FastAPI, pyoxigraph (embedded SPARQL store), rdflib |
| LLM | Anthropic Claude (server-side, structured tool-use → RDF) |
| Store | Oxigraph (on-disk), Turtle import/export |
| Infra | Docker, docker-compose, Terraform (AWS, target TBD) |
| Quality | pytest, vitest, Playwright (e2e + visual), Lighthouse CI, ESLint, ruff, radon (cyclomatic + maintainability) |

## Quick start (local)

### With Docker (recommended)

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY for the LLM features
docker compose up --build
# frontend → http://localhost:5173   backend → http://localhost:8000/docs
```

### Without Docker

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload          # http://localhost:8000

# Frontend (in another shell)
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

On first run the backend seeds a comprehensive **Monsters, Inc.** demo ontology
(52 nodes / 86 edges) as a protected project, so the canvas, glossary, and
inventory are all populated immediately.

## API (milestone 1)

Data routes accept an optional `?project_id=` (defaults to `demo`) selecting
which saved ontology to act on.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/projects` | List saved ontologies (demo + yours) |
| POST | `/api/projects` | Create a project (`seed`: empty / demo / turtle) |
| PATCH | `/api/projects/{id}` | Rename / describe a project |
| DELETE | `/api/projects/{id}` | Delete a project (demo is protected) |
| GET | `/api/graph` | Nodes + edges projection for the canvas |
| GET | `/api/ontology/ttl` | Export the whole graph as Turtle |
| POST | `/api/ontology/ttl` | Import/replace the graph from Turtle |
| GET | `/api/relationship-types` | Seeded predicate vocabulary |
| POST | `/api/nodes` | Create a node |
| PATCH | `/api/nodes/{id}` | Update a node |
| DELETE | `/api/nodes/{id}` | Delete a node (and incident edges) |
| POST | `/api/edges` | Create a labelled relationship |
| DELETE | `/api/edges` | Delete a relationship |
| POST | `/api/llm/mutate` | Natural language → reviewed RDF mutation |
| GET | `/api/glossary` | SKOS concepts as a glossary |
| GET | `/api/inventory` | Systems & services inventory |

Full interactive docs at `/docs` when the backend is running.

## Testing & quality

```bash
# Backend
cd backend && pytest && ruff check . && radon cc app -a && radon mi app

# Frontend
cd frontend && npm run lint && npm run test && npm run test:e2e
```

CI runs all of the above on every PR (`.github/workflows/pr.yml`) and builds
images on `main` (`.github/workflows/main.yml`).

## Repository layout

```
backend/    FastAPI app, OntologyStore, LLM service, tests
frontend/   React app (dual canvas, forms, LLM bar), tests
infra/      Terraform skeleton (AWS, target account TBD)
docs/       Tree of thought, ADRs, design notes
.github/    CI workflows
```

## License

Open source under the MIT License. Built on open standards by design.
