# Research Brief: Competitive & Conceptual Landscape for Weave

**Status:** Draft — awaiting HITL approval
**Owner:** Gareth (gazzwi86@gmail.com)
**Date:** 2026-06-26
**Audience:** Internal — product & architecture (Gareth + future PO / Architect agents)
**Deliverable location:** `.claude/reports/`
**This session produces:** this brief only. Reports are written in a later session on approval.

---

## 1. Purpose

Weave's thesis is to close a loop no incumbent closes end-to-end: **model the business →
generate apps/agents/pipelines → automate**. To design the Constitution Engine (the MVP) and
position the platform, we need a grounded, decision-oriented map of:

1. **How the closest analogue — Palantir Foundry — and adjacent players actually work**: their
   features, building blocks, and tools, so we know what to *emulate*, what to *adopt*, and where
   to *deliberately differ*.
2. **How businesses are articulated today** (the diagrams and notations — ArchiMate, BPMN, DMN,
   C4, capability/value-stream maps, org charts, REA) and **how each translates and composes into
   an ontology** (OWL/RDF/SHACL). This directly feeds (a) the design of our universal ontology and
   (b) the "ingest what the client already has" capability.
3. **The academic grounding** for enterprise ontology and knowledge-graph construction, so our
   model rests on established theory rather than ad-hoc typing.

This research informs four decisions in priority-neutral order: **universal ontology design**,
**feature roadmap & parity**, **positioning & differentiation**, and **ingest of existing
artifacts**.

## 2. Background — what we already know (do not re-research)

- Product strategy, scope, and architecture are fixed in `CLAUDE.md`, the `weave-platform` brief,
  and the `constitution-engine` etc briefs (see `.claude/specs/*/01-brief/*.md`). Confirmed: full W3C stack (RDF/OWL 2 DL / SHACL / SPARQL /
  PROV-O / SKOS), ArchiMate-3-aligned ~9-type universal ontology, NL + forms authoring, multi-tenant
  AWS SaaS, Constitution Engine ships first.
- The vision artefacts in `prototypes/thoughts.md` and `prototypes/BluShift-transcript.md` describe
  the intended product surface (constitution, org/network views, dark-factory harness, Polaris
  self-improvement, audit trail). Reference prototypes exist in `prototypes/`.
- Research must **build on** these, not relitigate them. Where a finding challenges a confirmed
  decision, flag it explicitly as a recommendation, do not silently contradict the briefs.

## 3. Organizing frame — the three paradigms

The whole field can be read along one axis: **how the model of the business is produced and how
"live" it is.** Every report should locate its subjects on this frame.

| Paradigm | Question it answers | How the model is built | Exemplars |
|---|---|---|---|
| **Descriptive-modeled** | "How is the business *designed* to run?" | Humans draw it (notations) | ArchiMate / BPMN tools, LeanIX, Ardoq, Bizzdesign |
| **Mined-observed** | "How does the business *actually* run?" | Inferred from event logs | Celonis, SAP Signavio, Software AG ARIS |
| **Data-bound-actionable** | "What is the live state, and what can I *do*?" | Bound to source data + write-back | Palantir Foundry Ontology |

**Working thesis:** no incumbent unifies all three *and* adds generation + automation. Weave's
whitespace is the union — a modeled **and** observed graph that is also data-bound, generative, and
governed. The reports exist to confirm, refute, or qualify this.

## 4. Research questions

### Thrust A — Competitive / product (emulate · adopt · differentiate)

- A1. What are Palantir Foundry's core building blocks (Ontology: object/link/action/function
  types; Pipeline Builder; Workshop; Quiver; Object Explorer; OSDK; AIP Logic/Agents) and which map
  onto Weave's planned engines?
- A2. For each adjacent category, what is the headline capability, the data model underneath, and the
  authoring experience for non-technical users?
- A3. Where is each competitor strong/weak on the three-paradigm frame, and on the four loop stages
  (model → generate → automate → govern)?
