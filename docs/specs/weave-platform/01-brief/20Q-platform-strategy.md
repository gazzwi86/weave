---
type: Elicitation — 20 Questions
title: Weave Platform Strategy — 20 Questions
description: "Twenty Questions elicitation of Weave platform scope, commercial model, and technical architecture."
tags: [weave-platform, 01-brief, elicitation, strategy]
timestamp: 2026-06-29T00:00:00Z
resource: docs/specs/weave-platform/01-brief/20Q-platform-strategy.md
---

# 20 Questions Analysis: Weave Platform Product Strategy

**Method:** Twenty Questions
**Date:** 2026-06-24
**Topic:** Weave platform product strategy, scope, and architecture

> **⚠️ Superseded (decisions A1 + the BPMO reframe, 2026-06-30).** This historical elicitation
> record says "Weave ships a universal business ontology; clients extend it." That has been
> refined: Weave ships a **process-centric BPMO** (Business Process Management Ontology) — the
> "business brain" — as the universal *upper framework* (Process at the centre, linked to data,
> systems, services, capabilities, governance, goals and actors; ~13 kinds + relationships),
> **not** a populated business taxonomy. Clients build their **own** domain vocabulary and
> instances on top. "Weave provides the grammar; the company writes the sentences." Canonical set:
> `docs/specs/_inter-engine-contracts.md` CE-READ-1; see CLAUDE.md and the Constitution Engine
> brief/PRD for the authoritative framing. The rest of this document stands.

---

## Starting Scope

Broad question: What is Weave, who is it for, how does it work, and what makes it
different — across commercial model, technical architecture, and product strategy?

---

## Question Log

### Round 1 — Positioning and GTM (Q1–Q4)

1. **Core value axis** → Equal weight: describe + generate dark-factory code + quick
   automations. The knowledge/visual ontology is the authoritative source that guides
   the entire system.
2. **Primary persona** → Persona arc: Ops team starts (with CTO/board backing); then
   product, architecture, and engineers build with it.
3. **Commercial model** → Pure SaaS (commercial) primary + consulting-led engagements
   as a paid service arm.
4. **Market tier** → Enterprise (500+ staff) AND mid-market (50–500) — both in scope.

**Established after Round 1:** Weave is a full-stack commercial SaaS targeting enterprise
and mid-market; ops teams adopt first, engineers and architects extend it. The graph is
both a visualisation and an execution engine simultaneously.

---

### Round 2 — Data model and standards (Q5–Q8)

5. **Standards depth** → Full W3C semantic web: RDF/OWL/SHACL/SPARQL/PROV — maximum
   reasoning, interoperability, and linked-data portability.
6. **Ontology authorship** → Weave ships a universal business ontology (Palantir-style
   typed entities); clients populate it and extend it.
7. **Non-technical editing** → Yes — natural language + guided forms. Business analysts
   and operations managers edit the graph without code.
8. **Integration posture** → Integrate and augment existing tools (ServiceNow CMDB, Jira,
   Confluence, LeanIX) via connectors — not replace them.

**Established after Round 2:** Full semantic web platform with a business-friendly UX
layer. Weave is the graph of record; existing tools feed into it via connectors.

---

### Round 3 — Architecture decisions (Q9–Q12)

9. **Micro-frontends** → Single React SPA with modular internal structure (not MFEs).
   Simpler to start; can extract MFEs later if needed.
10. **MVP first** → Constitution engine: ontology editor + SPARQL store + visual graph
    explorer. Everything else depends on this foundation.
11. **Real-time collaboration** → Figma-style simultaneous multi-user graph editing
    required at launch. Significant engineering complexity; non-negotiable.
12. **Deployment model** → Multi-tenant cloud SaaS (shared infrastructure, logical
    isolation per customer).

**Established after Round 3:** Single SPA, constitution engine first, real-time
multi-user collab required, cloud multi-tenant.

---

### Round 4 — Build engine and automation (Q13–Q16)

