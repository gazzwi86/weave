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
  - **Relationship types (illustrative — `GET /api/ontology/types` is authoritative, never a
    hand-copied list per `ontology-standards.md`):** `performedBy` (Process/Activity→Actor),
    `consumes` and `produces` (Process/Activity↔DataAsset), `hasField` (DataAsset→Field),
    `triggeredBy` (Process←Event), `hasStep` (Process→Activity), `precedes`/`follows`
    (Activity→Activity step ordering, from BPMN sequenceFlow — CE ADR-013-adjacent), `dependsOn`, `runsOn`
    (Service→System), `accesses` (Service→DataAsset), `realizes` (Process→BusinessCapability),
    `servesGoal` (BusinessCapability→Goal), `inDomain`, `hasCapability`, `governedBy`
    (Process/DataAsset→Policy), `describes`, `partOf`, and SKOS `broader`/`narrower`/`related`.
    The shipped BPMO data-model table (CE tech spec) is the source; `/api/ontology/types` serves
    every relationship above **including `hasField`**.
  - **Kind descriptions (added 2026-07-08):** every framework kind carries a `skos:definition`
    (plain-language description) in the shipped ontology, surfaced as a `description` field per
    kind in this response. Consumers (GE side panel, CE authoring surfaces) render it rather than
    hand-copying glossary text. Authored + exposed by CE v1 TASK-011.
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
  - **Citations (CE v1, additive, per CE ADR-011):** the response MAY carry an optional
    `citations` array — each entry pairs `entity_iri` + `artefact_iri` + `passage_id` + a source
    locator (page / heading-path / char-range) + a ≤300-char snippet (FR-043: cite BOTH the graph
    IRI and the source text). Additive-only; the base `{ sparql, rows, columns, grounded_iris }`
    shape is unchanged, so M1/M2 consumers ignore it harmlessly.
  - **Security:** the LLM-generated SPARQL passes through the **same single SELECT-only +
    `SERVICE`-blocked validator** as user-supplied queries — there is exactly ONE validator
    between any SPARQL string (regardless of origin) and the store. The NL path is **not** a
    separate code path and is **not** an SSRF bypass (CE tech-spec must assert this with a test).
- **Agent-grounding — what the BASE framework answers vs what needs the authority extension.**
  *(Honest scope — the 13-kind framework ships the join skeleton, NOT full authority resolution.)*
  - The base framework (`performedBy` / `governedBy` / `accesses` / `hasStep`) supports two
    queries directly: `escalation(process)` → the Actor(s) to contact/escalate to; and
    `coverage_gap(kind, required_links[])` → entities of `kind` missing one or more of
    `required_links`, as explicit `{ entity_iri, missing_link }` rows (one row per absent link).
    The **default invocation** is `coverage_gap(Process, [performedBy, governedBy])`; consumers
    pass other pairs (e.g. `(BusinessCapability, [ownedBy])`) — the row shape is unchanged. Which
    predicates are "required" per kind is named by each consumer, not hard-coded in the query.
    **`coverage_gap` is the M1-credible grounding query.**
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
  - Idempotency / conflict: duplicate-IRI create is reconciled to the existing node (not an error).
    Callers MAY pass an idempotency key, with pinned semantics: (a) the key is **unique per tenant**;
    a replay within the window returns the **original stored `201 { activity_iri, version_iri }`** —
    no re-apply, no new version. (b) Window = **24h default, tunable** (crash-recovery is hours, not
    months); an expired key is treated as a new request. (c) Same key + **different payload → `409`**
    (key-reuse error) — never a silent divergence.
  - **Referential integrity:** CE applies exactly the submitted ops — there is no server-side
    cascade beyond them. Integrity is enforced by SHACL at commit: ops that leave a dangling
    reference (where shapes forbid it) fail the whole batch with `422`. A deleting client must
    therefore submit the incident-edge deletes too; it should first read incident edges (CE-READ-1)
    that lie outside its loaded slice, or an otherwise-valid delete can surprise-`422`.
  - **Concurrency (M2 → v1):** M2 has no conditional write — concurrent applies both commit (each a
    new CE-VERSION-1 version), so lost-update protection is the caller's (a client-side
    since-version drift warning). **Planned additive v1 enhancement:** an OPTIONAL
    `expected_version` request field → `409 { current_version_iri }` when the base moved, giving
    true server-side lost-update protection inside CE's already-serialised commit path. Non-breaking
    (absent field = current behaviour); downstream editors (GE canvas, Events) should design toward
    it rather than inventing bespoke guards.
