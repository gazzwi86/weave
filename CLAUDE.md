# Weave

A monorepo platform for describing, visualising, and automating how a company operates — through ontologies, knowledge graphs, and data models. Weave lets you map the full enterprise (people, processes, systems, data, rules, relationships) as a navigable graph, and uses that model to generate applications, data products, and automations — regardless of whether the underlying data lives in Snowflake, AWS, Azure, Databricks, or on-prem.

**Positioning:** The operating system for the AI-native company — a living digital twin of the organization (DTO). Model the business → generate code/agents/pipelines → automate. The moat is closing that loop on open W3C standards, at mid-market reach, with whole-business NL+forms authoring — not the triple store, which is commoditising fast (Ardoq's 2026 GraphLake acquisition brought RDF/OWL/SHACL to an EA incumbent). This is a time-limited window: differentiate on generation/automation closure before the substrate advantage erodes.

**Core sub-systems:**
- **Constitution engine** — ontology/graph layer (RDF/OWL/SHACL/SPARQL/PROV); the live model of the business. **First engine to ship** (the Platform shell — app/nav/workspace/auth/Cognito/Bedrock — is built first as the foundation everything runs in).
- **Build engine** — generate apps (UI+API), AI agents, data pipelines, forms/dashboards from the graph model
- **Events & actions engine** — automations triggered by graph changes AND external events (webhooks, Jira, cron)
- **Graph explorer** — visualise the company as a force-directed network; drill-in focus views; structured C4 canvas; Figma-style real-time multi-user collab (**Phase 2** — MVP ships single-user editing + async sharing)

**Architecture decisions (confirmed):**
- Single React SPA, modular internally (not micro-frontends)
- Multi-tenant cloud SaaS
- Full W3C semantic web: RDF/OWL/SHACL/SPARQL/PROV
- Weave ships a **process-centric BPMO** (Business Process Management Ontology) — the "business brain" — as the universal *upper framework* (~13 kinds: Process, Activity, Event, DataAsset/Field, System, Service, BusinessCapability, BusinessDomain, Policy, Goal, Actor, Concept, Class + the relationships connecting them: performedBy/consumes/produces/runsOn/realizes/governedBy/…). Processes sit at the centre, linked to the data, systems, capabilities, governance, goals and actors that operate the business — the model an agent reasons inside. Clients extend it with their own domain kinds/instances; it's a **framework, not a populated taxonomy**. ArchiMate-3 aligned; REA + UFO behind the curtain. Grounded in `prototypes/obpm` (NOT the thin weave-prototype UI). Canonical set: `docs/specs/_inter-engine-contracts.md` CE-READ-1. See `.claude/memory/decision_ontology-bpmo.md`.
- NL + forms editing for business users (no code required) — both ship in v1; forms are SHACL-shape-driven
- AI-native throughout every layer
- Managed connectors (7 integrations): Snowflake, Databricks, S3, Azure Data Lake, Atlassian (Jira + Confluence, one OAuth family), ServiceNow, Slack

**Commercial model:** Fully commercial SaaS + consulting/workshop engagement arm (no open source)

**MVP success criterion:** One real client models their company → Weave auto-generates one working artefact (app, pipeline, or agent)

**Reference prototypes:** throwaway reference material in `prototypes/` (gitignored, not part of the harness) — delete once specs are complete.

## Laws

You must strictly adhere to these laws in every interaction:

1. **Don't Assume. Don't Hide Confusion. Surface Trade-offs:** If a requirement, file context, or intent is ambiguous, do not guess. Stop and ask for clarification using simple, high-signal options. Always explicitly state the technical trade-offs of a chosen path.
2. **Minimum Code that Solves the Problem:** Write the leanest, most direct solution possible. Never add speculative features, "future-proofing," or unrequested boilerplate.
3. **Touch Only What You Must:** Limit your footprint. Modulate and isolate your changes. Clean up only your own mess; do not refactor or modify adjacent code/assets unless explicitly instructed to do so.
4. **Define Success Criteria. Loop Until Verified:** Before executing a plan or writing code, define what "success" looks like. Test, analyze, and loop your reasoning until those criteria are objectively met.

## Cognitive Protocol: Thinking fast and slow

When perfoming complex work, such as forming a plan, writing/reviewing code, assessing specs, creating artifacts, or analyzing visual/structural assets (images/webpages), you must execute your thoughts in two distinct, sequential phases:

### Phase 1: Fast Thinking (Intuition & Structure)
* **Objective:** Form an immediate structural baseline.
* **Actions:** Analyze raw visual/textual structures, immediate intent, aesthetics, and explicit details. Apply rapid inferences grounded in *where* the asset sits (e.g., its location in the codebase or its visual hierarchy in a UI).

### Phase 2: Slow Thinking (Deliberation & Tree of Thought)
* **Objective:** Challenge Phase 1, branch out possibilities, and calculate impacts.
* **Actions:** 
    * Deconstruct your Phase 1 findings. Actively look for blind spots, hidden technical debt, or edge cases.
    * Use a **Tree of Thought (ToT)** approach to branch out alternative hypotheses and strategies.
    * Run a downstream analysis: trace how your proposals will impact dependencies, security, performance, or user experience.
    * Amend, alter, or completely pivot your initial assumptions based on this deliberation before taking action.

## Workflow

### 1. The Dynamic Scratchpad

Maintain a persistent, evolving **Scratchpad** (eg .thinking.md) at the base of your responses during complex or multi-turn tasks. Use it to track active files, current goals, discovered context, and active hypotheses. (This ensures parallel agent teams or long-context workflows remain seamlessly synchronized). It should not be a commited file in git.

### 2. Impact-Driven File Planning
When planning changes across files, explicitly map out the proposed modifications, file paths, and success criteria in your plan *before* editing. Update the plan dynamically as your Tree of Thought expands.

### 3. Jargon-Free Elicitation Layer
* **Internal Processing:** Your internal reasoning (Fast/Slow thinking phases) must be hyper-detailed, rigorous, and technically precise.
* **User Communication:** Your external prompts, requests, and questions directed to the user must be highly simplified (near ELI5 level). Avoid abbreviations and unclear requests. 
* **Nuance Extraction:** Use Multiple-Choice Questions (MCQs) and clear scenario trade-offs instead of open-ended questions to extract precise preferences from the user.

## Response template

When tasked with complex execution, format your response using this structure to prove compliance:

### [System 1: Fast Analysis]

* *Observations on immediate structure, context, and obvious intent.*

### [System 2: Slow Deliberation & Tree of Thought]

* *Tree of Thought branching, hidden edge cases, and Law 1 Trade-offs.*
* *Law 4 Success Criteria definition.*

### [Workspace Scratchpad]

* *Active Files / Context Tracked / Active Goal / Next Steps.*

### [Actionable Output / User Elicitation]

* *The minimal solution (Laws 2 & 3) OR an ELI5 MCQ/clarification request.*

## Getting started

To begin spec-driven development on a new engine or feature:

1. Run `/po` — the Product Owner agent will guide you through elicitation and produce:
   - `docs/specs/<entity>/01-brief/brief.md`
   - `docs/specs/<entity>/02-prd/prd.md`
   - `docs/specs/<entity>/02-prd/epics/EPIC-*.md`
   - `docs/specs/<entity>/03-roadmap/roadmap.md`

2. Review the specs, then run `/architect` to produce the tech spec:
   - `docs/specs/<entity>/04-arch/tech-spec/*.md`
   - `docs/specs/<entity>/04-arch/tasks/TASK-*.md`

3. Run `/spec-review` to gate-check completeness before implementation.

4. Run `/implement` — the dark factory loop executes tasks one by one, TDD-first.

5. Run `/qa` and `/status` to check progress. `/status` also reports spec health and OKF
   bundle conformance.

To visualise the full knowledge graph: open `docs/viz.html` (run `/okf-visualize` first).
To check spec conformance: run `/okf-validate`.

## Layout — read this map before grepping

| Path | What it is | Conventions live in |
|---|---|---|
| `.claude/` | Claude Code config — settings, hooks, skills, agents, commands | – |
| `docs/specs/` | Product specs by entity and phase | `docs/specs/<entity>/<phase>/*.md` |
| `.claude/spec-templates/` | Spec artifact templates | – |
| `docs/wiki/` | OKF v0.1 knowledge bundle — per-area anatomy pages (regenerated by `/anatomy`) | `docs/wiki/README.md` |

**Per-package CLAUDE.md files (once packages exist) override global rules.**

## Top-level commands

<!-- TODO: add build, dev, test, lint commands once monorepo packages are scaffolded -->

**Codebase knowledge (wiki):**
- `/anatomy` — full regeneration of `ANATOMY.md` + `docs/wiki/<area>.md` OKF bundle + `viz.html`
- `/anatomy refresh <files>` — incremental update for changed files only
- `/okf-validate` — conformance check of the `docs/wiki/` OKF bundle
- `/okf-visualize` — render `docs/viz.html` (self-contained Cytoscape.js knowledge graph)

## Stack (confirmed)

Decisions are final unless overridden by explicit PRD justification.

**Application**

- Backend: Python 3.12+, FastAPI, Pydantic v2, uv
- Frontend: TypeScript strict, Next.js 15 App Router, Tailwind CSS, shadcn/ui
- API: REST (OpenAPI 3.1) + SPARQL 1.1 for graph traversal
- Auth: AWS Cognito (default) or Auth0 (multi-IdP)

**AI / Agents**

- Agent SDK: Anthropic Agent SDK (Claude Agent SDK) — Python primary, TypeScript secondary; generates portable agent code (decided 2026-06-26)
- Agent runtime: AWS Bedrock AgentCore (GA components only: Runtime, Memory, Identity, Gateway) — revisit fit with Anthropic Agent SDK during Build Engine tech spec
- Models: `claude-opus-4-8` (elicitation/architecture), `claude-sonnet-4-6` (generation/implementation), `claude-haiku-4-5` (validation/formatting)
- Guardrails: AWS Bedrock Guardrails (PII, content policy, topic blocking)

**Data**

- RDF store: Oxigraph (dev/test) → Neptune or Jena Fuseki (prod — decision deferred to Constitution Engine tech spec)
- Vector: AWS S3 Vectors
- Relational: AWS Aurora PostgreSQL Serverless v2 + SQLAlchemy async
- Cache: AWS ElastiCache (Redis 7)

**Infrastructure**

- IaC: Terraform
- Compute: AWS Lambda (primary), ECS Fargate (long-running agents)
- SPA hosting: CloudFront + S3
- Secrets: AWS Secrets Manager only
- CI/CD: GitHub Actions (OIDC to AWS, environment protection rules)
- Observability: CloudWatch + OpenTelemetry (ADOT Collector)

**Semantic web**

- Ontology: OWL 2 DL, Turtle serialisation
- Validation: SHACL
- Provenance: PROV-O
- Vocabulary: SKOS
- Query: SPARQL 1.1 + SPARQL Update
- EA notation: ArchiMate 3

## Conventions

- Python tooling: `uv` only (enforced by hook — rejects bare pip usage)
- Secrets: AWS Secrets Manager only — never hardcoded, never in `.env` files
- Testing: TDD-first; unit → integration → E2E; Playwright for browser tests; mutation ≥ 70%
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), stacked PRs per phase