- A4. What is the defensible **differentiation** for Weave (open W3C standards, mid-market reach,
  NL+forms authoring, shipped universal ontology, closed model→generate→automate loop)?
- A5. What should we deliberately **not** build (commodity or low-value features)?

### Thrust B — Methodological / semantic (notation → ontology)

- B1. For each notation (ArchiMate, BPMN, DMN, C4, org charts, capability maps, value-stream maps,
  REA, e3value), what does it capture, and what is the published or derivable mapping to OWL/RDF?
- B2. How do SHACL shapes encode each notation's well-formedness rules (so imports validate)?
- B3. How do the notations *compose* — where do ArchiMate, BPMN, C4, and a data model overlap or
  conflict, and how is that reconciled in one graph (glossary/SKOS as the reconciliation spine)?
- B4. What is the right backbone for Weave's universal ontology, and where are its gaps (events/
  temporal, data assets, motivation layer)?
- B5. How can existing client artefacts (EA repositories, BPMN, CMDB exports, spreadsheets) be
  ingested — R2RML/RML for relational, LLM-assisted extraction for diagrams/text — and reconciled?
- B6. What does the academic corpus (TOVE, Enterprise Ontology, DEMO, REA, OntoUML/UFO) establish
  that we should adopt or avoid?

## 5. Scope

### In scope — the ~8 subjects, by category

- **Reference analogue:** Palantir Foundry / AIP / Ontology *(deepest treatment).*
- **Enterprise Architecture & digital-twin-of-organization:** LeanIX (SAP), Ardoq, Bizzdesign,
  MEGA HOPEX, Software AG Alfabet, AI-native entrants (e.g. Catio); **Microsoft** Azure Digital
  Twins + DTDL and Fabric Digital Twin Builder as the hyperscaler twin/EA play.
- **Process mining / intelligence:** Celonis (object-centric, Process Sphere/OCEL), SAP Signavio,
  Software AG ARIS.
- **Semantic / knowledge-graph platforms:** Stardog, Ontotext / Graphwise (GraphDB + PoolParty),
  TopBraid EDG (TopQuadrant), Cambridge Semantics / Altair Graph Studio.
- **Data catalog & governance:** Collibra, Atlan, data.world; **Microsoft** Purview as the overlap
  with our governed-content scope.
- **Notations:** ArchiMate 3, BPMN 2.0, DMN, C4, UML, org charts, capability maps, value-stream
  maps, REA, e3value.
- **Academic:** enterprise-ontology and KG-construction literature (see §10 seed list).

> **Microsoft note:** Microsoft is not a standalone report; it spans EA/twins (Azure Digital Twins,
> DTDL, Fabric) and governance (Purview), and is treated as a flagged thread in R2 and R4.

### Out of scope

- Re-deciding anything fixed in the existing briefs (stack, standards, MVP order, commercial model).
- Vendor pricing negotiation detail and procurement logistics.
- Exhaustive feature-by-feature parity matrices for every product (we capture *headline* capability
  + data model + authoring UX, not changelogs).
- Building anything — this is research; outputs are reports, not code or specs.

## 6. Deliverables — report manifest

Per-theme reports plus a short executive synthesis, all in `.claude/reports/`. Every report ends
with a mandatory **Implications for Weave** section (see §7).

