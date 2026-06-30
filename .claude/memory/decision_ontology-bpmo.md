---
name: Weave ontology — the BPMO business brain
description: CE ships a process-centric BPMO framework (obpm-grounded), superseding the thin 8-kind core; includes the prototype-grounding correction
type: decision
created: 2026-06-30
---

Weave's Constitution Engine ships a **process-centric BPMO** (Business Process Management
Ontology) — the **"business brain"** — as the universal *upper framework* clients extend.
Processes sit at the centre, linked to the **data** they consume/produce, the **systems** that
run them, the **capabilities** they realize, the **governance/policies** that bound them, the
**goals** they serve, and the **actors/roles** that perform them. An agent reasons *inside these
bounds* — what to do, when, with which system, who to contact/escalate to.

**Framework kinds (~13; finalised in CE tech spec):** Process · Activity (task/step) · Event ·
DataAsset (+ Field) · System · Service · BusinessCapability · BusinessDomain · Policy
(constraint/rule) · Goal (motivation) · Actor (role/identity) · Concept (SKOS) + Class (OWL,
punned with Concept per decision B1). **Relationships:** performedBy · consumes · produces ·
triggeredBy · hasStep · runsOn · accesses · realizes · servesGoal · inDomain · hasCapability ·
governedBy · describes · partOf · SKOS broader/narrower/related. **Canonical set lives in
`docs/specs/_inter-engine-contracts.md` → CE-READ-1.**

**SUPERSEDES the earlier "thin 8 structural kinds" framing** (BusinessDomain/Capability/System/
Service/DataAsset/Field/Concept/Class). That set was a mistake — it was grounded in the simpler
`prototypes/weave-prototype` **UI** (`frontend/src/lib/colors.ts`), NOT the ontology model.
Decision A1 still holds ("Weave ships a FRAMEWORK, not a populated taxonomy"); the framework is
just the richer BPMO.

**Prototype-grounding correction (the key future-confusion guard):**
- **`prototypes/obpm/`** (ontology-based process modelling — `mi-process`, `mi-governance`,
  `mi-motivation`, `mi-catalog`, `mi-agent-model`, `mi-core`, `mi-glossary`, `mi-provenance`,
  `mi-constitution`) = the **authoritative ONTOLOGY reference** for the BPMO + agent-grounding.
- **`prototypes/weave-prototype/`** = the **authoritative IMPL reference** (Oxigraph store, SHACL
  staged validation, `propose_mutations` LLM mutation flow, Cytoscape canvas). Its UI node-kind
  set is a thin subset — do NOT treat it as the ontology model.

**Also decided 2026-06-30:**
- **Ingest pipeline** = first-class (post-MVP-loop, prioritized cold-start lever): **agent-driven
  conversational document ingest** (feed a BPM/policy/runbook → agent extracts → proposes via the
  chat panel, linked to existing resources → SHACL → human-approve → PROV-O), ArchiMate/BPMN model
  import, AI diagram→data, R2RML/RML structured data, SKOS cross-notation reconciliation.
- **Agent-grounding** is CE-provided: the graph states agent authority (obpm `mi-agent-model`);
  unstated → route-to-human; explicit deny overrides inferred authority.
- **Recorded doors, build NONE in v1:** OCEL 2.0 process-mining INGEST (OQ + Non-Goal: *ingest, do
  not build a miner/PQL*); REA / gUFO / OWL-Time opt-in extensions; UFO advise-not-enforce
  (sh:Warning/Info); virtual-graph SPARQL→SQL federation (OQ + pending ADR; current external
  ingestion = **materialised copy**, not query-time live).

**How to apply:** when modelling or referencing the Weave ontology, use the BPMO kind/relationship
set from CE-READ-1; ground *ontology* questions in `obpm`, *implementation* questions in
`weave-prototype`. Never reintroduce "8 kinds" as the shipped model. See [[decision_platform-strategy]].
