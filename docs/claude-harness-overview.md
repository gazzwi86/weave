# Claude Harness Overview

> How the Weave AI development harness works — intended design and operating model.
> Last updated: 2026-06-25. Read this before working on harness configuration.

---

## What this harness is

The Weave harness is a Claude Code configuration that turns Claude into a **spec-driven
dark-factory builder** for the Weave product itself. It implements:

1. **SDLC skills** — composable per-artifact skills that produce high-quality spec documents
   with research rounds, model right-sizing, and section-by-section HITL review
2. **Persona agents** — orchestration shells (PO, Architect, Engineer, QA) that call skills
   in sequence and hold the Laws, handoff contracts, and phase boundaries
3. **Dark factory loop** — an autonomous implementation mode that builds entire phases
   unattended, pausing only at phase-completion gates for human review
4. **Hooks** — lifecycle guards that enforce quality (no secrets, uv-only, anatomy freshness,
   epic-gate HITL, drift detection)
5. **Opinionated stack defaults** — confirmed choices baked in so skills don't defer to a
   lookup table for decisions already made

**What it is NOT:** Weave's product features (Build Engine, Constitution Engine). This harness
builds Weave. The Build Engine is a separate sub-system that Weave will generate for customers.

---

## The SDLC cascade

```
Elicitation
  └─ /elicit (20Q, Six Hats, Five Whys, Stochastic Reasoning)

Product Owner phase          [HITL: section-by-section within each artifact]
  └─ po-brief     → .claude/specs/<entity>/01-brief/brief.md
  └─ po-prd       → .claude/specs/<entity>/02-prd/prd.md
  └─ po-roadmap   → .claude/specs/<entity>/03-roadmap/roadmap.md
  └─ po-epic      → .claude/specs/<entity>/02-prd/epics/EPIC-NNN.md (one per epic)

Tech Architect phase         [HITL: section-by-section within each artifact]
  └─ arch-stack          → settings.json weave.stack
  └─ arch-c4             → tech-spec/architecture.md
  └─ arch-openapi        → tech-spec/openapi.yaml
  └─ arch-data-model     → tech-spec/data-model.md
  └─ arch-flows          → tech-spec/business-process.md
  └─ arch-class          → tech-spec/class-diagram.md
  └─ arch-cicd           → tech-spec/ci-cd.md
  └─ arch-testing        → tech-spec/testing-strategy.md
  └─ arch-dod + arch-dor → tech-spec/definition-of-done.md / definition-of-ready.md
  └─ arch-infra          → tech-spec/infrastructure.md
  └─ arch-adr            → decisions/ADR-NNN.md (one per key decision)
  └─ arch-task-brief     → tasks/TASK-NNN.md (one per task, batched 3-5 for HITL)

Implementation phase (dark factory)
  └─ /implement → phase-gated loop (see Dark Factory section)
      └─ Per task: PLAN → TDD → QA → CODIFY (`/goal` with 60-turn cap, Haiku-evaluated)
      └─ Phase gate: HITL Approve/Amend/Reject after each PO-defined phase

QA + Phase gate
  └─ /qa  → 10-category validation per task
  └─ /security-review → at phase completion
  └─ Phase gate → HITL before next phase
```

---

## Skills reference

### Product Owner skills

| Skill file | Invoked by | Produces | Model |
|---|---|---|---|
| `skills/po-brief/SKILL.md` | `agents/product-owner.md` | `brief.md` | Opus (elicit) → Sonnet (draft) |
| `skills/po-prd/SKILL.md` | `agents/product-owner.md` | `prd.md` | Opus (stories) → Sonnet (NFRs) |
| `skills/po-roadmap/SKILL.md` | `agents/product-owner.md` | `roadmap.md` | Sonnet |
| `skills/po-epic/SKILL.md` | `agents/product-owner.md` | `epics/EPIC-NNN.md` | Sonnet |

### Tech Architect skills

