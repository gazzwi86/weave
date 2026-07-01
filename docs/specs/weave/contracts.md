---
type: Reference
title: Weave Inter-Engine Contracts
description: "Canonical, single-source contract definitions that engines provide and consume. Every PRD's Inter-engine Interfaces section cites these by ID."
tags: [reference, contracts, architecture, inter-engine]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/weave/contracts.md
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# Weave Inter-Engine Contracts (canonical)

This is the **single source of truth** for the interfaces engines expose to and consume from
each other. PRDs MUST reference these by contract ID (e.g. `CE-WRITE-1`) rather than restating
or inventing endpoint names. Request/response shapes here are PRD-level (the OpenAPI/event
schemas are finalised in the tech spec); they are precise enough that a consumer can be specced
against them without guessing.

Contract IDs are stable; the underlying shape may evolve through tech-spec with a version bump.
Grounding citations point to the working prototype that proves the shape.

---

## 1. Constitution Engine (the contract hub)

CE is the upstream provider that Graph Explorer, Build, Events, Platform, and Onboarding all
depend on. CE owns and publishes ALL of the following.

### CE-READ-1 — Versioned read interface
- `GET /api/ontology/types` → registered node-kinds + relationship-types (the shipped
  process-centric **BPMO framework**) and any client-defined extensions.
  - **Kinds (13):** `Process`, `Activity` (task/step within a process), `Event` (trigger or
    boundary event), `DataAsset` (with `Field` for columns/attributes, and document/artefact
    content), `System`, `Service`, `BusinessCapability`, `BusinessDomain`, `Policy`
    (constraint/rule/regulatory-requirement/principle), `Goal` (motivation/driver/outcome),
    `Actor` (role/person/service-account identity), `Concept` (SKOS glossary term), `Class`
    (OWL type). `Concept`+`Class` are one punned resource (decision B1).
  - **Relationship types:** `performedBy` (Process/Activity→Actor), `consumes` and `produces`
    (Process/Activity↔DataAsset), `triggeredBy` (Process←Event), `hasStep`
    (Process→Activity), `dependsOn`, `runsOn` (Service→System), `accesses`
    (Service→DataAsset), `realizes` (Process→BusinessCapability), `servesGoal`
    (BusinessCapability→Goal), `inDomain`, `hasCapability`, `governedBy`
    (Process/DataAsset→Policy), `describes`, `partOf`, and SKOS `broader`/`narrower`/`related`.
  - This is a **framework, not a populated taxonomy** (decision A1): clients extend it with
    their own domain kinds/relationships. Aligned to ArchiMate 3; REA + UFO inform the design
    behind the curtain. Kind/relationship names and cardinalities are finalised in the CE
    data-model tech spec.
- `GET /api/ontology/resource/{iri}` → a single entity with its properties + edges.
- `GET /api/ontology/versions` → `[{version_iri, semver, published_at, is_latest}]`.
- `GET /api/sparql?version=<iri|latest>&page=<n>` — **SPARQL 1.1 SELECT-only**, `SERVICE`
  keyword blocked (SSRF), **paginated** (no silent row cap). `version=latest` resolves to the
  newest published version (default; downstream auto-tracks unless pinned).
- `POST /api/query/nl` → `{ question }` ⇒ `{ sparql, rows, columns, grounded_iris }` — a
  **natural-language → SELECT** surface (LLM drafts SPARQL, runs it SELECT-only, returns rows +
  the generated query for transparency). **Ships in M1** — it is the proof demo's
  cross-notation-reconciliation "wow" (one plain-language question answered across
  process + data + system + governance) and the business-user legibility entry point.
  - **Security:** the LLM-generated SPARQL passes through the **same single SELECT-only +
    `SERVICE`-blocked validator** as user-supplied queries — there is exactly ONE validator
    between any SPARQL string (regardless of origin) and the store. The NL path is **not** a
    separate code path and is **not** an SSRF bypass (CE tech-spec must assert this with a test).
