---
type: Spec
title: "Weave — Personas & the Persona↔Graph Loop"
description: "Program-level persona map: how each persona feeds the ontology and consumes it, with every claimed capability tagged against the current specs (FR/contract ID + milestone, partial, or gap). Feeds gap items into /po; does not restate the canonical RBAC table."
tags: [weave, personas, program, gaps]
status: Active
timestamp: 2026-07-02T00:00:00Z
resource: docs/specs/weave/personas.md
source: hand-authored (refined from user draft against specs @ e93d9ac)
confirmed_by: gazzwi86
confirmed_on: 2026-07-02
last_verified_sha: e93d9aca5c8ca5246f49eead55911d9e9acb43cb
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# Weave — Personas & the Persona↔Graph Loop

**What this document is.** A refinement of the persona thinking into a form the specs can absorb. The
**canonical RBAC role table lives in `engines/weave-platform.md` §"Canonical human roles"** (9 in-tenant
roles + super admin + agent principals) and is not restated here. This document adds what that table
doesn't carry: per-persona *feed* (what they put into the graph) and *consume* (what they get out),
each tagged against the current specs.

**Tags used below:**

- `[SPECCED — <ID>, <milestone>]` — exists as a requirement/contract today.
- `[PARTIAL — <ID>]` — an adjacent mechanism exists but doesn't cover the claim.
- `[GAP]` — not in any spec; collected in §4 as candidate new scope.

---

## 1. The persona↔graph loop (corrected framing)

Every persona both **feeds** the ontology and **consumes** it. The specs already commit to a single,
non-negotiable shape for the *feed* side — and it is **not** a RAG pipeline:

> Any input (document, diagram, schema, chat message) → agent **extracts candidate BPMO
> entities/relationships** → proposals surfaced with plain-English explanations → **per-proposal human
> accept/reject (HITL)** → prospective SHACL validation on a throwaway clone → commit via `CE-WRITE-1`
> with **PROV-O attribution** (LLM as extractor, human as approver, source document as `prov:used`).

This is EPIC-012 (`constitution-engine.md` FR-038–FR-042, v1.0 "Cold-Start Ingest") plus the MVP chat
path (FR-030 CSV, FR-033 paste-a-document). Every ingest path writes through `CE-WRITE-1`; a CI test
asserts nothing bypasses SHACL. The graph itself — queried via `CE-READ-1` (NL→SPARQL, grounding
queries) — is the retrieval substrate agents reason inside.

**Corrections to the draft premise:**

1. **"Graph RAG ingestion pipeline" is not specced and partly conflicts with the design.** S3 Vectors
   appears in the stack only as plumbing (`weave-spec.md` §2.3, ADR-001 tenant prefix); no
   embedding/retrieval flow is specced anywhere. The specs deliberately made the *validated graph* the
   thing agents consume, not a parallel vector index of raw documents. There is still a real, missing
   capability underneath the idea: **source documents remaining queryable after ingestion** (so an
   agent building the ontology can consult the original BPM doc, not just the extracted triples). That
   is a candidate **document-corpus companion store** (embeddings over ingested artefacts, linked to
   the graph via `prov:used`) — proposed as new scope, §4.1. It must be an *aid to extraction and
   Q&A*, never a second write path around `CE-WRITE-1`.
2. **"User provides context for each item before it is ingested" is a gap.** Provenance today is
   *system-captured* (who/what/when, source doc). There is no FR for a user supplying pre-ingestion
   metadata — source system, owner, sensitivity, date-of-truth, business context. §4.2.
3. **The SME follow-up loop is a gap with one dangling mention.** `constitution-engine.md` names
   "questionnaire/interview elicitation" as a nav item only — no FR, epic, or story behind it. Agents
   asking *inline clarifying questions* is specced (CE NL-query FR-018 MVP; Events FR-005/FR-006); the
   full loop — agent drafts SME questions → suggests recipients from the org chart (already modelled
   as CE content) → human confirms → share-link questionnaire → answers become new proposals — is not.
   §4.3.

