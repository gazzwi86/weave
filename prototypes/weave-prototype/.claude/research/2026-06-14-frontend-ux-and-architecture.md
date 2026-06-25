# Deep research — frontend UX, visualisation & architecture (P0.5)

> Date: 2026-06-14 · Method: 5 parallel web-research agents (graph-viz libraries,
> modelling-tool UX, data-catalog UX, LLM→RDF safety, schema→ontology). Sources
> cited inline. Caveat: many vendor/spec pages returned HTTP 403 to direct
> fetch, so some points rest on search-result extracts of those canonical pages;
> load-bearing claims are flagged where corroboration was partial.

## Executive summary — decisions for Weave

1. **Keep the dual-canvas split, with a scale escape hatch.** Cytoscape.js
   (Canvas) comfortably handles the low-thousands of nodes our ontologies will
   have for a long time and ships the richest layout/analysis set; React Flow
   (xyflow) is the right tool for the structured, draggable, labelled C4 canvas.
   If a graph ever needs 10k+ nodes, sigma.js (WebGL) or G6 (Canvas/SVG/WebGL)
   are the migration targets — G6 is notable as the one library that could serve
   *both* modes. Default force layout: **fcose**; hierarchy/C4: **ELK** (or dagre
   for simple trees).
2. **Model is the single source of truth; every view is a projection.** The RDF
   graph is canonical; Explore, Model/C4, Glossary, and Inventory are all derived
   views (SPARQL/tag/kind filters), never separate sources. This is the strongest
   borrowed pattern from IcePanel/Structurizr.
3. **Spotlight, don't delete.** Manage density by dimming non-focused nodes
   (opacity) and expanding one neighbourhood at a time, with semantic zoom hiding
   edge labels until hover/selection/zoom — not by culling.
4. **One context-sensitive inspector that is both the read and the write
   surface.** Inline-editable chips/dropdowns for description, kind, owner, tags,
   and relationships; re-skins per node-kind/edge-type; shows incoming/outgoing
   edges inline.
5. **LLM edits go through a staged, validated, human-approved pipeline** with a
   visible diff and PROV provenance — never auto-applied to the canonical graph.
6. **Schema ingestion = `DataAsset` + `Field` nodes** (CSVW-style for flat
   uploads), with DCAT/PROV behind the node/edge API and an explicit
   `aboutConcept` link to the ontology; the same internal model serves later
   Databricks/Snowflake connectors.

---

## 1. Visualisation & libraries

- **Cytoscape.js** — Canvas; practical ceiling ~3,000–5,000 nodes before the
  main-thread layout blocks the UI; richest built-in layouts/analysis. Good for
  the Explore canvas at MVP scale. (js.cytoscape.org;
  pkgpulse.com 2026 comparison)
- **sigma.js** — WebGL; built for thousands–100k elements; read-mostly
  exploration; weaker for editable diagrams. The scale escape hatch.
  (github.com/jacomyal/sigma.js)
- **G6 (AntV) v5** — Canvas/SVG/WebGL switchable, some Rust/WASM layouts; can
  plausibly serve both modes. (g6.antv.antgroup.com)
- **React Flow (xyflow)** — HTML-DOM nodes + SVG edges; best DX and custom-node
  freedom for the C4/Model canvas; lower node ceiling; bring-your-own layout
  (dagre/elkjs). (github.com/xyflow/xyflow)
- **Layouts:** fcose first (fast, supports compound/nested nodes + placement
  constraints); cola for constraint-based; ELK `layered` for orthogonal/port C4
  routing; dagre for simple trees. (blog.js.cytoscape.org/2020/05/11/layouts;
  github.com/iVis-at-Bilkent/cytoscape.js-fcose; eclipse.dev/elk)
- **Anti-hairball UX:** start with ~20–50 relevant nodes and expand on demand;
  predicate- and hop-constrained neighbourhood expansion; focus+context and
  semantic zoom; colour-by-type; centrality to surface/prune. (arxiv.org/html/2304.01311v4;
  cambridge-intelligence.com)

## 2. Modelling & catalog UX patterns to adopt

- **Views as projections of one model; drill-down as navigation** (double-click a
  group → descend into its subgraph; breadcrumb to climb). Derive coarse
  group→group edges from member edges ("implied relationships").
  (icepanel.io/c4-model; docs.structurizr.com/dsl/cookbook/implied-relationships)
- **Explore vs Edit modes**; selecting inspects without mutating; structural
  edits are deliberate. (docs.icepanel.io/core-features/modelling)
- **Flows / trace mode:** step through an ordered subgraph (lineage, provenance,
  reasoning path), auto-framing each hop and dimming the rest.
  (docs.icepanel.io/visual-storytelling/flows)
- **Context-sensitive right inspector** with inline editing, a "view
  dependencies" toggle (ego-graph), and a pinned summary header of key
  properties (owner, domain, status). (docs.icepanel.io; docs.atlan.com;
  docs.datahub.com custom-asset-summaries)
- **Create-by-placing + hover-to-connect handles**; labelled typed edges with an
  auto-generated legend; auto-layout by default with persisted manual positions.
  (drawio.com/docs/manual/connectors; c4model.com/diagrams/notation;
  docs.structurizr.com/as-code)
- **Object table/list view beside the canvas**, sortable/filterable by kind, tag,
  domain, "has documentation" — essential when the canvas alone doesn't scale.
  (docs.icepanel.io/core-features/modelling/model-objects-view)
- **Glossary as a Glossary→Category→Term tree** (broader/narrower), term page
  with Overview / child-Terms / Assets tabs; typed relationship slots
  (synonym/related/translations → SKOS); lifecycle status (Draft→Approved→
  Deprecated) with reviewers. (docs.open-metadata.org; docs.atlan.com;
  github.com/datahub-project business-glossary)
