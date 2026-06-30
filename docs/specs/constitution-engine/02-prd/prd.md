---
type: PRD
title: Constitution Engine — Product Requirements Document
description: "Full product requirements for the Weave Constitution Engine: the RDF/OWL/SHACL/SPARQL/PROV-O knowledge-graph layer that is the live model of the business and the inter-engine contract hub."
tags: [constitution-engine, 02-prd, ontology, semantic-web]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/constitution-engine/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Constitution Engine

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (ships first) · **Owner:** gazzwi86 · **Last Updated:** 2026-06-30

---

## 1. Product Context

### Background

The Constitution Engine is the first thing Weave ships and the layer everything else depends
on. It is where a company formally models how it operates — its structure, vocabulary, rules,
brand, and governance — as a standards-based RDF/OWL knowledge graph. The Build Engine, Events
& Actions Engine, and Graph Explorer all read from it; if the Constitution Engine does not
exist and is not trusted, nothing downstream can be generated or automated safely.

Weave ships a process-centric, ArchiMate-3-aligned **business-process-modelling-ontology
(BPMO) framework** — 13 kinds (**Process, Activity, Event, DataAsset** (with **Field** as its
column/attribute sub-kind), **System, Service, BusinessCapability, BusinessDomain, Policy,
Goal, Actor, Concept, Class** — Concept+Class are one punned resource per decision B1), a
relationship set that situates each process against the data it consumes/produces, the
systems/services that run it, the actors that perform it, the capabilities it realizes, the
goals it serves, the domain it sits in, and the policies that govern it, plus W3C
SHACL/PROV-O/SKOS scaffolding — and **no populated business taxonomy** (decision A1). This is
the "business brain": the model an autonomous agent reasons inside (what to do, when, with
which system, who to contact). Clients build their own domain taxonomy and instances on top of
that framework. "Weave provides the grammar; the company writes the sentences." The framework
is ArchiMate-3-aligned, with REA and UFO informing the design behind the curtain (never
user-exposed). Weave's value is the framework, the standards enforcement, the AI-assisted
authoring layer, and the cold-start ingest of a client's existing model — not a vocabulary the
client must fight.

The engine must be usable by non-technical business users (through natural-language chat **and**
SHACL-shape-driven guided forms — both in v1, decision B4) and by technical ontologists
(through a SELECT-only SPARQL editor and direct OWL model access), while ensuring every
committed change is validated by SHACL through a single mutation entry point and every mutation
is provenance-tracked.

This engine is also the **inter-engine contract hub**: it owns and publishes the seven `CE-*`
contracts (Section 5) that Graph Explorer, Build, Events, Platform, and Onboarding consume.
These are first-class owned deliverables, not open questions.

### Goals

1. Let any company build, validate, and query a formal OWL knowledge graph of their operating
 model on top of the shipped BPMO framework, without writing raw RDF or SPARQL.
2. Make every committed change SHACL-validated before it persists, through exactly one mutation
 entry point, so the model is always internally consistent.
3. Track provenance (who, what, when, why; human-vs-AI authorship) for every mutation, written
 both as PROV-O in the graph and as a platform audit entry (PLAT-AUDIT-1).
4. Support all five content areas in v1: structural ontology, instance data, SKOS controlled
 vocabulary, brand & voice standards, and governance & compliance rules.
5. Own and publish the seven `CE-*` inter-engine contracts as stable, versioned interfaces.
6. Ship two authoring surfaces (NL chat AND guided forms) and a SELECT-only SPARQL editor so
 both business users and power users can author and query the graph.
7. Make the graph the **agent-grounding** layer: agent-authority questions (what an agent may
 do, on which systems/data/processes, and who to contact) answerable as read-side SPARQL.
8. (Post-MVP, prioritized) Solve cold-start: ingest a client's *existing* model from
 documents, EA/BPMN exports, diagrams, and structured data through the validated mutation API.

### Non-Goals

1. **Graph visualisation, the structured C4 view, and the collaborative canvas** — owned by the
 Graph Explorer engine (embeddable via GE-CANVAS-1). Realtime multi-user co-editing is a
 Phase 2 Explorer capability; out of scope here either way.
2. **Code, app, agent, or pipeline generation** — owned by the Build Engine.
3. **Automations and event handling** — owned by the Events & Actions Engine.
4. **Managed source-system connectors and connector→graph ingestion** — platform-level
 (PLAT-CONNECTOR-1); ingestion writes back through this engine's CE-WRITE-1.
5. **The immutable cross-engine audit log as an independent store** — owned by the Platform
 (PLAT-AUDIT-1); this engine emits to it. CE PROV-O is the semantic-model provenance and also
 writes a corresponding PLAT-AUDIT-1 entry.
6. **Designing brand or creative assets** — the engine holds and governs standards; it does not
 produce logos or write brand strategy.
7. **Enforcing constraints at generation time** — the engine publishes governance constraints;
 downstream engines enforce them.
8. **Choosing the production RDF store** (Neptune vs Jena Fuseki) — deferred to tech spec.
9. **ODRL policy enforcement** — not in the v1 stack; v1 uses SHACL + data-classification
 properties (see OQ-09).
10. **Process mining / discovery, conformance checking, and a process query language (PQL)** —
 the engine *ingests* observed-behaviour event data (e.g. OCEL 2.0, see OQ-14) as modellable
 data, but does NOT build discovery or conformance algorithms or a PQL; heavy mining is
 integrated/partnered.