| ID | Report | Core content |
|---|---|---|
| **R0** | Executive synthesis | The three-paradigm map; positioning/whitespace; top emulate/adopt/avoid calls; cross-cutting risks. Board-readable. |
| **R1** | Palantir Foundry / AIP deep-dive | Ontology (object/link/action/function types), Pipeline Builder, Workshop, Quiver, Object Explorer, OSDK, AIP Logic/Agents; mapping to Weave engines; open-standards contrast. |
| **R2** | EA & digital-twin-of-organization tools | LeanIX, Ardoq, Bizzdesign, MEGA, Alfabet, Catio; Microsoft Azure Digital Twins/DTDL + Fabric; capability maps, ArchiMate/TOGAF support, graph-native modelling. |
| **R3** | Process mining & intelligence | Celonis (OCPM/OCEL/Process Sphere), Signavio, ARIS; the mined-observed paradigm; how a "live graph of how the business runs" is built; relevance to keeping Weave's model alive. |
| **R4** | Semantic/KG platforms & data catalog/governance | Stardog, Ontotext/Graphwise, TopBraid EDG, Cambridge Semantics/Altair; Collibra, Atlan, data.world; Microsoft Purview; reasoning, SHACL, virtual graphs, glossary/lineage. |
| **R5** | Notations → Ontology translation *(first-class)* | Mapping tables ArchiMate/BPMN/DMN/C4/UML/org-chart/capability/value-stream/REA → OWL/RDF + SHACL; composition & reconciliation; **worked retail example (Hammerbarn/Bunnings)**; ingest method (R2RML/RML + LLM-assisted). |
| **R6** | Academic foundations & methods | TOVE, Enterprise Ontology (Uschold & King), DEMO/Dietz, REA (McCarthy), OntoUML/UFO (Guizzardi), ODM, ontology learning, LLM-empowered KG construction; what to adopt for the universal ontology. |

## 7. Method & standards for the reports

- **Primary sources first.** Vendor docs (palantir.com/docs, Microsoft Learn), standards bodies
  (OMG for BPMN/DMN/UML, The Open Group for ArchiMate/TOGAF, W3C for RDF/OWL/SHACL/RML), and
  peer-reviewed / arXiv papers. SEO listicles only for orientation, never as the cited basis.
- **Mandatory "Implications for Weave" section** in every report, structured as four buckets:
  **Emulate** (copy the pattern), **Adopt** (use the tech/standard directly), **Avoid** (commodity
  or anti-pattern), **Differentiate** (where we deliberately diverge and why). Without this a report
  is an encyclopedia, not a decision aid.
- **Locate every subject on the three-paradigm frame** (§3) and the four loop stages
  (model → generate → automate → govern).
- **R5 must contain concrete mapping tables** (source construct → OWL/RDF construct → SHACL
  constraint), not prose, plus one end-to-end retail worked example.
- Cite inline; end each report with a Sources list of URLs/DOIs used.

## 8. Hypotheses — predicted findings (to be confirmed/refuted)

Stated up front so the research can falsify them. The user explicitly asked for this.

- **H1 — The whitespace is the union of three paradigms.** No incumbent unifies descriptive-modeled
  + mined-observed + data-bound-actionable *and* adds generation/automation. Weave's differentiation
  is the union, not any single axis. *(Highest-stakes claim; R0/R3 should stress-test it.)*
- **H2 — Palantir is the reference architecture, open standards are our wedge.** Foundry's
  object/link/action/function + OSDK + AIP is the pattern to emulate; our deliberate differences are
  open W3C semantics (vs proprietary ontology), mid-market accessibility, NL+forms authoring, and a
  shipped universal ontology. Palantir's lock-in and enterprise-only price are the opening.
- **H3 — Notation→ontology is largely *solved in theory*, unproductised in practice.** ArchiMate 3.2
  (Mendoza RDF/OWL+SHACL), BPMN (BBO), UML (OMG ODM), and ArchiMEO already provide formal mappings.
  The gap Weave fills is *productising* and *LLM-assisting* the mapping + reconciliation, not
  inventing the correspondences. SHACL is the validation bridge.
- **H4 — The moat is authoring + liveness + closure, not storage.** Triple stores and standards are
  commodity (Oxigraph/Stardog/GraphDB). The defensible value is (a) validated low-friction authoring
  for non-experts, (b) keeping the model bound to reality (connectors + process-mining-style
  observation), and (c) closing to generation. Incumbents each own one; none owns all three.
