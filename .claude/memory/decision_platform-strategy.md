---
name: Weave platform strategy
description: Core product positioning, architecture decisions, and MVP definition from 20Q elicitation
type: decision
created: 2026-06-24
---

Weave is the operating system for the AI-native company. Model the business as a
semantic knowledge graph → generate apps/agents/pipelines from it → automate via
graph changes and external events. Equal weight across all three modes.

**Why:** Palantir does this for $1M+/yr; no tool closes the model→generate→automate loop
end-to-end for mid-market. WorkIQ/LeanIX model but can't build. Low-code tools build
but don't model.

**Architecture decisions:**
- Full W3C semantic web: RDF/OWL/SHACL/SPARQL/PROV (not a lighter property graph)
- Weave ships a universal business ontology; clients extend it
- Single React SPA modular (micro-frontends deferred)
- Multi-tenant cloud SaaS
- AI-native throughout every layer
- Managed connectors: Snowflake, Databricks, S3, Azure, Jira, ServiceNow

**MVP:** Constitution engine first. Success = one client, one generated artefact.

**Commercial:** Fully commercial SaaS (no OSS) + consulting/workshop arm.

**How to apply:** All spec work, stack choices, and architecture decisions should be
evaluated against: does this serve the model→generate→automate loop? Does it serve
the ops-first → CTO/board → engineer persona arc?
