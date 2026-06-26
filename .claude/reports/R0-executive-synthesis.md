# R0 — Executive Synthesis (Board-Readable)

**Status:** Draft for board / product-leadership review
**Date:** 2026-06-26
**Author:** Synthesis session (Opus 4.8), from `.claude/reports/R1`–`R6` and `00-research-brief.md`
**Reading time:** ~10 minutes. Every claim is traceable to a per-theme report (cited as R1–R6).

---

## 0. The one-paragraph answer

The market is converging on Weave's thesis from three directions at once — and that is both the
validation and the warning. Palantir (R1) owns *data-bound + generation*; Celonis (R3) owns
*mined-observed*; the EA tools (R2) and KG/governance platforms (R4) own *descriptive + govern*.
No incumbent occupies the **specific** intersection Weave targets: the **union of all three
paradigms on open W3C standards, with generation and automation closing the loop, authored by
business users (NL + forms) over a shipped universal ontology, at mid-market reach.** The original
"no one has the union" framing is *too strong* and must be retired (Palantir's Machinery already
spans data-bound + mined-observed, R3 §7.2). The durable moat is **not** the open-standards
substrate — that is commoditising fast (Ardoq's 2026 GraphLake move, R2; triple stores are
commodity, R4) — but the **generation/automation closure plus low-friction authoring plus
liveness** (H4). Position on the closure and the authoring, not on the triples.

---

## 1. The three-paradigm map (single synthesis table)

Every major subject placed on the three paradigms (descriptive-modeled / mined-observed /
data-bound-actionable) and the four loop stages (model → generate → automate → govern).

Legend: ✓✓ strong/exemplar · ✓ present · △ partial/emerging · ✗ absent.

| Subject (report) | Descriptive | Mined-observed | Data-bound | model | generate | automate | govern |
|---|---|---|---|---|---|---|---|
| **Palantir Foundry / AIP** (R1, R3) | △ (data-engineered, not notation) | ✓ (Machinery — ontology-native) | ✓✓ (exemplar) | ✓✓ | ✓✓ | ✓✓ | ✓ (proprietary) |
| **SAP LeanIX** (R2) | ✓✓ | ✗ (via Signavio connector only) | ✗ | ✓✓ | ✗ | △ (workflow) | ✓✓ |
| **Ardoq** (R2) | ✓✓ (→ context graph) | ✗ | △ (import autom.) | ✓✓ | ✗ | △ (EA practice) | ✓✓ |
| **Bizzdesign / HOPEX** (R2) | ✓✓ (ArchiMate-native) | ✗ | ✗ | ✓✓ | ✗ | ✗ | ✓✓ |
| **Software AG Alfabet** (R2) | ✓✓ | ✗ | ✗ | ✓✓ | ✗ | ✗ | ✓ |
| **Catio** (R2) | ✗ (auto-discovered) | ✓ (tech-stack slice) | ✓ (code/cloud) | ✓ | △ (advice) | △ (advice) | △ |
| **Azure Digital Twins / DTDL** (R2) | △ | ✗ | ✓ (physical) | ✓ | ✗ | △ (events) | △ |
| **Fabric Digital Twin Builder** (R2) | △ | ✗ | ✓ (industrial) | ✓ | △ (BI/agents/ML) | △ (Activator) | △ |
| **Celonis (OCDM/Process Sphere)** (R3) | ✗ | ✓✓ (object-centric) | △ (→ "digital twin") | ✓✓ | ✗ | △ (Orchestration) | ✓✓ |
| **SAP Signavio** (R3) | ✓ (BPMN suite) | ✓ (object-centric arriving) | △ (ERP feedback) | ✓✓ | ✗ | △ | ✓✓ |
| **Software AG ARIS** (R3) | ✓ (EPC/BPMN) | ✓ (case-centric, conformance) | ✗ | ✓ | ✗ | ✗ | ✓✓ |
| **Stardog / GraphDB / TopBraid / Anzo** (R4) | ✓✓ | ✗ | △ (virtual graphs, read) | ✓✓ | ✗ | ✗ | △–✓✓ |
| **Collibra / Atlan / data.world / Purview** (R4) | ✓ (glossary/catalog) | ✗ | △ (lineage/metadata) | △ | ✗ | △ (policy propagation) | ✓✓ |
| **Notation→ontology import** (R5) | ✓✓ (cold-start) | ✗ | △ (R2RML virtualise) | ✓✓ | ✗ | ✗ | ✓ (SHACL) |
| **Academic corpus (REA/DEMO/UFO/TOVE)** (R6) | ✓✓ (theory) | △ (REA/DEMO event spine) | △ (REA stock-flow) | ✓✓ | ✗ | △ | ✓ |
| **Weave (target)** | ✓✓ (ingest notations) | ✓ (planned: OCEL ingest) | ✓ (connectors + R2RML) | ✓✓ | **✓✓ (differentiator)** | **✓ (differentiator)** | ✓✓ (SHACL/PROV-O) |

