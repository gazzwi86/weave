# Weave — Roadmap & Decision Log

> **Canonical, evolving planning document.** It carries the milestone plan, the
> full task backlog (keyed to the tree of thought in
> [`docs/tree-of-thought.md`](docs/tree-of-thought.md)), and an append-only
> **decision log** with rationale. Update it every turn: tick tasks, add newly
> discovered work, and record decisions as they are made. This is the reference
> we resume from across sessions.
>
> Last updated: **2026-06-22** · Current phase: **P2/P4/P5 — versioning, MCP, canvas polish, hardening**

---

## 1. North star

Build, curate, and visualise detailed ontologies as **rich, colourful,
interactive knowledge graphs** on open semantic-web standards (RDF/RDFS/OWL/
SKOS/PROV/Turtle), editable by **UI forms** and by **natural language (Claude)**,
with associations to business domains/capabilities and data schemas, producing
a **glossary** and **service inventory**, and (later) connecting to live data
sources (Databricks/Snowflake).

## 2. Milestones

| ID | Milestone | Goal | Status |
|----|-----------|------|--------|
| **P1** | Foundation & vertical slice | Backend ontology store + API; dual-mode canvas; form + LLM editing; Docker/CI/IaC skeleton | 🟡 in progress |
| **P0.5** | Deep research & requirements | Research UI/UX, viz, modelling patterns; refine requirements & ADRs | ✅ done → [report](.claude/research/2026-06-14-frontend-ux-and-architecture.md) |
| **P2** | Modelling depth | C4 levels, groups/containers, IcePanel-style flows, layout persistence | ⬜ |
| **P3** | Data & business association | Schema upload (JSON Schema/Avro/DDL) → data assets; domain/capability maps | ⬜ |
| **P4** | Glossary & inventory products | Polished, exportable glossary + service inventory views | 🟡 in progress |
| **P5** | Provenance, review & versioning | Human-in-the-loop approval of LLM diffs; PROV history; graph versioning | 🟡 in progress |
| **P6** | Live connectors | Databricks Unity Catalog, Snowflake information_schema ingestion | ⬜ |
| **P7** | Hardening & deploy | AWS account, full IaC, observability, auth/tenancy, a11y, perf budgets | ⬜ |

> Note: **P0.5 (deep research)** runs *before* we commit hard to the P2+ design,
> per the agreed process — research to rationalise requirements, features, and
> visuals before building too far.

## 3. Task backlog (keyed to the tree of thought)

Legend: ✅ done · 🟡 in progress · ⬜ todo · 🔭 needs research first

### P1 — Foundation & vertical slice
- ✅ T1 Repo scaffold, README, LICENSE, .gitignore, .env.example
- ✅ T1a Tree of thought + this roadmap/decision log
- ✅ T1b Claude boilerplate: `CLAUDE.md`, `.claude/` settings + SessionStart hook, `.pre-commit-config.yaml` git hooks
- ✅ T2 Backend: `OntologyStore` (Oxigraph) — node/edge CRUD, reified edge annotations, TTL import/export, projection
- ✅ T2a Backend: glossary + inventory derived views
- ✅ T3 Backend: Claude tool-use mutation service + `apply_operations` (ref resolution, PROV stamp)
- ✅ T3a Backend: FastAPI routes + CORS + OpenAPI
- ✅ T3b Backend: unit tests (store/api/llm), ruff, radon CC+MI gates green
- ✅ T3c Backend: `/simplify` + `/review` quality gates run; fixes applied (partial-update node semantics fixing kind-change + field-wipe bugs, glossary dedupe, edge-delete detail, perf consolidations)
- ✅ T3d Backend: **multi-project support** — `ProjectManager` (per-project Oxigraph store + JSON manifest), project CRUD API, every data route gains `?project_id=`; demo is a protected project
- ✅ T3e Expanded **Monsters, Inc.** demo ontology (52 nodes / 86 edges, all kinds + relationships) as the seeded demo project
- ✅ T3f Backend `/verify`: ran the server, exercised projects/graph/glossary/inventory/TTL/LLM-guard/persistence
- ✅ T4 Frontend: app shell, typed API client, TanStack Query, design tokens
  - ✅ T4a **Projects tab** UI — switch / create (empty or from-demo) / rename / delete saved ontologies