---

## 2. Personas

The draft's six personas map onto the canonical roles as follows. Roles the draft doesn't cover
(workspace admin, ops/SRE, automation author, brand/content owner, viewer/exec sponsor) already exist
in the canonical table and are omitted here deliberately — this doc refines the *authoring-heavy*
personas that feed the ontology.

### 2.1 Business analyst / SME (canonical role: Business analyst / SME — `author-instances`)

**Mission:** analyse the company domain by domain; get what's in people's heads and process documents
into the graph.

**Feeds:**

- Upload process documents (BPM docs, policies, runbooks, bodies of text) → agent-extracted proposals
  `[SPECCED — FR-038 conversational doc ingest, v1.0; FR-033 paste-a-document, MVP]`
- BPMN / flow-chart / sequence / state diagrams → structured import (BPMN/ArchiMate)
  `[SPECCED — FR-039, v1.0]`; any diagram as image via vision extraction `[SPECCED — FR-040, v1.0]`
- Implicitly-captured systems, services, APIs, people, departments from those documents — extraction
  targets the full BPMO kind set, so this falls out of FR-038/FR-040 rather than needing its own path
  `[SPECCED — EPIC-012 AC, v1.0]`
- Instance data + glossary terms via forms/chat `[SPECCED — FR-030/FR-033 + author-instances, MVP]`

**Consumes:** NL cross-cutting query `[SPECCED — CE-READ-1 NL query, M1]`; Explorer navigation
`[SPECCED — GE-CANVAS-1, M1]`.

**Prompt for fixes/amends to the ontology:** the chat authoring loop — NL → proposals → per-proposal
accept/reject → commit `[SPECCED — FR-033 + E11-S3 explanations, MVP]`.

### 2.2 Product owner (canonical role: PO — Build engine persona) and 2.3 Enterprise architect

> The draft merges these; the specs (correctly) split them: the **PO** is a Build-engine persona
> (intake, spec approval, phase gates), the **Enterprise architect** is the CE/Platform persona
> (`author-ontology` + `author-shapes` + `publish`). Note also a naming drift to fix: Build calls its
> persona "Technical architect" while Platform/CE/Onboarding say "Enterprise architect" (§5).

**Feeds (PO):**

- Generate specifications in collaboration with AI; approve them
  `[SPECCED — Build E1 Request Studio intake + spec-approval HITL gate, M1]`
- Manage backlogs; work across multiple products quickly
  `[SPECCED — Build v1.0 PM surfaces: E2 Project Registry, E4 Kanban, E5 Task Brief UI]`
- NL prompt for fixes/amends to specs and the ontology
  `[SPECCED — Build follow-up edits + CE chat loop; MVP–v1.0]`
- Brainstorm / ideate / explore / vibe-code prototypes
  `[GAP — no ideation or prototyping-mode capability anywhere in the specs; §4.5]`

**Consumes (PO + Architect):**

- Explore business rules and processes their product touches — impact/dependency drill-in
  `[SPECCED — CE-READ-1 grounding queries M1; Explorer impact overlays M2]`
- Research existing systems/APIs their product can consume or replace
  `[SPECCED — NL query over System/Service/API kinds, M1; richer once connectors land, v1.0]`
- Find and apply compliance/risk framework requirements from a quick search
  `[SPECCED — NL query + governance shapes FR-025; policy coverage via coverage_gap, M1]`
- Find innovation opportunities through the ontology/system landscape with AI assist
  `[GAP — ideation assistance absent; nearest is the NL "wow" query; §4.5]`
- Research prior specs, designs, code in research phases
  `[PARTIAL — generated artefacts and decision logs are in Build (E7 decision-log UI, v1.0); arbitrary
  prior-document research needs the document corpus, §4.1]`