## SDLC — spec-driven flow

Weave uses a per-artifact skill harness. Specs cascade: Brief → PRD → Roadmap → Tech Spec → Tasks
(PDAC loops with HITL gates). See `docs/claude-harness-overview.md` for full harness architecture.

**Workflow commands:**
- `/po` — Product Owner orchestration shell (calls po-brief → po-prd → po-roadmap → po-epic)
- `/architect` — Tech Architect shell (calls arch-stack → arch-c4 → arch-openapi → … → arch-task-brief)
- `/elicit` — structured elicitation (20Q, Six Hats, Five Whys, Stochastic)
- `/implement` — dark factory loop (PDAC per task, phase-gated HITL)
- `/qa` — 10-category task validation
- `/spec-review` — pre-scaffold spec completeness gate
- `/status` — progress + kanban + blockers

**Per-artifact skills (invoked by agents, not directly):**
PO: `po-brief`, `po-prd`, `po-roadmap`, `po-epic`, `design-system` (UI-bearing projects — PO Phase 3b
    asks "does this have a UI?" → generates `docs/standards/design/` before /architect)
Architect: `arch-stack`, `arch-c4`, `arch-openapi`, `arch-data-model`, `arch-flows`, `arch-class`,
           `arch-cicd`, `arch-testing`, `arch-dod`, `arch-dor`, `arch-task-brief`, `arch-adr`, `arch-infra`