- ✅ T5 Frontend: Explore canvas (Cytoscape, fcose) — colour-by-type, labelled edges, click-to-inspect, spotlight dim, legend; instance preserved across edits
- ✅ T6 Frontend: Model canvas (React Flow) — draggable, labelled edges, second projection; syncs on graph change
- ✅ T7 Frontend: Inspector panel (details + edit/delete for nodes & edges) + add node/edge forms
- ✅ T8 Frontend: LLM prompt bar wired to `/api/llm/mutate` (handles 503 no-key)
- ✅ T9 Docker: backend image + frontend image (nginx) + docker-compose
- ✅ T10 CI: PR backend + frontend (typecheck/lint/unit/build) + e2e/Lighthouse jobs; main build/deploy placeholder
- ✅ T11 Terraform skeleton (ECR + ECS cluster shell, compute TODO; AWS account TBD)
- ✅ T12 Frontend tests: vitest unit (17), Playwright smoke e2e + config, Lighthouse CI config, eslint
- ✅ T13 Frontend cleanups from review: shared `<DataTable>` (Glossary/Inventory/Objects); `<FormField>` primitive (AddNodeForm/AddEdgeForm/Inspector); Inspector already has read vs edit mode; bundle code-split via React.lazy (initial JS 193 KB gzip, was 966 KB; Cytoscape/React Flow load on demand)

### P0.5 — Deep research & requirements ✅
- ✅ R1 Visualisation UX & library comparison (Cytoscape/sigma/G6/React Flow; fcose/ELK; anti-hairball UX)
- ✅ R2 Modelling-tool UX (IcePanel/Structurizr/C4/draw.io) — model-as-source, drill-down, flows, inspector
- ✅ R3 LLM + ontology safety (SHACL/OWL validation, staged diff + human approval, PROV, dedup/grounding)
- ✅ R4 Schema→ontology mapping (CSVW/RML/LinkML/DCAT; Databricks UC & Snowflake metadata models)
- ✅ R5 Glossary/data-catalog UX (Atlan/Collibra/OpenMetadata/DataHub/data.world)
- ✅ R6 Synthesis → [research report](.claude/research/2026-06-14-frontend-ux-and-architecture.md), ADR-011..014, task expansion below

### P2 — Modelling depth (research-informed)
- ✅ **Drill-down navigation**: right-click BusinessDomain → "View domain members" filters canvas to show only that domain's nodes; breadcrumb overlay with ← All back button; `weave:drill-domain` custom event
- ⬜ Implied/aggregated group→group edges derived from member edges
- ✅ Semantic-zoom edge labels: hidden until zoom ≥ 0.55× (or hover); keeps overview uncluttered on dense graphs
- ✅ **Togglable legend filter**: clicking a kind in the Explore legend shows/hides its nodes (and incident edges) via a `.hidden` class; off kinds render dimmed + struck-through (`Legend.test.tsx`)
- ✅ **Capability heatmap overlay on Graph canvas**: dropdown to colour BusinessCapability nodes by maturity/investment/strategic importance/lifecycle; restores kind colour when cleared; never re-triggers layout
- ✅ **Node right-click context menu**: Inspect/Edit, View domain members (domain nodes), Connect from here…, Delete node
- ✅ **Position persistence**: node x/y saved to localStorage per-project; restored on reload; "Reset layout" clears and re-runs fcose
- ✅ **Inline canvas editing**: double-click canvas → quick-add node popover; drag node handle → connect (cytoscape-edgehandles); right-click edge → change type or delete
- ⬜ Explore vs Edit modes; spotlight/dim focus (spotlight already done on click)
- ⬜ Flows / trace mode (step through an ordered subgraph, auto-frame each hop)
- ✅ **Objects** table view: sortable/filterable list of every node (search + kind filter + connection count); Edit button opens NodeEditModal
- ✅ Auto-layout persisted: fcose only runs for nodes without saved positions; "Reset layout" clears localStorage and re-runs