| Skill file | Invoked by | Produces | Model |
|---|---|---|---|
| `skills/arch-stack/SKILL.md` | `agents/tech-architect.md` | `settings.json` stack config | Haiku + AskUser |
| `skills/arch-c4/SKILL.md` | `agents/tech-architect.md` | `tech-spec/architecture.md` | Opus |
| `skills/arch-openapi/SKILL.md` | `agents/tech-architect.md` | `tech-spec/openapi.yaml` | Sonnet |
| `skills/arch-data-model/SKILL.md` | `agents/tech-architect.md` | `tech-spec/data-model.md` | Sonnet |
| `skills/arch-flows/SKILL.md` | `agents/tech-architect.md` | `tech-spec/business-process.md` | Sonnet |
| `skills/arch-class/SKILL.md` | `agents/tech-architect.md` | `tech-spec/class-diagram.md` | Sonnet |
| `skills/arch-cicd/SKILL.md` | `agents/tech-architect.md` | `tech-spec/ci-cd.md` | Sonnet |
| `skills/arch-testing/SKILL.md` | `agents/tech-architect.md` | `tech-spec/testing-strategy.md` | Sonnet |
| `skills/arch-dod/SKILL.md` | `agents/tech-architect.md` | `tech-spec/definition-of-done.md` | Haiku |
| `skills/arch-dor/SKILL.md` | `agents/tech-architect.md` | `tech-spec/definition-of-ready.md` | Haiku |
| `skills/arch-task-brief/SKILL.md` | `agents/tech-architect.md` | `tasks/TASK-NNN.md` | Opus |
| `skills/arch-adr/SKILL.md` | `agents/tech-architect.md` | `decisions/ADR-NNN.md` | Sonnet |
| `skills/arch-infra/SKILL.md` | `agents/tech-architect.md` | `tech-spec/infrastructure.md` | Sonnet |

### Orchestration + support skills

| Skill file | Trigger | Purpose |
|---|---|---|
| `skills/elicit/SKILL.md` | `/elicit` | 20Q, Six Hats, Five Whys, Stochastic |
| `skills/interview/SKILL.md` | PO/brownfield path | SME knowledge extraction |
| `skills/implement/SKILL.md` | `/implement` | Dark factory orchestration |
| `skills/qa/SKILL.md` | Auto (per task) | 10-category task validation |
| `skills/phase-gate/SKILL.md` | Stop hook → implement | Phase completion ceremony |
| `skills/spec-review/SKILL.md` | Pre-scaffold | Spec completeness gate |
| `skills/status/SKILL.md` | `/status` | Progress dashboard |
| `skills/dependency-check/SKILL.md` | Pre-phase | Tool + credential availability |
| `skills/discover/SKILL.md` | Brownfield init | Codebase graph analysis |
| `skills/reconcile/SKILL.md` | Brownfield / wiki-lint | Graph ↔ spec drift detection |
| `skills/scout/SKILL.md` | Brownfield | Targeted file/module investigation |
| `skills/stack-config/SKILL.md` | harness-init / standalone | Set opinionated stack in settings |
| `skills/thinking-tools/SKILL.md` | Any agent | Reasoning frameworks |
| `skills/project-memory/SKILL.md` | `/remember` | Save team facts to committed memory |
| `skills/prototype/SKILL.md` | `/prototype` | Rapid vibe-coded prototype |
| `skills/extract-prototype/SKILL.md` | Architect | Extract tests/patterns from prototype |

---

## Persona agents

Agents are orchestration shells. They hold Laws (non-negotiable constraints), a sequenced
list of skill invocations, and HITL contracts. They do NOT produce artifacts directly —
they delegate to skills.

| Agent | File | Runs | Calls skills |
|---|---|---|---|
| Product Owner | `agents/product-owner.md` | `/po` | po-brief, po-prd, po-roadmap, po-epic |
| Tech Architect | `agents/tech-architect.md` | `/architect` | arch-* (13 skills) |
| Engineer | `agents/engineer.md` | Invoked by implement | scaffold + TDD implementation |
| QA | `agents/quality-assurance.md` | Auto per task | qa skill + reporting |
| Prototyper | `agents/prototyper.md` | `/prototype` | prototype skill |

### Agent Laws (universal, baked into every agent)

