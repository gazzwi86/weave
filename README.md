# Weave

**The operating system for the AI-native company.**

Weave lets an organisation describe its entire operating model — people, processes, systems,
data, rules, relationships — as a single live knowledge graph, then generates and runs the
applications, AI agents, data pipelines, and automations that operate the business.

It closes the loop that no existing enterprise-architecture, BI, or low-code tool closes
end-to-end: **model → generate → automate → govern**.

---

## The problem

A company's operating model lives scattered across stale architecture diagrams, Confluence
pages, spreadsheets, CMDBs, and individual employees' heads. None of it is machine-readable,
none of it is executable, and all of it drifts out of date the moment it is written down.

Three categories of tooling each solve only one third of the problem:

| Category | What it does | What it misses |
|---|---|---|
| EA tools (LeanIX, ServiceNow CMDB, Visio) | Describes the business | Generates nothing — the model is documentation, not an execution engine |
| Low-code / app builders | Generates software | Has no authoritative model of the business — every app is assembled from tribal knowledge |
| BI / analytics | Reports on the business | Cannot act on it |

AI transformation stalls here. Every automation is bespoke and brittle, the operating model
rots faster than it can be maintained, and the promised value of AI agents — running real
business processes — is never realised at scale.

---

## What Weave does

Weave ships a **universal business ontology** — a process-centric BPMO ("business brain"),
ArchiMate-3-aligned, RDF/OWL/SHACL/PROV-O — that clients populate and extend rather than build
from scratch. Business and technical users co-edit the graph through natural language and guided
forms — no RDF or SPARQL knowledge required — while the underlying model stays standards-compliant
and fully validated.

From that graph, Weave generates and runs:

- **Applications** (UI + API) grounded in the company's ontology, vocabulary, brand, and
  governance constraints — compliant by construction, portable code the team owns
- **AI agents** built against the Anthropic Agent SDK, with budget caps, secrets management,
  and an immutable decision log
- **Data pipelines** and dashboards derived from the live model
- **Automations** triggered by graph changes or external events (Jira, ServiceNow, webhooks, cron)

Every artefact stays traceable to the graph element and spec it came from. When the model
changes, the affected artefacts are known.

### Positioning

Weave is a living **digital twin of the organization (DTO)**: model the business → generate
code/agents/pipelines → automate. The moat is closing that loop on open W3C standards, at
mid-market reach, with whole-business natural-language + forms authoring — **not** the triple
store, which is commoditising fast (Ardoq's 2026 GraphLake acquisition brought RDF/OWL/SHACL to an
EA incumbent). This is a time-limited window: differentiate on generation/automation closure before
the substrate advantage erodes.

**Commercial model:** fully commercial SaaS plus a consulting/workshop engagement arm — no open
source.

---

## The four engines

### Constitution Engine *(ships first — the MVP)*

The authoritative knowledge-graph layer. Holds the live RDF/OWL model of the business,
validates every change against SHACL shapes, tracks full PROV-O provenance, and exposes a
stable versioned interface the other engines read from. The platform shell (app/nav/workspace/
auth/Cognito/Bedrock) is built first as the foundation everything runs in. If the Constitution
Engine is wrong, nothing generated downstream can be right.

### Build Engine

Turns the knowledge graph into working software. Teams spin up projects, co-author
specifications with PO and architect agents, then generate artefacts via autonomous
dark-factory agent teams or interactive human-in-the-loop sessions — with HITL gates, budget
caps, and a mid-flight replan control. Generated artefacts write back into the company
ontology, keeping the model alive in both directions.

### Events & Actions Engine

Automates business processes triggered by internal graph changes or external events —
webhooks, Jira tickets, ServiceNow workflows, cron schedules. Each automation is governed by
the Constitution's rules and policy constraints, and every action is attribution-tracked.

### Graph Explorer

Visualises the company as a force-directed knowledge network with drill-in focus views and a
structured C4 canvas. The MVP ships single-user editing plus async sharing; Figma-style
real-time multi-user collaboration is **Phase 2**. The visual surface on top of the Constitution
Engine's model.

---

## Stack

| Layer | Choices |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, uv |
| Frontend | TypeScript strict, Next.js 15 App Router, Tailwind CSS, shadcn/ui |
| API | REST (OpenAPI 3.1) + SPARQL 1.1 |
| Auth | AWS Cognito (default) / Auth0 (multi-IdP) |
| Agents | Anthropic Agent SDK; AWS Bedrock AgentCore runtime |
| Models | claude-fable-5 (elicitation, product ownership, architecture), claude-sonnet-5 (generation, implementation, QA, validation) |
| RDF store | Oxigraph (dev/test) → Neptune or Jena Fuseki (prod) |
| Relational | AWS Aurora PostgreSQL Serverless v2 |
| Vector | AWS S3 Vectors |
| Cache | AWS ElastiCache (Redis 7) |
| IaC | Terraform, GitHub Actions, AWS Lambda + ECS Fargate |
| Semantic web | OWL 2 DL, SHACL, SPARQL 1.1, PROV-O, SKOS, ArchiMate 3 |

Managed connectors (Snowflake, Databricks, S3, Azure Data Lake, Atlassian, ServiceNow, Slack) are
**deferred to v1.0** — the MVP ships none.

---

## Quickstart — spec-driven development

Weave is built with a spec-driven dark-factory harness: specs cascade Brief → PRD → Roadmap →
Tech Spec → Tasks, and an autonomous `/implement` loop builds from them with human-in-the-loop
gates. To spec and build an engine or feature:

```bash
/elicit         # understand a new problem space (20Q, Six Hats, …)
/po             # Product Owner: brief → PRD → roadmap → epics, section-by-section HITL
                #   → writes docs/specs/weave/engines/<entity>.md
/architect      # Tech Architect: stack → C4 → OpenAPI → data model → … → task briefs
                #   → writes docs/specs/weave/engines/<entity>/{tech-spec,decisions,m1/tasks}/
/spec-review    # completeness gate — must pass before any code
/implement      # dark-factory loop: builds each task TDD-first, pauses at phase gates
/qa · /status   # validate a task · see the kanban + next action
```

To visualise the knowledge graph, run `/okf-visualize` then open `docs/viz.html`. To check spec
conformance, run `/okf-validate`.

**Running the loop:** the operator runbook is
[`docs/running-the-implement-loop.md`](docs/running-the-implement-loop.md) — the full PDAC cycle,
every HITL gate (including the UI run-book sign-off and the `ui_verify` gate), the one-PR-per-epic
model, and resume. How the whole harness fits together is in
[`docs/claude-harness-overview.md`](docs/claude-harness-overview.md).

---

## Repository layout

| Path | What it is |
|---|---|
| `docs/specs/weave/` | The unified spec: `weave-spec.md` (program + foundations), `contracts.md`, `dev-environment.md`, `engines/<entity>.md` + `engines/<entity>/{tech-spec,decisions,m1/tasks}/` |
| `docs/standards/` | Coding standards and the `design/` design system |
| `docs/wiki/` | OKF knowledge bundle — per-area anatomy pages (generated by `/anatomy`) |
| `.claude/` | Claude Code harness — settings, hooks, skills, agents, commands, rules, state |
| `prototypes/` | Throwaway reference material (gitignored; deleted once specs are complete) |
| `CLAUDE.md` | The always-loaded rules and conventions for agents working in this repo |

---

## MVP success criterion

One real client models their company in Weave, and Weave auto-generates one working artefact
— an application, data pipeline, or AI agent — that runs a genuine business process.

---

## Caveman

The [Caveman plugin](https://github.com/juliusbrussee/caveman) is always installed in this repo

---

## Ponytail

I have been using ponytail in this repo to reduce the number of tokens consumed.

In a claude session:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

---

## Headroom
> Local Token Optimization with Headroom and Claude Code

To optimize token usage and compress long contexts (such as file structures, tool outputs, and build logs), this project uses **Headroom** as a local background proxy server for **Claude Code**.

This setup automatically routes all local `claude` CLI commands through Headroom on port `8787` seamlessly across all terminal sessions.

### 🛠️ Global Installation & Setup

#### 1. Install Headroom globally via `uv`
Ensure you have Python ≥ 3.10 and `uv` installed, then run:
```bash
uv tool install "headroom-ai[all]"
```

#### 2. Configure macOS Launch Agent (Persist on Boot)
To ensure the Headroom proxy launches silently in the background when your Mac boots up, we use a custom `launchd` supervisor script.

1. Create a launch agent configuration file:
   ```bash
   nano ~/Library/LaunchAgents/com.headroom.proxy.plist
   ```
2. Paste the following XML configuration:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://apple.com">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.headroom.proxy</string>
       <key>ProgramArguments</key>
       <array>
           <string>/Users/gareth/.local/bin/headroom</string>
           <string>proxy</string>
           <string>--port</string>
           <string>8787</string>
       </array>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/tmp/headroom.stdout.log</string>
       <key>StandardErrorPath</key>
       <string>/tmp/headroom.stderr.log</string>
   </dict>
   </plist>
   ```
3. Save the file (`Ctrl + O`, `Enter`) and exit (`Ctrl + X`).
4. Register and load the daemon immediately:
   ```bash
   launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.headroom.proxy.plist
   ```

#### 3. Route Claude Code Traffic Globally
To ensure every Claude session (including sub-sessions, new terminal tabs, and multiple projects) automatically passes through the proxy, map the base URL in your shell profile.

Add the following line to your `~/.zshrc` (or `~/.bashrc`):
```bash
export ANTHROPIC_BASE_URL="http://localhost:8787"
```
Apply the changes:
```bash
source ~/.zshrc
```

### 🔍 Verification & Troubleshooting

#### Check Proxy Health
Run Headroom's internal system check or ping the port to ensure the background daemon is healthy:
```bash
headroom doctor
```
or 
```bash
curl http://localhost:8787/health
```

#### Inspect Live Logs & Traffic
If you encounter routing anomalies, inspect the background stream outputs:
*   **Error logs:** `cat /tmp/headroom.stderr.log`
*   **Live traffic stream:** `tail -f /tmp/headroom.stdout.log`

#### Live Telemetry Dashboard
You can monitor active context compression rates, token savings metrics, and real-time request histories by visiting the local web user interface:
👉 **[http://localhost:8787/dashboard](http://localhost:8787/dashboard)**

### 🛑 Managing the Service
If you ever need to stop or restart the background service manually:
*   **Stop the background proxy:** 
    ```bash
    launchctl bootout gui/\$(id -u) ~/Library/LaunchAgents/com.headroom.proxy.plist
    ```
*   **Restart / Load the proxy:** 
    ```bash
    launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.headroom.proxy.plist
    ```


---

## Status

Weave is in **active spec-driven development — there is no application code in this repository
yet.** It is a harness that produces the specs from which the product will be built. The
Constitution Engine is the first milestone; the Build, Events & Actions, and Graph Explorer
engines depend on it and ship after it.

Specs live in `docs/specs/weave/`. See [`CLAUDE.md`](CLAUDE.md) for the always-loaded conventions
and [`docs/claude-harness-overview.md`](docs/claude-harness-overview.md) for the full harness,
stack decisions, and development workflow.