### P4 — Glossary & inventory products (research-informed)
- ✅ Export to CSV / Markdown: `toCsv` + `toMarkdownTable` pure helpers with 5 tests; Glossary and Inventory views gain CSV + MD download buttons (hidden when empty)
- ✅ **Rules** product view: `GET /api/rules` introspects the SHACL shapes into structured if/then rules (single source of truth — not a hand-kept list); a grouped, plain-English **Rules** tab renders them (`validation/rules.py`, `lib/rules.ts` + tests)
- ✅ **Custom rules**: `POST /api/rules` + `DELETE /api/rules/{id}` — user-defined SHACL constraints enforced at write time; custom rules merged into `shapes_graph()` so they gate `apply_operations` (ADR-020); RulesView has form + delete button for custom rules
- ✅ **Inline Glossary editing**: edit term label and definition via the existing `PATCH /api/nodes` path; `GlossaryView` shows inline edit form
- ✅ **Canvas view toggles**: "Hide labels" / "Hide edges" overlay buttons on ExploreView (ADR-019)
- ✅ **Inspector enhancements**: domain/capability dropdowns in node edit; capability EA fields (maturity, strategic importance, investment, lifecycle, owner); inline "Add connection" form; edge delete buttons in edge lists
- ✅ **Domain view** (renamed from Model): no edge connectors; React Flow positional layout (ADR-022)
- ✅ **Capabilities view**: heat-mapped card grid, domain grouping, dimension selector (ADR-022, ADR-023)
- ✅ **Query view**: `POST /api/sparql` (SELECT-only, SERVICE-blocked, 500-row cap) + `POST /api/sparql/nl` (NL→SPARQL via LLM, context-rich system prompt from live registry); QueryView with SPARQL editor + example queries + NL mode (ADR-024)
- ✅ **Capability EA model**: `weave:maturity`, `weave:strategicImportance`, `weave:investmentLevel`, `weave:lifecycleStatus`, `weave:capabilityOwner` properties in namespaces, store, models, and types (ADR-023)
- ✅ **Ollama local LLM provider**: `OllamaService` using JSON-grammar mode; activated by `WEAVE_OLLAMA_URL`; all three LLM routes go through `_get_llm_service()` factory (ADR-021)
- ✅ **Claude harness uplift**: per-folder CLAUDE.md files (`backend/`, `frontend/`, `docs/`, `infra/`); `.claude/commands/` slash commands; `.claude/agents/` custom agents; `.claude/rules/` enforcement rules; PostToolUse hook for lint-on-edit; enhanced settings.json permissions/deny list
- ✅ Richer filtering / search on Glossary (search by definition / related term label)
- ✅ Inventory: filter by kind/domain/capability; coverage stats (% with domain/capability/description)
- ✅ Objects + Inventory: Edit button opens NodeEditModal (all node fields including EA properties)
- ✅ Rules: Edit button for custom rules (opens pre-filled form; saves as delete+create)
- ✅ **Graph versioning**: named TTL snapshots via `OntologyStore.create_snapshot/list_snapshots/restore_snapshot`; manifest.jsonl sidecar; GET/POST/restore routes; Versions tab in UI; Download TTL per snapshot
- ✅ **MCP server** (`mcp-server/`): expose ontology as resources + tools over the MCP protocol; `weave_propose`, `weave_apply`, `weave_commit`, `weave_sparql` tools; defaults to latest committed snapshot for versioned TTL resource
- ✅ **Audit trail / History**: every `apply_operations` call records a `history.jsonl` event with per-op summaries; History tab shows newest-first
- ✅ **LLM settings UI**: runtime provider/model switcher (Anthropic/Ollama); reads installed models from Ollama; Settings tab
- ✅ **Onboarding + Help**: 3-slide modal on first visit; ? floating button to re-open; 5 guided demo tasks checklist
- ✅ **Loading spinners**: replaced all loading text strings with animated `<LoadingSpinner>` component
- ✅ **Query tab first**: Query is the first tab, defaults to Natural Language mode
- ✅ **Graph tab** (renamed from Explore): Explore tab → Graph