- **H5 — ArchiMate + a REA/DEMO-informed core is the right backbone**, but with known gaps: event/
  temporal modelling (look to OCEL/DTDL), data-asset modelling (look to C4 + data-model conventions),
  and the motivation layer. Our 9-type core should map cleanly onto ArchiMate layers.
- **H6 — Timing is validated but the window is closing.** "Digital twin of the organization"
  (Gartner) and "ontology as the semantic operating system of the AI-first enterprise" are converging
  analyst framings on exactly Weave's thesis — confirming demand while warning that Microsoft (Fabric
  Digital Twin Builder), Palantir (moving down-market), and AI-native EA entrants are circling the
  same whitespace.

## 9. Success criteria for this research

- [ ] Each of the ~8 subjects is located on the three-paradigm frame and the four loop stages.
- [ ] Every report carries a populated Emulate/Adopt/Avoid/Differentiate section.
- [ ] R5 delivers concrete mapping tables for ≥6 notations plus one end-to-end retail worked example.
- [ ] Each hypothesis in §8 is explicitly marked confirmed / refuted / qualified in R0.
- [ ] A single positioning statement and a prioritised "emulate vs avoid" list emerge in R0,
      traceable to evidence in the per-theme reports.
- [ ] ≥70% of citations are primary sources (vendor docs, standards bodies, peer-reviewed papers).

## 10. Risks & known gaps

- **Vendor-marketing bias** — capabilities are oversold in docs; cross-check with independent
  analysis and, where possible, hands-on/community sources.
- **Palantir opacity** — deepest internals are partly undocumented publicly; depth may be bounded by
  what docs/blogs reveal.
- **Recency drift** — process mining (object-centric) and AI-native EA are moving fast; date all
  capability claims and prefer 2025–2026 sources.
- **Notation-mapping rabbit-holes** — formal OWL mappings can get academically deep; R5 stays
  pragmatic (what's needed to import and validate), not a formal-semantics treatise.
- **Scope creep across MS surfaces** — Microsoft spans many products; keep it to the twin (R2) and
  governance (R4) threads relevant to us.

## 11. Source seed list (primary, validated this session)

- **Palantir:** Ontology overview, object/link/action types, OSDK, Workshop, Quiver, AIP features —
  `palantir.com/docs/foundry/*`.
- **Microsoft:** Azure Digital Twins ontologies & DTDL models; Fabric Digital Twin Builder —
  `learn.microsoft.com/azure/digital-twins/*`, `learn.microsoft.com/fabric/*`.
- **Process mining:** Celonis OCPM / Process Sphere; van der Aalst, *Object-Centric Process Mining*
  (vdaalst.com/publications/p1352.pdf); OCEL standard; OCPM² (arXiv 2503.10735).
- **Notation→ontology:** Mendoza, *ArchiMate 3.2 as an RDF Ontology* (+ GitHub `archimate_ontology`);
  *ArchiMEO* (SCITEPRESS 90002); BBO (BPMN-Based Ontology); OntoUML/UFO Catalog (GitHub
  `OntoUML/ontouml-models`); OMG ODM; W3C RML ontology (oa.upm.es/75488) and R2RML.
- **KG construction / ontology learning:** *LLM-empowered KG construction: a survey* (arXiv
  2510.20345); Text2KGBench (arXiv 2308.02357); Frontiers AI medical ontology mapping (2025).
- **Semantic/KG platforms:** Stardog, Ontotext/Graphwise, TopBraid EDG, Cambridge Semantics/Altair —
  vendor docs.
- **Academic enterprise ontology:** Uschold & King *Enterprise Ontology*; TOVE (Fox, U. Toronto);
  Dietz *Enterprise Ontology* / DEMO; McCarthy *REA*; Guizzardi *OntoUML/UFO*.

## 12. Next step

On approval of this brief, a later session writes R0–R6 into `.claude/reports/` following §6–§7.
Refinements to scope, hypotheses, or the report manifest are expected before sign-off.

---
*Drafted for review. Approve, or mark changes, before reports are commissioned.*