- Grounding: `validation/shacl.py`, `api/routes.py:365-483` (`_validate_prospective`, `apply_ops`);
  `llm/service.py:16-67,143-206` (MUTATION_TOOL, apply_operations, dedup).
- **Note:** the prototype's legacy `POST /api/llm/mutate` auto-apply path bypasses validation —
  it is NOT part of this contract. `POST /api/operations/apply` is the ONLY mutation entry point.

### CE-DIFF-1 — Version diff
- `GET /api/ontology/diff?from=<version_iri>&to=<version_iri>`
  → `{ added: [Triple], removed: [Triple], modified: [Modification] }`
  where `Triple = { subject, predicate, object }` and
  `Modification = { subject, predicate, before, after }` (`before`/`after` are the old and new
  **object values** for that subject+predicate — not nested Triples) — a flat RDF triple set that
  **includes edge modifications** (the prototype's client diff did not; this is server-side).
- *Amended 2026-07-05 (human-approved):* the original `Node|Edge` / `{ref, kind, before, after}`
  shape presupposed a node/edge distinction that has no first-class existence at the RDF triple
  level. Consumers derive any node/edge grouping client-side; if a server-side grouped projection
  proves necessary for the Explorer diff overlay, it is added as an additive optional view — never
  by changing this base shape. Authoritative response schema:
  `packages/backend/src/weave_backend/schemas/ontology.py::DiffResponse` (CE ADR-002).
- **Breaking-span (additive):** the response also carries `versions: [{ version_iri, breaking }]` —
  the **ordered** published-version span `from → to`, each flagged with its `breaking` bool — so a
  consumer asks "did anything breaking land between my pin and latest?" in ONE call
  (`any(v.breaking)`), instead of three engines each re-fetching ordered versions and slicing. Base
  triple shape (`added`/`removed`/`modified`) is untouched.
- **Shape-break detection lives in CE at publish time** (one owner, one rule set): CE computes each
  version's `breaking` flag from BOTH function-signature changes (CE-FUNCTION-1 / ADR-009 classes)
  AND shape/kind surface changes — a property removed or retyped, a cardinality tightened, a kind
  removed (unstated class defaults to breaking, same precedent ADR-009 set). Build MUST NOT parse
  SHACL diffs to decide breakingness — that re-implements CE's ontology semantics.
- Consumers: Graph Explorer (diff overlay), Build (artefact staleness — reads `versions[].breaking`,
  never derives it).

### CE-VERSION-1 — Version metadata + canonical lag
- `GET /api/ontology/versions` (see CE-READ-1) is the single source for "latest".
- **Canonical version-lag** = count of published versions strictly between a consumer's pinned
  version and `is_latest`. Build/Events/Explorer/Platform all compute staleness from this — none
  re-implement it. "Stale" default threshold = lag ≥ 2 (configurable).

### CE-EVENT-1 — Graph-change event stream
- CE emits change events: `{ change_type: "added"|"updated"|"deleted"|"constraint-violated",
  entity_iri, version_iri, last_published_version, actor, ts }`. **Publish events carry the real
  CE-VERSION-1 `version_iri`; draft-commit events carry `version_iri: null` plus
  `last_published_version`** (the last published CE-VERSION-1 IRI, or null if never published) —
  version IRIs and graph IRIs are different namespaces; a consumer dereferencing `version_iri`
  must never receive a draft graph IRI.
- **Beta transport (M2, ADR-008):** tenant-scoped transactional change-feed — one event row written
  in the same transaction as the commit, read via `GET /api/events?since_seq={n}&limit={m}` (ordered,
  plus `latest_seq`; per-tenant monotonic `seq` is additive to the event shape). Retention 30 days
  (default, tunable via PLAT-SETTINGS-1); an aged-out cursor gets `410 Gone` and re-baselines via
  CE-READ-1 — never a silent empty page. Push fan-out (SNS/WebSocket) is a post-v1 additive upgrade
  reading this feed as its outbox.
- Consumers: Events (graph-change triggers — **Should Have**), Graph Explorer (live canvas
  refresh — polls the seq feed for draft + published deltas), Platform (live
  activity / “draft-vs-published delta” widgets). **There is no separate "since-version poll on
  CE-READ-1" fallback** — the seq feed above IS the polled transport (it is polling by
  construction, covers DRAFT commits via `version_iri: null` rows, and degrades via `410 Gone`
  → re-baseline on CE-READ-1). A consumer that isn't ready for push simply reads the seq feed;
  it does not invent a version-filtered read that does not exist.