### P3 — Data & business association (research-informed)
- ✅ Schema upload (CSV + JSON Schema) → `DataAsset` + `Field` nodes (`weave:partOf`), with `/api/schema/import`, parser + xsd type inference, and a UI import form
- ✅ Concept link on import (DataAsset `describes` a chosen `skos:Concept`)
- ✅ Type-default suggestions (column → xsd datatype stored on the field)
- ⬜ Persist the column→concept mapping as data for idempotent re-uploads
- ⬜ Per-field concept linking + DCAT/PROV vocabulary on the asset
- ⬜ Evaluate LinkML as internal schema IR; Avro/SQL-DDL formats

### P5 — LLM safety pipeline (research-informed)
- ✅ Enum-constrain `propose_mutations` tool schema from the namespaces registry (kinds + relationship types)
- 🟡 IRI reconciliation/dedup — exact same-label/same-kind reuse on add_node (fuzzy threshold + merge prompt UI deferred)
- ✅ Staged **propose → review → approve** flow: `/api/llm/propose` (no mutation) + `/api/operations/apply`; LLM bar shows the proposed changes and applies only on approval
- ✅ **SHACL validation gate**: approved batches are applied to a throwaway copy and validated against relationship-range shapes (`inDomain`→Domain, `hasCapability`/`realizes`→Capability, `describes`→Concept) first; a violation blocks the commit (HTTP 422) and the message surfaces in the review bar. Standalone `GET /api/validate` too
- 🟡 Distinguish human vs LLM agent in PROV — approved batches are attributed to `user`, auto-apply to `llm` (richer PROV-O modelling deferred)
- ⬜ OWL consistency check + NL-explained violations; SHACL shapes for cardinality/datatypes

### Cross-cutting / later phases
- ⬜ Auth & multi-tenancy model
- ⬜ Graph versioning / branching / diff
- ⬜ Human-in-the-loop approval workflow for LLM changes
- ⬜ Accessibility (WCAG) + performance budgets
- ⬜ Observability (logs/metrics/traces), error tracking
- ⬜ Live connectors (Databricks, Snowflake)

## 4. Decision log (append-only)

Format: **ADR-NNN — Title** · *date* · **Decision** · **Why** · **Alternatives/▢ revisit**.

- **ADR-001 — Dual-mode canvas (Cytoscape + React Flow)** · 2026-06-14 ·
  *Decision:* render one shared ontology two ways — a force-directed "Explore"
  view (Cytoscape.js) and an IcePanel/C4-style "Model" view (React Flow). ·
  *Why:* exploration and deliberate modelling are different intents; one graph,
  two projections avoids divergence. · *Alternatives:* single canvas (rejected:
  serves neither well), sigma.js (revisit for very large graphs in R1).

- **ADR-002 — Embedded Oxigraph triple store** · 2026-06-14 ·
  *Decision:* persist the graph in pyoxigraph (embedded SPARQL store) with
  Turtle import/export as first-class interchange. · *Why:* self-contained, fast,
  standards-complete, no extra infra; TTL keeps everything portable/diffable. ·
  *Alternatives:* rdflib-only (slower queries), Fuseki/GraphDB (heavier infra —
  revisit at scale), Postgres+RDF export (least semantically native).

- **ADR-003 — Claude server-side via structured tool-use** · 2026-06-14 ·
  *Decision:* NL edits go through a server-held Claude call that must return a
  single `propose_mutations` tool call; the server validates + applies ops and
  PROV-stamps them. · *Why:* structured tool-use yields valid, reviewable RDF
  mutations rather than free-text; keeps keys server-side. · *Alternatives:*
  BYO-key (revisit for cost/self-host), provider-agnostic layer (revisit if
  multi-model needed), local model (quality risk for structured output).

