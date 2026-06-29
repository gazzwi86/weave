# Weave Spec-Helper Findings

> Dense reference for PO and Architect spec agents. Synthesised from 9 research passes across all prototypes, reports, and existing specs.
> Sources: `prototypes/Blushift/`, `prototypes/versent-weave/`, `prototypes/obpm/`, `prototypes/weave-prototype/`, `.claude/reports/R0–R6`, `.claude/specs/`

---

## 1. Platform Overview & Positioning

### Mission

"Weave is the operating system for the AI-native company: the only platform that models the whole business — by ingesting the diagrams and data you already have into one open, standards-based graph (RDF/OWL/SHACL/PROV-O) — and then closes the loop, generating the apps, agents, and pipelines that run it, authored by business users in natural language and forms over a shipped universal ontology. Where Palantir does this behind a proprietary cage at enterprise prices, the EA tools stop at a beautiful diagram, and the process miners stop at a dashboard, Weave is the one that closes model → generate → automate → govern on open standards, at mid-market reach."

### Three-Paradigm Frame

| Paradigm | Question | How built | Exemplars |
|---|---|---|---|
| Descriptive-modeled | How is business *designed* to run? | Humans draw it | ArchiMate/BPMN tools, LeanIX, Ardoq, Bizzdesign |
| Mined-observed | How does business *actually* run? | Inferred from event logs | Celonis, SAP Signavio, ARIS |
| Data-bound-actionable | What is the live state, and what can I *do*? | Bound to source data + write-back | Palantir Foundry Ontology |

**Key correction:** Palantir already spans data-bound AND mined-observed via Foundry Machinery. The genuine whitespace is open W3C standards + generation closure + whole-business scope + NL+forms authoring + mid-market pricing.

### Four Sub-Systems

| Sub-system | Description | Ships |
|---|---|---|
| **Constitution Engine** | RDF/OWL/SHACL/SPARQL/PROV-O graph layer; live model of the business | FIRST (MVP) |
| **Build Engine** | Generates apps (Next.js/shadcn), agents (Anthropic Agent SDK), pipelines from graph | After CE |
| **Events & Actions Engine** | Automations triggered by graph changes + external events (webhooks, Jira, cron) | After BE |
| **Graph Explorer** | Force-directed Cytoscape canvas; Figma-style real-time multi-user collab | With CE |

### Commercial Model

- Fully commercial SaaS, closed source; no community edition
- Revenue: workspace-tier subscription + usage-based generation/automation
- Target: enterprise (500+ staff) AND mid-market (50–500)
- AWS-only in v1 (no multi-cloud, no on-prem)

### MVP Success Criterion

One real client models their company → Weave auto-generates one working artefact (app, pipeline, or agent) demonstrable within 6 months.

---

## 2. Application Shell & Navigation

### Primary Navigation (from Blushift prototype → `prototypes/Blushift/shell.jsx`)

| Tab ID | Label | Notes |
|---|---|---|
| `dashboard` | Dashboard | Activity feed, metrics, in-flight tasks |
| `workspaces` | Workspaces | Cards with health, sparklines, contributors |
| `organisation` | Organisation | Routes to `/organisation/org-graph` |
| `ops` | Ops | Operations dashboard |
| `polaris` | Self-Improvement | Badge = proposal count (7 in mock) |
| `releases` | Releases | Release management |
| `audit` | Audit | Immutable signed audit chain |
| `settings` | Settings | Budgets, integrations, users |

**Hash routing pattern:** `parts[0]` maps to tab IDs. Special cases: `portfolio` → `dashboard`; `workspace` or `project` → `workspaces`; `organisation`, `org-graph`, `transformations`, `finops` → `organisation`.

### Header Elements (right side)

- Search box (Cmd+K shortcut, ⌘K hint)
- Bell notification icon with red unread badge
- Avatar dropdown (initials + chevron)

### Command Palette

Triggered by Cmd+K or search click. 600px wide modal, dark surface, blur-shadow `0 30px 80px rgba(0,0,0,0.7)`.

| Kind | Label | Sub-label |
|---|---|---|
| Go to | Org Graph | Layered architecture |
| Go to | Polaris | 12 proposals waiting |
| Go to | Audit | 4,712 entries — verified |
| Project | Customer self-service portal v2 | Wave 1: Implementation 78% |
| Action | New Request | Build something new |
| Action | Help me — panic | `/weave:help-me` |
| Action | Verify audit chain | `/weave:audit verify` |

Search: case-insensitive substring on `label + sub + kind`. Keyboard: `↵` open, `↑↓` navigate, `esc` close.

### Confirmed Platform Navigation (from brief)

- Top header: home / workspace switcher / primary nav / global search / notifications / help & tour launcher / account menu
- Primary areas: Dashboard · Constitution · Explorer · Build · Automate · Compliance · Settings

### Sub-Navigation (Engine-Level)

**Constitution Engine** — left sidebar sections: Model (Overview, Ontology/Types, Instances/Data, Org chart), Vocabulary & standards (Glossary, Brand & voice, Rules & policies, Governance & compliance, Strategy & motivation), Tools (Query, Mapping, Versions, Authoring & questionnaires)

**Graph Explorer** — canvas-centric sidebar: Explore (canvas), Saved views, Filters & layers, Versions & diff, Collaboration

**Build Engine** — Build root (Projects, New project, Templates & module kit, Self-improvement, Build settings); Inside a project: Overview, Spec, Plan/Kanban, Project ontology, Anatomy/Wiki, Artefacts, Decision log, Self-healing, Settings

**Events Engine** — Automations, Builder, Runs/history, Triggers & connectors, Templates/library, Audit & compliance, Automate settings

### RBAC Roles

| Role | Primary access |
|---|---|
| Workspace admin/owner | Full control |
| Enterprise architect | Author ontology structure, types, rules; full model read |
| Business analyst / SME | Author instance data and glossary; limited structural change |
| Brand / content owner | Author brand and voice content; read model |
| Compliance / risk officer | Author governance/compliance; audit logs; read model |
| Engineer / developer | Build projects; generate, code, artefacts; read model |
| Ops / SRE | Operate built products; self-healing, runs, deployments |
| Automation author | Create and manage automations; read model |
| Viewer / stakeholder | Read-only explore and dashboards |

Non-human (agent) identities: first-class principals; scoped least-privilege; every change attributed in PROV-O + immutable audit log.

---

## 3. Org / Workspace Model

### Demo Org: Northwind Financial (from `prototypes/Blushift/fixtures.jsx`)

```
domains: 5
services: 77
stakeholders: 47
capabilities: 41
User: Jamie Reeves <jamie@northwind.fin>
```

### Workspace Schema (6 mock records)

| ID | Name | Domain | Health | Projects | Specs | Wiki pages | Open Proposals |
|---|---|---|---|---|---|---|---|
| `customer-portal` | Customer Portal | customer | green | 4 | 7 | 38 | 3 |
| `fraud-and-claims` | Fraud & Claims Intelligence | claims | amber | 3 | 5 | 24 | 2 |
| `lending-data` | Lending Data Platform | lending | green | 5 | 9 | 51 | 4 |
| `policy-underwriting` | Policy & Underwriting | policy | green | 2 | 4 | 29 | 1 |
| `platform-foundations` | Platform Foundations | platform | green | 6 | 11 | 72 | 5 |
| `data-and-ml` | Data & ML | data | amber | 3 | 6 | 33 | 2 |

**Full workspace field schema:** `id, name, domain, icon, hue (colour), description, lead (name+initials), contributors[], projects, specs, wikiPages, openPolaris, health (green/amber), activitySpark (10-point sparkline), lastActive`

### Project Schema (3 mocks)

| ID | Name | Workspace | Phase | Phase % | Budget used/cap | Owner |
|---|---|---|---|---|---|---|
| `csp-v2` | Customer self-service portal v2 | customer-portal | Wave 1: Implementation | 78% | 1847/3000 | Sarah Chen |
| `fraud-uplift` | Fraud-scorer model uplift | fraud-and-claims | Wave 0: Spec review | 12% | 312/4500 | Maya Patel |
| `snowflake-ingest` | Lending Snowflake ingestion | lending-data | Wave 1: Implementation | 45% | 923/2200 | Chris Okafor |

**Project phases in use:** `Wave 0: Spec review`, `Wave 1: Implementation`
**Demo status field:** `{status: 'green'|'amber', label}` — "Last demo: 2h ago", "No demo yet", "Last pipeline: 6h"
**Budget concept:** projects have explicit token/cost budgets with caps; budget alerts appear in notifications.

### Workspace Info Architecture (from `prototypes/thoughts.md`)

```
Workspace / company
  Branding & tone of voice
  Obligations & Constraints (regulation, tech stack)
  Principles
  Aims / Goals
  Initiatives → Product/Project management graph → Epic → Task
  Domains → Capabilities
  Assets
  Business processes
  Data: Systems (C4 L1) → Containers (C4 L2) → Components (C4 L3) → Code (C4 L4)
  Glossary (links to resources/assets/codebases)
  Service catalog (C4 model)
  Resources: Knowledge base, Module & pattern kit
```

---

## 4. Self-Improvement Engine (formerly "Polaris")

> The self-improvement engine monitors projects and the org graph; generates evidence-backed proposals with agent dispatch actions.

### Proposal Schema

```json
{
  "id": "P-YYYY-MM-DD-NNN",
  "title": "string",
  "time": "ISO timestamp",
  "tags": ["HIGH|MEDIUM|LOW IMPACT", "PROJECT|ORG-LEVEL"],
  "project": "projectId | null",
  "evidence": ["string (3-5 items)"],
  "rationale": "string",
  "metrics": [{"name": "string", "delta": "string"}],
  "action": "string (agent dispatch instruction)"
}
```

### 6 Mock Proposals (from `prototypes/Blushift/fixtures.jsx`)

1. **P-2026-05-08-014** (HIGH, project-level, csp-v2): Add font preconnect to `<head>` — reduces FOUT. Evidence: 3 fidelity failures, F25 shows >300ms FOUT, 5 similar projects use preconnect. Action: "Dispatch Engineer → add preconnect → run F25 → confirm → commit"

2. **P-2026-05-07-022** (MEDIUM, project-level, csp-v2): Cache `/api/portfolio` at edge — saves ~$180/mo. Evidence: p95 latency 412ms (4.2× SLO), 92% read-only, 88% hit ratio. Action: "Dispatch Engineer → set cache headers → load test → ship"

3. **P-2026-05-06-008** (HIGH, org-level): Promote Adjudication capability to org graph (currently inferred). Evidence: 4 services implement adjudication semantics, 11 wiki references with no owner. Action: "Dispatch Architect → propose ADR → Council review → graph mutation"

4. **P-2026-05-05-031** (MEDIUM, project-level, fraud-uplift): Replace ad-hoc retry loops with circuit breaker. Evidence: 6 incidents trace to retry storms.

5. **P-2026-05-05-027** (LOW, project-level, snowflake-ingest): Write missing ADR for Kafka topic schema versioning. Evidence: 3 services with divergent assumptions, 1 schema-drift incident.

6. **P-2026-05-04-019** (MEDIUM, org-level): Consolidate 3 duplicate auth helpers. Evidence: 2 CVEs patched in only one implementation.

### Pattern Invariants

- Every proposal: 3–5 concrete evidence items, clear metrics with delta values, named agent dispatch action
- Proposals at both project-level (scoped) and org-level (null project)
- "Dispatch {AgentType} →" in action strings — UI must have a dispatch mechanism

---

## 5. Audit Chain

### From Blushift Prototype (`prototypes/Blushift/fixtures.jsx`)

**4,712 entries** total (mock), last verified 5 min ago.

### Entry Schema

```typescript
{n: number, t: ISO_timestamp, op: 'Edit'|'Read'|'Bash'|'Write'|'Block', target: string, meta: string, flag?: 'red'}
```

### Example Entries

| Op | Target | Meta | Flag |
|---|---|---|---|
| Edit | src/components/Bubble.tsx | sandbox passed • scrubber clean • signed ✓ | — |
| Read | src/components/Cart.tsx | sandbox passed • signed ✓ | — |
| Bash | pnpm test --filter checkout | exit 0 • 12.4s • signed ✓ | — |
| Write | src/components/Promo.tsx | sandbox passed • scrubber clean • signed ✓ | — |
| Block | ~/.kube/config | sandbox BLOCKED • write to protected path • signed ✓ | red |

**Key invariants:** BLOCKED operations are flagged red but remain in the chain (immutable). Every entry: number, timestamp, op type, target path, sandbox result, scrubber result, cryptographic signature.

### Backend Audit Trail (from `prototypes/weave-prototype/backend/`)