**Feeds (Architect):** ontology structure, types, restrictions, SHACL shapes
`[SPECCED — author-ontology/author-shapes RBAC FR-031, MVP]`.

### 2.4 Engineer (canonical role: Engineer / developer — read model + build)

**Feeds:**

- Build agentic engineered deliverables — apps, APIs, pipelines — via the dark factory; artefacts
  write back to the graph `[SPECCED — Build M1 loop + BE-ARTEFACT-1; agents/pipelines post-v1]`
- Produce ADRs `[SPECCED — Build E7 decision log, v1.0]`
- Create/update tests and tasks `[SPECCED — Build task pipeline + QA-agent DoD gate FR-047, M1–M2]`
- Vibe-code prototypes `[GAP — same as PO; §4.5]`

**Consumes:**

- Work across products via project registry/Kanban `[SPECCED — Build v1.0]`
- Code review `[SPECCED — QA agent + no-self-approval invariant FR-026, M1]`
- Analysis of application behaviour/code against ontology rules, spec rules, and company-wide
  expectations incl. brand tone of voice
  `[PARTIAL — brand-conformance gate CE-BRAND-1 ≥ 0.90 (M2) + reality-drift spec-vs-code table FR-057
  (post-v1) cover generated products; a general "audit my codebase against the ontology" capability
  for non-generated code is not specced; §4.6]`
- NL prompt for fixes to specs/ontology `[SPECCED — chat loop, MVP]`

### 2.5 Data steward / data engineer `[RESOLVED 2026-07-02 — added as the 10th canonical in-tenant role in weave-platform.md]`

No canonical role covers this today; the draft's data capabilities currently smear across BA/SME and
Engineer. Proposed as a 10th in-tenant role (or an explicit sub-profile of BA/SME + Engineer — decide
in /po).

**Feeds:**

- Schemas, column descriptions, relational/CMDB data → graph
  `[SPECCED — FR-041 R2RML/RML import, v1.0; FR-030 CSV with AI column-mapping, MVP]`
- Glossaries `[SPECCED — glossary authoring via author-instances + SKOS, MVP]`
- Data rules, requirements, quality expectations in NL/documents
  `[SPECCED — same ingest paths; rules land as SHACL shapes via architect/compliance review]`
- Data-flow / lineage / ERD / sequence diagrams
  `[PARTIAL — FR-040 vision extraction ingests them as BPMO entities; no dedicated lineage model or
  lineage-diagram semantics beyond consumes/produces edges]`
- Data provenance descriptions `[SPECCED — PROV-O spine FR-006, MVP]`
- Data classification frameworks
  `[PARTIAL — dataClassification SKOS scheme exists in the Authority Extension (ADR-002, M2); no
  ingestion path for a client's own framework document]`
- Identities (human + system) and their RBAC to data/DBs/schemas
  `[PARTIAL — the ontology models Actor/Role/Permission (ONT-4, M1→M2 ODRL); describing *external*
  system RBAC as graph content has no dedicated path — it's generic instance authoring]`
- Raw example data `[GAP — sample-data ingestion for grounding/validation is not specced]`
- Semantic-layer architecture, access tokens `[GAP — not specced; tokens must stay in Secrets
  Manager, never in the graph — model the *grant*, not the secret]`

**Consumes:** lineage/dependency traversal via NL query + Explorer `[SPECCED — M1/M2]`; generated
data products/pipelines `[SPECCED — Build, pipelines post-v1]`.

### 2.6 Risk / compliance officer (canonical role: Compliance / risk officer — `author-shapes` + audit read)

**Feeds:**

- Risk management framework, governance categories, policy constraints as enforceable rules
  `[SPECCED — governance SHACL shapes FR-025 + author-shapes RBAC, MVP]`