- **ADR-004 — Edges as triples + reified annotations** · 2026-06-14 ·
  *Decision:* relationships are direct triples; when an edge needs a
  comment/note, a companion `rdf:Statement` reifies it to hold annotations. ·
  *Why:* keeps the graph natural for SPARQL while giving edges identity and
  detail. · *Alternatives:* n-ary relation nodes (heavier), RDF-star (revisit
  when tooling support is universal).

- **ADR-005 — Node id passed as query param, not path** · 2026-06-14 ·
  *Decision:* node update/delete take the node IRI via `?node_id=`. · *Why:*
  IRIs contain `://`; embedding in a path segment is fragile. ·
  *Alternatives:* path with `:path` + encoding (rejected: brittle double-slash).

- **ADR-006 — Process: research before deep build; quality gates before commit**
  · 2026-06-14 · *Decision:* run a deep-research pass (P0.5) before committing to
  P2+ design; run `/simplify`, `/review`, and `/verify` at the end of each phase
  before commit/push; keep this roadmap + decision log current every turn. ·
  *Why:* de-risk a large multi-session build; rationalise requirements with
  evidence; keep quality high and history legible.

- **ADR-007 — Commit Claude & git boilerplate** · 2026-06-14 ·
  *Decision:* keep `CLAUDE.md` (rules/commands), `.claude/settings.json` +
  `.claude/hooks/session-start.sh` (bootstrap deps so tests/linters run in fresh
  web sessions), and `.pre-commit-config.yaml` (ruff + hygiene on commit, backend
  tests on push) in the repo. · *Why:* consistent, reproducible dev experience
  for Claude and humans across sessions; quality gates enforced at the boundary. ·
  *Alternatives:* ad-hoc setup each session (rejected: slow, drifts).

- **ADR-008 — Multi-project model: one Oxigraph store per project** · 2026-06-14 ·
  *Decision:* each saved ontology is an independent project with its own
  on-disk Oxigraph store (a subdirectory) tracked in a JSON manifest; the demo
  ("Monsters, Inc.") is a protected project that cannot be deleted/modified.
  Data routes select a project via `?project_id=` (default `demo`). · *Why:*
  clean isolation, simple per-project import/export, reuses `OntologyStore`
  unchanged, and dodges the RocksDB single-writer lock (distinct dirs). ·
  *Alternatives:* one store with a named graph per project (revisit — avoids many
  dirs/locks but threads a graph param through every method); single global graph
  (rejected: no multi-ontology). · *Known limit:* many concurrent projects each
  hold a store handle; fine for the MVP, revisit pooling/eviction at scale.

- **ADR-009 — Partial-update semantics for nodes** · 2026-06-14 ·
  *Decision:* `update_node` only touches fields actually present in the payload
  (API uses `model_dump(exclude_unset=True)`; the LLM forwards only supplied
  keys) and updates `rdf:type` when `kind` is given. · *Why:* fixes two review
  bugs — kind changes were silently dropped, and LLM edits wiped
  position/colour/domain/capability. · *Alternatives:* full-replace (rejected:
  data loss), force callers to resend all fields (rejected: fragile).

- **ADR-010 — Parallel subagents ("agent teams")** · 2026-06-14 ·
  *Decision:* use parallel subagents for independent work — review/cleanup
  finders, demo-ontology authoring, and (next) frontend slices. · *Why:* speed
  and focus; keeps the orchestrator's context lean. · *Note:* greenfield builds
  need a crisp shared contract first (the API + this roadmap) before fan-out.

- **ADR-011 — Visualisation libraries confirmed (with scale escape hatch)** ·
  2026-06-14 · *Decision:* Cytoscape.js for the Explore canvas (fcose default
  layout) and React Flow for the Model/C4 canvas (ELK/dagre layout); sigma.js or
  G6 (WebGL) are the migration path if a graph exceeds ~5k nodes. · *Why:*
  research shows Cytoscape covers low-thousands (our scale) with the richest
  layout set, React Flow is best-in-class for editable C4-style diagrams; WebGL
  only needed at much larger scale. · *Source:* research report §1.