- **Agent-grounding — what the BASE framework answers vs what needs the authority extension.**
  *(Honest scope — the 13-kind framework ships the join skeleton, NOT full authority resolution.)*
  - The base framework (`performedBy` / `governedBy` / `accesses` / `hasStep`) supports two
    queries directly: `escalation(process)` → the Actor(s) to contact/escalate to; and
    `coverage_gap(process)` → required links that are **absent** (a Process with no
    `performedBy`/`governedBy`), as explicit `{ entity_iri, missing_link }` rows. **`coverage_gap`
    is the M1-credible grounding query.**
  - **`governedBy` → `Policy` reaches a *described* rule (human-readable prose), not a
    machine-evaluable constraint.** Enforcement lives in SHACL shapes (CE-WRITE-1), not in Policy
    edges. Consumers MUST NOT expect machine-enforceable authority from a `governedBy` edge alone.
  - True `authority(actor, action, target)` resolution requires the **canonical Authority Extension**
    (an optional, generic add-on clients populate; obpm `mi-agent-model.ttl` is the reference):
    a `Permission`(action/effect/onEntity/requiresRole), `authorityLevel`, `HITLTrigger`
    (`escalatesTo`/`escalationDeadline`/`triggeredByStep`), and a `dataClassification` SKOS scheme.
    Without the extension populated, `authority()` **degrades to `coverage_gap` + `deny`** — it
    never returns an implicit allow. The extension's shape is finalised in the CE data-model tech
    spec; whether Weave ships it canonical or documents it as a client extension pattern is **CE
    OQ-AUTH-1** (architect decision).
  - Response convention: `{ rows: [...], decision: "permit"|"deny"|"coverage-gap" }`. Unstated
    permission ⇒ `deny`/route-to-human; explicit deny overrides inferred authority. The model
    expresses authority; the execution engine decides run-time action.
- **`automatable` property:** a SHACL-shaped boolean on `Activity`/`Process`, **default `false`**
  (absent ⇒ route-to-human). Part of the Authority Extension above; it is the safety hinge of the
  Events governance gate (`EA-AUTOMATION-1`); CE owns its shape and default so the safety invariant
  never rests on an undefined attribute.
- Grounding: `weave-prototype/backend/app/ontology/store.py:581-603` (SELECT-only, SERVICE block);
  `api/routes.py` (read routes); obpm `mi-agent-model.ttl` (authority/permission/HITL pattern).

### CE-WRITE-1 — Validated-operations write API  *(the contract three engines were missing)*
- `POST /api/operations/apply`
  - Request: `{ operations: [Op], actor: <service-principal IRI>, target: "draft" | <version_iri> }`
  - `Op` ∈ `add_node | update_node | add_edge | delete_node | delete_edge` (matches the LLM
    `propose_mutations` tool schema). New nodes carry a local `ref` resolved to real IRIs as
    edges in the same batch are applied. Dedup: case-insensitive `label`+`kind` match reuses the
    existing node id.
  - Behaviour: applied on a **throwaway clone**, SHACL-validated; commits only if no
    `sh:Violation` (Warning/Info are advisory). Every applied batch writes a PROV-O activity
    attributed to `actor`.
  - Response: `201 { activity_iri, applied_count, version_iri }` OR
    `422 { violations: [{ focus_node, path, severity, message }] }`.
  - Idempotency / conflict: duplicate-IRI create is reconciled to the existing node (not an error);
    callers may pass an idempotency key.
- Grounding: `validation/shacl.py`, `api/routes.py:365-483` (`_validate_prospective`, `apply_ops`);
  `llm/service.py:16-67,143-206` (MUTATION_TOOL, apply_operations, dedup).
- **Note:** the prototype's legacy `POST /api/llm/mutate` auto-apply path bypasses validation —
  it is NOT part of this contract. `POST /api/operations/apply` is the ONLY mutation entry point.