- **Law A** — common-stack first (Weave defaults, § Stack)
- **Law B** — functional, browser-runnable, automation-tested (Playwright for UI)
- **Law C** — council-graded quality for enterprise claims (7-persona, ≥ 4.0/5)
- **Law D** — stacked PRs (one PR per phase, small commits)
- **Law E** — complexity as a budget (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- **Law F** — synthetic verification only (LocalStack, not real cloud in tests)

---

## Dark factory — how it works

The dark factory mode runs the implementation loop autonomously between human-review gates.

### Starting a dark factory run

```bash
/implement          # continue from current state
/implement EPIC-003 # start a specific epic
```

### Loop mechanics

```
1. Read progress.json → identify next unstarted task in current phase (dependency-ordered)
2. User (or routine) issues: `/goal all tasks in current phase done, or stop after 60 turns`
   Haiku evaluates the condition after each turn — no hand-rolled turn counter needed
3. Per task:
   a. PLAN: read task brief + dependency summaries from .claude/state/summaries/
   b. DELEGATE: engineer subagent (worktree isolation)
      - write failing tests (TDD)
      - implement until green
      - /simplify + /code-review
      - commit to feature branch
   c. ASSESS: qa subagent (worktree isolation)
      - 10-category validation
      - EARS AC compliance
      - mutation testing (≥ 70%)
      - if FAIL: feed report back to engineer, retry (max 3)
   d. CODIFY: write summaries/TASK-NNN.md, update + commit progress.json, open PR
4. Increment current_run.turns in progress.json after each task
5. When all tasks in the phase complete:
   Stop hook fires → phase_gate() detects phase completion → re-prompts Claude
6. Claude presents: kanban summary, PR list, phase-summary
7. AskUserQuestion: Approve → next phase | Amend → describe changes | Reject → replan
8. If Approve: advance phase in progress.json, loop back to step 1 for next phase
```

### Phase gate (after all epics in a phase)

```
1. /security-review across all changed code
2. Mutation testing report
3. Documentation generation (README, docs/api.md, docs/architecture.md)
4. AskUserQuestion: Approve phase / Amend / Reject
5. If Approve: advance phase in progress.json, dependency-check for next phase
```

### Overnight / unattended pattern

```
Trigger: push to backlog-ready branch, or daily 02:00 UTC (via schedule routine)
Run:    /implement (reads committed progress.json from the clone)
Output: committed progress.json, feature PR(s) opened for human review
Gate:   PR approval = human advance signal
```

---

## Hook architecture

Hooks run shell commands at lifecycle events. All hooks live in
`.claude/scripts/hooks.py` (Python, module-dispatched).

### Active hooks

| Event | Matcher | Function | Effect |
|---|---|---|---|
| PreToolUse | Edit\|Write | `check-no-secrets` | Blocks hardcoded secrets |
| PreToolUse | Edit\|Write + Bash | `check-uv-over-pip` | Blocks `pip install` |
| PostToolUse | Edit\|Write | `mark-anatomy-stale` | Sets anatomy freshness flag |
| PostToolUse | Write|Edit (progress.json) | `commit-progress` | Auto-commits state file |
| Notification | — | `notification` | Logs Claude messages to stderr |
| SessionStart | — | `check_setup_status` | Warns missing git hooks |
| Stop | — | `phase_gate` | Presents HITL gate at phase completion |
| Stop | — | `drift_check` | Context hygiene suggestions (local LLM) |
| SubagentStop | — | `subagent_stop` | Injects task summary back to parent |
| PreCompact | — | `pre_compact` | Snapshot state before compaction |
| SessionEnd | — | `session_end` | Flush pending state |
| UserPromptSubmit | — | `user-prompt-submit` | Inject project memory context |

### HITL gate contract

The `phase_gate` hook fires when `progress.json` transitions to `phase_complete` state:

```
Hook fires → injects HITL prompt via stderr → sys.exit(2)
Claude re-starts → reads HITL prompt → formats kanban + AskUserQuestion
Human approves → implement skill continues to next phase
```

The `stop_hook_active: true` guard on the payload prevents infinite loop.

Phases group a PO-defined set of epics. Gate granularity = one review per phase, not per
epic. Phase boundaries and their HITL checkpoint notes are declared in the roadmap artifact.

---

## Model right-sizing

Skills declare their model tier. The `model-budget` skill returns the configured model
for a given skill name.

| Task type | Model | Effort | Rationale |
|---|---|---|---|
| Elicitation / creative brief writing | claude-opus-4-8 | high | Needs wide reasoning, novel framing |
| Architecture design, C4 diagrams | claude-opus-4-8 | high | Spatial reasoning, tradeoff analysis |
| Task brief writing | claude-opus-4-8 | medium | Self-contained, must be complete |
| PRD stories, flows, openapi | claude-sonnet-4-6 | medium | Structured but not exploratory |
| Data models, class diagrams | claude-sonnet-4-6 | medium | Precision > creativity |
| DoR/DoD, YAML/config generation | claude-haiku-4-5 | low | Mechanical, template-following |
| Validation, lint checks | claude-haiku-4-5 | low | Fast, cheap, deterministic |
| Code implementation (engineer) | claude-sonnet-4-6 | medium | TDD iteration; high effort for complex tasks |
| Security review | claude-opus-4-8 | high | High-stakes, adversarial |

---

## Opinionated stack (Weave defaults)

These are baked into skills. Override requires explicit justification in the PRD.

### Application

- **Backend**: Python 3.12+, FastAPI, Pydantic v2, uv
- **Frontend**: TypeScript strict, Next.js 15 App Router, Tailwind CSS, shadcn/ui
- **API**: REST (OpenAPI 3.1) + SPARQL for graph queries
- **Auth**: AWS Cognito (default) or Auth0 (if multi-IdP required)

### AI / Agents

- **Agent SDK**: Anthropic Agent SDK (Python primary, TypeScript secondary)
- **Agent runtime**: AWS Bedrock AgentCore (GA components only: Runtime, Memory, Identity, Gateway)
- **Models**: claude-opus-4-8 (reasoning), claude-sonnet-4-6 (generation), claude-haiku-4-5 (validation)
- **Guardrails**: AWS Bedrock Guardrails (PII, content policy, topic blocking)

### Data

- **RDF store**: Oxigraph in dev → Neptune / Jena Fuseki eval for prod (decision deferred)
- **Vector**: AWS S3 Vectors
- **Relational**: AWS Aurora PostgreSQL Serverless v2 + SQLAlchemy async
- **Cache**: AWS ElastiCache (Redis 7)

### Infrastructure

- **IaC**: Terraform
- **Compute**: AWS Lambda (primary), ECS Fargate (long-running agents)
- **SPA hosting**: CloudFront + S3
- **Secrets**: AWS Secrets Manager
- **CI/CD**: GitHub Actions with OIDC to AWS
- **Observability**: CloudWatch + OpenTelemetry (Honeycomb or ADOT Collector)

### Semantic web

- **Ontology**: OWL 2 DL, Turtle serialisation
- **Validation**: SHACL
- **Provenance**: PROV-O
- **Vocabulary**: SKOS
- **Query**: SPARQL 1.1 + SPARQL Update
- **Notation** (EA): ArchiMate 3

---

## State files

| File | Written by | Read by | Purpose |
|---|---|---|---|
| `.claude/specs/<entity>/<phase>/*.md` | PO / Architect skills | All agents | Spec artifacts |
| `.claude/state/progress.json` | implement skill, committed | All loops, routines | Task/phase state |
| `.claude/state/summaries/TASK-NNN.md` | Engineer subagent | Next task's PLAN step | Task context chain |
| `.claude/state/summaries/EPIC-NNN.md` | epic-gate skill | Human review, next epic | Epic completion record |
| `.claude/state/escalations/TASK-NNN-blocker.md` | Engineer (on ambiguity) | Human | Blocked task details |
| `.claude/state/complexity-waivers.md` | Engineer | QA | Cyclomatic/cognitive waivers |
| `.claude/memory/MEMORY.md` | project-memory skill | SessionStart | Team decisions, conventions |
| `ANATOMY.md` | /anatomy command | All agents | File/function semantic map |

---

## How to use the harness

### Starting a new feature / spec

```bash
/elicit          # establish context (20Q recommended for new areas)
/po              # brief → PRD → roadmap → epics (section-by-section HITL)
/architect       # tech spec → task briefs (section-by-section HITL)
/spec-review     # completeness gate before any code
/implement       # dark factory: epic-by-epic, with HITL at each epic boundary
```

### Resuming after a break

```bash
/status          # show kanban, current phase, next unblocked task
/implement       # pick up from progress.json
```

### Checking quality

```bash
/qa              # validate the current task against the brief
/security-review # run security pass (auto at phase gate)
/code-review     # review current diff
```

### Saving knowledge

```bash
/remember <fact> # saves to .claude/memory/ (committed, team-visible)
```

---

## Conventions

- **Spec location**: `.claude/specs/<entity>/<phase>/<artifact>.md`
- **Template location**: `.claude/spec-templates/<artifact>.md`
- **Progress**: `.claude/state/progress.json` (always committed, routines depend on it)
- **Skills**: `.claude/skills/<skill-name>/SKILL.md` (Weave-owned)
- **Agents**: `.claude/agents/<persona>.md`
- **Hooks**: `.claude/scripts/hooks.py` + modules in `.claude/scripts/modules/`
- **No `pip install`**: uv only (enforced by hook)
- **No hardcoded secrets**: Secrets Manager only (enforced by hook)

---

## Key design decisions (ADR references)

| Decision | What | Where |
|---|---|---|
| Skill granularity | Per artifact/template (not per persona, not per section) | `.claude/specs/skills-update.md` § 4.1 |
| HITL gates | Spec = section-by-section; implement = phase-gated groups of epics (PO-defined) | `.claude/specs/skills-update.md` § 4.2 |
| Loop mechanism | `/goal` CLI primitive (v2.1.139+, Haiku-evaluated); condition includes `or stop after 60 turns`; `phase_gate()` Stop hook for HITL | `.claude/specs/skills-update.md` § 4.3 |
| Agent runtime | Anthropic Agent SDK → AgentCore (GA only) | `.claude/specs/skills-update.md` § 4.7 |
| Triplestore | Oxigraph dev → Neptune/Fuseki eval prod (deferred) | `.claude/specs/skills-update.md` § 4.5 |
| CRDT library | Deferred to Graph Explorer spec phase | `.claude/specs/skills-update.md` § 4.6 |