- **ADR-012 — LLM mutations are staged, validated, and human-approved** ·
  2026-06-14 · *Decision:* NL edits flow through retrieve → enum-constrained
  tool call → IRI reconciliation/dedup → SHACL + OWL validation → staged diff →
  human approval → PROV stamp (human vs LLM agent). Never auto-apply to the
  canonical graph. · *Why:* 2023–2026 benchmarks show autonomous LLM ontology
  construction is unreliable; SHACL/PROV are the W3C-standard guards. · *Source:*
  research report §3. *(Supersedes the MVP's immediate-apply behaviour; the
  current apply path stays behind a flag until the pipeline lands in P5.)*

- **ADR-013 — Schema ingestion as DataAsset/Field nodes (CSVW + DCAT/PROV)** ·
  2026-06-14 · *Decision:* uploads become `DataAsset` + `Field` nodes with
  DCAT/PROV emitted behind the node/edge API and an explicit `aboutConcept` link
  to the ontology; the physical node stays distinct from the conceptual one. One
  internal Catalog→Schema→Table→Column→Tag model serves later Databricks/
  Snowflake connectors. · *Why:* W3C-standard, minimal, idempotent, connector-
  ready. · *Source:* research report §4.

- **ADR-015 — Semantic-zoom edge labels via zoom + hover events** · 2026-06-15 ·
  *Decision:* edge labels start with `text-opacity: 0` in the Cytoscape.js stylesheet and
  become visible on `zoom` events (threshold 0.55×) or `mouseover` on an individual edge. ·
  *Why:* the Monsters Inc. demo has 86 edges; showing all labels at once creates visual noise
  at default zoom; semantic zoom + hover is the established pattern (research report §1). ·
  *Alternatives:* always-on labels (cluttered), rely purely on the inspector (too slow to discover).

- **ADR-016 — Pure CSV/Markdown helpers separate from download side-effect** · 2026-06-15 ·
  *Decision:* `toCsv` and `toMarkdownTable` are pure string functions exported from
  `src/lib/export.ts`; `exportCsv`/`exportMarkdown` compose them with the browser download
  side-effect. · *Why:* pure functions are trivially unit-testable without mocking browser APIs. ·
  *Alternatives:* test the download wrappers directly (requires heavy browser stubs, fragile).

- **ADR-017 — Rules page derives from the SHACL shapes, not a parallel list** ·
  2026-06-17 · *Decision:* the "Rules" product view is generated by introspecting
  the SHACL shapes (`schema_rules()` SPARQL-queries the same shapes graph used for
  validation) into structured if/then rules, exposed at `GET /api/rules` and
  grouped by category in the UI. · *Why:* the constraints enforced at write time
  and the rules shown to users must never drift; one source of truth guarantees
  it. Deterministic, no API key, no hallucination. · *Alternatives:* hand-authored
  rules list (rejected: drifts from the shapes), LLM-narrated rulebook (deferred —
  richer prose but non-deterministic and needs a key; revisit as an opt-in layer).

- **ADR-018 — Legend doubles as a per-kind visibility filter** ·
  2026-06-17 · *Decision:* the Explore legend entries are toggle buttons; turning a
  kind off adds a `.hidden` (`display: none`) class to its nodes and their incident
  edges, driven by a `hiddenKinds` set lifted into `ExploreView`. · *Why:* the
  legend already maps colour→kind, so it is the natural place to filter; reuses the
  existing reconcile effect and never re-runs layout. · *Alternatives:* a separate
  filter panel (rejected: redundant with the legend), removing elements from the
  graph (rejected: loses positions + forces a relayout on toggle).

- **ADR-014 — Infra skeleton: ECR + ECS Fargate shell, deploy deferred** ·
  2026-06-14 · *Decision:* Terraform declares ECR repos and an ECS cluster shell;
  the compute/ALB/secrets topology and the ECS-vs-App-Runner-vs-Lambda choice are
  documented TODOs until an AWS account exists. Backend Docker image + CI build
  are real now. · *Why:* make the deploy decision deliberately, with infra ready
  to complete; nothing applied without an account + remote state.