11. **Query-time live federation of external data** — current external-data ingestion is a
 **materialised copy** (R2RML/RML import via CE-WRITE-1), NOT a query-time virtual-graph
 SPARQL→SQL federation against live sources (OQ-17, pending ADR). The connector-driven live
 path remains a Platform responsibility (Non-Goal #4 / PLAT-CONNECTOR-1).

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| **Enterprise architect / ontologist** | Builds the client domain taxonomy on the shipped framework; curates OWL structure, properties, restrictions, hierarchy | Standards-compliant OWL/SHACL modelling with reasoning, without hand-writing Turtle | author-ontology + author-shapes + publish |
| **Business analyst / SME** | Authors instance data and glossary terms for their domain via NL chat or guided forms | One agreed definition per term; guided forms for known properties | author-instances |
| **Brand / marketing owner** | Maintains tone of voice and brand styleguides as governed assets | A single authoritative home for brand standards consumed downstream via CE-BRAND-1 | author-brand |
| **Compliance / risk officer** | Maintains regulatory obligations and business rules; audits the graph | Constraints as queryable first-class content; audit trail; self-audit queries | author-shapes + read |
| **Downstream platform engineer / agent** | Consumes the graph from Build, Events, Explorer engines | Stable versioned read interface (CE-READ-1); confidence in internal consistency | read (via service principal) |

> Role slugs (`read`, `author-instances`, `author-ontology`, `author-shapes`, `author-brand`,
> `publish`, `admin`) align with the platform RBAC model resolved through PLAT-SETTINGS-1. The
> concrete role × action matrix is FR-031. Agent/service principals are minted by
> PLAT-IDENTITY-1.

---

## 3. User Stories

### Epic 1: Ontology Modelling (OWL Structure)

**E1-S1: Define a new class via chat or form**
As an **enterprise architect**, I want to describe a new OWL class in natural language (or fill
a guided form) so that the change commits without my needing to write raw RDF.
- **AC:** Given I type "add a class called ContractualObligation that is a subclass of Policy",
 when I submit, then the AI proposes a change shown as a **human-readable operation list**
 (plain-English summary), and on confirm the class is committed as an `owl:Class` with the
 correct `rdfs:subClassOf`, SHACL prospective validation passes, and a PROV-O activity is
 stamped recording authoring-agent kind = `llm` and approving human = my identity.
- **AC (failure — AI unavailable):** Given the AI provider is unavailable, when I open the chat,
 then the NL surface returns HTTP 503 with a clear offline message, AND the guided forms and
 browse/query surfaces remain fully functional so I can still author the class via a form.
- **AC (failure — invalid):** If the proposed class would produce a `sh:Violation` (e.g. a shape
 forbids the parent), the commit is blocked with HTTP 422 and a human-readable message; the
 graph is unchanged. (OWL logical inconsistency, by contrast, blocks at *publish* — see E8-S2.)
- **Priority:** Must Have

**E1-S2: Define property restrictions and disjointness**
As an **enterprise architect**, I want to add OWL property restrictions (e.g.
`owl:someValuesFrom`, cardinality) and disjointness axioms via chat or form so that my ontology
has logical rigour without hand-coding OWL DL.
- **AC:** "a Comedian must have at least one certLevel" proposes an `owl:minCardinality 1`
 restriction; "Actor and System are disjoint" proposes `owl:disjointWith`.
- **AC (failure):** If the NL is ambiguous, the AI asks a clarifying question rather than
 emitting a guessed axiom; if the AI is unavailable, the form path still accepts the restriction.
- **Priority:** Must Have

**E1-S3: Import and refine a starting model**
As an **enterprise architect**, I want to paste a document excerpt or plain-text description so
that the AI proposes an initial OWL structure I can refine iteratively.
- **AC:** The AI proposes a set of classes and object properties from the pasted content;
 I can reject individual proposals and ask for alternatives without restarting; each accepted
 proposal commits separately so history is granular.
- **AC (failure):** If the AI is unavailable, the import surface returns 503 and the user is
 directed to the forms path to add classes manually.
- **Priority:** Must Have

**E1-S4: OWL reasoning surfaces inferences**
As an **enterprise architect**, I want inferred relationships and logical inconsistencies to
surface so that I can correct them before they propagate downstream.
- **AC:** Inference is materialised **at publish** (not per-commit), per published version, into
 a per-version inferred named graph (e.g. `weave:graph/v1.2.0/inferred`); inferred triples are
 labelled as inferred (not asserted).
- **AC (failure):** If the chosen reasoner times out at the configured budget (default 30 s,
 tunable per workspace — see NFR Performance), the publish surfaces a reasoner-timeout error
 and does not produce a partial inferred graph.
- **Priority:** Should Have (v1 — may be a consistency check without full materialisation;
 gated on OQ-01)

---

### Epic 2: Instance Data Population

**E2-S1: Add a company entity via chat or form**
As a **business analyst**, I want to describe a real entity ("add our CRM system called
Salesforce; owned by the Revenue domain") so that it is added as an instance of the correct
class in the client's domain taxonomy.
- **AC:** The AI identifies an appropriate class **in the active ontology** (e.g. a client
 `System` subclass), proposes an IRI, and sets the stated properties; the SHACL shapes for that
 class are checked before commit; the PROV-O record includes the approving human identity, the
 authoring-agent kind, a timestamp, and the chat message as the activity description.
- **AC (failure):** Violations block the save (HTTP 422); if the AI is unavailable, the analyst
 can add the entity through the guided form for that class.
- **Priority:** Must Have

**E2-S2: Edit and delete instances (partial-update semantics)**
As a **business analyst**, I want to update or remove an entity so that the graph stays accurate.
- **AC:** On an update, **only the properties named in the change are retracted/asserted**; all
 other properties of the entity (position, colour, domain, etc.) are preserved untouched
 (partial update, matching prototype `exclude_unset`). PROV-O stamps the change.
- **AC (failure):** Deleting an instance that other entities reference produces a warning listing
 the affected references before the commit; the user must confirm; the commit otherwise aborts.
- **Priority:** Must Have

**E2-S3: Bulk-populate via structured input**
As an **enterprise architect**, I want to upload a CSV or paste a table so that the AI maps
columns to OWL properties and batch-creates instances.
- **AC:** The AI presents a column-to-property mapping **and an inferred xsd datatype per column**
 (sampling at least N rows, default N=20 tunable, not a single row) for human correction before
 any commit.
- **AC (failure):** Any row that would fail SHACL is flagged and skipped with a per-row reason;
 the remaining rows commit; the user gets a summary of committed vs skipped counts.
- **Priority:** Should Have

**E2-S4: Browse and search instances**
As a **business analyst**, I want to browse and search all instances of a class without writing
SPARQL.
- **AC:** The Instances / Data screen lists instances grouped by class with text search on label
 + comment; clicking an instance shows its properties and outgoing/incoming relationships.
- **AC (failure):** If a class has more instances than one page (default page size 50, tunable),
 results paginate; the screen never silently truncates.
- **Priority:** Must Have

---

### Epic 3: SKOS Controlled Vocabulary (Glossary)

**E3-S1: Define a canonical business term**
As a **business analyst**, I want to create a glossary entry with a preferred label, definition,
synonyms, and broader/narrower links so that the organisation shares one agreed meaning per term.
- **AC:** A new `skos:Concept` is created with `skos:prefLabel`, `skos:definition`, and zero or
 more `skos:altLabel`; SHACL enforces exactly one `skos:prefLabel` per language and one
 `skos:definition`; broader/narrower (`skos:broader`/`skos:narrower`) can be set via chat or form.
- **AC (failure):** A second `skos:prefLabel` in the same language produces a `sh:Violation` and
 blocks the commit (HTTP 422).
- **Priority:** Must Have

**E3-S2: Glossary term and OWL class are one punned resource**
As an **enterprise architect**, I want a business term and its structural class to be the **same
resource** so that vocabulary and structure are never out of sync.
- **AC (decision B1):** A single URI is simultaneously an `owl:Class` and a `skos:Concept`
 (class+concept punning). No separate linking property is required or used; the punning is
 documented in the data model. SHACL validation runs with `inference='none'` so DL-completeness
 is not load-bearing.
- **AC:** The reconciliation query "show everything we know about ContractualObligation" returns
 both the OWL axioms and the SKOS annotations of that one URI.
- **AC (failure):** A query that assumed two distinct URIs (legacy `weave:denotes` pattern) is
 not supported; the Glossary and NL-query surfaces present the single punned resource.
- **Priority:** Must Have

**E3-S3: Search and browse the glossary**
As any user, I want to search the glossary by keyword so that I can find the canonical term.
- **AC:** Search matches on `skos:prefLabel`, `skos:altLabel`, and `skos:definition`; results
 show the preferred label, definition, and the resource's OWL role (since it is punned).
- **AC (failure):** A no-match search returns an empty-state with a "create this term" affordance,
 not an error.
- **Priority:** Must Have

---

### Epic 4: Brand & Voice Standards

**E4-S1: Upload and govern brand standards**
As a **brand / marketing owner**, I want to add our brand styleguide and tone-of-voice guide as
governed content so that the Build Engine can consume them via CE-BRAND-1.
- **AC:** Brand standards are stored as RDF individuals (a brand-standard class in the active
 ontology) with content type, content body (or source URI), effective date, and owner; every
 change carries a PROV-O stamp and is versioned; CE-BRAND-1 `GET /api/brand/tokens` projects
 them to flattened design-token JSON so Build consumes tokens without parsing RDF.
- **AC (failure):** A brand individual missing a required property (per its SHACL shape) is
 blocked at commit (HTTP 422) and never appears in the token projection.
- **Priority:** Must Have

**E4-S2: Structure tone-of-voice rules as machine-evaluable VoiceRules**
As a **brand / marketing owner**, I want to encode rules ("use active voice", "max reading age
12") so that downstream agents can evaluate generated text against them.
- **AC:** Rules are modelled as VoiceRule individuals with a human label and a machine-evaluable
 assertion, exposed via CE-BRAND-1 `GET /api/brand/voice-rules`; the chat panel assists in
 extracting rules from a pasted styleguide.
- **AC (failure):** If the AI is unavailable, the owner can add VoiceRules through the guided
 form; the extraction surface returns 503 without blocking manual entry.
- **Priority:** Should Have

---

### Epic 5: Governance & Compliance Rules

**E5-S1: Model a regulatory obligation as a tenant-scoped SHACL shape**
As a **compliance / risk officer**, I want to describe a requirement and have the AI generate a
SHACL shape so that the rule is enforced on every future edit.
- **AC:** The AI produces an `sh:NodeShape`/`sh:PropertyShape` from NL; I review it; on confirm it
 is added to **this tenant's** shapes graph (never global) with its own PROV-O provenance; shape
 changes invalidate validation caches **across all workers/instances** (external invalidation,
 not process-local).
- **AC (failure):** A tenant's custom shape MUST NOT apply to any other tenant; a cross-tenant
 shape-leak test (tenant-A shape, tenant-B commit) confirms tenant-B is unaffected.
- **Priority:** Must Have

**E5-S2: Run a self-audit query to find uncovered risks**
As a **compliance / risk officer**, I want pre-built self-audit queries so that I can find
entities missing required governance coverage (e.g. data assets classified sensitive with no
guarding shape).
- **AC:** Built-in gap-detection SPARQL SELECT queries are available from the Governance screen;
 results list affected entities with links; a self-audit can be scheduled and results surfaced
 in the dashboard. PII/sensitive handling uses SHACL + data-classification properties (not ODRL
 in v1).
- **AC (failure):** A scheduled self-audit that fails to run emits a PLAT-NOTIFY-1 notification
 rather than failing silently.
- **Priority:** Should Have

**E5-S3: Browse and search compliance rules**
As a **compliance / risk officer**, I want to see all modelled rules and their coverage.
- **AC:** The Rules & Policies screen lists all SHACL shapes (target class, constraint summary,
 severity incl. `sh:Info`); for each shape it shows which entities are currently in violation.
- **AC (failure):** If validation has not yet run for the current draft, the screen shows a
 "validation pending" state, not stale or empty coverage.
- **Priority:** Must Have

---

### Epic 6: SHACL Validation (Cross-Cutting)

**E6-S1: One validated mutation entry point blocks invalid commits**
As any user, I want invalid changes blocked before commit so that the graph only ever contains
valid data.
- **AC (single entry point — CE-WRITE-1):** There is **exactly one** mutation entry point to the
 trusted graph (`POST /api/operations/apply`); it always runs prospective SHACL validation. No
 auto-apply path and no raw SPARQL Update surface may write to the trusted store. (The
 prototype's legacy auto-apply `POST /api/llm/mutate` bypass is explicitly forbidden.)
- **AC (mechanism):** Prospective validation **clones** the target graph, applies the batch to
 the clone, runs SHACL, and commits to the real graph only if zero `sh:Violation` results exist.
- **AC:** `sh:Violation` → HTTP 422, graph unchanged; `sh:Warning` and `sh:Info` are advisory and
 never block.
- **Priority:** Must Have

**E6-S2: SHACL error messages are actionable**
As any user, I want validation errors to explain what was wrong and how to fix it.
- **AC:** Error messages include the violated shape, the offending node/path, the constraint, and
 a plain-English explanation.
- **AC (failure):** If the AI "fix this" helper is unavailable, the raw structured violation
 (focus node, path, severity, message) is still shown so the user can fix it manually.
- **Priority:** Must Have

**E6-S3: Standalone validation endpoint**
As a **downstream platform engineer**, I want a `GET /api/validate` endpoint to check the whole
graph against all active shapes.
- **AC:** Returns a SHACL validation report (JSON-LD or Turtle) listing violations, warnings, and
 info, scoped to the caller's tenant.
- **AC (failure):** A request for a non-existent version returns 404; a request without a valid
 JWT returns 401.
- **Priority:** Must Have

---

### Epic 7: SPARQL Query & NL Query

**E7-S1: Ask natural-language questions about the graph**
As a **business analyst**, I want to ask a plain-English question and get an answer.
- **AC:** The NL input generates and executes a **SPARQL SELECT** query and returns readable
 results; the generated SPARQL is shown (collapsed, expandable); if the AI cannot construct a
 valid query it asks a clarifying question rather than hallucinating results.
- **AC (failure — AI unavailable):** The NL query surface returns HTTP 503 with a clear message,
 AND the raw SPARQL editor remains fully functional so the user can query without AI.
- **Priority:** Must Have

**E7-S2: Write and execute raw SPARQL (SELECT-only, paginated)**
As an **enterprise architect**, I want a SPARQL editor for complex graph traversal.
- **AC (decision B3):** The editor supports **SPARQL 1.1 SELECT only**; UPDATE/INSERT/DELETE are
 rejected; the `SERVICE` keyword is blocked (SSRF); results are **paginated** (no silent row
 cap). CONSTRUCT/ASK/DESCRIBE are deferred to tech-spec (OQ-10), not promised in v1.
- **AC:** Syntax highlighting, prefix auto-complete, and table rendering of SELECT bindings;
 standard prefixes (rdf, rdfs, owl, skos, prov, dcterms, xsd, weave, res) pre-loaded.
- **AC (failure):** A non-SELECT or `SERVICE`-bearing query is rejected before execution with a
 clear message naming the disallowed construct; nothing executes against the store.
- **Priority:** Must Have

**E7-S3: Save and share queries (server-side, team-shared)**
As any user, I want to save a named SPARQL query so a colleague can re-run it.
- **AC:** Saved queries are **server-side and workspace-scoped**, visible to all workspace
 members; a saved query can be promoted to a saved view.
- **AC (failure):** A saved query that references a now-deleted prefix or version still loads;
 execution surfaces the resolution error rather than silently returning empty.
- **Priority:** Should Have

**E7-S4: Ground an agent in what it may do (agent-authority queries)**
As a **downstream platform engineer / agent**, I want to ask the graph what an agent may do —
on which systems and data, within which process, and who to contact or escalate to — so that
agents reason within the bounds the model states rather than from hardcoded policy.
- **AC (Given/When/Then):** Given a populated BPMO graph in which processes are linked to
 their Actors, Systems, Services, DataAssets, and Policies, when a caller issues a built-in
 agent-authority SPARQL SELECT (e.g. "which Activities of process X may an autonomous agent
 execute alone vs. route to a human", "who may read this DataAsset", "which Actor does this
 exception escalate to and within what deadline"), then the graph returns the answer from the
 modelled `governedBy` / `performedBy` / `accesses` relationships and policy/constraint
 individuals — no answer is invented where the graph is silent.
- **AC (default, tunable):** Where the graph does not state a permission, the answer defaults
 to **deny / route-to-human** (default, tunable per workspace); an explicit deny in the model
 overrides any inferred authority.
- **AC (failure):** If the graph is missing the links a query needs (e.g. a process with no
 `performedBy`), the query returns an explicit "coverage gap" row for that entity rather than
 an empty result that could be read as "permitted".
- **Note:** These are read-side SPARQL over CE-READ-1; no new contract is minted. The model
 expresses authority; the Events & Actions Engine remains responsible for what an agent
 actually does at run time (the model/execution separation).
- **Priority:** Should Have

---

### Epic 8: OWL Reasoning

**E8-S1: Infer implied relationships at publish, per version**
As an **enterprise architect**, I want OWL reasoning to infer relationships I have not asserted.
- **AC:** Inference runs **at publish** and materialises into a **per-version** inferred named
 graph (e.g. `weave:graph/v1.2.0/inferred`) so a pinned read of v1.2 never sees inferences from
 v1.3; inferred triples are labelled as inferred in results.
- **AC (failure):** If inference exceeds the reasoner budget (default 30 s, tunable), publish
 fails with a reasoner-timeout error; no partial inferred graph is committed.
- **Priority:** Should Have (v1 simplified; gated on OQ-01)

**E8-S2: Detect inconsistencies at publish**
As an **enterprise architect**, I want logical inconsistencies surfaced before publishing.
- **AC:** An OWL **consistency check runs before each publish**; inconsistencies (unsatisfiable
 classes, violated disjointness) block the publish with a list of affected classes and the
 violated axioms. (SHACL `sh:Violation` blocks earlier, at commit — E6-S1.)
- **AC (failure):** If the reasoner is unavailable, publish is blocked with a clear error (never
 published-without-check); the draft remains editable.
- **Priority:** Must Have (gated on OQ-01)

---

### Epic 9: Provenance & Version Lifecycle

**E9-S1: Every change carries a PROV-O record AND a platform audit entry**
As a **compliance / risk officer**, I want every committed change auditable.
- **AC:** Every applied operations batch creates a `prov:Activity` with `dcterms:created`,
 `rdfs:comment` (stated reason or chat message), the **authoring-agent kind** (the LLM modelled
 as a `prov:SoftwareAgent`, the human as a `prov:Person` via `prov:wasAssociatedWith` the
 approval activity), and the **canonical principal IRI** minted by PLAT-IDENTITY-1. The same
 event is emitted to PLAT-AUDIT-1.
- **AC:** PROV records live in `weave:graph/prov`, append-only, never overwritten; 100% of
 committed changes across all content areas carry a PROV-O record.
- **AC (failure):** If the PLAT-AUDIT-1 emit fails, the commit is not silently accepted as
 audited — emit is retried; the discrepancy is itself logged.
- **Priority:** Must Have

**E9-S2: Draft → published version lifecycle**
As an **enterprise architect**, I want to work in a draft and publish a named version so
downstream engines can pin to it.
- **AC:** The engine maintains a draft named graph and one or more immutable published named
 graphs identified by version IRIs (e.g. `weave:graph/v1.2.0`); publishing snapshots the draft,
 generates a PROV-O change log from the diff, and never alters an existing published version.
- **AC (decision B2):** `?version=latest` resolves to the **newest published version**;
 downstream auto-tracks latest unless pinned. (Released/deprecated lifecycle states are advisory
 metadata only and do NOT redefine `latest` — see OQ-11.)
- **AC (failure):** A publish that fails the OWL consistency check (E8-S2) leaves the prior
 published versions and the draft intact; no partial version IRI is created.
- **Priority:** Must Have

**E9-S3: View version history and diff (server-side, nodes AND edges)**
As an **enterprise architect**, I want to see what changed between two published versions.
- **AC (CE-DIFF-1):** The Versions screen lists published versions; selecting two shows a
 **server-computed** diff of added/removed/**modified nodes AND edges**.
- **AC (failure):** A diff request for a non-existent version returns 404; a diff of a version
 against itself returns an empty diff, not an error.
- **Priority:** Must Have

---

### Epic 10: Stable Read & Write Interfaces (Inter-engine Contract Hub)

**E10-S1: Versioned read interface for downstream engines (CE-READ-1)**
As a **downstream platform engineer / agent**, I want to read the graph at a pinned version.
- **AC:** `GET /api/sparql?version=<iri|latest>&page=<n>` executes a **SELECT-only**, paginated,
 `SERVICE`-blocked query against the named version; `GET /api/ontology/types|resource/{iri}|versions`
 serve registered kinds + extensions, a single entity, and the version list.
- **AC:** The endpoint is authenticated (Cognito JWT / service-principal) and tenant-scoped; it
 **never silently truncates** — it paginates.
- **AC (failure):** A pinned version IRI that does not exist returns 404; an unscoped query that
 would cross tenant boundaries is rejected (see Isolation NFR).
- **Priority:** Must Have

**E10-S2: Validated write interface (CE-WRITE-1)**
As a **downstream engine** (Build, Events, platform ingestion), I want to write graph changes
through one validated entry point.
- **AC:** `POST /api/operations/apply` accepts `{ operations, actor, target }`, applies on a
 throwaway clone, SHACL-validates, commits only if no `sh:Violation`, writes a PROV-O activity
 attributed to `actor`, and returns `201 { activity_iri, applied_count, version_iri }` or
 `422 { violations }`. Duplicate-IRI create is reconciled (idempotency key supported).
- **AC (failure):** A batch with any `sh:Violation` commits nothing (all-or-nothing on the clone);
 a malformed `Op` returns 400 without touching the store.
- **Priority:** Must Have

---

### Epic 11: Authoring Surfaces — Chat AND Forms (Cross-Cutting)

**E11-S1: Persistent chat panel for all authoring**
As any user, I want a persistent chat panel across the Constitution area for any kind of change.
- **AC:** The chat panel is available from all Constitution screens; it understands the current
 screen and defaults to that content area; every AI proposal shows a **human-readable operation
 list / plain-English change summary** before confirm (a raw-Turtle view is available **on
 demand for the ontologist/power-user persona only**, never the default); confirming triggers
 the single validated mutation pipeline (CE-WRITE-1).
- **AC (failure — AI unavailable):** The chat returns HTTP 503 with a clear offline message; the
 guided forms, browse, and SPARQL surfaces remain fully functional.
- **Priority:** Must Have

**E11-S2: SHACL-shape-driven guided forms (decision B4)**
As a **business analyst**, I want guided forms (driven by the SHACL shapes for a kind) so that I
can author without AI and without RDF.
- **AC:** For a selected class, the form renders fields from that class's SHACL shapes (reusing
 the prototype Inspector / NodeEditModal / AddNodeForm patterns); submitting goes through the
 same single validated mutation pipeline (CE-WRITE-1); partial-update semantics apply (E2-S2).
- **AC (failure):** A required field left blank produces an inline validation error before submit;
 a server-side `sh:Violation` returns 422 and the form shows the violation against the field.
- **Priority:** Must Have

**E11-S3: AI explains its proposals**
As a **business analyst**, I want the AI to explain its proposal in plain English.
- **AC:** Each proposal carries a 1–3 sentence plain-English summary; "explain this" expands the
 reasoning.
- **AC (failure):** If the AI is unavailable, the structured operation list still renders without
 the prose summary.
- **Priority:** Must Have

**E11-S4: Conversation history**
As any user, I want the chat to retain my session conversation.
- **AC:** Conversation is preserved for the browser session; refresh clears it (v1; server-side
 persistence deferred — OQ-08).
- **Priority:** Should Have

---

### Epic 12: Artefact & Document Ingest (Post-MVP, prioritized)

> The cold-start adoption lever for clients leaving Bizzdesign / LeanIX / MEGA: absorb the
> model they already hold in documents, EA/BPMN tools, diagrams, and databases. Every story
> writes through the single validated mutation entry point (CE-WRITE-1) with PROV-O
> attribution; none introduces a second mutation path. All stories are **Post-MVP
> (prioritized)** — sequenced after the MVP authoring loop but ahead of nice-to-haves. This is
> user-supplied, materialised-copy import — distinct from the platform's live managed
> connectors (PLAT-CONNECTOR-1).

**E12-S1: Agent-driven conversational document ingest** **[USER PRIORITY]**
As a **business analyst / enterprise architect**, I want to upload an existing enterprise
document (a BPM, policy, runbook, or process doc) and have an agent propose, through the chat
panel, additions linked to what the graph already holds, so that I populate the model from what
I already have instead of from a blank page.
- **AC (Given/When/Then):** Given an uploaded document, when the agent processes it, then it
 extracts candidate entities and relationships, maps them to the BPMO kinds, and — reusing the
 propose-mutations + find-existing-node reconciliation flow — proposes additions **linked to
 the relevant existing graph resources** (same-label + same-kind matches are reused, not
 duplicated), surfaced in the chat panel as a human-readable per-proposal operation list.
- **AC (human-in-the-loop):** The human reviews and accepts or rejects **per proposal**; each
 accepted proposal is SHACL-validated on a throwaway clone (prospective pre-flight) and
 committed through CE-WRITE-1 with a PROV-O activity attributing the LLM as the extracting
 agent and the human as the approver, plus the source document as `prov:used`.
- **AC (default, tunable):** A proposal whose confidence is below a threshold (default 0.6,
 tunable per workspace) is flagged "low confidence" for explicit review rather than
 pre-selected for accept.
- **AC (failure — AI unavailable):** If the AI provider is unavailable, the upload surface
 returns HTTP 503 with a clear message; no partial extraction is committed; the user can still
 author via forms/chat once the provider returns.
- **AC (failure — invalid):** A proposal that would produce a `sh:Violation` is blocked at
 commit (HTTP 422) with the violation shown against the proposal; the graph is unchanged.
- **Priority:** Must Have (within Epic 12)

**E12-S2: Structured model import (ArchiMate Exchange Format + BPMN)**
As an **enterprise architect**, I want to import an ArchiMate Exchange Format file or a BPMN
(BBO) model so that an existing EA/process model becomes graph content.
- **AC (Given/When/Then):** Given a well-formed ArchiMate Exchange Format or BPMN file, when I
 import it, then it is converted to RDF and materialised through CE-WRITE-1, with a per-notation
 SHACL well-formedness shape checked before commit; the importer maps ArchiMate/BPMN element
 types to the BPMO kinds (e.g. BPMN task→Activity, BPMN event→Event, ArchiMate
 application-component→System/Service).
- **AC (default, tunable):** Elements that do not map to a framework kind are imported as the
 nearest kind with a flag, defaulting to **Concept** (tunable mapping) and listed for review,
 not silently dropped.
- **AC (failure):** A file that fails the per-notation well-formedness SHACL shape is rejected
 with a per-element reason; nothing is committed; a partially-valid file commits only the valid
 elements and reports the skipped ones.
- **Priority:** Should Have

**E12-S3: AI diagram / image-to-data**
As an **enterprise architect**, I want to upload a diagram or image (a hand-drawn or exported
process/architecture diagram) so that a vision model extracts entities and relationships from
it.
- **AC (Given/When/Then):** Given an uploaded image, when the vision model processes it, then it
 proposes BPMO entities and relationships through the same per-proposal review + CE-WRITE-1
 commit flow as E12-S1.
- **AC (default, tunable):** Extraction confidence below a threshold (default 0.6, tunable)
 flags the proposal for explicit review.
- **AC (failure):** If the vision model cannot parse the image (unreadable / unsupported), the
 surface returns a clear error and proposes nothing; no partial commit.
- **Priority:** Should Have

**E12-S4: Structured-data import (R2RML + RML)**
As an **enterprise architect**, I want to import structured data — a relational/CMDB extract via
W3C **R2RML** or CSV/JSON/XML via **RML** — so that operational records become graph instances.
- **AC (Given/When/Then):** Given a source dataset and a mapping, when I run the import, then the
 mapping materialises RDF that is committed through CE-WRITE-1 (materialised copy, not a live
 virtual graph), SHACL-validated per row, with PROV-O attribution naming the source.
- **AC (default, tunable):** Rows failing SHACL are flagged and skipped with a per-row reason;
 the rest commit; the user gets a committed-vs-skipped summary (consistent with the bulk-CSV
 flow, FR-030). Datatype inference samples at least N rows (default 20, tunable).
- **AC (failure):** A malformed mapping is rejected before any commit with a clear error; the
 store is untouched.
- **Note:** This is materialised-copy import, explicitly NOT query-time SPARQL→SQL federation
 (OQ-17) and distinct from the platform's live connectors (Non-Goal #4).
- **Priority:** Should Have

**E12-S5: SKOS cross-notation reconciliation**
As an **enterprise architect**, I want the same business concept arriving from different
notations (an ArchiMate element, a BPMN artefact, a glossary term) to reconcile to one anchor so
that the graph does not fragment into duplicates.
- **AC (Given/When/Then):** Given entities ingested from multiple notations that denote the same
 concept, when reconciliation runs, then they collapse to **one canonical resource** via the
 same find-existing-node reconciliation flow used elsewhere (same-label + same-kind reuse), so
 the concept is one punned `owl:Class` + `skos:Concept` (decision B1 — no separate
 cross-notation linking property), and downstream reads see one canonical concept.
- **AC (default, tunable):** Reconciliation proposes a merge above a label/definition similarity
 threshold (default 0.85, tunable) for human confirmation; it never auto-merges below it.
- **AC (failure):** A proposed merge that would violate SHACL (e.g. conflicting single-valued
 properties) is blocked and surfaced for manual resolution.
- **Priority:** Should Have

---

## 4. Functional Requirements

| ID | Requirement (observable behaviour + failure mode + acceptance) | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Chat panel present and persistent on all Constitution screens; returns 503 with offline message when AI unavailable while forms/browse/query stay live. AC: panel mounts on every screen; offline state asserted. | E11-S1 | P0 | MVP |
| FR-002 | Every AI-proposed mutation shows a **human-readable operation list / plain-English summary** before commit; raw-Turtle view available on demand for ontologist/power-user only. AC: default review surface is the op-list, not Turtle. | E11-S1, E11-S2 | P0 | MVP |
| FR-003 | **Exactly one** mutation entry point (`POST /api/operations/apply`, CE-WRITE-1) writes to the trusted graph; it always runs prospective SHACL validation on a clone; no auto-apply or raw SPARQL Update may write. AC: legacy auto-apply path absent; bypass attempt rejected. | E6-S1 | P0 | MVP |
| FR-004 | Prospective validation **clones** the target graph, applies the batch, runs SHACL, commits only if zero `sh:Violation`. AC: a batch with one violation commits nothing. | E6-S1 | P0 | MVP |
| FR-005 | `sh:Violation` → HTTP 422 (graph unchanged); `sh:Warning` and `sh:Info` are advisory, surfaced, never block. AC: each severity exercised. | E6-S1, E5-S3 | P0 | MVP |
| FR-006 | Every committed change produces a PROV-O `prov:Activity` in `weave:graph/prov` recording authoring-agent kind (`prov:SoftwareAgent` for LLM, `prov:Person` for approving human via `prov:wasAssociatedWith`) and the PLAT-IDENTITY-1 principal IRI; AND emits the same event to PLAT-AUDIT-1. AC: 100% of commits carry both; audit-emit failure retried + logged. | E9-S1 | P0 | MVP; PLAT-AUDIT-1, PLAT-IDENTITY-1 |
| FR-007 | OWL **consistency check runs before each publish**; inconsistencies block publish with affected classes + violated axioms; reasoner-unavailable blocks publish (never publishes unchecked). AC: inconsistent draft cannot publish. | E8-S2 | P1 | MVP; gated on OQ-01 |
| FR-008 | Draft → published version lifecycle with immutable published named graphs (version IRIs); publish snapshots draft + generates PROV-O change log; existing versions never altered. AC: prior versions byte-identical after a new publish. | E9-S2 | P0 | MVP |
| FR-009 | `?version=latest` resolves to the **newest published version** (decision B2); downstream auto-tracks unless pinned. AC: publishing v1.3 makes `latest` resolve to v1.3. | E9-S2 | P0 | MVP |
| FR-010 | CE-READ-1: `GET /api/sparql?version=<iri\|latest>&page=<n>` — **SELECT-only**, `SERVICE` blocked, **paginated** (no silent cap). AC: UPDATE/SERVICE rejected pre-execution; large result paginates. | E10-S1, E7-S2 | P0 | MVP |
| FR-011 | CE-READ-1: REST `GET /api/ontology/types`, `/resource/{iri}`, `/versions`; all accept `?version=`, default `latest`. AC: each returns documented shape; bad version → 404. | E10-S1 | P0 | MVP |
| FR-012 | CE-WRITE-1: `POST /api/operations/apply` accepts `{operations,actor,target}`, validates on clone, returns `201{activity_iri,applied_count,version_iri}` or `422{violations}`; duplicate-IRI reconciled; idempotency key supported. AC: dup create reuses node; malformed Op → 400. | E10-S2, E6-S1 | P0 | MVP |
| FR-013 | CE-DIFF-1: `GET /api/ontology/diff?from=&to=` returns server-computed added/removed/**modified nodes AND edges**. AC: an edge-only change appears in `modified`. | E9-S3 | P0 | MVP |
| FR-014 | CE-VERSION-1: `GET /api/ontology/versions` is the single source for latest; canonical **version-lag** = count of published versions strictly between a pin and `is_latest`; "stale" default threshold lag ≥ 2 (tunable). AC: consumers read lag, never recompute. | E9-S2 | P0 | MVP |
| FR-015 | CE-EVENT-1: emit graph-change events `{change_type,entity_iri,version_iri,actor,ts}` (change_type ∈ added\|updated\|deleted\|constraint-violated); transport deferred (OQ-12). AC: a commit produces one event; consumers may degrade to polling CE-READ-1 by since-version. | E9-S1 | P1 | MVP (Should-Have for Events consumers) |
| FR-016 | CE-BRAND-1: `GET /api/brand/tokens` (flattened design-token JSON) + `GET /api/brand/voice-rules` (machine-evaluable). AC: tokens consumable without parsing RDF; a brand individual failing its shape never appears in tokens. | E4-S1, E4-S2 | P0 | MVP |
| FR-017 | CE-METRICS-1: `GET /api/metrics/ontology` → `{entity_count_by_kind, latest_version, draft_published_delta, shacl_errors_by_severity, owl_inconsistencies}`. AC: Platform Dashboard binds to it; values match graph state. | E5-S3 | P1 | MVP |
| FR-018 | NL query: NL → AI-generated **SPARQL SELECT** → executed results, generated SPARQL shown (collapsed); cannot-construct → clarifying question, never hallucination; AI-unavailable → 503 while SPARQL editor stays live. AC: 503 path keeps editor functional. | E7-S1 | P0 | MVP |
| FR-019 | SPARQL editor: SELECT-only, `SERVICE`-blocked, paginated; syntax highlight + prefix auto-complete + table render; non-SELECT/`SERVICE` rejected pre-execution. AC: rejected query never reaches store. | E7-S2 | P0 | MVP |
| FR-020 | Ontology / Types screen lists the 13 BPMO framework kinds + the client-built taxonomy with properties and relationships (vocabulary-agnostic — no hardcoded client class IRIs). AC: screen reflects the active ontology, not a fixed list. | E2-S4, E1-S1 | P0 | MVP |
| FR-021 | Instances / Data screen lists + text-searches instances by class; paginates (default 50/page, tunable); never silently truncates. AC: >page-size class paginates. | E2-S4 | P0 | MVP |
| FR-022 | Glossary: create/edit punned resources (single URI = `owl:Class` + `skos:Concept`, decision B1) with `skos:prefLabel`/`altLabel`/`definition`/`broader`/`narrower`; SHACL enforces one prefLabel/lang + one definition; validation runs `inference='none'`. AC: second prefLabel/lang → 422; punning documented. | E3-S1, E3-S2 | P0 | MVP |
| FR-023 | Glossary search matches `prefLabel`/`altLabel`/`definition`; no-match → empty-state with create affordance. AC: empty search not an error. | E3-S3 | P0 | MVP |
| FR-024 | Brand & Voice screen stores brand individuals + VoiceRules with versioning + PROV-O; AI extraction from pasted styleguide, with form fallback when AI unavailable. AC: form path works at 503. | E4-S1, E4-S2 | P0 | MVP |
| FR-025 | Governance screen: SHACL shapes stored in the **authoring tenant's** shapes graph (never global) with PROV-O; browsable by target class; shape change invalidates validation cache across all workers/instances. AC: cross-tenant shape-leak test passes. | E5-S1, E5-S3 | P0 | MVP; PLAT-SETTINGS-1 |
| FR-026 | Self-audit gap queries available from Governance screen; PII/sensitive handling via SHACL + data-classification properties (NOT ODRL in v1); schedulable; failed run → PLAT-NOTIFY-1. AC: gap query lists uncovered entities. | E5-S2 | P1 | MVP; PLAT-NOTIFY-1 |
| FR-027 | `GET /api/validate` returns a full SHACL report (JSON-LD/Turtle) incl. violations/warnings/info, tenant-scoped; bad version → 404; no JWT → 401. AC: report enumerates all severities. | E6-S3 | P0 | MVP |
| FR-028 | OWL inferred triples materialised **per published version** (e.g. `weave:graph/v1.2.0/inferred`) at publish; pinned reads include/exclude inferred deterministically per version; reasoner-timeout (default 30s, tunable) → no partial graph. AC: v1.2 read excludes v1.3 inferences. | E8-S1, E1-S4 | P1 | MVP; gated on OQ-01 |
| FR-029 | Inferred triples labelled as inferred in query results and instance views. AC: asserted vs inferred distinguishable in output. | E8-S1 | P1 | MVP |
| FR-030 | Bulk-populate: CSV/table upload with AI column-to-property mapping + xsd datatype inference sampling ≥ N rows (default 20, tunable, not 1) shown for human correction before commit; rows failing SHACL flagged + skipped with reason; passing rows commit. AC: skipped-row reason surfaced. | E2-S3 | P1 | MVP |
| FR-031 | RBAC role × action matrix enforced (the grid in §6 → Security → RBAC matrix); resolved through PLAT-SETTINGS-1 cascade. AC: a BA cannot publish; a viewer cannot author; an architect can author-ontology + publish. | (RBAC) | P0 | MVP; PLAT-SETTINGS-1 |
| FR-032 | All REST + SPARQL endpoints require a Cognito JWT / service principal and are tenant-scoped + rate-limited; secrets via AWS Secrets Manager only. AC: no-JWT → 401; over-limit → 429. | E10-S1 | P0 | MVP |
| FR-033 | Import initial model from pasted document/text via chat (AI proposes classes + properties; reject-individual + ask-alternative without restart; per-proposal commit); AI-unavailable → 503 + forms fallback. AC: granular history; 503 path documented. | E1-S3 | P0 | MVP |
| FR-034 | Edit uses **partial-update** semantics: only named properties retracted/asserted; all others (position, colour, domain…) preserved. AC: an edit omitting position never wipes position. | E2-S2 | P0 | MVP |
| FR-035 | Saved queries are **server-side, workspace-scoped**, visible to all members; promotable to saved view. AC: a colleague in the same workspace re-runs a saved query. | E7-S3 | P2 | MVP |
| FR-036 | Agent-grounding: built-in agent-authority SPARQL SELECTs over CE-READ-1 answer "what may an agent do, on which systems/data/process, who to escalate to" from modelled `governedBy`/`performedBy`/`accesses` links; absent permission defaults to **deny / route-to-human** (default, tunable); explicit deny overrides inferred authority; a missing required link returns an explicit coverage-gap row, never an empty "permitted". AC: a process with no `performedBy` yields a coverage-gap row; an unstated permission resolves to deny. | E7-S4 | P1 | MVP (read-side over CE-READ-1; no new contract) |
| FR-037 | Ship a small **framework competency-question set** (e.g. consumes/produces/runs-on/performed-by/governed-by per process) runnable against any client graph; client onboarding MUST declare **2–5** domain competency questions; both are runnable as a test. AC: framework CQs return for the seeded graph; a client with <2 declared CQs is flagged at onboarding. | (CQ) | P1 | MVP |
| FR-038 | Conversational document ingest: an uploaded document → agent-extracted BPMO candidates proposed **through the chat panel, linked to existing resources** (reuse propose-mutations + find-existing-node reconciliation); per-proposal human accept/reject; SHACL prospective pre-flight on a throwaway clone; commit via CE-WRITE-1 with PROV-O (LLM extractor + human approver + source doc as `prov:used`); low-confidence (default 0.6, tunable) flagged; AI-unavailable → 503 with no partial commit; `sh:Violation` → 422. AC: a re-mention of an existing entity reuses it, not duplicates; 503 path commits nothing. | E12-S1 | P1 | Post-MVP (prioritized) |
| FR-039 | Structured model import (ArchiMate Exchange Format + BPMN/BBO) → RDF via CE-WRITE-1 with per-notation SHACL well-formedness; element-type→BPMO-kind mapping; unmapped elements default to **Concept** (tunable) and are listed, not dropped; a file failing well-formedness is rejected with per-element reasons; a partially-valid file commits valid elements and reports skips. The ArchiMate→RDF basis follows published prior art (**ArchiMEO** ontology / **archimate2rdf**) as a *reference*, not a tooling dependency. AC: a BPMN task lands as Activity; a malformed file commits nothing. | E12-S2 | P2 | Post-MVP (prioritized) |
| FR-040 | AI diagram/image-to-data: a vision model extracts BPMO entities/relationships from an uploaded image, proposed through the same per-proposal review + CE-WRITE-1 commit as FR-038; confidence below threshold (default 0.6, tunable) flagged; unreadable image → clear error, no partial commit. AC: extraction routes through CE-WRITE-1; unreadable input proposes nothing. | E12-S3 | P2 | Post-MVP (prioritized) |
| FR-041 | Structured-data import via W3C **R2RML** (relational/CMDB) + **RML** (CSV/JSON/XML) materialised through CE-WRITE-1 (materialised copy, NOT query-time federation — OQ-17); per-row SHACL with skip-and-report; datatype inference samples ≥ N rows (default 20, tunable); malformed mapping rejected before any commit; the R2RML/RML mapping layer (mapping authoring, storage, execution engine) is detailed in the CE data-model / ingest tech-spec note. AC: failing rows skipped with reason, rest commit; malformed mapping leaves store untouched. | E12-S4 | P2 | Post-MVP (prioritized); distinct from PLAT-CONNECTOR-1 |
| FR-042 | SKOS cross-notation reconciliation: entities denoting one concept across notations collapse to **one canonical punned resource** (`owl:Class` + `skos:Concept`, decision B1 — no separate cross-notation linking property) via the find-existing-node reconciliation flow; merge proposed above similarity threshold (default 0.85, tunable) for human confirm, never auto-merged below; a merge that would violate SHACL is blocked and surfaced. AC: cross-notation duplicates collapse to one concept on confirm; sub-threshold pairs are not merged. | E12-S5 | P2 | Post-MVP (prioritized) |

> Every FR is phased; FRs that cannot ship before another engine/contract carry it in
> "depends-on". Contract-bearing FRs cite the owning `CE-*`/`PLAT-*` contract ID verbatim.

---

## 5. Inter-engine Interfaces

> CE is the contract **hub**. The Provided table below mirrors every `CE-*` contract in
> `docs/specs/_inter-engine-contracts.md` §1 verbatim by ID. These are first-class owned
> deliverables, not open questions.

### Consumed (this engine calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Platform | **PLAT-AUDIT-1** | latest | Every commit emits a typed audit event; CE PROV-O is the semantic mirror (FR-006). |
| Platform | **PLAT-IDENTITY-1** | latest | Canonical service-principal IRI for the LLM authoring agent and human approvers, used in PROV-O + every audit entry (FR-006). |
| Platform | **PLAT-NOTIFY-1** | latest | SHACL-violation, self-audit-failure, and version notifications (FR-026; engines publish to the open type taxonomy). |
| Platform | **PLAT-SETTINGS-1** | latest | Tenant isolation, RBAC cascade, and per-scope tunable thresholds resolve through the 4-level cascade (FR-025, FR-031, NFR Isolation). |
| Platform | **PLAT-BILLING-1** | latest | NL/AI authoring + NL-query token usage metered per-token (NFR Reliability). |
| Platform | **PLAT-CONNECTOR-1** | latest | Connector→graph ingestion writes back through CE-WRITE-1 (Non-Goal #4); CE does not own connectors. |

> Consumed contracts are pinned to `latest` at PRD level; the tech spec fixes exact version
> tags. Where a flow touches a contract, the FR/NFR names it rather than describing prose.

### Provided (this engine exposes to others — mirrors §1 verbatim by ID)

| Contract | Consumers | Shape | Stability |
|---|---|---|---|
| **CE-READ-1** — Versioned read interface | Explorer, Build, Events, Platform, Onboarding | `GET /api/ontology/types` → the **13 BPMO framework kinds** (Process, Activity, Event, DataAsset/Field, System, Service, BusinessCapability, BusinessDomain, Policy, Goal, Actor, Concept, Class) + relationship-types + client extensions; `GET /api/ontology/resource/{iri}` → entity + properties + edges; `GET /api/ontology/versions` → `[{version_iri, semver, published_at, is_latest}]`; `GET /api/sparql?version=<iri\|latest>&page=<n>` — **SPARQL 1.1 SELECT-only**, `SERVICE` blocked (SSRF), **paginated** (no silent row cap), `version=latest` = newest published. **Agent-grounding:** because processes are linked to their systems/data/actors/capabilities/policies, agent-authority questions (what an agent may do, on what, who to contact) are answerable as read-side SPARQL over this contract — no separate contract. | stable |
| **CE-WRITE-1** — Validated-operations write API | Build, Events, Platform ingestion, Explorer | `POST /api/operations/apply` · Request `{operations:[Op], actor:<principal IRI>, target:"draft"\|<version_iri>}`; `Op ∈ add_node\|update_node\|add_edge\|delete_node\|delete_edge` (new nodes carry a local `ref` resolved to IRIs in-batch; dedup = case-insensitive `label`+`kind` reuse). Applied on a **throwaway clone**, SHACL-validated, commits only if no `sh:Violation` (Warning/Info advisory); writes a PROV-O activity attributed to `actor`. Response `201{activity_iri,applied_count,version_iri}` OR `422{violations:[{focus_node,path,severity,message}]}`. Idempotency key supported; duplicate-IRI create reconciled to existing node. **Only** mutation entry point. | stable |
| **CE-DIFF-1** — Version diff | Explorer (diff overlay), Build (artefact staleness) | `GET /api/ontology/diff?from=<version_iri>&to=<version_iri>` → `{added:[Node\|Edge], removed:[Node\|Edge], modified:[{ref,kind,before,after}]}` — includes **edge** modifications (server-side). | stable |
| **CE-VERSION-1** — Version metadata + canonical lag | Build, Events, Explorer, Platform | `GET /api/ontology/versions` is the single source for "latest". **Canonical version-lag** = count of published versions strictly between a consumer's pinned version and `is_latest`; consumers never re-implement it. "Stale" default threshold = lag ≥ 2 (configurable). | stable |
| **CE-EVENT-1** — Graph-change event stream | Events (graph-change triggers — **Should Have**, degrade to polling CE-READ-1 with since-version), Platform (live activity / draft-vs-published delta widgets) | Events `{change_type:"added"\|"updated"\|"deleted"\|"constraint-violated", entity_iri, version_iri, actor, ts}`. Transport (SNS / WebSocket / change-feed) deferred to tech-spec (OQ-12). | beta |
| **CE-BRAND-1** — Brand → design-token projection + VoiceRule contract | Build (compliant-by-construction generation; conformance bar default 90%, configurable, measured against these) | `GET /api/brand/tokens` → flattened design-token JSON (colour, type scale, spacing, radii…) projected from RDF brand individuals; `GET /api/brand/voice-rules` → machine-evaluable VoiceRules (each a checkable assertion). | stable |
| **CE-METRICS-1** — Aggregate metrics for the Dashboard | Platform Generative Dashboard (CE-sourced widgets = MVP-eligible set) | `GET /api/metrics/ontology` → `{entity_count_by_kind, latest_version, draft_published_delta, shacl_errors_by_severity, owl_inconsistencies}`. | stable |

---

## 6. Non-Functional Requirements

### Performance

> All thresholds are configurable defaults, tunable per workspace, and flagged UNVERIFIED until a
> tech-spec load test confirms them (OQ-13). None is a hard GA gate.

- SPARQL SELECT (≤ 3 triple patterns) against a published graph: **default p95 < 500 ms** at
 10k–500k triples (UNVERIFIED — confirm by load test, OQ-13).
- SHACL prospective validation for a single-entity mutation: **default < 2 s** (UNVERIFIED;
 re-derive against an actual shapes-graph size estimate — the prior "≤ 200 shapes" figure was a
 likely misattribution of the prototype's 200-*node* prompt cap and is removed).
- Chat AI response: **default p95 < 5 s** (excluding streaming); first streamed token **< 1 s**
 (UNVERIFIED, OQ-13).
- Publish (snapshot + OWL consistency check + per-version inference + PROV-O): **default < 30 s**
 for graphs up to 500k triples (UNVERIFIED, OQ-13); reasoner budget default 30 s, tunable.

### Security

- All REST + SPARQL endpoints require a Cognito JWT / service principal (FR-032); RBAC enforced
 per the **role × action matrix** below (FR-031) resolved through the **PLAT-SETTINGS-1**
 cascade. The enforcement *layer* (middleware vs attribute-level SHACL) is OQ-07; the *policy*
 is fixed here.

**RBAC matrix** (✓ = permitted; — = denied):

| Role \ Action | read | author-instances | author-ontology | author-shapes | author-brand | publish | delete |
|---|---|---|---|---|---|---|---|
| Architect / ontologist | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Business analyst / SME | ✓ | ✓ | — | — | — | — | —¹ |
| Brand / marketing owner | ✓ | — | — | — | ✓ | — | —¹ |
| Compliance / risk officer | ✓ | — | — | ✓ | — | — | — |
| Downstream engineer / viewer (service principal) | ✓ | — | — | — | — | — | — |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓² |

¹ May delete only instances they authored within their content area (delete-own), per the
referencing-warning flow (E2-S2). ² No role may delete PROV-O provenance records — that is not an
available operation for any principal, including admin (FR-006 append-only invariant).

- **SELECT-only** query surface; UPDATE/INSERT/DELETE rejected; `SERVICE` keyword blocked (SSRF
 prevention); writes only through the single validated mutation entry point (CE-WRITE-1) — no
 raw SPARQL Update from any UI (FR-003, FR-010, FR-019).
- PROV-O records are immutable + append-only; deletion is not an available operation (not even
 for admins); the audit log (PLAT-AUDIT-1) is append-only at the DB-constraint level.
- NL authoring: AI-proposed operations are never applied to the real store without passing the
 clone-based SHACL gate; the AI never bypasses the validation pipeline.
- Secrets: all credentials (database, Cognito, AI provider keys) via **AWS Secrets Manager**
 only; never in env files or source.
- PII / sensitive data: classify via SHACL + data-classification properties; surface gaps in
 self-audit queries (FR-026). **ODRL is NOT in the v1 stack** (OQ-09).

### Reliability

- The single mutation pipeline is all-or-nothing on the clone: a batch with any `sh:Violation`
 commits nothing (FR-004).
- CE-EVENT-1 consumers degrade to **polling** CE-READ-1 by since-version if the stream is not
 ready (FR-015); change-event delivery is at-least-once with idempotent consumers.
- PLAT-AUDIT-1 emit is retried on failure and the discrepancy logged; a commit is never recorded
 as audited when its audit emit failed (FR-006).
- AI-provider-unavailable degrades to 503 on NL surfaces only; forms, browse, and SPARQL stay
 live (FR-001, FR-018, FR-033).
- AI/NL token usage metered via **PLAT-BILLING-1** (per-token); metering events never dropped.

### Observability

- Every `apply_operations` emits an OpenTelemetry span: attributes `outcome`
 (success\|validation-failure\|error), `mutation_count`, `validation_duration_ms`,
 `actor_principal_iri`, `tenant_id`.
- SPARQL execution emits spans: `query_hash`, `result_count`, `page`, `duration_ms`, `tenant_id`.
- AI authoring emits spans: `model_id`, `input_tokens`, `output_tokens`, `proposal_accepted`
 (bool). Logs correlate by `trace_id`; no PII or secrets logged.

### Accessibility

- Chat panel, guided forms, and query screen: **WCAG 2.1 AA**, with a zero-violations gate in CI
 (axe).
- Full keyboard navigation for all primary authoring flows (chat submit, form fill/submit, diff
 review confirm/reject); visible focus; ARIA labels on interactive controls.

### Isolation & data safety

- **Multi-tenant isolation mechanism (named):** each tenant's graph data is isolated such that
 **no query — with or without an explicit `GRAPH` clause — can return another tenant's triples.**
 Implemented as either store-per-tenant OR named-graph + query-rewriting middleware that injects
 the tenant graph and **rejects any unscoped query**. Final mechanism is a tech-spec decision
 (OQ-04); the expectation and test are fixed here.
- **Cross-tenant-read test (required):** a tenant-A JWT issuing an unscoped SPARQL query returns
 **zero** tenant-B triples. A companion **cross-tenant shape-leak test** confirms a tenant-A
 custom SHACL shape never affects a tenant-B commit (FR-025).
- Tenant boundaries, RBAC, and budget caps resolve through **PLAT-SETTINGS-1** (tighter-wins).

### Browser / device support

- Chrome, Firefox, Safari — latest 2 major versions. Browser SPA only; no IE11; no
 Electron-specific code.

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| **A1** — Ship a process-centric, ArchiMate-3-aligned **BPMO framework** (13 kinds + relationship types + W3C scaffolding), NOT a populated taxonomy; clients build their own domain taxonomy on top | "Weave provides the grammar; the company writes the sentences." The framework is a business-process-modelling ontology where Process is the centre, linked to the data it consumes/produces, the systems/services that run it, the actors that perform it, the capabilities it realizes, the goals it serves, the domain it sits in, and the policies that govern it — the "business brain" an agent reasons inside. Grounded in the obpm BPMO meta-model (process/activity/event, capability/goal/driver, policy/permission, role/identity, domain, service, data-asset/document meta-classes); ArchiMate-3-aligned with REA + UFO behind the curtain. Supersedes the earlier "thin 8 structural kinds" framing, which was drawn from the simpler prototype canvas UI rather than the richer BPMO. |
| **No manual-only modeller** — every authoring surface (chat, forms, ontology import, document ingest, structured-data import) offers an AI / auto-population on-ramp | The blank-page cold-start problem is the main adoption barrier; no surface may require hand-written RDF as the only path. |
| **B1** — Glossary term and OWL class are **one punned resource** (single URI = `owl:Class` + `skos:Concept`); punning documented; SHACL runs `inference='none'` | Avoids a fragile cross-notation linking property (`weave:denotes`); DL-completeness is not load-bearing since validation does not rely on OWL inference. Grounded: obpm `mi-glossary.ttl` (same URI is both). |
| **B2** — `?version=latest` = **newest published version**; downstream auto-tracks unless pinned | Matches CE-READ-1 / CE-VERSION-1. Released/deprecated states are advisory metadata only and do not redefine `latest` (deferred OQ-11). |
| **B3** — SPARQL surface = **SELECT-only + `SERVICE`-blocked (SSRF) + paginated** (no silent row cap); writes only via CE-WRITE-1 | Matches the implemented, intentionally-secured prototype sanitizer (`store.py:581-603`). CONSTRUCT/ASK/DESCRIBE deferred (OQ-10). |
| **B4** — Two authoring surfaces in v1: NL chat AND SHACL-shape-driven **guided forms** | A confirmed platform decision ("NL + forms editing"); the prototype already ships forms (Inspector / NodeEditModal / AddNodeForm). Neither deferred. |
| **Single validated mutation entry point** — only `POST /api/operations/apply` (CE-WRITE-1) writes; clone-then-validate-then-commit; no auto-apply, no raw SPARQL Update | Closes the prototype's legacy `/api/llm/mutate` validation-bypass hole; CE-WRITE-1 names this as the only mutation entry point. |
| **Partial-update semantics** — only named properties retracted/asserted; others preserved | Prevents AI edits from wiping canvas layout (position/colour/domain). Grounded: prototype `update_node` `exclude_unset`. |
| **Validation/reasoning timing** — SHACL prospective validation at **commit**; OWL consistency check + per-version inference at **publish** | Resolves the prior internal commit-vs-publish inconsistency; matches the prototype clone-store commit gate and a heavier batch reasoner at publish. |
| **PROV-O records human-vs-AI authorship** — LLM = `prov:SoftwareAgent`, approving human = `prov:Person`; canonical principal IRI from PLAT-IDENTITY-1; also emits PLAT-AUDIT-1 | Preserves the prototype's load-bearing "AI proposed / human approved" trust distinction. |
| **OWL/SHACL split** — OWL DL for class semantics (open-world); SHACL for data-quality enforcement (closed-world) | The "Polikoff rule" from prototype research: relationship matrix in SHACL shapes, not OWL axioms. |
| **PROV-O append-only; no deletion** | Governance / audit-trail requirement; downstream generation safety. |
| **Production RDF store deferred to tech spec** | Unblock dev with Oxigraph; choose Neptune vs Jena Fuseki against real scale (OQ-02). |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | Which OWL reasoner ships in v1 (RDFLib-OWL / Owlready2 / Stardog / ELK)? Tractability at 500k triples? FR-007/FR-028 gate on this. | Architect |
| OQ-02 | Production RDF store: Neptune vs Jena Fuseki — latency, SPARQL 1.1 compliance, cost at scale. | Architect |
| OQ-03 | Which Claude model handles NL→operations generation? Token budget per mutation? (Candidate `claude-sonnet-4-6`.) | Architect |
| OQ-04 | Final multi-tenant isolation mechanism: store-per-tenant vs named-graph + query-rewriting that rejects unscoped queries. (Expectation + cross-tenant test fixed in NFR Isolation.) | Architect |
| OQ-05 | *(Resolved)* SPARQL Update is never exposed; writes go only through CE-WRITE-1. Connector→graph ingestion is a platform responsibility writing via CE-WRITE-1 (PLAT-CONNECTOR-1). | — |
| OQ-06 | *(Resolved by CE-BRAND-1)* Brand/voice serialised as a flattened design-token JSON projection + machine-evaluable VoiceRules over the RDF. | — |
| OQ-07 | RBAC **enforcement layer**: FastAPI middleware vs attribute-level SHACL (the policy matrix itself is fixed in FR-031/§7). | Architect |
| OQ-08 | Authoring conversation history: v1 is session-only; at what phase does server-side persistence become a requirement? | PO |
| OQ-09 | ODRL policy enforcement (PII/sensitive): not in v1 stack (v1 uses SHACL + data-classification). Should ODRL be added to the stack later, and update CLAUDE.md? | Architect |
| OQ-10 | Expand the query surface beyond SELECT (CONSTRUCT/ASK/DESCRIBE) post-v1, with SSRF mitigation if `SERVICE` is ever re-enabled. | Architect |
| OQ-11 | Should published versions carry advisory released/deprecated lifecycle states + a single-active-release pointer? (Must NOT redefine `latest` = newest published, decision B2.) | Architect + PO |
| OQ-12 | CE-EVENT-1 transport: SNS fan-out vs WebSocket vs change-feed (Events degrades to polling until decided). | Architect |
| OQ-13 | Confirm all NFR Performance thresholds by load test; re-derive the SHACL "shapes-graph size" figure. | Architect |
| OQ-14 | **OCEL 2.0** as the named event-layer candidate for ingesting observed-behaviour event data (object-centric event logs). Confirm the ingest mapping; NOT a process-mining engine (Non-Goal #10). | Architect |
| OQ-15 | Opt-in extension patterns: **REA (ISO 15944-4)** economic-exchange, **gUFO** foundational typing, **OWL-Time** temporal modelling — which ship as documented extension patterns vs. stay design-only behind the curtain? | Architect + PO |
| OQ-16 | UFO / OntoUML rigour as **internal discipline** advised via `sh:Warning` / `sh:Info` (never user-exposed as hard rules) — how deep to enforce-vs-advise? | Architect |
| OQ-17 | Virtual-graph **SPARQL→SQL federation** (query-time live external data) vs. the v1 materialised-copy import — pending ADR. Clarifies the Non-Goal #11 boundary. | Architect |
| OQ-18 | Ingest extraction-confidence and reconciliation-similarity defaults (0.6 / 0.85) — confirm and tune against real client documents. | PO |

---

## 9. Acceptance Criteria (PRD-level)

The Constitution Engine PRD is satisfied when:

- [ ] A user can build a domain taxonomy and instances on top of the shipped framework using
 **either** the chat panel **or** guided forms — no raw Turtle written by the user.
- [ ] Every committed change (structure, instance, glossary, brand, governance) goes through the
 **single** validated mutation entry point, is SHACL-validated on a clone, carries a PROV-O
 record (human-vs-AI authorship), and emits a PLAT-AUDIT-1 event.
- [ ] A compliance officer can describe a rule in plain English, have it encoded as a
 **tenant-scoped** SHACL shape, and see it enforced on subsequent edits — and confirm it does
 not affect another tenant.
- [ ] A business user can ask "what systems does our Revenue domain depend on?" and get an answer
 without writing SPARQL; with the AI offline, they can still query via the SPARQL editor and
 author via forms.
- [ ] An ontologist can write and execute raw **SELECT-only** SPARQL; a non-SELECT or `SERVICE`
 query is rejected before execution.
- [ ] Build reads brand tokens via CE-BRAND-1 and the graph at a pinned version via CE-READ-1
 without a Constitution change breaking it; the version diff (CE-DIFF-1) shows added/removed/
 modified nodes AND edges between two versions.
- [ ] A tenant-A JWT cannot read tenant-B triples via an unscoped SPARQL query (cross-tenant
 isolation test passes).
- [ ] All seven `CE-*` contracts are exposed at the shapes specified in Section 5.
- [ ] A populated client graph answers the shipped **framework competency-question set** (what
 a process consumes/produces, what runs it, who performs it, what governs it) plus the
 client's 2–5 declared domain competency questions.
- [ ] An agent-authority query returns the right answer from the modelled
 `governedBy`/`performedBy`/`accesses` links — an unstated permission defaults to deny, an
 explicit deny overrides authority, and a missing required link returns a coverage-gap row
 rather than an empty "permitted".
- [ ] (Post-MVP, prioritized) A user uploads an existing enterprise document and, through the
 chat panel, accepts agent-proposed additions **linked to existing graph resources**, each
 committed via CE-WRITE-1 with PROV-O attribution — populating the model without a blank page.

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Chosen OWL reasoner is intractable at 500k triples | High | Med | OQ-01; FR-007/FR-028 gate on it; reasoner budget (default 30 s) + fail-closed publish; fall back to consistency-check-only if materialisation is too costly. |
| Named-graph isolation leaks across tenants | High | Med | NFR Isolation names the mechanism + a mandatory cross-tenant-read test; OQ-04 picks the final mechanism (store-per-tenant favoured if rewriting proves fragile). |
| A second mutation path reintroduces the validation bypass | High | Med | FR-003 mandates exactly one entry point; CI test asserts no auto-apply / raw-Update write surface exists. |
| Performance thresholds prove wrong | Med | High | All flagged UNVERIFIED defaults (OQ-13); none is a hard GA gate. |
| AI-provider outage blocks all authoring | Med | Med | Forms + SPARQL stay live at 503 (FR-001/FR-018/FR-033). |
| Punning confuses downstream consumers expecting distinct URIs | Low | Med | B1 documented; CE-READ-1 returns the single punned resource; glossary UI presents both roles of one URI. |
| Ingest is sold as zero-effort but real documents/event logs are messy (low extraction quality, dirty event logs) | High | High | **Never promise zero-effort liveness**: ingest is AI-*assisted*, per-proposal human-reviewed, SHACL-gated; low-confidence flagged (default 0.6); ingest is materialised-copy, not live federation (Non-Goal #11); event-log ingest models OCEL data, not a mining guarantee (Non-Goal #10, OQ-14). |
| Ingest reintroduces a second, unvalidated mutation path | High | Med | Every Epic 12 path writes through CE-WRITE-1 only (FR-038–FR-042); CI asserts no ingest path bypasses prospective SHACL validation. |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [Weave Platform Brief](../../weave-platform/01-brief/brief.md)
- [Build Engine Brief](../../build-engine/01-brief/brief.md) — downstream consumer
- [Graph Explorer Brief](../../graph-explorer/01-brief/brief.md) — downstream consumer + visual layer

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