History stored in `history.jsonl` sidecar (disk-backed) or `_history` list (memory-backed) on `OntologyStore`. `HistoryEvent` schema:

```python
{id: str (uuid hex), timestamp: ISO, agent: "user"|"llm", summary: str, operations: list[dict]}
```

Polled via `GET /api/history?project_id=&limit=100` — newest first, hard cap 100 events. Frontend auto-polls every 10s (`refetchInterval: 10000`).

### PROV-O Provenance Stamp

Every `apply_operations()` call invokes `store.stamp_activity(agent, summary)` which creates a `prov:Activity` node with `dcterms:created`, `rdfs:comment`, `prov:wasAttributedTo`. Lives in `weave:graph/prov` named graph.

---

## 6. Graph Visualisation

### Canvas Libraries (Confirmed, ADR-001/011)

- **Cytoscape.js** — force-directed Explore canvas. Library: v3.30.2. Plugins: `cytoscape-fcose` (layout), `cytoscape-edgehandles` (drag-to-connect)
- **React Flow** (`@xyflow/react` v12) — positional Domain/C4 canvas. No edge connectors (ADR-022). Layout: 5-column grid, 200px col gap, 110px row gap.
- **Escape hatch at 10k+ nodes:** sigma.js or G6 (WebGL renderer) — not built yet.

### Cytoscape fcose Layout Parameters

```javascript
{
  name: 'fcose',
  quality: 'default',
  animate: true,
  animationDuration: 600,
  randomize: true,
  nodeSeparation: 90,
  idealEdgeLength: 110,
  nodeRepulsion: 6500
}
```

### Versent Radial Layout Algorithm (`prototypes/versent-weave/versent-ai-first-network.html`)

Two-phase custom deterministic radial layout (passed as `preset` to Cytoscape):

**Phase 1 — BFS ring assignment:** BFS from core node assigns `depth[nodeId]`. Parent = neighbour at `depth-1` with lowest edge-preference score (enables=0, comprises=1, intersects=2, instance-of=3, delivers=4, uses=6, informs=7).

**Phase 2 — Angular position (weighted):**
- `weight[nodeId]` = leaf count in subtree
- `frac = 0.5 × (1/numKids) + 0.5 × (weight[k] / totalWeight)` — 50/50 blend of equal-share and subtree-weight
- Ring radius = `depth × 200` pixels
- Position: `{x: 1000 + r×cos(angle - π/2), y: 1000 + r×sin(angle - π/2)}`

### Node Visual Encoding (Versent prototype)

| Class | Shape | Size | Notes |
|---|---|---|---|
| `core` | circle | 52×52px | glow shadow, z-top |
| `pillar` | circle | 30×30px | bold 700 |
| `offering` | circle | 24×24px | — |
| `cap` | round-diamond | 24×24px | — |
| `asset` | round-rectangle | 22×18px | — |
| Others | circle | 16×16px | tool, ritual, practice, partner |

Border style: `solid` = live, `dashed` = emerging. `proposed:true` nodes: pink dotted border.

### Edge Visual Encoding (Versent prototype — 7 types)

| Type | Colour | Style | Arrow |
|---|---|---|---|
| `enables` | `#e2e9f2` (steel) | solid | yes, 2.1px |
| `comprises` | `#565c66` (dark grey) | solid | yes |
| `delivers` | `#73c8a3` (green-teal) | dashed `[7,4]` | yes |
| `uses` | `#6aa6e0` (blue) | dotted `[1.5,4]` | yes |
| `intersects` | `#9aa1ab` (grey) | solid | NO (undirected) |
| `instance-of` | `#b89ad8` (mauve) | dashed `[7,4]` | yes |
| `informs` | `#cba98a` (tan) | dotted `[1.5,4]` | yes |

### Weave Prototype Canvas Features (from `prototypes/weave-prototype/frontend/`)