Support: `phase-gate`, `elicit`, `spec-review`, `status`, `implement`

**Design system (UI-bearing projects):** `docs/standards/design/` (parent `design.md` + tokens/color/
typography/motion/components/data-viz/layout/iconography/voice) is generated by the `design-system`
skill and **consumed by the Architect** (task-brief `design_tokens`), **Engineer** (builds against it —
no ad-hoc hex/px/duration; Law 20), and **QA** (design-conformance + Lighthouse-100/WCAG-AA gate). It
compiles to DTCG tokens served by `CE-BRAND-1`.

**Spec location:** `docs/specs/<entity>/<phase>/<artifact>.md`

| Phase | Directory | Artifacts |
|---|---|---|
| 01-brief | `docs/specs/<entity>/01-brief/` | `brief.md` |
| 02-prd | `docs/specs/<entity>/02-prd/` | `prd.md`, `epics/EPIC-NNN.md` |
| 03-roadmap | `docs/specs/<entity>/03-roadmap/` | `roadmap.md` |
| 04-arch | `docs/specs/<entity>/04-arch/tech-spec/` | architecture, openapi, data-model, flows, etc. |
| 04-arch/tasks | `docs/specs/<entity>/04-arch/tasks/` | `TASK-NNN.md` |
| 04-arch/decisions | `docs/specs/<entity>/04-arch/decisions/` | `ADR-NNN.md` |

