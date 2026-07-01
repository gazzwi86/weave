---
name: Weave platform strategy
description: Core product positioning, architecture decisions, and MVP definition from 20Q elicitation
type: decision
created: 2026-06-24
---

Weave is the operating system for the AI-native company — a living **digital twin of the
organization (DTO)**. Model the business as a semantic knowledge graph → generate apps/agents/
pipelines from it → automate via graph changes and external events.

**Why (corrected 2026-06-30 by the .claude/reports research):** do NOT claim "no tool closes the
loop" — Palantir Foundry already spans model→generate→automate (and Machinery does process mining)
behind a proprietary cage at enterprise prices; EA tools stop at a diagram; process miners stop at
a dashboard. The moat is **closing the loop on open W3C standards, at mid-market, with
whole-business NL+forms authoring + the BPMO "business brain" that grounds agents** — a
time-limited window (the triple store is commoditising; Ardoq's 2026 GraphLake brought RDF/OWL/SHACL
to an EA incumbent). Differentiate on closure, NOT the substrate.

**Architecture decisions:**
- Full W3C semantic web: RDF/OWL/SHACL/SPARQL/PROV (not a lighter property graph)
- CE ships a **process-centric BPMO upper framework** (the "business brain") clients extend — a
  framework, not a populated taxonomy. See [[decision_ontology-bpmo]] (supersedes the old
  "universal business ontology / 8 kinds" framing).
- Single React SPA modular (micro-frontends deferred)
- Multi-tenant cloud SaaS
- AI-native throughout every layer
- Managed connectors (7 integrations): Snowflake, Databricks, S3, Azure Data Lake, Atlassian
  (Jira + Confluence), ServiceNow, Slack

**Build order / MVP:** Platform shell first (app/nav/workspace/Cognito/Bedrock/tenancy) →
**Constitution Engine (first engine)** → Graph Explorer → Build → Events → Onboarding. MVP = the
**thin end-to-end loop** (Platform + CE + Explorer + a narrow Build slice → generate one artefact).

**Commercial:** Fully commercial SaaS (no OSS) + consulting/workshop arm.

**How to apply:** All spec work, stack choices, and architecture decisions should be
evaluated against: does this serve the model→generate→automate loop? Does it serve
the ops-first → CTO/board → engineer persona arc?