### CE-DIFF-1 — Version diff
- `GET /api/ontology/diff?from=<version_iri>&to=<version_iri>`
  → `{ added: [Node|Edge], removed: [Node|Edge], modified: [{ ref, kind, before, after }] }`
  — includes **edge** modifications (the prototype's client diff did not; this is server-side).
- Consumers: Graph Explorer (diff overlay), Build (artefact staleness).

### CE-VERSION-1 — Version metadata + canonical lag
- `GET /api/ontology/versions` (see CE-READ-1) is the single source for "latest".
- **Canonical version-lag** = count of published versions strictly between a consumer's pinned
  version and `is_latest`. Build/Events/Explorer/Platform all compute staleness from this — none
  re-implement it. "Stale" default threshold = lag ≥ 2 (configurable).

### CE-EVENT-1 — Graph-change event stream
- CE emits change events: `{ change_type: "added"|"updated"|"deleted"|"constraint-violated",
  entity_iri, version_iri, actor, ts }`.
- Transport (SNS / WebSocket / change-feed) deferred to tech-spec.
- Consumers: Events (graph-change triggers — **Should Have**, degrade to polling CE-READ-1 with a
  since-version if the stream isn't ready), Platform (live activity/“draft-vs-published delta” widgets).

### CE-BRAND-1 — Brand → design-token projection + VoiceRule contract
- `GET /api/brand/tokens` → flattened design-token JSON (colour, type scale, spacing, radii…)
  projected from the RDF brand individuals — so Build can consume tokens without parsing RDF.
- `GET /api/brand/voice-rules` → machine-evaluable VoiceRules. Each rule declares
  `{ id, severity: "critical"|"normal", assertion }` where `assertion` is mechanically checkable.
- **Conformance score (defined, so it is a buildable gate):**
  `score = (normal rules passed) / (total normal rules)`; **any failed `critical` rule = hard
  fail regardless of score.** Pass bar = score ≥ 0.90 (default, tunable) **and** zero critical
  failures. Replaces the prior undefined "≥90% adherence".
- Consumers: Build (compliant-by-construction generation). **Milestone:** CE-BRAND-1 and the Build
  conformance gate are **M2** (not M1 — the M1 proof ships with safety gates only:
  SAST/type/secret-scan/mutation). Resolves CE OQ-06.

### CE-METRICS-1 — Aggregate metrics for the Dashboard
- `GET /api/metrics/ontology` → `{ entity_count_by_kind, latest_version, draft_published_delta,
  shacl_errors_by_severity, owl_inconsistencies }`.
- Consumer: Platform fixed dashboard (M1, CE-sourced tiles); composable Generative Dashboard (M2+).

### CE-FUNCTION-1 — Ontology-bound function registry  *(resolves OQ-13 / Build-OQ-12 / EA-OQ-13)*
- **CE owns** the single registry of *ontology-bound functions*: named, typed, graph-aware logic
  units bound to a CE object-kind (e.g. `reorderStock(System, DataAsset) → Activity`). One
  definition, one owner, one version lineage — so Build and Events cannot diverge into conflicting
  primitives. **Decision made now; built in M2/v1.0** (not M1).
- `GET /api/functions` → `[{ fn_iri, name, bound_kind, signature, version_iri }]`;
  `GET /api/functions/{iri}` → full signature + grounding entity IRIs.
- Consumers: **Build** generates a typed binding into `BE-SDK-1` (one SDK method per function);
  **Events** references a function by `fn_iri` as an `EA-AUTOMATION-1` action; **Build/Events
  agents** invoke it as a tool. None of them defines or versions it — they all read CE.
- Grounding: obpm `mi-catalog` / `mi-agent-model`; net-new registry codegen in the CE tech spec.

---

## 2. Weave Platform (cross-cutting services)

### PLAT-AUDIT-1 — Immutable audit/provenance service  *(single system of record)*
- One platform-owned, append-only, tamper-evident log. Engines EMIT typed events; they do not
  keep independent signed stores. Build's decision-log and Events' run-log are **views/filters**
  over this service. CE PROV-O remains the semantic-model provenance AND writes a corresponding
  PLAT-AUDIT-1 entry.
- Event: `{ seq, ts, actor_principal_iri, engine, event_type, target_iri, diff_summary, signature }`.
- Append-only enforced at the **DB-constraint level**; deletes rejected by the database and the
  attempt itself logged. Single signing + storage scheme (resolves Platform OQ-09 = Build OQ-04 as
  ONE decision). Query + export (JSON/NDJSON) with signature-verification metadata.

### PLAT-NOTIFY-1 — Notification service
- One extensible service with an **open/registerable** notification-type taxonomy (NOT a fixed
  enum). Engines publish notification events; delivery in-app + Slack. Covers budget, SHACL
  violations, self-improvement, build state, HITL-gate fired, automation-failure, connector-degraded,
  onboarding-activation, etc. Resolves Events OQ-05 (= reuse platform).

### PLAT-IDENTITY-1 — Agent service-principal registry
- One registry mints/scopes agent principal IRIs, including **dynamic per-automation** principals.
  Reconciles Platform's agent classes + Build's 5 dark-factory roles (Engineer/QA/Architect/Review/
  Sandbox) + Events' per-automation principals. The canonical principal IRI is used uniformly in
  PROV-O and every PLAT-AUDIT-1 entry. Least-privilege role-scope per principal.

### PLAT-CONNECTOR-1 — Managed connector contract
- v1 integrations (**7**): Snowflake · Databricks · S3 · Azure Data Lake ·
  **Atlassian (Jira + Confluence, one OAuth/connector family)** · ServiceNow · **Slack**.
- Exposes: a connector reference/handle model, a programmatic **health-status read API**
  (`status, last_sync, last_error, error_count`), and a data/event **delivery interface**.
  Credentials in AWS Secrets Manager only.
- Connector-data **ingestion into the graph** is a platform ingestion responsibility that writes
  via CE-WRITE-1 (resolves the duplicated Platform OQ-05 / CE OQ-05).

### PLAT-SETTINGS-1 — Tenancy & settings cascade
- Four-level cascade **Company → Domain → Workspace → Project**, tighter-wins precedence;
  loosening a parent-set constraint requires parent approval. Budget caps, policy, and RBAC resolve
  through this cascade. Exposes a settings-resolution read API (effective value + which level set it).

### PLAT-BILLING-1 — Metering
- Two billable dimensions: automation execution **per-run** AND AI generation/agent usage
  **per-token**. One metering pipeline; metering events never dropped (separate queue from run outcome).

---

## 3. Graph Explorer

### GE-CANVAS-1 — Embeddable canvas component
- A parameterised, embeddable graph canvas: props `{ source, filterByIri, mode: "force"|"c4",
  readonly, version }`. Supports the force-directed company graph AND the structured C4 view (v1).
- Consumer: Build embeds a **project-scoped slice** (`filterByIri = project IRI`) and writes project
  architecture updates back via CE-WRITE-1 (bidirectional sync). Explorer owns the component; Build
  manages its project portion.

---

## 4. Build Engine

### BE-ARTEFACT-1 — Generated-artefact provenance + write-back
- Generated artefacts (apps/agents/pipelines) carry a provenance header (spec ID, pinned CE version,
  referenced entity IRIs) and write new services/APIs/data-assets back to the graph via CE-WRITE-1
  with PROV-O attribution. Stale-indicator computed via CE-VERSION-1.

### BE-SELFIMPROVE-1 — Shared signal→issue→dispatch engine
- The reusable signal-collection + issue-draft + dark-factory-dispatch component. Configured by
  **Platform self-improvement** (Weave-the-product; approval = Weave-internal operators only) AND by
  Build **client-app self-healing** (E11; every fix is HITL-gated, no autonomous merge). Build E12 is
  folded into Platform's Weave-product self-improvement.

### BE-SDK-1 — Ontology→typed-SDK + standalone graph-surface OpenAPI generation
- Given a **pinned CE version** (`CE-VERSION-1`), Build generates two artefacts derived from the
  CE ontology types + SHACL shapes read via `CE-READ-1`:
  - **(a) A typed client SDK**, packaged as a **TypeScript/npm** package and a **Python/pip**
    package, so engineers consume the company graph through typed, ontology-derived classes and
    methods instead of hand-written SPARQL/HTTP.
  - **(b) A standalone OpenAPI 3.1 contract** describing the graph **query/write surface** — a
    generated *client-facing* contract wrapping `CE-READ-1` / `CE-WRITE-1`, NOT a redefinition of
    CE's own API; it is versioned to the pinned CE version and shipped alongside the SDK.
- **Ontology→type mapping (the package shape):**
  - a SHACL **node shape** → a **typed class**;
  - the shape's declared **properties** → **typed fields** (datatype + cardinality taken from the
    shape constraints);
  - a named **SPARQL SELECT** → a **typed query method** on the relevant class/client.
- **Versioning + provenance:** both artefacts are versioned to the pinned CE `version_iri` and carry
  the `BE-ARTEFACT-1` provenance header (spec ID, pinned CE version, referenced entity IRIs).
  **Regenerable** when `CE-DIFF-1` reports a delta since the pin (regenerated package gets a bumped
  tag; the prior package is retained so a client may pin an older SDK).
- **Ownership:** the generated SDK + OpenAPI contract are **client-owned and forkable** — emitted as
  portable source into the project repo (consistent with Build's portable-code goal); Weave does not
  gate the client's fork.
- **Failure mode:** if `CE-READ-1` is unreachable or the pinned version's SHACL shapes cannot be
  resolved, generation fails atomically (per Build E8-S1) with the unresolved shape/version named —
  no partial package is emitted.
- Consumers: client engineering teams (consume the generated graph SDK); downstream apps Build
  generates.
- Grounding: **new capability — no prototype grounding.** Source of the type model is `CE-READ-1`
  (ontology types + SHACL shapes); the package/contract codegen is net-new in the Build tech spec.

---

## 5. Events & Actions Engine

### EA-AUTOMATION-1 — Two-tier automation model
- **Simple tier:** declarative JSON (SNS/SQS-style event→action), runtime-interpreted.
- **Complex tier:** Anthropic Agent SDK agentic actions/triggers (reasoning, multi-step) — supported
  in v1 as action/trigger types.
- Execution: interpreter-first in v1; portable Agent-SDK artefact **export** is a fast-follow.
- Every automation is grounded in a CE entity (CE-READ-1) and pinned to a version (CE-VERSION-1);
  graph updates go through CE-WRITE-1; graph-change triggers consume CE-EVENT-1; runs metered via
  PLAT-BILLING-1 (per-run) and audited via PLAT-AUDIT-1.

---

## Ownership matrix (who builds what)

| Concern | Owner | Consumers |
|---|---|---|
| Ontology read/write/diff/version/events/brand/metrics | **Constitution Engine** | Explorer, Build, Events, Platform, Onboarding |
| Audit/provenance log (one service) | **Platform** | CE, Build, Events |
| Notifications | **Platform** | all engines |
| Agent identity registry | **Platform** | CE, Build, Events |
| Managed connectors + ingestion | **Platform** | Events, Build, CE |
| Tenancy/settings cascade + billing | **Platform** | all engines |
| Graph canvas component | **Graph Explorer** | Build |
| Weave-product self-improvement | **Platform** (Build E12 folded in) | — |
| Client-app self-healing | **Build** (E11, always HITL) | — |
| Hammerbarn seed (live-pipeline built) | CE/Build/Events produce; **Onboarding** integrates | — |