**Dark factory loop:**
```
/elicit  →  /po  →  /architect  →  /spec-review  →  /implement
                                                       ↓
                    /goal all tasks in phase done, or stop after 60 turns
                                                       ↓
                                             phase_gate() Stop hook → HITL
                                             Approve → next phase
```

**State spine:** `.claude/state/progress.json` (committed after every task)
**Progress CLI:** `bash .claude/scripts/progress.sh kanban|ready|phase-check|update ...`

## Navigation

**Tool priority (use the first available):**

1. **jcodemunch** (if MCP connected) — surgical symbol lookup, no full-file reads.
   After first code is added, run `index_folder` once. Re-run after large commits.
   - When symbol name is obvious, call `get_symbol_source` directly.
   - If that misses, call `search_symbols` then `get_symbol_source`.
   - Always check `_freshness`; if `"stale_index"`, run `index_folder { incremental: true }`.

2. **headroom** (MCP connected) — compresses large tool outputs 60-95% before context.
   Use `headroom_compress` on large file reads or grep output.

3. **ANATOMY.md / docs/wiki/** — broad orientation on an unfamiliar area.

4. **Direct Read + Bash grep** — fall back when no other tools available.

## Project memory

`.claude/memory/MEMORY.md` is the committed-to-git team memory layer.
Types: `project` (initiatives, deadlines), `decision` (architectural rationale),
`feedback` (team conventions), `reference` (external-system pointers).

Use `/remember <fact>` to save explicitly. The `project-memory` skill routes
personal preferences to user-level memory instead.