- NL expectations/logic/rules → shapes via the chat loop `[SPECCED — FR-033 path, MVP]`
- Identity and access rules `[PARTIAL — platform RBAC is fixed policy (FR-031); *modelled* authority
  rules arrive with ODRL Authority Extension, M2]`
- Risk registers, risk maps/heatmaps, cause-and-effect diagrams, assessments, incident reports,
  playbooks `[PARTIAL — ingestible only via the generic document/vision paths FR-038/FR-040; risk
  artefacts are not named source types and there is no Risk kind in the BPMO 13; §4.7]`
- The systems used to govern the org `[SPECCED — System/Service instance authoring + governedBy
  edges, MVP]`

**Consumes:**

- Query the ontology for rules `[SPECCED — NL query + CE-READ-1, M1]`
- Violation detection: SHACL contraventions on every write `[SPECCED — CE-WRITE-1, M1]`; scheduled
  self-audit gap queries `[SPECCED — FR-026, MVP/P4]`; coverage_gap grounding query
  `[SPECCED — CE-READ-1, M1]`; compliance dashboard `[SPECCED — Platform dashboard, M2]`;
  automation-run audit reports `[SPECCED — Events FR-033/EPIC-009, post-v1]`
- Agents querying **active systems** (not just the graph) to find violations
  `[GAP — requires connectors (v1.0) + Events (post-v1); no FR ties them into a "scan reality for
  violations" capability; §4.8]`
- Generate diagrams and documentation from the ontology
  `[PARTIAL — Explorer views/saved views (M1/M2) and Build anatomy/wiki for generated products (M2);
  no general "export governance documentation from the graph" FR]`

---

## 3. Demonstrating the value of the ontology (mapped to specs)

All five value claims from the draft, against what's specced — and when Hammerbarn can carry each:

| Value claim | Spec status | Hammerbarn-demonstrable |
|---|---|---|
| Find design↔build misalignment (monitoring, components) | `[PARTIAL — FR-057 reality-drift spec-vs-code table, post-v1; CE-VERSION-1 lag + CE-DIFF-1 staleness, M1/M2]` | post-v1 |
| Find compliance violations in built projects | `[SPECCED — SHACL on write M1 · FR-026 self-audit MVP · coverage_gap M1 · compliance dashboard M2]` | **M1–M2 (strongest early proof)** |
| Harden products and specs against ontology rules | `[PARTIAL — compliant-by-construction generation + safety gates M1; CE-BRAND-1 conformance gate M2; no spec-document hardening feature]` | M2 |
| Auto-update ontology/docs/processes as systems change | `[PARTIAL — BE-ARTEFACT-1 write-back M1, CE-EVENT-1 change stream M2, doc-refresh in phase ceremony; deliberately HITL-gated — drift is *surfaced*, never auto-applied]` | M2 (surfaced), post-v1 (propagation) |
| Assist in ideation | `[GAP — absent from all specs; §4.5]` | — |

**Hammerbarn sequencing reality:** the CE + Explorer Hammerbarn content ships in the M1 window; the
full demo (Kitchen Designer app + example automations) is post-v1-gated on Build/Events GA; the
entity content itself lives in the not-yet-written **Hammerbarn Content Brief**
(`onboarding-content-brief.md`). If the value-demonstration pack above should be *shown in
Hammerbarn*, each row's scenario belongs in that content brief — add it when the brief is authored.

---

## 4. Gaps → candidate new scope (route through /po per engine)

Ordered by leverage. **Dispositions recorded 2026-07-02** (ratified by owner): items 1, 2, and 4 are
committed scope; the rest are recorded candidates in their owning engine specs.

1. **[COMMITTED 2026-07-02 → CE v1.0, FR-043, ADR-003]** **Document corpus companion store (the defensible core of the "Graph RAG" idea).** Ingested
   artefacts stay retrievable (S3 + embeddings in S3 Vectors), linked to graph entities via
   `prov:used`, so extraction agents and NL query can consult sources — answers cite both graph IRIs
   and source passages. Read-side only; never a write path around `CE-WRITE-1`. → CE (extends
   EPIC-012), v1.0-adjacent. Needs an ADR (new retrieval infrastructure).