### CE-BRAND-1 — Brand → design-token projection + VoiceRule contract
- `GET /api/brand/tokens` → flattened design-token JSON projected from the RDF brand individuals —
  so Build can consume tokens without parsing RDF. **Shape = closed core + extensions:** closed
  core `{ color, typography (fontFamily + scale), spacing, radius }` is the stable Build-codegen
  target (adding a core field = contract amendment); `extensions` is an open namespaced map that
  passes through untyped. Build M2 codegens only the closed core.
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
- `shacl_errors_by_severity` **and `owl_inconsistencies`** MAY be `{ "pending": true }` when counts
  for the current graph state are not yet computed (`owl_inconsistencies` has no producer until the
  post-v1 reasoner lands, so it is `pending` through v1). Consumers MUST render a pending state,
  never zeros (honesty rule — a `0` count would read as "no violations", a false-health signal both
  engines' specs ban).
- Consumer: composable Generative Dashboard (M2+). The **M1 fixed dashboard** is hand-composed
  CE-sourced tiles and does **not** consume this contract — CE-METRICS-1 lands M2.

### CE-FUNCTION-1 — Ontology-bound function registry  *(resolves OQ-13 / Build-OQ-12 / EA-OQ-13)*
- **CE owns** the single registry of *ontology-bound functions*: named, typed, graph-aware logic
  units bound to a CE object-kind (e.g. `reorderStock(System, DataAsset) → Activity`). One
  definition, one owner, one version lineage — so Build and Events cannot diverge into conflicting
  primitives. **Decision made now; built in M2/v1.0** (not M1).
- **Typing model (ADR-009):** a function is a `weave:Function` individual in the tenant's graph;
  each parameter and the return reference a **BPMO kind IRI** (per `GET /api/ontology/types`,
  CE-READ-1) plus an optional `sh:NodeShape` constraining accepted nodes. Written via CE-WRITE-1
  (single mutation entry point — SHACL + PROV-O apply). **RDF is the single source of truth**; CE
  derives a **JSON-Schema projection** per signature (CE-BRAND-1 pattern: derived on read/commit,
  never hand-edited, never allowed to diverge — guarded by a projection round-trip contract test).
  Build codegen and agent tool schemas consume the JSON Schema; SPARQL consumers query the RDF.
- `GET /api/functions` →
  `[{ fn_iri, name, bound_kind, signature, version_iri, status, breaking }]`;
  `GET /api/functions/{iri}` → full RDF-level signature (kind/shape IRIs) + grounding entity IRIs
  + the derived JSON Schema.
- **Versioning (ADR-009):** functions version **with the graph** — `version_iri` IS the
  CE-VERSION-1 version IRI; no per-function lineage. A published signature is **immutable
  in-place**: a signature change lands as a new graph version with `breaking: true`
  (param added/removed/retyped or return changed = breaking; label/description = not; an unstated
  change class defaults to breaking). `breaking: true` on a version means **that version introduced
  a breaking change vs the previous published version**. Build SDK codegen refuses to regenerate across
  `breaking: true` without explicit human acknowledgement. `status: "active" | "deprecated"` —
  Events must not bind **new** automations to a deprecated function; existing references resolve.
- **Milestone split (ADR-009, pinned; execution deferred 2026-07-08):** **M2 = the CE surface
  complete** — definition + revision via CE-WRITE-1, both `GET` endpoints incl. derived JSON Schema,
  breaking/deprecation semantics live; Build *starts* typed-binding codegen against this surface.
  **Execution — invocation semantics, implementation residence, runtime binding, SDK generation at
  scale — is deferred to POST-V1**, built alongside its only consumer (the Events & Actions engine,
  post-v1). Rationale: no v1.0 caller exists (Build v1 does not invoke functions), so shipping a
  runtime at v1.0 would be speculative. CE v1.0 = document-corpus ingest (EPIC-012) only. Nothing
  about *executing* a function is M2 **or v1.0**.
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
- **Query filters:** `engine`, `event_type`, `actor_principal_iri`, `target_iri`, time range, plus a
  `q` substring filter (case-insensitive, matched against `diff_summary` and `target_iri`; plain
  ILIKE at v1 — no ranking/fuzzy; full-text is an additive upgrade). Consumers (e.g. Build's
  Decision Log) use `q` server-side rather than paging the whole log to search client-side.
- **`event_type` naming:** a dotted `{engine}.{noun}.{verb}` namespace convention (e.g.
  `ce.version.published`, `build.artefact.generated`) — no fixed enum, no registry at v1; the
  convention is the contract. Filter by prefix (`event_type=ce.*`) for an engine's audit slice.
- **Altitude — audit is NOT operational telemetry.** This is an immutable tamper-evident
  provenance log; error/retry/latency rates are high-volume ops signal and MUST NOT be pumped
  into the append-only signed store. Ops-health surfaces (e.g. Platform's ops dashboard) read
  CloudWatch metrics / the structured-log pipeline (weave-spec structured-log fields incl.
  `latency_ms`, `tenant_id`; CE M1 already emits CW metrics) — not PLAT-AUDIT-1.

### PLAT-NOTIFY-1 — Notification service
- One extensible service with an **open/registerable** notification-type taxonomy (NOT a fixed
  enum). Engines publish notification events; delivery in-app + Slack. Covers budget, SHACL
  violations, self-improvement, build state, HITL-gate fired, automation-failure, connector-degraded,
  onboarding-activation, etc. Resolves Events OQ-05 (= reuse platform).
- **Email channel (SES) is post-v1** (user ruling 2026-07-08). The email-digest preference exists in
  the data model but is UI-gated (hidden/disabled) until the channel ships — never silently ignored.
- **Publish notification (2026-07-08):** CE version publish emits `ontology.version.published`;
  the service notifies **all active tenant members except the publisher** (in-app bell; email
  follows the channel above post-v1).

### PLAT-IDENTITY-1 — Principal registry (human + agent)
- One registry mints/scopes canonical principal IRIs for **all actors**, human and agent.
- **Human principals** are minted at first Cognito login (M1 PLAT-TASK-004 AC-1):
  `urn:weave:principal:user:{cognito_sub}`, stored in Aurora, and embedded in the JWT
  `principal_iri` claim. Consumers needing the acting human's IRI (e.g. GE canvas edits →
  CE-WRITE-1 attribution) read the JWT `principal_iri` claim directly — no separate resolve call —
  or look up `GET /api/principals/{iri}` for the record.
- **Agent principals**: the same registry mints/scopes agent principal IRIs, including **dynamic
  per-automation** principals. Reconciles Platform's agent classes + Build's 5 dark-factory roles
  (Engineer/QA/Architect/Review/Sandbox) + Events' per-automation principals.
- The canonical principal IRI is used uniformly in PROV-O and every PLAT-AUDIT-1 entry.
  Least-privilege role-scope per principal.
- **Role / scope claim (single contracted source for mutation gates).** A principal's roles and
  project/domain grants are carried in the JWT as a `roles` claim (tenant + project/domain-scoped
  grants) and are authoritative for authorization; the full record is readable at
  `GET /api/principals/{iri}` (`{ iri, kind, roles, scopes }`). Effective RBAC for a given resource
  resolves through **PLAT-SETTINGS-1** (the cascade owns precedence). Every mutation gate (e.g.
  Build's publish/apply guards, GE canvas edits) reads THIS surface — it never invents a bespoke
  role lookup. *(Post workspace-drop the overlay is project/domain-role, not workspace-role.)*
- **Role vocabulary:** the normative enumeration is weave-platform.md §"Canonical human roles" —
  **10 in-tenant roles + the Weave super admin**, with project-scoped grants for non-senior users
  (tenancy realignment decision, 2026-07-08). This contract does not restate the table; engines
  cite it, never invent role names.

### PLAT-CONNECTOR-1 — Managed connector contract
- v1 integrations (**7**): Snowflake · Databricks · AWS · Azure Data Lake ·
  **Atlassian (Jira + Confluence, one OAuth/connector family)** · ServiceNow · **Slack**.
- Exposes: a connector reference/handle model, a programmatic **health-status read API**
  (`status, last_sync, last_error, error_count`), and a data/event **delivery interface**.
  Credentials in AWS Secrets Manager only.
- **Instance enumeration:** the connector list read returns one row per configured instance —
  `{ handle, connector_type, status }` — and IS the enumeration surface. Consumers (e.g. Build's
  external-binding dialog) enumerate via this read; manual handle entry is not a supported
  integration path.
- Connector-data **ingestion into the graph** is a platform ingestion responsibility that writes
  via CE-WRITE-1 (resolves the duplicated Platform OQ-05 / CE OQ-05).
- **Ingestion identity + idempotency (ADR-015/017):** ingested nodes carry
  `weave:externalId = "<connector_instance_handle>:<source_id>"` — scoped to the connector
  **instance** (not type), so two connectors of the same type (e.g. two Jira sites) never collide;
  parse first-colon-only. No `tenant_id` in the value (the graph is the tenant boundary). Ingestion
  batches and write-backs carry idempotency keys. Records mapping to a kind absent from the tenant
  ontology are **skipped (not batch-failed)** and **counted** — surfaced via the health-read API as
  a skipped-count dimension (sustained skips read as degraded); a later resync recovers them once
  the kind is added. Write-back v1 allowlist = **Atlassian + ServiceNow** only, reject-on-drift
  conflict policy; the other five connectors are read-only.
- **Milestone: the whole connector surface (config + health + ingestion) is deferred to v1.0**
  (post-MVP). The MVP/M1 platform delivers its unique value without external integrations; the
  seven managed connectors are the *extended* value and land at v1.0. Platform still *owns* the
  contract from M1 (it is one of the six `PLAT-*`), but nothing in M1 depends on a live connector.

### PLAT-SETTINGS-1 — Tenancy & settings cascade
- **Three-level cascade `Company → Domain → Project`** (plus a cross-tenant **super-admin**
  operator role), tighter-wins precedence; loosening a parent-set constraint requires parent
  approval. Budget caps, policy, and RBAC resolve through this cascade. Exposes a
  settings-resolution read API (effective value + which level set it).
- **Workspace level removed (2026-07-08 human decision).** A former Workspace-scoped setting
  **re-homes to its enclosing Domain**; on a re-home collision (a Domain row and a former
  Workspace row for the same key), the **tighter (more restrictive) value wins** — re-homing must
  never loosen an effective policy (that would be a security regression). See
  `.claude/memory/decision_tenancy-workspace-alignment.md`.
- **M1 transition (honest):** M1 shipped Platform code / RLS / JWT may still carry `workspace_id`;
  **these specs are authoritative for M2+**, and the M1 code refactor is a tracked follow-up (not
  yet landed). Until it lands, live M1 behaviour and these specs diverge on workspace by design —
  M2 briefs test against the spec, not the residual M1 column.

### PLAT-BILLING-1 — Metering
- Two billable dimensions: automation execution **per-run** AND AI generation/agent usage
  **per-token**. One metering pipeline; metering events never dropped (separate queue from run outcome).
- **Read surface:** `GET /api/billing/usage?group_by=engine|user|project&from=&to=&granularity=day`
  → `{ rows: [{ key, tokens, runs, cost }], as_of }`. `as_of` carries FR-034's last-known +
  timestamp lag semantics (metering is eventually-consistent — never present a stale figure as
  live). `granularity=day` gives the trend series. This ONE endpoint serves the dashboard spend
  widget (E2-S3), the FR-034 breakdown, and Build's per-project cost. **No budget/cap endpoints
  here** — caps resolve via PLAT-SETTINGS-1 (FR-035).
- **`cost` semantics (2026-07-08):** the dollar-conversion rate card is **post-v1** (user ruling).
  Until it ships, `cost` is `null` and consumers render the counts (`tokens`, `runs`) — never a
  fabricated dollar figure. Rate card lands with the post-v1 billing work.

---

## 3. Graph Explorer

### GE-CANVAS-1 — Embeddable canvas component
- A parameterised, embeddable graph canvas: props `{ source, filterByIri, mode: "force"|"c4",
  readonly, version }`. Supports the force-directed company graph AND the structured C4 view (v1).
- Consumer: Build embeds a **project-scoped slice** (`filterByIri = project IRI`) and writes project
  architecture updates back via CE-WRITE-1 (bidirectional sync). Explorer owns the component; Build
  manages its project portion.
- **`filterByIri` slice semantics (pinned — a locked contract with an undefined slice is worse than
  an unlocked one, Build M2 consumes it):** the slice = the node named by `filterByIri` plus the
  nodes reachable within the configured hop depth. An edge with **both endpoints inside** the slice
  renders normally; an edge with **one endpoint outside** (an incident/boundary edge) renders as a
  **stub marker** on the in-slice node (a "connects outward" affordance) — the out-of-slice node is
  NOT pulled in. Two conformant builds therefore return the **same** slice for the same input; this
  is asserted by the ge-canvas-1 conformance suite (no "both pass, different slice" ambiguity). This
  aligns with CE-WRITE-1's incident-edge rule (a deleting client already reads incident edges first).
- **M2 pin:** force mode only; exact prop types, behavioural semantics, and the conformance suite are
  pinned in `engines/constitution-engine/tech-spec/ge-canvas-1.md` — prop-surface changes after Build M2
  decomposition are contract amendments. c4 mode post-v1.

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