- **ADR-019 — Canvas label/edge toggles as view-state overlays** · 2026-06-22 ·
  *Decision:* "Hide labels" and "Hide edges" toggles live as an overlay in
  `ExploreView`, passed as props to `CytoscapeGraph`; implemented via `useEffect`
  inline style overrides (not stylesheet classes) so they don't conflict with
  the `.hidden` legend-filter class. · *Why:* view-display concerns are orthogonal
  to data-visibility concerns; separating them avoids CSS specificity collisions.

- **ADR-020 — Custom SHACL rules stored in a JSON sidecar + merged at validation time** ·
  2026-06-22 · *Decision:* user-defined rules are stored as JSON in
  `data/custom_rules.json`; `add_rule` / `remove_rule` generate SHACL Turtle
  fragments and call `shapes_graph.cache_clear()`; `shapes_graph()` merges the
  static + custom Turtle before returning the rdflib Graph. · *Why:* custom rules
  must actually gate the `apply_operations` pipeline, not just appear in the UI —
  ADR-017's single-source principle extended to user-defined constraints. ·
  *Alternatives:* display-only rules (rejected: silent lie); separate validation
  graph per project (deferred for per-project rules).

- **ADR-021 — Ollama provider as a JSON-grammar fallback for local dev** ·
  2026-06-22 · *Decision:* when `WEAVE_OLLAMA_URL` is set, an `OllamaService`
  replaces `LLMService`; Ollama uses the `format` parameter (grammar-constrained
  JSON output) instead of tool_choice, which Ollama's API does not support. ·
  *Why:* allows zero-cost local testing of the AI features (Qwen2.5-Coder 14B/32B
  recommended). · *Caveats:* enum adherence is structural not semantic; SHACL gate
  remains the primary safety net; default num_ctx=32768 required.

- **ADR-022 — Capability view is a card grid (no connectors); Domain view suppresses edges** ·
  2026-06-22 · *Decision:* `CapabilityView` shows `BusinessCapability` cards grouped
  under `BusinessDomain` sections — no edges rendered. `DomainView` (renamed from
  ModelView) passes `edges={[]}` to ReactFlow — nodes are positioned but unconnected.
  Heatmap colouring in CapabilityView driven by a dimension selector (maturity,
  investment, strategic importance, lifecycle status). · *Why:* the user's explicit
  requirement: "domain and capability views shouldn't have any connectors."

- **ADR-023 — Capability EA properties as first-class RDF literals** · 2026-06-22 ·
  *Decision:* `weave:maturity`, `weave:targetMaturity`, `weave:strategicImportance`,
  `weave:investmentLevel`, `weave:lifecycleStatus`, `weave:capabilityOwner` added to
  `NON_EDGE_PREDICATES` and `_SCALAR_FIELDS`; surfaced in `NodeIn/NodeOut`, the
  frontend types, and the Inspector's capability edit form. · *Why:* these standard
  enterprise architecture attributes (LeanIX/Ardoq pattern) need to be queryable
  via SPARQL and exportable in TTL — not hacked via the free-text `note` field.

- **ADR-024 — SPARQL query screen with read-only SELECT, SERVICE rejection, 500-row cap** ·
  2026-06-22 · *Decision:* `POST /api/sparql` accepts SELECT-only queries (regex
  guard), rejects SERVICE keyword (SSRF prevention), caps at 500 rows. NL→SPARQL
  via `POST /api/sparql/nl` uses a context-rich system prompt built from the live
  namespaces registry + few-shot examples; supports Ollama fallback. ·
  *Why:* power users need direct graph access; safety rails prevent abuse of a
  read-only endpoint; dynamic system prompt ensures the LLM has accurate vocabulary.