**Correction flagged (R1 ↔ R3).** R1 §A3 states Foundry "does not do process mining." R3 §7.2 —
the report that actually investigated the mined-observed leg — found Foundry ships **Machinery**, an
ontology-native process-mining capability (primary source: `palantir.com/docs/foundry/machinery/
process-mining`). **R3 is correct and supersedes R1 on this point**; the table above reflects
Foundry as `✓` on mined-observed. This correction is load-bearing for the H1 verdict below.

**Two readings of the table.**

1. **Columns are lopsided.** `model` and `govern` are crowded; `generate` is **empty across every
   incumbent except Palantir** (and Palantir only from a proprietary ontology). `automate` exists
   only as governance-workflow or process-trigger automation, never as "emit apps/agents/pipelines
   from the model." This empty `generate` column is the consistent payload of R1, R2, R3, and R4.
2. **The paradigm union is contested, not vacant.** Palantir spans two paradigms (data-bound +
   mined); Celonis is migrating from mined toward "digital twin"; EA tools are pure-descriptive.
   The clean "three empty corners waiting for Weave" picture is false. What is genuinely unoccupied
   is the *intersection on open standards, with generation closure, at mid-market with NL+forms*.

---

## 2. Positioning & whitespace — confirm / refute / qualify the thesis

**Working thesis (brief §3):** Weave's whitespace is the UNION of the three paradigms + generation
+ automation.

**Verdict: QUALIFIED (strengthened, not refuted).**

- **The "+ generation + automation" leg is the real, defensible whitespace.** It survives every
  report intact: no EA tool, no KG/governance platform, no process miner generates running
  apps/agents/pipelines from the model (R2 §4.2, R3 §9, R4 §5–6). Only Palantir does — and only from
  a closed object model (R1). This is the column to own.
- **The "union of three paradigms" leg is contested.** Palantir already unifies data-bound +
  mined-observed ontology-natively (R3 §7.2); Celonis reframes its mined object graph as a "digital
  twin of the business" (R3 §4.1). The bare paradigm-union is therefore **not vacant whitespace** —
  it is a convergence zone several well-funded incumbents are entering.
- **The genuinely unoccupied position is the *specific conjunction*:** union **on open W3C standards**
  (vs Palantir's/Celonis's proprietary models) + **generation/automation closure from that graph** +
  **whole-business scope** (vs Catio's tech-stack-only, MS's industrial-only) + **NL+forms authoring
  over a shipped ontology** + **mid-market reach** (vs enterprise-only pricing). Each incumbent
  occupies one or two of these; none occupies all (R1 §A4, R2 §5, R3 §9, R4 §7.4).

**Implication for messaging:** retire "no incumbent has the union / incumbents lack process mining"
(falsifiable, per R3 §9). Lead with **"the only platform that closes model → generate → automate on
open standards, authored by business users."**

---

## 3. Hypotheses H1–H6 — explicit verdicts

### H1 — The whitespace is the union of three paradigms · **QUALIFIED**