2. **[COMMITTED 2026-07-02 → CE v1.0, FR-044]** **Pre-ingestion context capture.** A lightweight metadata step on upload (source system, owner,
   date-of-truth, sensitivity, free-text context) stored as PROV-O/annotation properties on the
   ingest activity; the extractor prompt consumes it. → CE EPIC-012, small FR.
3. **[RECORDED CANDIDATE → constitution-engine.md §2.1 ingest notes]** **SME interview loop.** Agent drafts follow-up questions from extraction gaps → suggests
   recipients from the org chart (already CE content) → human confirms → share-link questionnaire
   (extend the existing share-link pattern) → answers re-enter as proposals through the same HITL
   path. Converts the dangling "questionnaire/interview elicitation" nav item into an epic. → CE,
   v1.0/post-v1.
4. **[RESOLVED 2026-07-02 → 10th canonical role in weave-platform.md; Technical onboarding path]** **Data steward persona.** Add to the canonical role table (or explicitly profile onto BA/SME +
   Engineer) with the §2.5 feed/consume set; decide whether lineage semantics beyond
   consumes/produces edges are needed. → Platform (role table) + CE.
5. **[RECORDED POST-V1 CANDIDATE → build-engine.md §Post-v1 candidates]** **Ideation / prototyping mode.** "Explore the landscape, find whitespace, vibe-code a throwaway
   prototype grounded in the graph." Biggest genuinely-new surface; likely a Build-engine mode
   distinct from the dark factory (speed over gates, explicitly non-writing-back). → Build, post-v1
   candidate — or explicitly declare a non-goal.
6. **[RECORDED CANDIDATE → build-engine.md §Post-v1 candidates]** **Ontology-conformance audit for non-generated code.** "Point Weave at an existing repo and check
   it against the ontology/spec/brand rules." Extends FR-057 beyond Build-generated products. →
   Build, post-v1 candidate.
7. **[RECORDED CANDIDATE → constitution-engine.md §2.1 ingest notes]** **Risk artefact ingestion.** Name risk registers/assessments/heatmaps as first-class source types
   (mapping tables for common register formats); decide whether Risk becomes a client-extension kind
   pattern or stays Policy/Goal instances. → CE EPIC-012 extension.
8. **[RECORDED CANDIDATE → events-actions-engine.md §2.3b]** **"Scan reality for violations."** Agents traverse connector-reachable systems and reconcile
   against graph rules (the risk officer's active-system check). Depends on `PLAT-CONNECTOR-1`
   (v1.0) + Events (post-v1). → Events/Platform, post-v1.

## 5. Spec inconsistencies to fix (found during this pass)

Small, mechanical; fix in place rather than via /po. **All six fixed 2026-07-02:**

1. *(Fixed — table relabelled "10 in-tenant roles + Weave super admin (out-of-band)"; onboarding
   counts updated to 10, incl. the new data steward role.)*
2. *(Fixed — brand/content owner restored to the platform PRD personas table.)*
3. *(Fixed — the five were already enumerated in `contracts.md` §PLAT-IDENTITY-1 (Architect /
   Engineer / QA / Review / Sandbox); `build-engine.md` now names them and notes the orchestrator
   is not a principal.)*
4. *(Fixed — canonical display name is **Enterprise architect**; Build and Explorer annotate their
   local aliases and `weave-platform.md` carries the engine-persona → canonical-role mapping table.)*
5. *(Fixed — mapped in the `weave-platform.md` engine-persona → canonical-role table; delivery
   manager = viewer/stakeholder with author access on Build surfaces.)*
6. *(Fixed — CTO/exec sponsor is now `viewer` + billing/budget visibility; admin granted
   explicitly only when an exec actually administers.)*