- **ADR-025 — Snapshots as JSONL-manifest + individual TTL files** · 2026-06-22 ·
  *Decision:* each committed version is stored as `{data_dir}/snapshots/{id}.ttl`
  (the full Turtle export) with a `manifest.jsonl` sidecar for metadata (label,
  description, created, counts). `list_snapshots()` reads the manifest; `restore_snapshot`
  re-imports the TTL. · *Why:* TTL files are human-readable, diffable in git, and
  directly usable as standalone interchange; JSONL appends are crash-safe. ·
  *Alternatives:* one big JSONL with embedded TTL (rejects: large, not directly importable),
  git tags (deferred: needs git integration, out of scope).

- **ADR-026 — MCP server as a separate package pointing at the HTTP API** · 2026-06-22 ·
  *Decision:* `mcp-server/` is a standalone Python package using the `mcp` SDK;
  it talks to the Weave backend over HTTP (not direct import) so it works whether
  Weave is run via uvicorn or Docker. Resources include projects, live graph, latest
  committed TTL, history, vocabulary. Tools: `weave_propose`, `weave_apply`,
  `weave_commit`, `weave_sparql`. · *Why:* MCP transport independence means the
  same server works with Claude Code, Claude Desktop, and future clients; HTTP
  boundary keeps the server stateless. · *Caveat:* end-to-end verification requires
  a running Weave backend + an MCP client — not tested in sandbox.

- **ADR-027 — Heatmap overlay and drill-down as ephemeral view state** · 2026-06-22 ·
  *Decision:* `heatmapDimension` and `focusDomain` are React state in `ExploreView`,
  passed as props to `CytoscapeGraph`; neither persists to localStorage or the backend.
  Heatmap recolours nodes via `cy.nodes().style()` without touching element data or
  triggering a re-layout. Drill-down adds `.domain-filtered` class to excluded elements
  independently of the `.hidden` kind-filter class. · *Why:* these are display-layer
  decisions, not data changes; keeping them ephemeral avoids polluting the URL, the
  RDF store, or saved positions.

- **ADR-015 — Frontend vertical slice shipped (React 18 + Vite + TS)** ·
  2026-06-14 · *Decision:* dual-canvas app — Cytoscape Explore (fcose, colour-by-
  kind, spotlight dim) + React Flow Model — with a context-sensitive Inspector
  (edit/delete), add-node/edge forms, an LLM bar, a Projects switcher
  (create/rename/delete), and Glossary/Inventory tables; TanStack Query for
  server state; typed API client. The Cytoscape instance is created once and
  reconciled in place so edits never reset the viewport/layout; React Flow
  re-syncs on graph change. · *Why:* matches the research (dual canvas, model-as-
  source, spotlight). · *Verified:* typecheck/lint/17 unit tests/build green;
  HTTP-level serve + CORS checked. Browser e2e runs in CI (Playwright browser
  download is blocked in the dev sandbox). · *Deferred (T13):* shared table/form
  primitives, Inspector read/edit split, shared canvas mapper, bundle code-split.

## 5. Open questions (resolve via research or with the user)

- Auth/tenancy: single-tenant MVP or orgs/workspaces from the start?
- AWS compute target: ECS Fargate vs. App Runner vs. Lambda+API GW?
- Should LLM mutations require explicit human approval before they commit?
- Layout persistence: store node x/y in the graph (`weave:x/y`, already
  supported) or keep layout client-only per user?
- Visual identity: colour system, density, dark/light — define in research R1/R2.

## 6. Risks & mitigations

- **Scope sprawl** → strict milestone gating; this roadmap is the contract.
- **LLM hallucination into the graph** → validation + PROV + (P5) human review/diff.
- **Large-graph performance** → research R1; WebGL (sigma) fallback path kept open.
- **Standards complexity vs. usability** → hide RDF mechanics behind node/edge API.
- **Multi-session continuity** → roadmap + decision log + tree of thought are the memory.

## 7. How we work (process)

1. Plan/expand the tree of thought and this roadmap before and after each task.
2. Build in thin vertical slices; prefer something clickable early.
3. End each phase with `/simplify` → `/review` → `/verify`, then commit & push.
4. Research before committing to design-heavy or hard-to-reverse choices.
5. Record every non-trivial decision as an ADR here, with rationale.