The literal claim ("no incumbent unifies descriptive + mined + data-bound, *and* adds
generation/automation") is **refuted in its strong form** and **confirmed in its refined form**.
R3 §7.2 is decisive: Palantir Foundry's **Machinery** spans data-bound **and** mined-observed,
ontology-natively, and Foundry also generates (R1). Celonis encroaches from the mining side with
OCDM-as-"digital twin" (R3 §4.1). So the paradigm union is *contested from multiple directions, not
vacant*. What survives — and is genuinely unoccupied — is the **specific combination**: the union
built on **open W3C standards** (not proprietary ontologies), with **generation of apps/agents/
pipelines from that graph**, at **mid-market reach with NL+forms authoring**. Confidence: high; this
is the most important correction in the study (traceable to R1 §A3, R3 §7.2 §9).

### H2 — Palantir is the reference architecture; open standards are the wedge · **CONFIRMED (time-limited)**

R1 confirms Foundry's object/link/action/function + OSDK + AIP is the pattern to emulate, and that
its proprietary lock-in (exit is "a monumental undertaking") plus enterprise-only pricing
(contact-sales, ~74% large-enterprise reviewers) is the opening (R1 §1, §A2, §A4). **Two caveats
temper it.** (a) Lock-in is a *feature* for Palantir's defense/large-enterprise base, not purely a
vulnerability — openness wins the *mid-market and the lock-in-averse*, not universally (R1 §A4
caveat). (b) The open-standards wedge is **time-limited**: Ardoq's June-2026 GraphLake acquisition
brings RDF/OWL/SHACL + temporal + provenance to an EA incumbent (R2 §3.2, §5 flag), and triple
stores/SHACL are commodity (R4 §2.5). The wedge is real but must convert to a durable lead on
closure + authoring before it erodes. Confidence: high (R1, R2 §5, R4 §6).

### H3 — Notation→ontology is solved in theory, unproductised in practice · **CONFIRMED (qualified)**

R5 confirms it directly: for all ten notations a published or directly-derivable OWL/RDF
formalization exists, and the strongest (ArchiMate via Mendoza/ArchiMEO, BPMN via BBO) ship *with*
SHACL. The correspondences are not the hard part; **no product ingests heterogeneous artefacts and
composes them into one SHACL-validated, SKOS-reconciled graph** — that pipeline is Weave's wedge
(R5 §0, §B5, Implications). One genuine *theory* gap: **C4 has no canonical ontology** and must be
expressed as a thin profile over ArchiMate (R5 §B1.5). Confidence: high; note the ArchiMate-RDF
anchor (Mendoza) is single-author and should be treated as best-available reference, not an Open
Group release (R5 source-honesty flag).

### H4 — The moat is authoring + liveness + closure, not storage · **CONFIRMED**

R4 confirms it from the supply side: RDF/OWL/SHACL/SPARQL are sold as commodities by four mature
vendors plus open source; SHACL has been a W3C Rec since 2017; "storage and standards conformance
are not a moat" (R4 §2.5, §6). The only storage-adjacent capability that is differentiating is
**virtual-graph federation** (Stardog) because it touches *liveness* (R4 §6). The defensible value
is (a) non-expert authoring, (b) keeping the model bound to reality, (c) closing to generation —
incumbents each own one, none owns all three (R4 §6, R2 §5 flag). Confidence: high.

### H5 — ArchiMate + REA/DEMO-informed core is the right backbone · **CONFIRMED (three qualifications)**

R6 confirms the 9 types map cleanly onto ArchiMate layers and that the academic corpus *augments*
rather than replaces it (R6 §5). Three qualifications sharpen it: **(1)** the named gaps are real and
the fixes are now specific — the event/temporal gap is best filled by **OCEL 2.0**, which R3 §3
promotes from "look to" (H5's tentative pointer) to a **ready-made, peer-reviewed metamodel to
adopt**, plus REA economic events and TOVE time/causality (R6 §5). **(2)** H5 omits **UFO/OntoUML**,
which R6 argues is the corpus's most important contribution to *getting the types right* (kind vs
role vs relator; Weave's "Actor/Role/Org-Unit" bundle is three different UFO categories) — add it as
an internal validation discipline via gUFO (R6 §4.5, §5). **(3)** DEMO's contribution is the
commitment kernel, not its heavyweight method (R6 §4.3). Confidence: high.

### H6 — Timing is validated but the window is closing · **CONFIRMED**

R2 confirms both halves. Validation: Gartner's "Digital Twin of the Organization" (DTO) is the
analyst-sanctioned convergence label, now branded by Ardoq, MEGA/QualiWare, BusinessOptix and others
(R2 §2); Palantir itself frames its Ontology as "a digital twin of the organization" (R1 §1); Celonis
calls OCDM "the core of an organization's digital twin" (R3 §4.1). Window-closing: **Microsoft Fabric
Digital Twin Builder** (Preview, Build 2025) reaches data-bound + dashboards/Q&A-agents/ML, though
industrial-scoped and non-W3C (R2 §3.7); **Ardoq's GraphLake** brings the W3C stack to EA (R2 §3.2);
**Catio** shows auto-discovery beating manual EA (R2 §3.6); EA-vendor **consolidation** (Bizzdesign
now owns HOPEX) signals a maturing market (R2 §4.2). Confidence: high.

**Scorecard:** H1 qualified · H2 confirmed (time-limited) · H3 confirmed (qualified) ·
H4 confirmed · H5 confirmed (3 qualifications) · H6 confirmed.

---

## 4. Top Emulate / Adopt / Avoid calls (prioritised, cross-study)

Prioritised by leverage on the MVP (Constitution Engine) and on durable differentiation.

### Emulate (copy the pattern)

1. **Foundry's semantic/kinetic split** — a semantic core (objects/links = OWL classes/properties)
   plus a kinetic overlay (actions = SHACL-validated, PROV-O-tracked write-back; functions =
   ontology-bound logic). Foundry's single best structural idea (R1 §1, Implications).
2. **OSDK-style code generation: ontology → typed SDK + OpenAPI** — the canonical "generate from the
   model" pattern, directly achievable over OWL/SHACL shapes. This is the differentiating column
   made concrete (R1 §2.5, Implications).
3. **Mendoza's layered-SHACL "matrix-in-SHACL-not-OWL" discipline** — the house pattern for
   validating every notation import; SHACL is the import-validation bridge (R5 §B1.1, Implications).
4. **SKOS reconciliation spine** — one `skos:Concept` as the shared meaning anchor every notation
   points at; the cross-notation SPARQL answer no single-notation tool gives (R5 §B3 — Weave's core
   IP).
5. **Object-centric-by-construction + designed-vs-observed conformance overlay** — borrow Celonis's
   anti-flattening narrative and ARIS/Machinery's amber/grey/dashed conformance UX as a SHACL+diff
   overlay (authored graph = to-be, ingested OCEL = as-is) (R3 §9).
6. **Survey/broadcast crowdsourced authoring + AI diagram-to-data ingest** — LeanIX Surveys, Ardoq
   AI Import Builder set the bar for non-architect maintenance and "ingest what the client has"
   (R2 §5).
7. **Stardog virtual-graph SPARQL→SQL federation** — the one storage-adjacent feature that delivers
   *liveness* against Snowflake/Databricks/Azure without ETL (R4 §6, §7.1).
8. **Purview "active glossary terms"** — make ontology terms *policy carriers* that propagate
   governance to bound data, nudging `govern` toward `automate` cheaply (R4 §7.1).
9. **TOVE competency-question discipline + Text2KGBench conformance/hallucination metrics** — gate
   the shipped ontology and the LLM ingest pipeline on answerable questions and measured conformance,
   not feature counts (R6 §4.2, §4.7).

### Adopt (use the tech/standard directly)

1. **Full W3C stack** (RDF/OWL 2 DL / SHACL / SPARQL / SKOS / PROV-O) — already fixed; vindicated as
   the lingua franca of every serious vendor (R4 §7.2). Adopt SHACL's sanctioned uses beyond
   validation: **UI building, code generation, data integration** (R4 §7.2).
2. **OCEL 2.0 as the event/temporal metamodel and observed-behaviour import format** — promote from
   "look to" (H5) to confirmed adoption candidate; maps onto RDF + PROV-O with no semantic loss; use
   the SQLite exchange format for efficient ingest (R3 §3, §9).
3. **W3C R2RML (relational/CMDB) + RML (CSV/JSON/XML/spreadsheets)** for deterministic ingest;
   **W3C Organization Ontology** for org charts; **archimate2rdf** + **BBO** + **dmn-ont** as
   notation targets (R5 §B5, Implications).
4. **REA (ISO 15944-4, OWL via OntoREA)** as the economic/event core layered on ArchiMate;
   **gUFO** as the optional ontological-rigor overlay; **PROV-O + OWL-Time** for temporal/provenance
   (R5 §B4, R6 §5).
5. **OpenAPI 3.1 + vector RAG (S3 Vectors) + HITL gating on critical actions** — the Foundry agent
   patterns, mapped to the confirmed Weave stack (R1 Adopt).
6. **The Gartner DTO vocabulary** in positioning — the analyst-sanctioned demand signal (R2 §3 Adopt).

### Avoid (commodity / anti-pattern)

1. **A proprietary, non-portable object model** — Palantir's lock-in is its vulnerability for the
   mid-market; commit to RDF/OWL/SHACL (R1 §A5).
2. **A deep data-catalog / lineage / stewardship product** — Collibra/Atlan/Purview own it;
   multi-year build, zero differentiation; integrate or defer (R4 §7.3).
3. **A process-mining engine, an ETL/transformation IDE, a hosted widget runtime, or an LLM-agent
   runtime from scratch** — each is category-owned-elsewhere or commodity; ingest/integrate/generate
   instead (R1 §A5, R3 §9).
4. **Another manual ArchiMate modeller** — Bizzdesign/MEGA own formal-modelling rigour with a high
   skill floor in a consolidating market (R2 §5).
5. **Treating triple-store choice as strategic, or over-indexing on OLAP graph analytics** — it is
   substrate; choose on ops/cost/federation, not differentiation (R4 §7.3).
6. **Over-claiming "no-code" / "always-live, zero-effort" / "incumbents lack process mining"** — all
   three are falsifiable credibility traps (R1 §A5, R3 §9).
7. **Inventing a new C4 ontology; modelling capability/value-stream maps as separate notations;
   pushing the relationship matrix into OWL axioms; exposing OntoUML/DEMO formalism to users** —
   each is duplication or accessibility-killing over-formalisation (R5, R6 Avoid).

### Differentiate (deliberate divergence — the cross-study call)

1. **Close the loop: model → generate → automate, on open standards.** The empty `generate` column
   across all incumbents *is* the differentiation (R1–R4). This is the durable moat, not the triples.
2. **Union on one open-standards substrate, not via connectors or a proprietary model.** Authored +
   bound + observed in one RDF graph, so conformance is a graph diff not an ETL hop (R3 §9, R5).
3. **Shipped universal ArchiMate+REA+UFO ontology, NL+forms over it, mid-market priced.** Kills the
   "blank canvas needs immense expertise" weakness (R1 §A2); the literature offers each foundation
   separately — *no one ships the synthesis as a client-extensible product* (R6 §6).
4. **Generate a real, owned application** (Next.js/shadcn) the client can fork — not a hosted runtime
   (R1 Differentiate).

---

## 5. Positioning statement

> **Weave is the operating system for the AI-native company: the only platform that models the whole
> business — by ingesting the diagrams and data you already have into one open, standards-based graph
> (RDF/OWL/SHACL/PROV-O) — and then *closes the loop*, generating the apps, agents, and pipelines
> that run it, authored by business users in natural language and forms over a shipped universal
> ontology.** Where Palantir does this behind a proprietary cage at enterprise prices, the EA tools
> stop at a beautiful diagram, and the process miners stop at a dashboard, Weave is the one that
> closes *model → generate → automate → govern* on open standards, at mid-market reach.

The defensible anchor is **open-standards union + generation/automation closure + whole-business
NL+forms authoring at mid-market** — deliberately *not* "we alone do process mining / paradigm
union," which R1 and R3 falsify.

---

## 6. Cross-cutting risks

### 6.1 The window is closing (H6) — the headline risk

- **Microsoft Fabric Digital Twin Builder** (Preview, Build 2025) already reaches data-bound +
  dashboards + Q&A agents + ML + Activator automation off an "ontology" — though industrial-scoped
  and lakehouse/non-W3C (R2 §3.7). If Microsoft generalises it from industrial to whole-org and
  attaches generation, the distribution advantage is enormous. **Watch quarterly.**
- **Palantir moving down-market.** Foundry already implements all four loop stages; the only barrier
  to Weave's segment is pricing/packaging, which Palantir can change (R1 §A4). The open-standards and
  mid-market wedges are time-limited, not structural.
- **AI-native EA entrants.** Catio (auto-discovery + 31 agents, R2 §3.6) and Ardoq (AI-first +
  GraphLake RDF/OWL/SHACL, R2 §3.2) are converging on the same whitespace from the EA side. Ardoq is
  the single biggest competitive signal in the study — it adopted Weave's exact substrate in 2026
  (R2 §5 flag).

### 6.2 The open-standards wedge erodes (H2/H4)

Triple stores, SHACL, and reasoning are commodity (R4 §2.5); Ardoq just acquired the W3C stack
(R2 §3.2). **Mitigation:** convert the wedge into a durable lead on **generation/automation closure
+ NL/forms authoring + liveness** (H4) before the substrate advantage disappears. Do not market on
"we use open standards" alone.

### 6.3 The "live model" promise is costly to keep (R3)

The process-data-quality literature is blunt: log extraction from non-process-aware systems is the
dominant cost (R3 §2). Over-promising "always live, zero effort" is the vendor-marketing trap.
**Mitigation:** price data-quality/ingest effort honestly; make event-log quality checks a
first-class ingest step.

### 6.4 Authoring-accessibility vs ontological rigor (R6)

Weave's wedge is rigor (UFO/REA/TOVE-grade) *under* a non-expert surface. Too much enforced
formalism (FOL axioms, exposed OntoUML stereotypes) re-imports the inaccessibility Weave is fleeing;
too little forfeits the rigor that makes generation safe (R6 §4.5, §7). **Mitigation:** the
"how much UFO to enforce as SHACL vs advise" decision is flagged for the Constitution Engine tech
spec — keep formalism behind the curtain.

### 6.5 Over-claiming / credibility (all reports)

Vendor docs oversell ("no-code," "digital twin," "GenAI app development" that is really GraphRAG —
R4 §1). Weave must under-promise relative to incumbents on exactly the axes they over-claim, or
inherit the same credibility discount (R1 §A5, R4 §7.3).

---

## Implications for Weave (the prioritised cross-study call)

This consolidates §4 into the four mandatory buckets, ordered by priority.

### Emulate

Foundry's semantic/kinetic split and OSDK code-gen (R1); Mendoza's layered-SHACL import validation
and the SKOS reconciliation spine (R5); designed-vs-observed conformance overlay (R3); Stardog
virtual-graph federation and Purview active-glossary-terms (R4); survey-based crowdsourced authoring
and AI diagram-to-data ingest (R2); TOVE competency questions + Text2KGBench conformance gates (R6).

### Adopt

The full W3C stack with SHACL's code-gen/UI/integration uses (R4); **OCEL 2.0** as the event/temporal
metamodel and observed-behaviour import format (R3); R2RML/RML/ORG/archimate2rdf/BBO/dmn-ont for
deterministic ingest (R5); REA (ISO 15944-4) + gUFO + PROV-O/OWL-Time as the economic/temporal/rigor
layers (R5, R6); OpenAPI + S3-Vectors RAG + HITL gating (R1); the Gartner DTO vocabulary (R2).

### Avoid

A proprietary object model (R1); a deep catalog/lineage/stewardship product (R4); building
process-mining/ETL/widget-runtime/agent-runtime from scratch (R1, R3); another manual ArchiMate
modeller (R2); treating the triple store as strategic (R4); a new C4 ontology and separate
capability/value-stream notations (R5); exposing OntoUML/DEMO formalism or FOL axioms to users (R6);
over-claiming "no-code / always-live / incumbents-lack-mining" (R1, R3, R4).

### Differentiate

Close **model → generate → automate** on open standards — the empty `generate` column is the moat
(R1–R4). Union on one RDF substrate, not via connectors or a proprietary cage (R3, R5). Ship the
synthesised ArchiMate+REA+UFO universal ontology with NL+forms authoring at mid-market — the
synthesis no one productises (R6). Generate a real, owned, forkable application, not a hosted runtime
(R1). **Race condition:** these must harden into a lead before Microsoft/Palantir/Ardoq close the gap
(§6.1) — the open-standards substrate is necessary but no longer sufficient (H4).

---

## Sources

This synthesis cites no external sources of its own; every claim is traceable to the per-theme
reports and their primary sources:

- R1 — `.claude/reports/R1-palantir-foundry-aip.md` (Palantir Foundry / AIP)
- R2 — `.claude/reports/R2-ea-digital-twin-of-org.md` (EA & digital-twin-of-organization)
- R3 — `.claude/reports/R3-process-mining-intelligence.md` (process mining & intelligence)
- R4 — `.claude/reports/R4-semantic-kg-and-governance.md` (semantic/KG & catalog/governance)
- R5 — `.claude/reports/R5-notation-to-ontology.md` (notations → ontology)
- R6 — `.claude/reports/R6-academic-foundations.md` (academic foundations & methods)
- Brief — `.claude/reports/00-research-brief.md` (frame §3, hypotheses §8, success criteria §9)

Per-theme reports collectively meet the brief's ≥70% primary-source requirement; R0 inherits their
citations rather than introducing new ones.