- **Spotlight selection:** `closedNeighborhood()` stays visible; everything else `.dimmed` (opacity 0.18)
- **Semantic zoom threshold:** 0.55× — edge labels hidden below, shown on hover (ADR-015)
- **Position persistence:** `localStorage` key `weave:layout:{projectId}` — saved on drag end, loaded on mount; "Reset layout" clears + reloads
- **Domain drill-down:** right-click `BusinessDomain` → "View domain members" → `focusDomain` state → `.domain-filtered` class
- **Diff overlay:** added=green border, removed=red border+0.35 opacity, modified=orange border
- **Heatmap overlay:** `BusinessCapability` nodes coloured by dimension (maturity/investment/strategy/lifecycle) via `HEATMAP_COLORS[dim][value]`
- **Quick-add node:** double-click canvas → inline popover
- **Edgehandles drag-connect:** source ≠ target; handle: purple (#7c3aed) 12×12px circle

### Cytoscape Stylesheet (weave-prototype)

```javascript
// Node base
{ selector: 'node', style: { 'background-color': 'data(color)', 'label': 'data(label)',
    'text-valign': 'bottom', 'text-margin-y': 4, 'font-size': 11, 'font-weight': 600,
    'text-max-width': '120px', 'width': 34, 'height': 34, 'border-width': 2,
    'border-color': 'white', 'transition-duration': '0.15s' }}
// Selected
{ selector: '.selected', style: { 'border-width': 3, 'border-color': '#0f172a' }}
// Dimmed
{ selector: '.dimmed', style: { 'opacity': 0.18 }}
```

### Real-Time Collaboration

Decided: **Yjs CRDT** (mature, self-hostable, no per-seat SaaS lock-in). CRDT manages collaborative canvas/draft state ONLY — authoritative writes always flow through Constitution Engine SHACL validation. Sync transport (WebSocket on Fargate) deferred to tech spec. Rendering approach (Cytoscape.js vs WebGL) deferred to tech spec.

---

## 7. Knowledge Graph Data Model

### 7.1 Core Types (Universal Ontology)

**~9 ArchiMate-3-aligned canonical types** (shipped with Weave, clients extend):

| Type | ArchiMate layer | Key properties | Notes |
|---|---|---|---|
| Actor/Role/Org-Unit | Business | name, type | Three UFO categories (Kind/Role/Kind); use W3C `org:` |
| Capability | Strategy | maturity (1–5), strategicImportance, investmentLevel, lifecycleStatus, owner | Heat-map dimensions |
| Process/Activity | Business | automatable (bool), triggeredBy, produces, consumes | OBPM pattern |
| System/Application | Application | SLA, servesDomain, dependsOn | C4 L1/L2 |
| Data/Information asset | Technology/data | format, schema, classification | + Field nodes for columns |
| Rule/Policy | Motivation | enforcedByShape, enforcedByQuery | SHACL-backed |
| Event | Events | timestamp, OCEL 2.0 mapping | Supplemented by PROV-O + REA |
| Product/Service | Business | value proposition | REA EconomicResource |
| KPI/Metric | Strategy | target, current | ArchiMate motivation |

**OWL namespace:** `weave: <https://weave.dev/ontology#>`
**Resource IRI pattern:** `https://weave.dev/resource/<slug>-<8hex>`

**Weave prototype node kinds (8 registered):**

| Key | IRI | Default colour |
|---|---|---|
| `BusinessDomain` | `weave:BusinessDomain` | `#7c3aed` |
| `BusinessCapability` | `weave:BusinessCapability` | `#db2777` |
| `System` | `weave:System` | `#2563eb` |
| `Service` | `weave:Service` | `#0891b2` |
| `DataAsset` | `weave:DataAsset` | `#16a34a` |
| `Field` | `weave:Field` | `#65a30d` |
| `Concept` | `skos:Concept` | `#ea580c` |
| `Class` | `owl:Class` | `#d97706` |

**Relationship types (9 registered):**

| Key | IRI | Label |
|---|---|---|
| `dependsOn` | `weave:dependsOn` | depends on |
| `partOf` | `weave:partOf` | part of |
| `realizes` | `weave:realizes` | realizes |
| `owns` | `weave:owns` | owns |
| `exposes` | `weave:exposes` | exposes |
| `describes` | `weave:describes` | describes |
| `broader` | `skos:broader` | broader |
| `narrower` | `skos:narrower` | narrower |
| `related` | `skos:related` | related |

### 7.2 OWL Design Patterns

**OBPM core domain model** (`prototypes/obpm/ontologies/mi-core.ttl`) — 12 core classes, 9 TTL files (mi-core, mi-glossary, mi-catalog, mi-provenance, mi-process, mi-agent-model, mi-motivation, mi-governance, mi-constitution). All merge into `build/mi-merged.ttl`.

**Disjointness axioms:**
```turtle
mi:Comedian owl:disjointWith mi:DoorTechnician .
mi:LaughCanister owl:disjointWith mi:ScreamCanister .
mi:Identity owl:disjointWith mi:Monster .
```

**Existential restriction pattern:**
```turtle
mi:Comedian a owl:Class ;
    rdfs:subClassOf mi:Monster ;
    rdfs:subClassOf [
        a owl:Restriction ;
        owl:onProperty mi:certLevel ;
        owl:someValuesFrom xsd:integer
    ] .
```

**OWL vs SHACL split:** OWL 2 DL for logical class constraints (disjointness, existential restrictions, class hierarchy — open-world). SHACL for operational data-quality rules (range values, reporting deadlines, referential integrity — closed-world). The "Polikoff rule": relationship matrix in SHACL shapes, NOT OWL axioms.

**Business process as semantic individual:**
```turtle
mi:P1_DailyLaughRun a mi:BusinessProcess ;
    rdfs:label "P1 — Daily Laugh Run" ;
    mi:triggeredBy mi:ShiftStartEvent ;
    mi:produces mi:PerformanceRecord, mi:EnergyUnit ;
    mi:consumesInput mi:ChildDoor, mi:LaughCanister .
```

**NON_EDGE_PREDICATES** (never rendered as graph edges):
`rdf:type`, `rdfs:label`, `rdfs:comment`, `skos:definition`, `skos:prefLabel`, `weave:note`, `weave:color`, `weave:x`, `weave:y`, `weave:inDomain`, `weave:hasCapability`, `weave:maturity`, `weave:targetMaturity`, `weave:strategicImportance`, `weave:investmentLevel`, `weave:lifecycleStatus`, `weave:capabilityOwner`, `dcterms:created`, `prov:wasGeneratedBy`, `prov:wasAttributedTo`, `rdf:subject`, `rdf:predicate`, `rdf:object`.

### 7.3 SKOS Glossary

**SPARQL_PREFIXES** (prepended to every query in weave-prototype):
```sparql
PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:     <http://www.w3.org/2002/07/owl#>
PREFIX skos:    <http://www.w3.org/2004/02/skos/core#>
PREFIX prov:    <http://www.w3.org/ns/prov#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd:     <http://www.w3.org/2001/XMLSchema#>
PREFIX weave:   <https://weave.dev/ontology#>
PREFIX res:     <https://weave.dev/resource/>
```

**IRI naming conventions:**
- Classes: `weave:PascalCase`
- Properties: `weave:camelCase`
- Named graphs: `weave:graph/slug`
- Runtime instances: UUID IRI
- Blank nodes: only for structurally anonymous shapes never reused

**SKOS rules:**
- One `skos:prefLabel` per language
- `skos:altLabel` for synonyms
- `skos:broader`/`skos:narrower` for vocabulary hierarchy
- `skos:exactMatch` for confirmed equivalence
- `skos:closeMatch` for approximate equivalence
- `skos:definition` for `rdfs:comment` on Concept nodes

**Reconciliation spine (cross-notation):** One `skos:Concept` as shared meaning anchor. Every notation element points at it via `weave:denotes`. Cross-notation SPARQL: answers "show everything we know about X across architecture model, process model, and database." This is core IP.

**OBPM glossary:** 52 SKOS concepts, 7 top concepts; dual-use pattern: `skos:exactMatch` between `DoorStatus` vocabulary in SKOS and as OWL enumeration.

### 7.4 PROV-O Provenance

**Complete PROV-O lineage chain** (OBPM, `prototypes/obpm/ontologies/mi-provenance.ttl`):

```
ChildLaugh ←wasGeneratedBy← LaughCollectionActivity →wasAssociatedWith→ Agent_Sulley
LaughCollectionActivity →used→ LaughFloorStation_042
LaughCollectionActivity ←wasInformedBy← ShiftStartActivity
LaughCanister_CAN20240315042 →wasDerivedFrom→ ChildLaugh
LaughCanister_CAN20240315042 ←wasGeneratedBy← CanisterSealingActivity
EnergyUnit_EU20240315042001 →wasDerivedFrom→ LaughCanister_CAN20240315042
EnergyUnit_EU20240315042001 ←wasGeneratedBy← EnergyExtractionActivity
GridDispatchActivity →used→ EnergyUnit_EU20240315042001
EnergyLineageBundle ←wasGeneratedBy← GridDispatchActivity
```

**Entity double-typing pattern:**
```turtle
mi:EnergyUnit_EU20240315042001 a mi:EnergyUnit, prov:Entity ;
    mi:megawattHours "14.5"^^xsd:decimal ;
    mi:generatedAt "2024-03-15T10:22:00Z"^^xsd:dateTime ;
    prov:wasDerivedFrom mi:LaughCanister_CAN20240315042 ;
    prov:wasGeneratedBy mi:EnergyExtractionActivity .
```

**BusinessDocument dual-typing:**
```turtle
mi:BusinessDocument rdfs:subClassOf dcat:Distribution, prov:Entity .
```
Every formal document is simultaneously a DCAT distribution (discoverable) and a PROV-O entity (traceable).

**PROV bundle wrapping:** `mi:EnergyLineageBundle` wraps the full lineage chain as one provenance artefact for regulatory audit.

**OCEL 2.0 → PROV-O mapping:**

| OCEL 2.0 construct | Weave / W3C equivalent |
|---|---|
| Object (typed) | OWL individual of an ontology class |
| Object type | OWL class (ArchiMate-aligned) |
| Object-to-object relationship + qualifier | RDF object property |
| Event (timestamped, multi-object) | PROV-O `Activity` linking multiple entities |
| Qualified event-to-object relation | PROV qualified association / role |
| Dynamic attribute value change | PROV-O state + time, or RDF-star |

### 7.5 DCAT 3 Data Catalog

**11 DCAT 3 datasets** (OBPM):

| Dataset | Type | Domain | Update |
|---|---|---|---|
| `MonsterRegistry` | `dcat:Dataset` | HR | On change |
| `DoorInventory` | `dcat:Dataset` | Door Mgmt | On change |
| `PerformanceRecordsDataset` | **`dcat:DatasetSeries`** | Operations | Daily (time-partitioned slices) |
| `EnergyLedger` | `dcat:Dataset` | Energy | Real-time |
| `CDAIncidentLog` | `dcat:Dataset` | Compliance | Event-driven |
| `ChildProfiles` | `dcat:Dataset` | Door Mgmt | On change |
| `KnowledgeModels` | `dcat:Dataset` | Enterprise | On change |

`KnowledgeModels` is the 11th dataset — the agent's OWL/SKOS/ODRL modules formally catalogued so agent's knowledge base is auditable.

**Catalog excerpt:**
```turtle
<https://vocab.monstersinc.com/catalog> a dcat:Catalog ;
    dct:title "Monsters, Inc. Enterprise Data Catalog"@en ;
    dcat:dataset mi:MonsterRegistry, mi:DoorInventory, mi:KnowledgeModels ;
    dcat:service mi:SPARQLEndpoint .
```

### 7.6 SHACL Validation

**4 static shapes in weave-prototype** (`app/validation/shapes.py`):

| Shape | Target | Constraint | Severity |
|---|---|---|---|
| `weave:InDomainShape` | subjects of `weave:inDomain` | `sh:class weave:BusinessDomain` | Violation |
| `weave:HasCapabilityShape` | subjects of `weave:hasCapability` | `sh:class weave:BusinessCapability` | Violation |
| `weave:RealizesShape` | subjects of `weave:realizes` | `sh:class weave:BusinessCapability` | Violation |
| `weave:DescribesShape` | subjects of `weave:describes` | `sh:class skos:Concept` | Violation |

**SHACL severity levels:**
- `sh:Violation` — hard, blocks save (HTTP 422)
- `sh:Warning` — incomplete, surfaced to user
- `sh:Info` — hint only

**OBPM SHACL shapes** (`prototypes/obpm/shapes/`):

```turtle
mi:ComedianCertShape a sh:NodeShape ;
    sh:targetClass mi:Comedian ;
    sh:property [
        sh:path mi:certLevel ;
        sh:minCount 1 ;
        sh:datatype xsd:integer ;
        sh:minInclusive 1 ;
        sh:maxInclusive 5 ;
        sh:severity sh:Violation ;
    ] .
```

```turtle
mi:CDAReportingShape a sh:NodeShape ;
    sh:targetClass mi:CDAIncident ;
    sh:property [
        sh:path mi:reportedAt ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
    ] .
-- Also: reporting delay <= 30 minutes (PT30M) between detectedAt and reportedAt
```

**Honest gap detection queries:** `GV6` returns datasets with `mi:SensitivePersonalData | mi:Restricted` classification and NO ODRL policy. `CN2` returns principles with NO `enforcedByShape` or `enforcedByQuery`. These are intentional self-audit queries.

**Validation pipeline (weave-prototype):**
1. `POST /api/llm/propose` — LLM proposes, no mutation
2. Frontend shows diff for human review
3. `POST /api/operations/apply` → `_validate_prospective()` clones store → applies → SHACL validates → violations → 422; clean → applies to real store + PROV stamps
4. `GET /api/validate` — standalone SHACL check

**Custom rules:** JSON sidecar (`data/custom_rules.json`); SHACL Turtle fragments merged at validation time; `shapes_graph()` cache invalidated on add/remove.

### 7.7 Agent / Permission Model

**Authority resolution (OBPM):**

```turtle
mi:Permission a owl:Class .
mi:action a owl:DatatypeProperty . -- "read"|"write"|"dispatch"|"escalate"|"export"
mi:effect rdfs:range xsd:string .  -- "allow"|"deny"
mi:authorityLevel rdfs:range xsd:integer . -- 1..5
mi:clearanceLevel rdfs:subPropertyOf mi:authorityLevel .
```

**4-gate agent decision loop:**
1. Permission `effect = "deny"` → BLOCK (explicit prohibition overrides all)
2. `empAuthorityLevel < requiresRole.authorityLevel` → BLOCK (insufficient authority)
3. `step.automatable = false` → route to human
4. HITL trigger fires → pause and escalate within deadline

**Key invariant:** Explicit `deny` beats even authority level 5. Proof: CEO (level 5) denied `export` of `ChildProfile`.

**Agent identity (OBPM):**
```turtle
mi:SA_AgentOrchestrator a mi:ServiceAccount ;
    mi:assumesRole mi:FloorManagerRole ;  -- level 3, minimum privilege
    rdfs:comment "Cannot self-approve its own escalation triggers." .
```

**HITL triggers (OBPM):**
- `HITL_2319Contamination` → escalates to `CDADirector`, deadline `PT30M`
- `HITL_LowLaughScore` → escalates to `FloorManagerRole`, deadline `PT1H`
- `HITL_HighSeverityIncident` → escalates to `CDADirector`, deadline `PT15M`

**ODRL policies (3):** `ChildProfileDataPolicy` (odrl:Set), `EmployeeDataPolicy`, `EnergyLedgerPolicy`. Pattern: `mi:governedByPolicy` from dataset to ODRL Set. `odrl:use` (NOT `odrl:read` — official term).

**Column-level data classification:**
```turtle
mi:ageRange     mi:dataClassification mi:SensitivePersonalData .
mi:bedroomType  mi:dataClassification mi:SensitivePersonalData .
mi:laughScore   mi:dataClassification mi:Internal .
mi:employeeId   mi:dataClassification mi:Internal .
```

### 7.8 Constitution Model (Principles / Governance)

**Structure:** Constitution → `mi:Principle` individuals → linked to `mi:Pillar` individuals (Strategy, Methods, People, Culture, Technology, Operations)

**Defensibility chain:** Principle → RegulatoryRequirement (`upholdsPrinciple`) → SHACL shape (`enforcedByShape`) + SPARQL query (`enforcedByQuery`) → live evidence in graph.

**Constitution Engine governed content (5 categories):**
1. Universal business ontology (~9 ArchiMate-3-aligned core types)
2. Business glossary / controlled vocabulary (SKOS)
3. Brand, voice & communication standards — machine-readable, governed assets
4. Governance, policy & compliance constraints (GDPR, SOC 2, industry-specific, business rules)
5. Strategic / motivation layer (mission, vision, goals, drivers, principles — ArchiMate motivation layer)

**Key boundary:** Constitution publishes; Build/Events apply. The CE is NOT the graph canvas (that's Explorer) and NOT the code generator (that's Build).

### 7.9 Notation-to-OWL Mappings

**ArchiMate 3.2** — backbone. Source: Mendoza 2026 (single-author blog post, NOT Open Group release). Namespace: `archimate: <https://purl.org/archimate#>`. 61 element types, 11 relationship types, 3-level SHACL suite. bp4mc2/archimate2rdf for Open Group XML → RDF.

**BPMN 2.0** — BBO (Annane et al. 2019, OWL 2 DL). Namespace: `bbo: <http://BPMNbasedOntology#>`. Ships `SHACLshapes.ttl`.

**DMN 1.1** — dmn-ont (Nicholas Car 2017, CC-BY 4.0). Namespace: `dmn: <http://promsns.org/def/dmn#>`. WARNING: targets DMN 1.1; current spec is 1.5/1.6.

**C4** — NO canonical OWL ontology. Map as ArchiMate profile: Person→`archimate:BusinessActor`; Software System→`archimate:ApplicationComponent`; Container→`archimate:ApplicationComponent`/`SystemSoftware`/`Node`; Component→nested `archimate:ApplicationComponent`.

**Org charts** — W3C Organization Ontology (`org: <http://www.w3.org/ns/org#>`). `org:subOrganizationOf` is `owl:TransitiveProperty`.

**Capability maps / Value-stream maps** — NOT separate notations. They ARE the ArchiMate Strategy layer (`archimate:Capability`, `archimate:ValueStream`, `archimate:CourseOfAction`, `archimate:Value`).

**REA** — OWL anchor: Gailly/Geerts/Poels OWL-REA. Constructs: `rea:EconomicResource`, `rea:EconomicEvent`, `rea:EconomicAgent`, `rea:duality`, `rea:stockflow`, `rea:Commitment`, `rea:Contract`. ISO 15944-4. Conceptual reference: REA2 (Laurier 2018, IOS Press) uses OntoUML — NOT OWL.

**Notation backbone priority:** ArchiMate wins because its OWL form ships with complete relationship matrix as SHACL; 4 of 10 notations collapse onto it (ArchiMate, capability maps, value-stream maps, half of org charts).

**Ontology gaps and fills:**

| Gap | Fill |
|---|---|
| Events & temporal | PROV-O + OWL-Time + OCEL 2.0 |
| Economic exchange | REA OWL (Gailly/Geerts/Poels) |
| Data assets (fine grain) | UML/OntoUML class detail + R2RML |
| Motivation depth | DMN + SHACL as enforced policy |
| Ontological rigour (identity/rigidity) | gUFO / OntoUML stereotypes |

**Ingest lanes:**

| Artefact | Lane | Tool |
|---|---|---|
| Relational DB / CMDB | W3C R2RML | Ontop/Morph engines |
| CSV / JSON / XML / spreadsheets | W3C KG-Construct RML (2025 modular spec) | Ships own SHACL shapes |
| ArchiMate EA repository | Open Group XML → RDF | bp4mc2/archimate2rdf |
| BPMN .bpmn XML | XSLT/parser → BBO | BBO + PM2ONTO transform |
| Diagrams, unstructured docs, prose | LLM extraction (probabilistic) | Propose triples → SHACL → HITL |

**LLM ingest safety rule:** LLM NEVER writes to graph directly. Proposes triples typed against universal ontology → passes SHACL → failures + low-confidence → HITL or SKOS reconciliation queue.

---

## 8. Governed Content

The Constitution Engine holds five content categories (section 7.8 above), with these specific design constraints:

- **Brand / voice standards:** machine-readable styleguides (visual identity, writing style) so generated artefacts are brand-compliant by construction. These are governed assets in the graph — not out-of-band PDFs.
- **Governance constraints as graph:** GDPR, SOC 2, industry-specific, security, data-handling, business rules are first-class graph content that guardrail downstream generation.
- **Draft → published lifecycle:** Constitution publishes versioned snapshots. Downstream engines (Build, Events) pin to specific published versions. Model changes must not silently break what depends on them.
- **Stable read interface:** REST + SPARQL, versioned, addressable by published version ID.

**Constitution Engine success criteria:**
- Shipped ontology extended + populated across ≥6 of 9 types within 30 days of GA
- ≥90% of business-user edits via NL or forms; 100% of committed changes pass SHACL
- ≥1 downstream artefact honours Constitution content (brand value, glossary term, blocked by governance)
- 100% of committed changes carry PROV-O records at GA
- ≥1 downstream engine reads graph through stable interface by MVP loop-close

---

## 9. SPARQL Patterns

### Glossary Query (weave-prototype, `OntologyStore.glossary()`)

```sparql
SELECT ?c ?label ?def ?rel WHERE {
  ?c a skos:Concept .
  OPTIONAL { ?c rdfs:label ?label }
  OPTIONAL { ?c rdfs:comment ?def }
  OPTIONAL { ?c skos:related ?rel }
} ORDER BY ?label
```

### Rules Introspection (weave-prototype, `_RULES_QUERY`)

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?shape ?path ?cls ?message ?severity WHERE {
  ?shape a sh:NodeShape ;
         sh:property ?prop .
  ?prop sh:path ?path .
  OPTIONAL { ?prop sh:class ?cls }
  OPTIONAL { ?prop sh:message ?message }
  OPTIONAL { ?prop sh:severity ?severity }
}
```

### SHACL Violations Extraction (weave-prototype, `_RESULTS_QUERY`)

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?focus ?path ?message ?severity WHERE {
  ?r a sh:ValidationResult ;
     sh:focusNode ?focus ;
     sh:resultSeverity ?severity .
  OPTIONAL { ?r sh:resultPath ?path }
  OPTIONAL { ?r sh:resultMessage ?message }
}
```

### Q1: Top Performers (OBPM)

```sparql
PREFIX mi:  <https://vocab.monstersinc.com/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?name ?certLevel (SUM(?mwh) AS ?totalMWh)
WHERE {
    ?comedian a mi:Comedian ;
              mi:name ?name ;
              mi:certLevel ?certLevel .
    ?perf a mi:PerformanceRecord ;
          mi:comedian ?comedian ;
          mi:energyGenerated ?mwh ;
          mi:date ?d .
    FILTER (YEAR(?d) = YEAR(NOW()) && MONTH(?d) = MONTH(NOW()))
}
GROUP BY ?comedian ?name ?certLevel
ORDER BY DESC(?totalMWh)
LIMIT 10
```

### AA1: Authority Check (OBPM — agent permission query)

```sparql
-- May employee E do action A on entity-class C?
SELECT ?employee ?decision WHERE {
    ?emp mi:holdsTitleRole ?role ; mi:name ?employee .
    ?role mi:authorityLevel ?empAuth .
    ?perm mi:action ?action ; mi:effect ?effect ;
          mi:requiresRole ?reqRole .
    ?reqRole mi:authorityLevel ?reqAuth .
    FILTER (?role = ?reqRole)
    BIND(IF(?effect = "deny", "DENY (explicit prohibition)",
         IF(?empAuth >= ?reqAuth, "ALLOW", "DENY (insufficient authority)")) AS ?decision)
}
```

### GV6: Governance Gap (OBPM — datasets with no ODRL policy)

```sparql
SELECT (STRAFTER(STR(?ds), "#") AS ?dataset) (STRAFTER(STR(?cls), "#") AS ?classification)
WHERE {
    ?ds a dcat:Dataset ; mi:dataClassification ?cls .
    FILTER (?cls IN (mi:SensitivePersonalData, mi:Restricted))
    FILTER NOT EXISTS { ?ds mi:governedByPolicy ?p }
}
ORDER BY ?dataset
```

### CN2: Unenforced Principles (OBPM — honest gap detection)

```sparql
SELECT ?label
WHERE {
    { ?rule a mi:Principle } UNION { ?rule a mi:RegulatoryRequirement }
    ?rule rdfs:label ?label .
    FILTER NOT EXISTS { ?rule mi:enforcedByShape ?s }
    FILTER NOT EXISTS { ?rule mi:enforcedByQuery ?q }
}
ORDER BY ?label
-- Returns exactly 1 row: "Joy over fear" (deliberately aspirational, not yet bound)
```

### Strategy Traceability (OBPM Q16)

```sparql
-- Goal → Capability → Process → owning Domain (multi-hop)
SELECT ?goal ?cap ?process ?domain WHERE {
    ?goal a mi:Goal ; rdfs:label ?goalLabel .
    ?cap mi:servesGoal ?goal ; rdfs:label ?cap .
    ?process mi:realizesCapability ?cap ; rdfs:label ?process .
    ?domain a mi:BusinessDomain .
    ?process mi:ownedByDomain ?domain ; rdfs:label ?domain .
}
```

### NL→SPARQL System Prompt Examples (weave-prototype)

Three embedded worked examples for NL→SPARQL:
1. "Which systems depend on the Billing service?" → SELECT with `weave:dependsOn`
2. "List all concepts with their definitions" → SELECT over `skos:Concept` with OPTIONAL
3. "How many nodes of each kind are there?" → SELECT with `GROUP BY` and `COUNT`

**Query constraints enforced by backend:** SELECT-only; `SERVICE` keyword rejected (SSRF prevention); hard cap 500 rows. Queries stored in `.sparql` files; SPARQL Update only via `OntologyStore` methods.

---

## 10. SHACL Validation Patterns

### ArchiMate Relationship Matrix (Polikoff rule)

Relationship matrix goes in SHACL, NOT OWL axioms. Rationale: OWL open-world assumption will not reject violations; SHACL closed-world assumption enforces them at runtime.

**Derived relationships via SHACL-AF:** `sh:construct` rules DR1-DR8 (direct), PDR1-PDR12 (path-derived). RDF-Star per-relationship metadata: provenance, dates, status, confidence.

### BPMN Structural SHACL (BBO)

```turtle
-- StartEvent: must have no incoming, at least one outgoing
bbo:StartEventShape sh:property [sh:path bbo:has_incoming ; sh:maxCount 0] .
-- EndEvent: must have no outgoing
bbo:EndEventShape sh:property [sh:path bbo:has_outgoing ; sh:maxCount 0] .
-- Gateway: ≥1 incoming, ≥1 outgoing; ≥2 on split side
```

### Permission Model Constraint (OBPM)

```turtle
mi:PermissionShape a sh:NodeShape ;
    sh:targetClass mi:Permission ;
    sh:property [
        sh:path mi:effect ;
        sh:minCount 1 ;
        sh:in ( "allow" "deny" ) ;
        sh:severity sh:Violation ;
        sh:message "Permission effect must be exactly 'allow' or 'deny'."
    ] .
```

### HITL Trigger Shape (OBPM)

```turtle
mi:HITLTriggerShape a sh:NodeShape ;
    sh:targetClass mi:HITLTrigger ;
    sh:property [sh:path mi:escalatesTo ; sh:minCount 1 ; sh:severity sh:Violation] ;
    sh:property [sh:path mi:escalationDeadline ; sh:minCount 1 ; sh:severity sh:Violation] ;
    sh:property [sh:path mi:triggeredByStep ; sh:minCount 1 ; sh:severity sh:Violation] .
```

### Capability EA Fields (weave-prototype SHACL)

```turtle
-- weave:RealizesShape enforces realizes → BusinessCapability
-- weave:HasCapabilityShape enforces hasCapability → BusinessCapability
-- weave:InDomainShape enforces inDomain → BusinessDomain
-- weave:DescribesShape enforces describes → skos:Concept
```

**Sanctioned uses of SHACL beyond validation:** UI building (derive form fields from shapes), code generation (shapes → typed SDK), data integration (import conformance), hallucination gating (LLM extraction conformance check).

---

## 11. API Reference

### Base URL

`VITE_API_BASE_URL` (default `http://localhost:8000`). All data routes prefixed `/api`. Project scoped via `?project_id=` query param (defaults to `"demo"`).

### Full Endpoint Table (weave-prototype)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok"}` | |
| GET | `/api/projects` | — | `list[ProjectOut]` | |
| POST | `/api/projects` | `ProjectIn` | `ProjectOut` | 201 |
| PATCH | `/api/projects/{id}` | `ProjectUpdate` | `ProjectOut` | 400 if demo |
| DELETE | `/api/projects/{id}` | — | — | 204, 400 if demo |
| GET | `/api/graph` | `?project_id` | `GraphOut` | |
| GET | `/api/node-kinds` | — | `list[NodeKind]` | static |
| GET | `/api/relationship-types` | — | `list[RelationshipType]` | static |
| POST | `/api/nodes` | `?project_id` + `NodeIn` | `{"id":str}` | 201 |
| PATCH | `/api/nodes` | `?node_id&project_id` + `NodeIn` | `{"id":str}` | |
| DELETE | `/api/nodes` | `?node_id&project_id` | — | 204 |
| POST | `/api/edges` | `?project_id` + `EdgeIn` | `{"id":str}` | 201, 400 bad type |
| POST | `/api/edges/delete` | `?project_id` + `EdgeRef` | — | 204 |
| GET | `/api/ontology/ttl` | `?project_id` | `text/turtle` | |
| POST | `/api/ontology/ttl` | `?project_id` + `TurtleIn` | `GraphOut` | 400 parse error |
| POST | `/api/schema/import` | `?project_id` + `SchemaImportIn` | `GraphOut` | |
| GET | `/api/rules` | — | `list[Rule]` | static + custom |
| POST | `/api/rules` | `RuleIn` | `Rule` | 201 |
| DELETE | `/api/rules/{id}` | — | — | 204, 404 if static |
| GET | `/api/glossary` | `?project_id` | `list[GlossaryTerm]` | |
| GET | `/api/inventory` | `?project_id` | `list[InventoryItem]` | |
| POST | `/api/llm/mutate` | `?project_id` + `LLMMutateIn` | `LLMMutateOut` | 503 no key |
| POST | `/api/llm/propose` | `?project_id` + `LLMProposeIn` | `LLMProposeOut` | 503 no key |
| POST | `/api/operations/apply` | `?project_id` + `OperationsApplyIn` | `OperationsApplyOut` | 422 SHACL fail |
| GET | `/api/validate` | `?project_id` | `{"violations":list}` | |
| POST | `/api/sparql` | `?project_id` + `SparqlIn` | `SparqlOut` | 400 non-SELECT |
| POST | `/api/sparql/nl` | `?project_id` + `SparqlNlIn` | `SparqlOut` | 503 no LLM |
| GET | `/api/history` | `?project_id&limit=100` | `list[HistoryEvent]` | newest first |
| GET | `/api/settings/llm` | — | `LLMSettingsOut` | |
| PATCH | `/api/settings/llm` | `LLMSettingsIn` | `LLMSettingsOut` | |
| GET | `/api/settings/llm/models` | — | `list[OllamaModel]` | |
| GET | `/api/snapshots` | `?project_id` | `list[SnapshotOut]` | |
| POST | `/api/snapshots` | `?project_id` + `SnapshotIn` | `SnapshotOut` | 201, 400 memory store |
| GET | `/api/snapshots/{id}/ttl` | `?project_id` | `text/turtle` | |
| POST | `/api/snapshots/{id}/restore` | `?project_id` | `GraphOut` | |
| POST | `/api/snapshots/{id}/ship` | `?project_id` | `SnapshotOut` | marks released |
| GET | `/api/snapshots/{id}/graph` | `?project_id` | `GraphOut` | for diff/compare |

**Edge delete workaround:** `DELETE /api/edges` body-less alias: `POST /api/edges/delete` for clients that can't send body with DELETE. Node ID passed as query param (not path) because IRIs contain `://` which breaks path segments (ADR-005).

---

## 12. Pydantic Models

### NodeIn (request) — full field schema

| Field | Type | Default | Purpose |
|---|---|---|---|
| `label` | `str` | required (min_length=1) | Human-readable name |
| `kind` | `str\|None` | None | One of 8 registered node kinds |
| `comment` | `str\|None` | None | Description / definition |
| `note` | `str\|None` | None | Free-form note |
| `color` | `str\|None` | None | Hex colour override |
| `domain` | `str\|None` | None | BusinessDomain node IRI |
| `capability` | `str\|None` | None | BusinessCapability node IRI |
| `maturity` | `str\|None` | None | 1–5 scale |
| `target_maturity` | `str\|None` | None | 1–5 scale |
| `strategic_importance` | `str\|None` | None | Commodity\|Differentiation\|Innovation |
| `investment_level` | `str\|None` | None | High\|Medium\|Low\|None |
| `lifecycle_status` | `str\|None` | None | Plan\|Phase In\|Active\|Phase Out\|End of Life |
| `capability_owner` | `str\|None` | None | Team or person name |
| `x` | `float\|None` | None | Canvas x position |
| `y` | `float\|None` | None | Canvas y position |

**Key invariant:** `update_node` only touches fields present in payload (`model_dump(exclude_unset=True)`) — omitted fields are preserved. Critical for LLM edits that must not wipe canvas positions.

### GraphOut

```python
class GraphOut(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]
```

**NodeOut:** id, label, kind, color, comment, note, domain, capability, maturity, target_maturity, strategic_importance, investment_level, lifecycle_status, capability_owner, x, y

**EdgeOut:** id (sha1[:16] of source+predicate+target), source, target, type (key), label (human), comment, note

### LLMMutateOut / LLMProposeOut

```python
class LLMMutateOut(BaseModel):
    message: str
    applied: bool
    operations: list[MutationOp]
    graph: GraphOut | None

class LLMProposeOut(BaseModel):
    message: str
    operations: list[dict[str, Any]]  # raw tool output

class MutationOp(BaseModel):
    op: str  # add_node|update_node|add_edge|delete_node|delete_edge
    summary: str
    detail: dict
```

### SnapshotOut

```python
class SnapshotOut(BaseModel):
    id: str           # 12-char hex
    label: str
    description: str  # default ""
    created: str      # ISO
    node_count: int   # default 0
    edge_count: int   # default 0
    status: str       # draft|released|deprecated
```

**One-released-at-a-time invariant:** `POST /api/snapshots/{id}/ship` marks target as `"released"` and demotes previous released snapshot to `"deprecated"`.

### Settings

```python
class Settings(BaseSettings):
    data_dir: str = "./data"            # WEAVE_DATA_DIR
    seed_demo: bool = True              # WEAVE_SEED_DEMO
    cors_origins: str = "http://localhost:5173"  # WEAVE_CORS_ORIGINS
    anthropic_api_key: str = ""         # ANTHROPIC_API_KEY
    llm_model: str = "claude-sonnet-4-6"   # WEAVE_LLM_MODEL
    ollama_url: str = ""                # WEAVE_OLLAMA_URL
    ollama_model: str = "qwen2.5-coder:14b"  # WEAVE_OLLAMA_MODEL
    ollama_context_window: int = 32768  # WEAVE_OLLAMA_CONTEXT_WINDOW
```

---

## 13. LLM Integration

### MUTATION_TOOL Schema (verbatim from `app/llm/service.py`)

```json
{
  "name": "propose_mutations",
  "description": "Propose a batch of changes to the knowledge graph...",
  "input_schema": {
    "type": "object",
    "required": ["message", "operations"],
    "properties": {
      "message": {"type": "string"},
      "operations": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["op"],
          "properties": {
            "op": {"type": "string", "enum": ["add_node","update_node","add_edge","delete_node","delete_edge"]},
            "ref": {"type": "string"},
            "id": {"type": "string"},
            "label": {"type": "string"},
            "kind": {"type": "string", "enum": ["BusinessDomain","BusinessCapability","System","Service","DataAsset","Field","Concept","Class"]},
            "comment": {"type": "string"},
            "note": {"type": "string"},
            "domain": {"type": "string"},
            "capability": {"type": "string"},
            "source": {"type": "string"},
            "target": {"type": "string"},
            "type": {"type": "string", "enum": ["dependsOn","partOf","realizes","owns","exposes","describes","broader","narrower","related"]}
          }
        }
      }
    }
  }
}
```

**Tool call:** `tool_choice = {"type": "tool", "name": "propose_mutations"}` — forced single tool call. `max_tokens = 2048`.

**System prompt building (`build_system_prompt`):**
- Valid node kinds list
- Valid relationship types list
- First 200 existing nodes as `"- {id} | {label} ({kind})"` lines
- Instruction to call `propose_mutations` exactly once and reuse existing nodes (deduplication)

### apply_operations ref resolution

`refs: dict[str, str]` maps LLM's local `ref` strings to real node IRIs as nodes are created. A later edge in the same batch can reference a node created earlier in the same batch. Deduplication: `find_node_by_label(label, kind)` — reuses existing node if found instead of duplicating.

### Staged Flow (LlmBar component)

1. User types prompt
2. "Propose" → `POST /api/llm/propose` (no mutation)
3. Frontend shows proposal panel: LLM message + bullet list of operations
4. "Apply N change(s)" → `POST /api/operations/apply` → SHACL pre-flight on throwaway store
5. On 422 → show violations; on 200 → graph refreshed
6. "Discard" → clear proposal

### Ollama Local LLM Mode

- Activated by `WEAVE_OLLAMA_URL` env var
- Uses MUTATION_TOOL `input_schema` as Ollama `format` parameter (GBNF grammar-constrained JSON)
- `num_ctx = 32768` required
- Recommended models: `qwen2.5-coder:14b` (default), `qwen2.5-coder:32b` (best), `qwen3:27b-q4_K_M`
- JSON grammar mode provides structural conformance (not semantic conformance)

### Model Right-Sizing

| Task | Model |
|---|---|
| Elicitation / creative brief | `claude-opus-4-8` |
| Architecture design, C4 diagrams | `claude-opus-4-8` |
| Task brief writing | `claude-opus-4-8` |
| Security review | `claude-opus-4-8` |
| PRD stories, flows, OpenAPI | `claude-sonnet-4-6` |
| Data models, class diagrams | `claude-sonnet-4-6` |
| Code implementation (engineer) | `claude-sonnet-4-6` |
| DoR/DoD, YAML/config generation | `claude-haiku-4-5` |
| Validation, lint checks | `claude-haiku-4-5` |

### LLM Safety (Text2KGBench discipline)

- Schema-based paradigm (Weave ships ontology → extraction constrained against 9 types + SHACL)
- Text2KGBench-style evaluation: ontology conformance + hallucination metrics as CI gate
- HITL at fusion/alignment stage
- Never schema-free extraction for governed core (maximises drift + hallucination)

---

## 14. Frontend Architecture

### Tech Stack

- React 18.3.1 + TypeScript 5.6 strict + Vite 5.4 (port 5173)
- TanStack Query v5 (server state: `retry: 1`, `refetchOnWindowFocus: false`)
- No React Router — tab-based SPA with manual switch
- Cytoscape.js (Explore canvas) + React Flow / @xyflow/react v12 (Domain canvas)
- Code splitting: all views `React.lazy()` — initial JS 193 KB gzip

### Tab Order

```
'Query' | 'Graph' | 'Domain' | 'Capabilities' | 'Objects' |
'Glossary' | 'Inventory' | 'Rules' | 'History' | 'Versions' | 'Settings'
```

Query tab is first (power-user entry point). Graph tab renamed from "Explore" in final iteration.

### viewKey Pattern

`projectId + tab` for project-scoped tabs, `tab` for non-project. Forces remount on project switch.

### Custom Events (cross-component communication without prop drilling)

- `weave:switch-tab` — programmatic tab switch
- `weave:drill-domain` — domain drill-down in ExploreView
- `weave:diff-requested` — trigger diff mode from VersionsView
- `weave:quick-add-node` — canvas double-click node creation
- `weave:change-edge-type` — edge right-click type change
- `weave:delete-edge`, `weave:delete-node`, `weave:start-connect`

### TanStack Query Key Registry

```typescript
queryKeys = {
  projects: ['projects'],
  nodeKinds: ['node-kinds'],            // staleTime: Infinity
  relationshipTypes: ['relationship-types'], // staleTime: Infinity
  rules: ['rules'],                     // staleTime: Infinity
  llmSettings: ['llm-settings'],        // staleTime: 30000
  graph: (pid) => ['graph', pid],
  glossary: (pid) => ['glossary', pid],
  inventory: (pid) => ['inventory', pid],
  history: (pid) => ['history', pid],   // refetchInterval: 10000
  snapshots: (pid) => ['snapshots', pid],
}
```

### CSS Design Tokens (`src/styles/tokens.css`)

```css
--bg: #f8fafc          /* page background (light) */
--surface: #ffffff
--surface-2: #f1f5f9
--border: #e2e8f0
--text: #0f172a
--text-muted: #64748b
--accent: #7c3aed       /* purple */
--accent-hover: #6d28d9
--danger: #dc2626
--success: #16a34a
--warn: #f59e0b
--radius: 10px
--shadow: 0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.08)
--bar-height: 56px      /* topbar */
--tabs-height: 44px
--font: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
```

**Brand gradient (logo text):** `linear-gradient(90deg, #7c3aed, #db2777, #0891b2)`

**Versent dark-canvas tokens** (contrast design language for graph canvas):
```css
--bg: #000               /* page background (dark) */
--green-bright: #39ff7a  /* core goal, brand */
--amber: #ffb84d         /* emerging status */
--coral: #ff7a6b         /* delete, close hover */
--mono: 'JetBrains Mono'
--disp: 'Space Grotesk'
--body: 'Inter'
```

### Capability Heatmap Color Maps

```typescript
// Card grid (CapabilityView)
maturity:            {1:'#fee2e2', 2:'#fef3c7', 3:'#dbeafe', 4:'#d1fae5', 5:'#ede9fe'}
investment_level:    {High:'#d1fae5', Medium:'#dbeafe', Low:'#fef3c7', None:'#f1f5f9'}
strategic_importance:{Differentiation:'#ede9fe', Innovation:'#fce7f3', Commodity:'#f1f5f9'}
lifecycle_status:    {'Phase In':'#dbeafe', Active:'#d1fae5', 'Phase Out':'#fef3c7',
                      'End of Life':'#fee2e2', Plan:'#f1f5f9'}

// Cytoscape heatmap overlay
maturity:            {1:'#ef4444', 2:'#f97316', 3:'#eab308', 4:'#22c55e', 5:'#8b5cf6'}
investment_level:    {High:'#22c55e', Medium:'#3b82f6', Low:'#f97316', None:'#94a3b8'}
```

### Inspector Panel

320px right drawer. Read mode: label, kind chip, detail rows (comment, note, domain, capability, maturity, strategic importance, investment, lifecycle, owner), outgoing/incoming edge lists with delete, "+ Add connection". Edit mode: inline form in drawer (no modal). Capability EA fields shown only if `kind === 'BusinessCapability'`.

### Key ADRs (Frontend)

| ADR | Decision |
|---|---|
| ADR-001 | Cytoscape.js (Explore/force-directed) + React Flow (Domain/C4) |
| ADR-012 | LLM mutations staged, validated, human-approved — never auto-applied |
| ADR-015 | Semantic-zoom edge labels at threshold 0.55× |
| ADR-018 | Legend doubles as per-kind visibility filter |
| ADR-022 | CapabilityView = card grid (no connectors); DomainView suppresses edges |
| ADR-023 | Capability EA properties as first-class RDF literals |
| ADR-024 | SPARQL SELECT-only, SERVICE blocked, 500-row cap; NL→SPARQL via LLM |
| ADR-025 | Snapshots: JSONL-manifest + individual TTL files |
| ADR-027 | Heatmap + drill-down as ephemeral view state only (not persisted) |

---

## 15. Build Engine

### Mission

Turn the knowledge graph into working software — spec to ship, with humans and AI agents together, generating apps (UI+API), agents (Anthropic Agent SDK), data pipelines, forms/dashboards from the graph model.

### Generation Priority Order (decided 2026-06-26)

1. Apps (UI + API) — Next.js/shadcn + FastAPI — FIRST
2. AI agents — Anthropic Agent SDK (Python primary, TypeScript secondary)
3. Data pipelines
4. Forms / dashboards

### Key Features

- Multiple projects with lifecycle: idea → business case → initiative sign-off → spec → implementation
- Spec co-authored with PO/architect agents (draft → review → approved)
- Project management: kanban + graph views, issues, dependency-aware task flow
- Project-level ontology view (this project's slice of the graph)
- Project anatomy/wiki: files, functions, capabilities, services, decisions, runbooks
- Both delivery modes: autonomous dark-factory AND interactive HITL sessions with phase gates
- Portable code client can own; pushed to client's repositories (not hosted runtime)
- Bidirectional graph sync: write-back of new/changed artefacts into company ontology
- Immutable tamper-evident compliance/decision log (append-only)
- Self-healing: built products observe own logs, raise issues, open/resolve fixes
- Engine self-improvement: proposes improvements to harness via human-approved PRs

### Build Engine Constraints

- Generated targets: TypeScript/Next.js (UI) + Python/FastAPI (API) + Anthropic Agent SDK (Python primary)
- Each project pins to specific published ontology version
- Compliant-by-construction: hard requirement (≥90% adherence to brand/vocab/governance)
- Secrets NEVER in generated code — AWS Secrets Manager only, enforced by scanning
- Budget/token caps enforced for dark-factory agents
- Generation events metered (usage-based pricing)

### Task Brief YAML Schema (from `prototypes/Blushift/fixtures.jsx`)

```yaml
task: TASK-024-checkout-summary-page
project: csp-v2
phase: wave-1-implementation

acceptance:
  - Renders order summary with line items, tax, total
  - Honors locale-specific currency formatting
  - Supports promo-code field with live validation

design_tokens:
  - color.surface.raised      # → DESIGN.md#L142
  - color.text.primary        # → DESIGN.md#L88
  - radius.card               # → DESIGN.md#L201

pixel_constraints:
  max_width: 720
  min_tap_target: 44
  contrast_min_AA: 4.5

forbidden_inferences:
  - DO NOT invent new color tokens — use design_tokens only
  - DO NOT hard-code currency symbols — use Intl.NumberFormat

required_diagrams:
  - mermaid_state: form (idle|validating|submitting|error|success)
```

### Kanban State (csp-v2 mock)

| Column | Tasks |
|---|---|
| Backlog | TASK-031..035 (5) |
| Ready | TASK-026..029 (4) |
| In Progress | TASK-024 (retry), TASK-025, TASK-030 |
| Review | TASK-022 (QA), TASK-021 (Review), TASK-023 (QA) |
| Done | TASK-014..018 (Wave 1 done) |
| Phase complete | TASK-001..013 (Wave 0 — 13 tasks) |

**Agent codes:** E=Engineer, Q=QA, R=Code Reviewer

---

## 16. Events & Actions Engine

### Mission

Make the company reactive — events in integrated systems automatically trigger governed actions grounded in documented processes and rules.

### Trigger Sources (priority order)

1. **External events** (primary): webhooks, Jira, ServiceNow, Slack, cron
2. **Graph changes** (secondary): changes inside the company graph

### Action Types

- Slack notifications
- API calls
- Agent runs (Anthropic Agent SDK)
- Graph updates (PROV-O-tracked write-back)

### Key Design Decisions (2026-06-26)

- NL-first authoring: "send a Slack notification to channel X whenever a delivery arrives, to automate this step of the goods-inwards process (or the referenced BPMN activity)"
- Visual n8n-style flow canvas complements NL, kept in sync with NL description
- Automations = portable Anthropic Agent SDK artefacts (skills, commands, agents)
- Every automation grounded in ontology — NO orphan automations
- Each automation pins to specific published ontology version
- At-least-once delivery; idempotent actions
- Append-only tamper-evident audit trail per run
- Automation runs metered (usage-based pricing)

### Boundary with Build Engine

Events Engine = business automation (Jira ticket → Slack notification). Build Engine = self-heals its own built products (log observability → auto-raise bug → fix).

### Positioning

"Foundry-style ontology-grounded governed actions + n8n-style multi-step power, for the mid-market."

---

## 17. Multi-User Collaboration

### Confirmed Decisions

- **CRDT library:** Yjs (confirmed). Rationale: mature, open, portable, self-hostable on AWS, no per-seat SaaS lock-in.
- **Sync transport:** WebSocket on ECS Fargate — deferred to Graph Explorer tech spec.
- **CRDT scope:** collaborative canvas/draft state ONLY. Authoritative writes always flow through Constitution Engine SHACL validation.
- **Required at launch:** non-negotiable (confirmed 2026-06-24).
- **Collaboration sessions:** scoped per tenant.

### Figma-Style Pattern

- Presence indicators (cursors, selections) per user
- Real-time convergent editing of graph canvas
- Workshop mode for live client modelling sessions
- ≥5 concurrent users, edits converge with no lost updates (success criterion at GA)

### Graph Explorer Success Criteria

- Whole-company graph renders and navigates at real scale
- ≥5 concurrent users, no lost updates
- 100% of canvas changes pass Constitution SHACL validation; invalid visual edit demonstrably blocked
- Non-expert navigation: business-role user completes find-and-understand task with no RDF/SPARQL
- Versioned views: view specific published version + diff between two versions
- ≥1 live multi-user collaborative workshop with client within 6 months of GA

---

## 18. Schema Ingestion

### Supported Formats (weave-prototype `app/ingest/schema.py`)

- **CSV:** first row = headers; row[1] = sample for type inference. XSD inference: whole numbers→`integer`, decimals→`decimal`, true/false→`boolean`, YYYY-MM-DD→`date`, else→`string`.
- **JSON Schema:** parses top-level `properties`; nullable arrays (e.g. `["string", "null"]`) pick first non-null type.

### import_schema() Output

1. Creates one `DataAsset` node (label=name, comment=format+field count)
2. Creates one `Field` node per field (label=column name, note=`"xsd:<type>"`)
3. Adds `partOf` edge from each field → asset
4. If `concept` given → adds `describes` edge from asset → concept

### Planned Formats (deferred)

- Avro
- SQL DDL
- Idempotent re-upload (fuzzy IRI dedup/merge prompt UI)
- Per-field concept linking

### R2RML Computed Properties (OBPM)

`DoorMaintenanceView` computes `mi:daysSinceMaintenance` via `DATEDIFF` in SQL — demonstrating R2RML can derive semantically rich properties with no direct relational counterpart.

### W3C KG-Construct RML (2025 modular spec)

For CSV/JSON/XML/spreadsheets → RDF. Ships own SHACL shapes for mapping validation. Superset of R2RML.

---

## 19. Connectors

### Managed Connectors (platform-level, v1)

| Connector | Type | Notes |
|---|---|---|
| Snowflake | Data warehouse | `information_schema` for schema discovery |
| Databricks | Lakehouse | Unity Catalog |
| S3 | Object storage | — |
| Azure Data Lake | Data lake | — |
| Jira | Issue tracker | Task federation in Build Engine |
| ServiceNow | ITSM | Events trigger source |
| Confluence | Wiki | Knowledge extraction |
| Slack | Messaging | Events trigger + notification output |
| GitHub | Code | Build Engine integration, commit tracking |

### Integration Architecture (from `prototypes/thoughts.md`)

Two-tier: Weave-level auth (configure integration credentials/tokens in Settings) → project/action-level scoping (target specific boards, accounts, channels within configured integrations).

### Connector Priority Order (from briefs)

Slack · GitHub · Atlassian (Confluence + Jira) · AWS · Snowflake · Salesforce · ServiceNow

### Virtual-Graph Federation (flagged open question)

Neptune and Fuseki are stores, NOT federation engines. For liveness against Snowflake/Databricks/Azure, need virtual-graph SPARQL→SQL push-down (Stardog pattern). Build in-house (R2RML/RML + push-down layer) vs adopt Stardog/Ontop open-source virtual-KG layer — must be resolved in Constitution Engine tech spec.

---

## 20. Infrastructure

### Confirmed Stack

**Application:**
- Backend: Python 3.12+, FastAPI, Pydantic v2, `uv` (enforced by hook — blocks bare pip)
- Frontend: TypeScript strict, Next.js 15 App Router, Tailwind CSS, shadcn/ui
- API: REST (OpenAPI 3.1) + SPARQL 1.1
- Auth: AWS Cognito (default) or Auth0 (multi-IdP)

**AI / Agents:**
- Agent SDK: Anthropic Agent SDK — Python primary, TypeScript secondary; MCP + A2A native
- Agent runtime: AWS Bedrock AgentCore (GA components only: Runtime, Memory, Identity, Gateway) — revisit fit with Anthropic Agent SDK in Build Engine tech spec
- Models: `claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`
- Guardrails: AWS Bedrock Guardrails (PII, content policy, topic blocking)

**Data:**
- RDF store: Oxigraph (dev/test) → Neptune or Jena Fuseki (prod — decision deferred to CE tech spec)
- Vector: AWS S3 Vectors (GA 2025)
- Relational: AWS Aurora PostgreSQL Serverless v2 + SQLAlchemy async
- Cache: AWS ElastiCache (Redis 7)

**Infrastructure:**
- IaC: Terraform
- Compute: AWS Lambda (primary), ECS Fargate (long-running agents, WebSocket)
- SPA hosting: CloudFront + S3
- API gateway: AWS API Gateway (REST) — Lambda integration, auth, rate limiting
- Secrets: AWS Secrets Manager ONLY — never hardcoded, never in `.env` files
- CI/CD: GitHub Actions (OIDC to AWS, environment protection rules)
- Observability: CloudWatch + OpenTelemetry (ADOT Collector)

### Data Directory Layout (weave-prototype)

```
<WEAVE_DATA_DIR>/
  projects.json              # manifest: [{id, name, description, created, is_demo}]
  projects/
    <project_id>/            # Oxigraph RocksDB store per project
      history.jsonl          # append-only audit trail
      snapshots/
        manifest.jsonl       # snapshot metadata
        <snapshot_id>.ttl    # exported Turtle snapshots
  custom_rules.json          # persisted custom SHACL rules
```

### Docker (weave-prototype)

```
Base: python:3.11-slim
User: weave (uid 1000, non-root)
Port: 8000
Healthcheck: polls http://127.0.0.1:8000/api/health every 30s (3s timeout)
CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
WEAVE_DATA_DIR=/data
```

### Python Dependencies (key)

```
fastapi>=0.110, uvicorn[standard]>=0.29, pydantic>=2.6, pydantic-settings>=2.2
pyoxigraph>=0.5,<0.6 (Rust, Python bindings — Oxigraph SPARQL store)
rdflib>=7.0 (SHACL validation)
pyshacl>=0.26 (SHACL validator)
anthropic>=0.40 (Anthropic SDK)
```

---

## 21. Competitive Intelligence

### Hypotheses Verdicts Summary

| Hypothesis | Verdict | Key evidence |
|---|---|---|
| H1 — Whitespace is paradigm union | QUALIFIED | Palantir Machinery = data-bound + mined-observed; H1 refined to "open standards + generation + accessibility" |
| H2 — Palantir is reference; open standards are wedge | CONFIRMED (time-limited) | Ardoq GraphLake (June 2026) erodes open-standards wedge |
| H3 — Notation→ontology solved in theory, unproductised | CONFIRMED (qualified) | 10 notations have OWL/RDF; no product does composed, validated, reconciled pipeline |
| H4 — Moat is authoring + liveness + closure, not storage | CONFIRMED | Triple stores are commodity; Stardog virtual graphs only storage-adjacent differentiator |
| H5 — ArchiMate + REA/DEMO core is right backbone | CONFIRMED (3 qualifications) | OCEL 2.0 fills event/temporal; UFO for identity/rigidity; DEMO commitment kernel matters |
| H6 — Timing validated but window closing | CONFIRMED | Microsoft Fabric DTB, Ardoq GraphLake, Palantir moving down-market |

### Palantir Foundry → Weave Mapping

| Foundry | Weave |
|---|---|
| Object/link types, interfaces | Constitution Engine (OWL classes/properties/SHACL) |
| Action types | Events & Actions Engine + Build (SHACL-validated write-back + PROV-O) |
| Functions | Build Engine (logic bound to graph) |
| Pipeline Builder | Constitution Engine (managed connectors + R2RML/RML) |
| Workshop | Build Engine (generate Next.js/shadcn apps instead of hosted widget canvas) |
| OSDK | Build Engine (crown jewel: ontology → typed SDK) |
| AIP Logic | Events & Actions + Build (Anthropic Agent SDK grounded by graph + Guardrails) |
| Foundry Machinery | Build Engine (designed-vs-observed conformance overlay — SHACL + diff) |

### Key Competitors at a Glance

| Tool | Paradigm | Generate | Open W3C | Notes |
|---|---|---|---|---|
| Palantir Foundry | Data-bound + mined | ✓ (proprietary) | ✗ | Enterprise-only, blank canvas, "monumental" exit |
| Ardoq (+ GraphLake) | Descriptive + W3C (Jun 2026) | ✗ | ✓ (NEW) | CRITICAL: adopted Weave's substrate; biggest competitive signal |
| LeanIX | Descriptive | ✗ | ✗ | 12 fact-sheet types; AI diagram-to-data |
| Bizzdesign/MEGA HOPEX | Descriptive (ArchiMate-native) | ✗ | ✗ | Gartner MQ Leader; high skill floor |
| Celonis | Mined-observed | ✗ | ✗ | OCDM; Process Sphere; Orchestration Engine |
| Catio | Auto-discovered | ✗ | ✗ | Tech-stack-only; 31 agents; no whole-org |
| Microsoft Fabric DTB | Data-bound | ~ (dashboards only) | ✗ | Industrial-scope; Delta tables NOT RDF |
| TopBraid EDG | Descriptive (SHACL-native) | ✗ | ✓ | Governs, does NOT generate |

### 10 White-Space Features (No Competitor Has All)

1. Real, forkable Next.js app generated from model (Foundry only generates hosted runtime)
2. Heterogeneous notation ingest (ArchiMate + BPMN + CMDB + spreadsheets) into ONE SHACL-validated, SKOS-reconciled RDF graph
3. Cross-notation SPARQL answers via shared SKOS concept spine
4. Designed-vs-observed conformance as open-standards graph diff (authored = to-be; OCEL = as-is)
5. Shipped universal ArchiMate+REA+UFO ontology as client-extensible product
6. Mid-market transparent pricing closing model → generate → automate
7. PROV-O-tracked write-back with SHACL-validated actions as open-standards kinetic layer
8. Ontology terms as semantic anchors AND policy carriers AND generation templates AND provenance anchors — one graph
9. NL authoring over shipped ontology for non-technical business authors (not ontologists)
10. Agent generation grounded in organisation's own OWL/SHACL model at mid-market reach

### Key Risks

| Risk | Mitigation |
|---|---|
| Ardoq GraphLake (June 2026) — exact W3C substrate | Accelerate generation/automation closure; they still don't generate |
| Palantir down-market — only pricing/packaging barrier | Race to establish mid-market presence before they adjust |
| Microsoft Fabric DTB — industrial-scoped now, could generalise | Watch quarterly; ensure whole-business scope is differentiated |
| Open-standards wedge eroding (triple stores commodity) | Convert to durable moat via generation + NL authoring + liveness |
| "Live model" promise costly — log extraction = dominant cost | Price data-quality/ingest effort honestly; make event-log quality checks first-class |
| Over-claiming "no-code" / "always-live" / "no process mining in incumbents" | All three are falsifiable; under-promise |

---

## 22. Standards Reference

### W3C Recommendations

| Standard | Version | Role in Weave |
|---|---|---|
| RDF | 1.1 | Graph data model |
| OWL 2 DL | — | Ontology; decidable description-logic profile |
| SHACL | W3C Rec 20 July 2017 | Validation; also: UI building, code gen, data integration, import conformance |
| SPARQL 1.1 | — | Graph query + update; via service layer only |
| PROV-O | — | Provenance; every write produces a record |
| OWL-Time | — | Temporal relations |
| SKOS | — | Taxonomy/vocabulary; reconciliation spine |
| R2RML | — | Relational DB → RDF mapping |
| KG-Construct RML | 2025 modular | CSV/JSON/XML → RDF; ships SHACL shapes |
| W3C Organization Ontology | — | `org:` — org charts; `subOrganizationOf` is `owl:TransitiveProperty` |

### OMG / ISO Standards

| Standard | Role |
|---|---|
| ArchiMate 3.2 (The Open Group) | EA notation backbone; Open Group Model Exchange File Format |
| BPMN 2.0 | Process notation; BBO (Annane 2019) is the OWL formalisation |
| DMN 1.x | Decision notation; dmn-ont (Nicholas Car 2017) targets 1.1 |
| UML 2 | Class models; ODM (dormant 2014) for mapping reference |
| ISO 15944-4 | Open-edi; standardises REA economic ontology |
| OCEL 2.0 | Object-centric event log; published ICPM 2023; XML/JSON/SQLite exchange |

### Ontologies & Vocabularies

| Ontology | Namespace | Notes |
|---|---|---|
| ArchiMate RDF (Mendoza 2026) | `archimate: <https://purl.org/archimate#>` | Single-author; NOT Open Group official |
| BBO | `bbo: <http://BPMNbasedOntology#>` | Ships `SHACLshapes.ttl` |
| dmn-ont | `dmn: <http://promsns.org/def/dmn#>` | CC-BY 4.0; targets DMN 1.1 |
| gUFO | nemo-ufes.github.io/gufo/ | OWL 2 DL implementation of UFO/OntoUML |
| OntoREA | ResearchGate 2017 | OWL formalisation of REA |
| DCAT | W3C | Dataset Catalog Vocabulary |
| PROV-O | www.w3.org/TR/prov-o/ | W3C Recommendation |

### Academic Foundations

| Source | Contribution |
|---|---|
| Uschold & King 1998 (Enterprise Ontology) | 4 subject areas: Activities & Processes, Organisation, Strategy, Marketing — corroborates core type families |
| TOVE (Fox & Grüninger, U. Toronto 1990s) | Competency-question discipline as acceptance test; activity/time/causality micro-ontology |
| DEMO / Dietz (PSI theory) | Actor-role + transaction-commitment kernel; request→promise→declare/accept pattern |
| REA / McCarthy 1982; ISO 15944-4 | Economic/event core; duality axiom; stock-flow derivation |
| UFO/gUFO (Guizzardi et al.) | Identity/rigidity: Kind (rigid), Role (anti-rigid, relationally dependent), Phase (intrinsic change), Relator (reified) |
| LLM KG Survey arXiv 2510.20345 (2025) | Schema-based vs schema-free paradigm; conformance + hallucination metrics (Text2KGBench ISWC 2023) |

---

## 23. UX Patterns

### From Versent Graph Prototype (`prototypes/versent-weave/`)

1. **Welcome-then-explore:** Modal on load with two CTAs (guided tour vs. free explore). Reduces blank-canvas anxiety.
2. **Linear story tour overlaid on live graph:** 10 steps, each highlights node subset + auto-fits viewport. "▶ Story" button or welcome modal CTA. Back/Next with `N/10` progress.
3. **Node-click → neighbourhood focus + drawer:** `closedNeighborhood()` dims everything else (opacity 0.16). Drawer slides from right 380px, `cubic-bezier(.4,0,.2,1)` in 280ms. Closed by tapping canvas, ✕ button, or Escape.
4. **In-place note capture per node:** `localStorage` key `vsn:notes:{nodeId}`. Notes shown in tooltip count ("N note(s) · click for detail").
5. **Typed relationship hover tooltips:** `SOURCE verb TARGET` + verb definition. Reduces need to consult a legend.
6. **Deterministic radial layout:** Semantically meaningful; no force-directed jitter. BFS from centre + subtree-weighted angular allocation.
7. **Filter dock = combined legend + control:** Each filter row is both a visual key and an interactive toggle.
8. **Status as visual encoding:** Live = solid border, Emerging = dashed. Simple, consistent, filterable.
9. **Contribution as structured export (no backend):** Form → markdown file → curator reconciles. Scales with zero backend.
10. **Context-aware questionnaire per node class:** Different questions per entity type. Lower barrier to contribution than free-form.

### From Blushift Prototype (`prototypes/Blushift/`)

11. **PageHeader 3-column explainer:** `role` (What this is) + `purpose` (What you do here) + `contributes` (Where it fits). Blue-left-border card, `rgba(59,130,246,0.05)` background.
12. **Activity feed as first-class feature:** Agents and humans listed equally as actors. 10 items mock with commit/validate/propose/escalate/approve events.
13. **Sparklines for workspace health:** 10-point SVG sparkline on each workspace card. Pure SVG, no library. `min→max` normalisation, 2px padding, filled area + stroke + terminal dot.
14. **Budget as product concept:** Projects have explicit token/cost budgets with caps. Budget alerts in notifications.
15. **Demo status as field:** "Last demo: 2h ago" — implying continuous deployment and regular demos are expected default.

### From Weave Prototype Frontend (`prototypes/weave-prototype/frontend/`)

16. **Staged LLM flow:** Propose → show diff bullet list → Apply/Discard. Never auto-applies.
17. **Inspector as write surface:** Right drawer, read/edit toggle. All node metadata + edge management inline.
18. **Snapshots with TTL download:** Each snapshot exports full Turtle; downloadable from Versions tab.
19. **Query tab as power-user entry point:** First in tab order, defaults to NL mode, shows generated SPARQL in collapsible `<details>`.
20. **Onboarding checklist → activation:** 3-slide modal (welcome → features → demo tasks). Demo tasks list with checkboxes. Help FAB re-opens at slide 1.

### Accessibility Patterns

- `role="tablist"` / `role="tab"` / `aria-selected` — tab navigation
- `aria-pressed` on legend toggles + view control buttons
- `aria-sort="ascending|descending"` on sortable headers
- `role="status"` + `aria-label` — loading spinners
- `role="dialog"` + `aria-modal` + `aria-label` — modals
- `role="listbox"` + `role="option"` — search results
- `aria-hidden` on drawer (toggled on open/close)
- `prefers-reduced-motion`: all transitions disabled + Cytoscape `duration:0`
- Mobile: drawer becomes bottom sheet at ≤680px; `border-radius: 16px 16px 0 0`
- All interactive elements as `<button>` or `<a>` (not `<div>`)

---

## 24. Demo Data

### Northwind Financial (Blushift prototype)

5 domains, 77 services, 47 stakeholders, 41 capabilities. Jamie Reeves `<jamie@northwind.fin>` as primary user. 6 workspaces, 3 projects, 6 self-improvement proposals, 20 kanban tasks.

### Monsters, Inc. (weave-prototype — 52 nodes / 86 edges)

**5 Business Domains:** Energy Production, Scare Floor Operations, Child Safety & Compliance, Workforce, R&D/Laugh Program

**8 Capabilities:** Scream Harvesting, Laugh Harvesting, Door Logistics, Threat Detection (CDA), Employee Scheduling, Canister Refining, Energy Distribution, Performance Analytics

**6 Systems:** Scare Floor System, Door Vault, Scream Refinery, Laugh Power Grid, CDA Control Center, Workforce Platform

**7 Services:** Scream Collector, Laugh Collector, CDA Monitoring, Employee Roster, Door Routing API, Canister Inventory, Energy Dispatch + Yield Analytics

**5 Data Assets:** Scream Canister Ledger, Children Door Registry, Employee Records, Incident Reports, Laugh Yield Log

**11 SKOS Concepts:** energy, scream, laugh, scare, door-station, door, monster, child, canister, cda, energy-crisis, power-surge

**Key PROV-O lineage:** Laugh → LaughCanister → EnergyUnit → MonstropolisGrid (full traceable chain; wrapped in `EnergyLineageBundle`)

### Hammerbarn (Demo Workspace for Onboarding)

Clearly fictional (inspired by Bunnings/Kingfisher/B&Q). Complete ontology populated across core types, glossary, brand and voice, governance content, business processes, org chart. Example generated app: 2D simulated kitchen designer (choose SKUs, lay out in galley/L-shaped/rectangular kitchen). Example automations. Safe sandbox — exercises don't affect real data.

### Versent AI-First Network (50 nodes, ~120 edges)

10 node classes (core, pillar, cap, asset, offering, initiative, tool, ritual, practice, partner). 7 relationship types (enables, comprises, delivers, uses, intersects, instance-of, informs). Core node: `aifirst` (AI-First operating model). 5 pillars: Principles, People+Agents, Toolkit, Knowledge, Culture. 22 live nodes, 28 emerging nodes.

---

## 25. Agent Architecture

### Dark Factory Pattern

- Agents run autonomously in loops (dark factory mode)
- Human intervention at phase gates only (HITL approval)
- Immutable audit trail of every agent action
- Self-improvement engine / outer loop monitors agent outputs and improves harness

### Agent Team Structure (from `prototypes/thoughts.md`)

**Exec initialisation phase:**
- Exec CEO — orchestrates constitution by running: Exec Operations (company constitution, capabilities), Exec Data (data catalog, governance rules), Exec Product (product catalogue), Exec CSRO (security, regulatory), Exec CTO (service inventory, technical constraints)
- Evaluator/Consultant — assesses constitution, suggests improvements, finds gaps

**Planning cohort:**
- Orchestrator (main session manager)
- Product Owner (plans and designs product needs)
- Technical Architect (high + low level solution details)
- Security Analyst (security lens)
- Technical Business Analyst (knows constitution; analyses design proposals)
- SME (domain expert)

**Delegation loop:**
- Principal Engineer (context gathering, parallel delegation, task planning, repo init)
- Implementor (non-frontend code: DevOps, observability, analytics, pipelines, IaC, API, config, state, DBs)
- Frontend (design system, frontend against DESIGN.md; ONLY creates frontend — no state logic)
- QA (runs/writes tests, checks DoD, validates against requirements)
- Security (code security review)
- Evaluator (Playwright exploratory testing)
- Claude Specialist (assesses session findings, refines project-level harness)
- Technical Docs Writer (documentation + session summary)
- Designer (visual assessment of frontend)

**Assessment / Council:** PO + TBA + SME + Architect — assess at end of each phase.

**Hardening (Self-Improvement):** outer harness improver. Inspects logs/council findings/human feedback → proposes improvements to harness, constitution.

**Ops loop:** Principal Engineer + Assessor (receives outage alarms, creates bugs for human approval) + Assessor Eval Council + Implementor.

### Agent Laws (universal, baked into every agent)

| Law | Description |
|---|---|
| A | Common-stack first (Weave defaults) |
| B | Functional, browser-runnable, automation-tested (Playwright for UI) |
| C | Council-graded quality for enterprise claims (7-persona, ≥4.0/5) |
| D | Stacked PRs (one PR per phase, small commits) |
| E | Complexity budget: cyclomatic ≤10, cognitive ≤15, function ≤50 lines |
| F | Synthetic verification only (LocalStack, not real cloud in tests) |

### Harness Hooks

| Event | Matcher | Function | Effect |
|---|---|---|---|
| PreToolUse | Edit/Write | check-no-secrets | Blocks hardcoded secrets |
| PreToolUse | Edit/Write + Bash | check-uv-over-pip | Blocks bare pip in source files |
| PostToolUse | Edit/Write | mark-anatomy-stale | Sets anatomy freshness flag |
| PostToolUse | progress.json | commit-progress | Auto-commits state file |
| Stop | — | phase_gate | Presents HITL gate at phase completion |
| Stop | — | drift_check | Context hygiene suggestions |
| SubagentStop | — | subagent_stop | Injects task summary to parent |
| PreCompact | — | pre_compact | Snapshot state before compaction |
| SessionEnd | — | session_end | Flush pending state |

### SDLC Cascade

```
/elicit (20Q, Six Hats, Five Whys, Stochastic)
  → /po → po-brief → po-prd → po-roadmap → po-epic
  → /architect → arch-stack → arch-c4 → arch-openapi → arch-data-model → arch-flows
              → arch-class → arch-cicd → arch-testing → arch-dod → arch-dor
              → arch-infra → arch-adr → arch-task-brief
  → /spec-review (gate)
  → /implement → PDAC loop per task → phase_gate() HITL
```

**Dark factory loop mechanism:** `/goal "all tasks in phase done, or stop after 60 turns"` — Haiku evaluates condition after each turn.

### State Files

| File | Purpose |
|---|---|
| `.claude/specs/<entity>/<phase>/*.md` | Spec artifacts |
| `.claude/state/progress.json` | Task/phase state (always committed) |
| `.claude/state/summaries/TASK-NNN.md` | Task context chain |
| `.claude/state/summaries/EPIC-NNN.md` | Epic completion record |
| `.claude/state/escalations/TASK-NNN-blocker.md` | Blocked task details |
| `.claude/memory/MEMORY.md` | Team decisions, conventions |
| `ANATOMY.md` | File/function semantic map |

---

## 26. ADR Distillation

### 27 ADRs from weave-prototype (`prototypes/weave-prototype/ROADMAP.md`)

| ADR | Title | Date | Key Decision |
|---|---|---|---|
| ADR-001 | Dual-mode canvas | 2026-06-14 | Cytoscape.js (Explore) + React Flow (Domain) |
| ADR-002 | Embedded Oxigraph | 2026-06-14 | pyoxigraph embedded; Turtle as first-class interchange |
| ADR-003 | Claude server-side tool-use | 2026-06-14 | NL edits → single `propose_mutations` tool call; server validates + PROV-stamps |
| ADR-004 | Edges as triples + reified annotations | 2026-06-14 | Direct triples; `rdf:Statement` reification only when comment/note present |
| ADR-005 | Node id as query param (not path) | 2026-06-14 | IRI `://` breaks URL path segments |
| ADR-006 | Research before deep build | 2026-06-14 | P0.5 research pass before committing to P2+ |
| ADR-007 | Commit Claude + git boilerplate | 2026-06-14 | Keep CLAUDE.md, .claude/settings.json, .pre-commit-config.yaml in repo |
| ADR-008 | Multi-project: one Oxigraph per project | 2026-06-14 | Independent RocksDB per project; demo protected |
| ADR-009 | Partial-update semantics | 2026-06-14 | `update_node` only touches fields in payload |
| ADR-010 | Parallel subagents | 2026-06-14 | Parallel subagents for independent work |
| ADR-011 | Viz libraries confirmed | 2026-06-14 | Cytoscape.js (fcose) + React Flow (ELK/dagre); sigma.js/G6 escape at scale |
| ADR-012 | LLM mutations staged | 2026-06-14 | retrieve → enum tool call → IRI dedup → SHACL → staged diff → human approval → PROV stamp |
| ADR-013 | Schema ingestion as DataAsset/Field | 2026-06-14 | CSVW + DCAT/PROV; `DataAsset describes Concept`; Catalog→Schema→Table→Column→Tag |
| ADR-014 | Infra skeleton | 2026-06-14 | Defer compute/ALB/secrets topology until AWS account exists |
| ADR-015 | Semantic-zoom edge labels | 2026-06-15 | `text-opacity: 0` until zoom ≥ 0.55× or `mouseover` |
| ADR-016 | Pure CSV/Markdown helpers | 2026-06-15 | `toCsv`/`toMarkdownTable` pure functions; download wrappers compose them |
| ADR-017 | Rules page derives from SHACL | 2026-06-17 | `schema_rules()` SPARQL-queries same shapes graph used for validation |
| ADR-018 | Legend as visibility filter | 2026-06-17 | Legend toggle → `.hidden` on nodes + incident edges; never re-runs layout |
| ADR-019 | Canvas label/edge toggles as overlays | 2026-06-22 | `useEffect` inline style (not stylesheet classes) to avoid CSS conflicts |
| ADR-020 | Custom SHACL in JSON sidecar | 2026-06-22 | `data/custom_rules.json`; generate SHACL Turtle; merge with static; invalidate cache |
| ADR-021 | Ollama as JSON-grammar fallback | 2026-06-22 | `WEAVE_OLLAMA_URL` → OllamaService; `format` param; Qwen2.5-Coder recommended |
| ADR-022 | CapabilityView = card grid (no connectors) | 2026-06-22 | Heatmap by dimension; DomainView suppresses edges |
| ADR-023 | Capability EA as first-class RDF literals | 2026-06-22 | maturity/strategicImportance/investmentLevel/lifecycleStatus/capabilityOwner in NON_EDGE_PREDICATES |
| ADR-024 | SPARQL SELECT-only, SERVICE rejected | 2026-06-22 | 500-row cap; NL→SPARQL via context-rich system prompt |
| ADR-025 | Snapshots: JSONL-manifest + TTL files | 2026-06-22 | `{data_dir}/snapshots/{id}.ttl` + `manifest.jsonl` sidecar |
| ADR-026 | MCP server as separate package | 2026-06-22 | Transport-independent; resources: projects/graph/TTL/history/vocabulary |
| ADR-027 | Heatmap + drill-down as ephemeral state | 2026-06-22 | `heatmapDimension` + `focusDomain` in React state; not persisted |

---

## 27. Spec Status & Open Questions

### Spec Status (as of 2026-06-26)

| Engine | Brief | PRD | Roadmap | Tech Spec | Tasks |
|---|---|---|---|---|---|
| Constitution Engine | ✅ | — | — | — | — |
| Graph Explorer | ✅ | — | — | — | — |
| Build Engine | ✅ | — | — | — | — |
| Events & Actions Engine | ✅ | — | — | — | — |
| Onboarding | ✅ | — | — | — | — |
| Weave Platform | ✅ (+ 20Q elicitation) | — | — | — | — |

**All engines need:** PRD (epics) → Roadmap → Tech Spec (arch-stack, arch-c4, arch-openapi, arch-data-model, arch-flows, arch-class, arch-cicd, arch-testing, arch-dod, arch-dor, arch-task-brief, arch-adr, arch-infra) → Tasks

### Open Architecture Decisions

| ID | Question | Resolve in |
|---|---|---|
| OQ1 | Production triplestore: Neptune vs Jena Fuseki vs continue Oxigraph? | Constitution Engine tech spec |
| OQ2 | CRDT library for real-time graph collaboration (RDF triple-level granularity) | Graph Explorer tech spec |
| OQ3 | Multi-tenant data isolation: row-level vs separate graphs vs separate Neptune clusters | CE + infra |
| OQ4 | progress.json: event-sourced (events.jsonl + materialised view) vs mutable? | Before dark factory builds |
| OQ5 | Dark factory routines: AWS Lambda/EventBridge cron vs Claude Code scheduled routines | Overnight automation design |
| OQ6 | arch-task-brief model: Sonnet + Haiku critic vs Opus? | Cost control |
| OQ-Stardog | Virtual-graph federation: build in-house (R2RML/RML + push-down) vs adopt Stardog/Ontop? | CE tech spec |

### Product / UX Gaps

1. No non-technical user story exists in any artefact (assumes OWL/SPARQL fluency) — [needs stories with NL-only flow]
2. No ICP (ideal customer profile) defined
3. No explicit 90-day path to first revenue / first client
4. Connector priority order deferred to roadmap (no explicit ordering yet)
5. Phase ordering of Build Engine (apps → agents → pipelines → dashboards) confirmed but not yet roadmapped
6. Onboarding training videos: placeholders only in v1

### Architecture / Technical Gaps

1. Production RDF store choice (OQ1 — deferred)
2. CRDT library for RDF triple-level collaboration (OQ2 — deferred)
3. Multi-tenant isolation strategy (OQ3 — deferred)
4. Virtual-graph federation: in-house vs Stardog/Ontop (flagged)
5. Real-time collaboration sync transport (WebSocket on Fargate) — deferred
6. "How much UFO to enforce as SHACL vs advise" — explicitly flagged for CE tech spec
7. Rendering approach for Graph Explorer (Cytoscape.js vs WebGL) — deferred
8. PROV-O tamper-evident claim needs hash-chaining + CloudTrail + S3 Object Lock for SOC 2
9. AWS-only stack is a procurement blocker for ~40% of enterprise accounts (Azure/GCP)

### Ontology Gaps

| Gap | Fill |
|---|---|
| Event/temporal: ArchiMate thin | PROV-O + OWL-Time + OCEL 2.0 |
| Economic exchange: no duality/stockflow | REA OWL (Gailly/Geerts/Poels) |
| Data assets (fine grain): DataObject coarse | UML/OntoUML class detail + R2RML |
| Motivation depth: thin on rules | DMN + SHACL as enforced policy |
| Ontological rigour: no formal identity/rigidity | gUFO/OntoUML |

### Testing Standards

- TDD-first: unit → integration → E2E
- Playwright for browser tests
- Mutation testing ≥70% (Stryker/TS or mutmut/Python)
- EARS notation for acceptance criteria: `WHEN [event] THE SYSTEM SHALL [behaviour]`
- Cyclomatic ≤10, cognitive ≤15, function ≤50 lines
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`

---

## 28. Navigation IA

### Full Navigation Tree (from `prototypes/thoughts.md`)

```
Weave (top-level)
  Dashboard
    recent activity
    metrics
    user-specific info

  Constitution
    Explore: full ontology + data exploration
    Query: SPARQL or NL→SPARQL
    Mapping: mappings between data and rules/processes
    Rules: extracted rules, visual interface for governance rules
    Glossary: shared terms and ontology vocabulary
    Org chart: people, roles, relationships (from SSO/Workday/HR integrations)

  Build
    Projects
      Project (for each project)
        Spec: create/edit spec collaboratively with PO, architect agents
        Project management: graph + kanban view
        Project-level ontology: focused view of the ontology for this project
        Issues
        Settings: integrations, Slack channels, users/contributors, budget caps

  Automate (Events & Actions)
    Actions: automations based on events
    Builder: NL + visual canvas
    Runs/History
    Triggers & Connectors
    Templates/Library
    Audit & Compliance

  Compliance
    Check: tools for testing apps/agents/automations/systems/data/integrations vs ontology
    Logs: full system audit trail

  Self-Improvement
    Proposals list (with evidence, metrics, dispatch actions)
    Harness improvements
    Feedback loop

  Questionnaires
    Create questionnaires/interviews to elicit/extract company knowledge → feeds ontology

  Settings
    Integrations
    Budgets
    Users / RBAC
    API keys (secrets)
    LLM provider/model
```

### Hash Route Map (Blushift prototype)

| Screen | Route |
|---|---|
| Dashboard | `/dashboard` or `/portfolio` |
| Workspaces | `/workspaces` |
| Org Graph | `/organisation/org-graph` |
| Transformations | `/transformations` |
| FinOps | `/finops` |
| Self-Improvement | `/polaris` |
| Releases | `/releases` |
| Audit | `/audit` |
| Settings | `/settings` |
| Inbox | `/inbox` |
| Help Me / Panic | `/help-me` |
| Wiki | `/wiki` |
| Project Dashboard | `/project/{id}/dashboard` |
| New Request | `/snappy` |
| Login | `/login` |

### Snappy Request Pattern

Entry point for new build requests. User describes: "Motor Fast-Track Claims Service" — the Build Engine entry point translating NL into a scoped project/spec. Surfaces as:
- Command palette action: "New Request — Build something new"
- Activity feed: "Maya Patel opened Request"
- Route: `/snappy`

### Weave Prototype Tab Order (11 tabs)

```
Query (first — power-user) | Graph | Domain | Capabilities | Objects |
Glossary | Inventory | Rules | History | Versions | Settings
```

Project-scoped: Query, Graph, Domain, Capabilities, Objects, Glossary, Inventory, History, Versions. Non-project: Rules, Settings.

---

*End of Weave Spec-Helper Findings. Last synthesised: 2026-06-26.*
*Do not commit directly — this is a working reference document. Move to `.claude/specs/` when formalized.*