- **Certification badges (Verified/Draft/Deprecated)** and transient
  announcement banners (info/warning/issue) on nodes; rich README/doc block
  separate from the one-line description. (docs.atlan.com certificates/asset-import)
- **Domains own assets/glossaries/teams**; data-products/services as named
  bundles belonging to one domain, joinable from both the product and the asset.
  (docs.open-metadata.org domains; github.com/datahub-project dataproducts)

## 3. LLM → RDF safety pipeline (target design)

A layered pipeline (synthesised from SHACL/PROV W3C specs + 2023–2026 papers):

1. **Retrieve** current-graph context (relevant nodes, kinds, allowed
   relationship registry) and inject into the prompt (GraphRAG for big graphs).
2. **Emit** via the constrained `propose_mutations` tool call — JSON-Schema with
   **enums sourced from our namespaces registry** for kinds & relationship types
   (we already do single-tool-call; add the enums + constrained decoding).
3. **Reconcile** each new-node ref against existing IRIs (label index + fuzzy
   threshold); LLM recommends, rules decide; mint a new IRI only when nothing
   matches — prevents duplicates.
4. **Validate**: SHACL gate (`sh:datatype`, `sh:class`, `sh:minCount/maxCount`,
   `sh:in` for controlled vocabularies) → OWL consistency check for
   inference-bearing axioms. Reject/stage on `sh:conforms=false`.
5. **Stage + diff**: show added/removed/modified nodes & edges; prompt **merge**
   on name/type collisions (CleanGraph pattern — same React+FastAPI stack as us).
6. **Approve** (human) → apply → **PROV-O stamp** distinguishing the human agent
   from the LLM/software agent (`prov:wasAssociatedWith`, `prov:wasAttributedTo`,
   `prov:Activity`, model id, timestamp).
7. On rejection, surface SHACL violations as natural-language explanations and loop.

Two hallucination classes to validate for: *content* (non-factual relations →
retrieval grounding + human review) and *ontology* (schema-invalid, e.g. wrong
object type → SHACL `sh:class`/domain-range + OWL reasoning). Benchmarks
(arxiv 2512.05594) say autonomous LLM ontology construction is still unreliable —
**human-in-the-loop + validation is mandatory, not optional.**
(w3.org/TR/shacl; w3.org/TR/prov-o; arxiv.org/pdf/2405.03932 CleanGraph;
arxiv.org/pdf/2412.15235 OG-RAG)

## 4. Schema → ontology & future connectors

- **MVP:** CSVW-style flat ingestion (CSV + optional JSON descriptor): row→asset
  instance, column→`Field`. Model `DataAsset` (table/file) and `Field` (column)
  as node kinds — never raw triples — emitting DCAT (`dcat:Dataset`/
  `dcat:Distribution`) + PROV behind the API. Link asset/field → ontology concept
  via an explicit `aboutConcept` edge (dct:type/dct:subject → `skos:Concept`),
  keeping the physical node distinct from the conceptual one.
- **Defaults:** table name → class label, column name → property label, SQL/JSON
  type → `xsd:` datatype; user/Claude confirms the concept link. Persist the
  mapping itself as data for idempotent re-uploads.
- **Consider LinkML** as the internal schema IR: one YAML model generates OWL,
  JSON Schema, SQL DDL, and validation, and imports from SQL/JSON-Schema/OWL.
- **Connectors (later):** one internal model — Catalog/Database → Schema →
  Table(`DataAsset`) → Column(`Field`) → Tag — serves both vendors. Databricks:
  crawl `system.information_schema.{catalogs,schemas,tables,columns,*_tags}` +
  `system.access.{table,column}_lineage`; Snowflake: full crawl from
  `ACCOUNT_USAGE` (365-day, tags via `TAG_REFERENCES`), incremental from per-DB
  `INFORMATION_SCHEMA`. Ingest native tags as candidate `aboutConcept`
  suggestions. (w3c.github.io/csvw/csv2rdf; w3.org/TR/vocab-dcat-3; linkml.io;
  docs.databricks.com unity-catalog; docs.snowflake.com account-usage)

## 5. Net impact on the build

- Confirms ADR-001 (dual canvas) with library specifics → see ROADMAP ADR-011.
- Adds a concrete LLM-safety pipeline → ROADMAP ADR-012 and P5 tasks.
- Adds the schema-ingestion data model → P3 tasks.
- Frontend phase task list expanded with: spotlight/dim, semantic-zoom edge
  labels, drill-down + breadcrumb, context-sensitive inline inspector, object
  table view, glossary tree, certification badges, flows/trace mode.

## Sources (selection)

Graph viz: js.cytoscape.org · github.com/jacomyal/sigma.js · g6.antv.antgroup.com
· github.com/xyflow/xyflow · github.com/iVis-at-Bilkent/cytoscape.js-fcose ·
eclipse.dev/elk · arxiv.org/html/2304.01311v4 · cambridge-intelligence.com.
Modelling/catalog UX: docs.icepanel.io · docs.structurizr.com · c4model.com ·
drawio.com/docs · docs.atlan.com · docs.open-metadata.org · github.com/datahub-project
· docs.datahub.com · w3.org/TR/skos-primer. LLM→RDF: w3.org/TR/shacl ·
w3.org/TR/prov-o · arxiv.org/pdf/2405.03932 · arxiv.org/pdf/2412.15235 ·
arxiv.org/pdf/2512.05594 · ontotext.com. Schema→ontology: w3c.github.io/csvw/csv2rdf
· w3.org/TR/vocab-dcat-3 · rml.io · linkml.io · docs.databricks.com · docs.snowflake.com.