13. **Build engine output** → ALL four types: full applications (UI + API), AI agents,
    data pipelines / data repos, AND forms / dashboards / reports.
14. **Event triggers** → Both: external events (webhooks, Jira, cron, Slack) AND internal
    graph mutations (node added, relationship changed, constraint violated) trigger automations.
15. **LLM integration** → AI-native throughout every layer: NL-to-RDF editing, AI-generated
    specs, build-engine code generation, automation suggestions, ontology recommendations.
16. **Data connectors** → Managed built-in connectors: Snowflake, Databricks, S3, Azure
    Data Lake, Jira, ServiceNow, Confluence.

**Established after Round 4:** The build engine is a full code-generation platform; the
events engine is a full bidirectional event bus; AI is not an add-on, it is the execution
model throughout.

---

### Round 5 — GTM, positioning, and success (Q17–Q20)

17. **Workshop methodology** → Both: the methodology is packaged as a product (templates,
    facilitation guides, certification) AND used as a GTM motion to drive Weave adoption.
18. **Competitor positioning** → **The operating system for the AI-native company.** No
    current tool lets you fully describe a company AND automatically wire AI agents,
    pipelines, and apps to run it. Weave is that OS. (Secondary framing: Palantir for
    the mid-market.)
19. **MVP success** → One real client can model their company in Weave AND Weave
    auto-generates one working artefact (app, pipeline, or agent) from that model.
    Single end-to-end path proven.
20. **Open source** → Fully commercial, closed source. No OSS core.

---

## Synthesis

### Established Facts

1. **Core proposition:** Describe the company as a semantic knowledge graph → generate
   dark-factory code, AI agents, pipelines, and dashboards from that graph → trigger
   automations from graph changes and external events. Equal weight across all three.

2. **Positioning:** The operating system for the AI-native company — not an EA tool,
   not a BI tool, not a low-code builder. The first platform that closes the
   model → generate → automate loop end-to-end.

3. **Standards:** Full W3C semantic web stack (RDF/OWL/SHACL/SPARQL/PROV). Interoperable,
   reasoned, linked-data-portable. Weave ships a universal business ontology; clients extend it.

4. **Users:** Ops team adopts first (NL + forms editing, visual graph). CTO/board governs.
   Architects and engineers build applications on top of the graph via the build engine.

5. **Architecture:** Single React SPA (modular), multi-tenant cloud SaaS, Figma-style
   real-time collab, full-stack connectors.

6. **MVP:** Constitution engine first (ontology editor + SPARQL store + graph explorer).
   Success = one real client, one generated artefact.

7. **Commercial:** Fully commercial SaaS. Workshop methodology is both a product and a
   GTM motion. Consulting engagement tier alongside the platform.

### Specific Requirement / Decision

> **Weave is a fully commercial, AI-native SaaS platform built on the W3C semantic web
> stack. It lets any company describe their entire operating model as a live, visual
> knowledge graph (using a universal business ontology), then uses that graph to
> automatically generate applications, AI agents, data pipelines, and automations —
> and to trigger actions from both graph changes and external events. The MVP is the
> Constitution Engine: a real-time collaborative ontology editor, SPARQL store, and
> graph explorer. Success is one real client with a populated graph and one generated
> working artefact.**

### Remaining Ambiguity

- Specific node/class taxonomy of the universal business ontology (what are the canonical
  entity types — process, system, person, capability, rule, data, event, KPI, product...?)
- Tech stack selection for real-time collaboration (CRDTs? Y.js? Liveblocks? Automerge?)
- Phase ordering of the build engine (apps first? agents first? pipelines first?)
- Connector priority order for managed connectors
- Pricing model (per seat? per workspace? usage-based?)

---

## Captured As

Saved to `docs/specs/weave-platform/01-brief/20Q-platform-strategy.md`

Next: `/po` — Product Owner to write the Brief, PRD, and Roadmap from this foundation.

# Related

- [Weave Platform — Product Brief](brief.md)
