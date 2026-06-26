---
title: Harness & Skills Redesign
status: draft
phase: planning
created: 2026-06-24
authors: [Claude, Gareth]
---

# Harness & Skills Redesign — First Pass Spec

> **Status:** First-pass draft for human review. Use `/po` to formally expand sections.
> Refer to `docs/claude-harness-overview.md` for the intended end-state architecture.

---

## 1. Problem Statement

The current skills imported into `.claude/skills/` are **persona-mapped monoliths** —
each skill file covers the entire workflow for one role (PO, Architect, Engineer, QA). This creates:

- **Shallow quality per artifact**: Each template section (e.g. Mission Statement, C4 diagram,
  OpenAPI contract) gets a sentence of instruction rather than a deep, research-backed process.
- **No model right-sizing**: Every phase uses the same model regardless of whether it's
  exploratory elicitation (needs Opus) or mechanical validation (Haiku suffices).
- **Brittle loop mechanism**: The Stop-hook `exit(2)` loop is hand-rolled and lacks a hard
  turn cap, cost control, or native epic-level HITL.
- **Stack opinionation missing**: Skills reference a generic `docs/stack-equivalents.md`
  lookup but Weave has a confirmed, highly opinionated stack that should be baked in.
- **No dark-factory path**: There is no autonomous "build the full backlog between
  human gates" capability. The loop is manual-resume only.

---

## 2. Goals

1. **Decompose persona skills into per-artifact skills** — one deep skill per spec template,
   each with research rounds, model right-sizing, HITL gates, and evaluation criteria.
2. **Redesign the dark factory loop** — use Claude Code's native `/goal` primitive for
   implementation; epic-by-epic HITL; committed `progress.json` for overnight routines.
3. **Harden hooks** — SubagentStop for task completion detection; remove deprecated
   completion_review loop (replaced by `/goal`); add epic-gate hook logic.
4. **Bake in the opinionated stack** — so skills don't defer to a lookup table for
   confirmed choices; only defer for decisions that are genuinely open.
5. **Write `docs/claude-harness-overview.md`** — orientation doc explaining the complete
   harness for any new session or team member.

---

## 3. Scope

| In scope | Out of scope |
|---|---|
| `.claude/skills/` (Weave-owned) | Imported reference skills (now removed) |
| `.claude/agents/` persona files (orchestration sequences) | Weave product features (build engine, constitution engine) |
| `.claude/settings.json` hooks | Application code |
| `docs/claude-harness-overview.md` | Client-facing documentation |
| Stack defaults in skills/CLAUDE.md | Pricing / commercial decisions |

---

## 4. Design Decisions

### 4.1 Skill granularity: per-artifact (DECIDED)

Each skill maps 1:1 to a spec template file in `.claude/spec-templates/`. Persona agents
(`agents/product-owner.md`, `agents/tech-architect.md`, etc.) hold the orchestration sequence
and call skills in order.

**Rationale:** Templates are the natural seams — they define the artifact boundary. One skill
per artifact allows maximum depth, model right-sizing, and independent evaluation.

**Rejected alternative:** Per-section (mission-skill, vision-skill…) — too fine-grained,
explodes orchestration complexity to ~30+ skills.

### 4.2 HITL gate placement (DECIDED)

| Phase | Gate granularity |
|---|---|
| Spec writing (PO + Architect) | Section-by-section within each artifact |
| Dark factory (Implementation) | After a phase, a group of epics (allows for QA as a set of functionality becomes available) |

**Rationale:** Spec writing requires tight creative review. Implementation can run autonomously
within a set of epics; the human reviews the phase output before the next begins. Phases are defined in the roadmap document by the po and include HITL checkpoint information.

### 4.3 Dark-factory loop mechanism (CONFIRMED — `/goal` is real)

> ✅ **Resolved (2026-06-25):** `/goal` is a native Claude Code CLI built-in (v2.1.139+),
> confirmed from primary source (code.claude.com/docs/en/goal). The council's grep was
> wrong — they searched `.claude/commands/`; `/goal` is not a file but a CLI built-in
> that does not appear there. The previous revision removing `/goal` was incorrect.

**How `/goal` works:**

After each turn, Haiku evaluates whether the stated condition is met. If not, Claude starts
another turn automatically. A turn-cap clause (`or stop after N turns`) is expressed as part
of the condition string — no hand-rolled counter in `progress.json` needed.

**Syntax for the dark factory:**

```
/goal all tasks in the current phase are done and committed to their feature branches,
or stop after 60 turns
```

**Interaction with `phase_gate()` Stop hook:**

`/goal` is itself a session-scoped prompt-based Stop hook (managed by Claude Code). Our
`phase_gate()` is a separate command-based Stop hook in `stop.py`. They are complementary:
`/goal` handles loop continuation between tasks; `phase_gate()` fires the HITL ceremony when
a phase completes. The `stop_hook_active: true` guard prevents infinite re-entry.

**Removed:** Hand-rolled turn-counter (`current_run.turns` / `max_turns`) in `progress.json`.
The 60-turn cap is expressed as a clause in the `/goal` condition, evaluated by Haiku.

**Prerequisite — task ZERO:** Create `.claude/scripts/progress.sh` and `.claude/state/`.
Nothing in the dark factory is testable without this.

### 4.4 HITL implementation for epic gates

Between epics, the loop pauses and the Stop hook fires:

```python
# stop.py — new epic_gate() function
if payload.get("stop_hook_active"):
    return  # guard: already looping
if state.current_epic_complete():
    sys.stderr.write("[Epic N complete. Review required before proceeding.]\n")
    sys.exit(2)  # re-prompts Claude to present AskUserQuestion to the human
```

The re-prompted Claude presents a kanban summary + AskUserQuestion (Approve/Amend/Reject).

### 4.5 Stochastic decision: production triplestore (OPEN)

Oxigraph (local/embedded, used in prototype) vs Amazon Neptune (managed, expensive, native
AWS) vs Apache Jena Fuseki (self-hosted, open).

**Criteria:** AWS-native integration (weight 4), cost at scale (4), SPARQL 1.1 compliance (5),
maintainability (3), query latency (3).

> **To resolve:** Run `/elicit --method stochastic "production RDF triplestore"` during
> the Constitution Engine tech spec phase.

### 4.6 Real-time collaboration CRDT (OPEN)

Yjs (most mature, Lexical/ProseMirror integrations) vs Liveblocks (managed, fast) vs
Automerge (pure CRDT, WebAssembly) vs custom OT.

> **To resolve:** During Graph Explorer tech spec. Constraint: must handle RDF triple-level
> granularity (not just text), which eliminates most off-the-shelf text CRDTs.

### 4.7 Anthropic Agent SDK/AgentCore/Bedrock division (DECIDED — broad strokes)

- **Anthropic Agent SDK** = authoring layer for AI agents generated by Weave's Build Engine.
  Open-source, supports Anthropic direct API + Bedrock, runs anywhere, MCP + A2A native.
  TypeScript SDK hit 1.0 in 2026.
- **AWS AgentCore** = managed runtime/ops for deployed agents (GA Oct 2025). Stateless
  serverless, 8-hr execution windows, session isolation, Memory + Identity + Gateway.
- **AWS Bedrock** = model access layer (Nova, Claude, Titan, etc.).

> **Rule:** Generate portable Anthropic Agent SDK code (the "IR" of the Build Engine). Deploy to
> AgentCore as the default-but-replaceable runtime. Build only on GA AgentCore primitives.
> Flag Payments/Insights as preview-only until GA.

---

## 5. Proposed Skill Inventory

### 5.1 PO Skills (decomposed from `po/SKILL.md`)

Each skill produces one spec artifact, section-by-section, with HITL at every section.

| Skill | Template | Model | Produces |
|---|---|---|---|
| `po-brief` | `spec-templates/brief.md` | Opus (elicit) → Sonnet (draft) | `brief.md` |
| `po-prd` | `spec-templates/prd.md` | Opus (stories) → Sonnet (NFRs) | `prd.md` |
| `po-roadmap` | `spec-templates/roadmap.md` | Sonnet | `roadmap.md` |
| `po-epic` | `spec-templates/epic.md` | Sonnet | `epics/EPIC-NNN.md` |

**Each PO skill must include:**

1. **Context ingestion** — read existing specs, prior 20Q/elicitation docs, CLAUDE.md
2. **Research round** — WebSearch for comparable product implementations, EARS-notation
   acceptance criteria from domain (use context7 for framework docs)
3. **Section-by-section generation** — one section, HITL, next section
4. **EARS notation** — acceptance criteria follow: `WHEN [event] THE SYSTEM SHALL [behaviour]`
5. **Stochastic offer** — detect competing requirements and offer stochastic reasoning
6. **Model right-sizing** — stated in skill; Opus for broad elicitation, Sonnet for structured
   generation, Haiku for mechanical validation/formatting passes
7. **Evaluation criteria** — explicit checklist at the bottom of each skill

### 5.2 Architect Skills (decomposed from `architect/SKILL.md`)

| Skill | Template | Model | Produces |
|---|---|---|---|
| `arch-stack` | — | Haiku (detect) + AskUser | `settings.json weave.stack` |
| `arch-c4` | `spec-templates/architecture/architecture.md` | Opus | `tech-spec/architecture.md` |
| `arch-openapi` | `spec-templates/architecture/openapi.yaml` | Sonnet | `tech-spec/openapi.yaml` |
| `arch-data-model` | `spec-templates/architecture/data-model.md` | Sonnet | `tech-spec/data-model.md` |
| `arch-flows` | `spec-templates/architecture/flows.md` | Sonnet | `tech-spec/business-process.md` |
| `arch-class` | `spec-templates/architecture/class.md` | Sonnet | `tech-spec/class-diagram.md` |
| `arch-cicd` | `spec-templates/tech-spec/ci-cd.md` | Sonnet | `tech-spec/ci-cd.md` |
| `arch-testing` | `spec-templates/tech-spec/testing-strategy.md` | Sonnet | `tech-spec/testing-strategy.md` |
| `arch-dod` | `spec-templates/tech-spec/definition-of-done.md` | Haiku | `tech-spec/definition-of-done.md` |
| `arch-dor` | `spec-templates/tech-spec/definition-of-ready.md` | Haiku | `tech-spec/definition-of-ready.md` |
| `arch-task-brief` | `spec-templates/task.md` | Opus | `tasks/TASK-NNN.md` |
| `arch-adr` | `spec-templates/adr.md` | Sonnet | `decisions/ADR-NNN.md` |
| `arch-infra` | `spec-templates/architecture/infrastructure.md` | Sonnet | `tech-spec/infrastructure.md` |

**Each Architect skill must include:**

1. **Stack-aware generation** — cite Weave's opinionated defaults (§ 7); only defer to
   `docs/stack-equivalents.md` for dimensions not in the opinionated defaults
2. **Research round** — context7 for framework idioms + few-shot patterns from
   `spec-templates/few-shot/<topic>/<stack>.md`
3. **Mermaid diagrams mandatory** — all architecture artifacts include rendered Mermaid
4. **EARS notation in task briefs** — every acceptance criterion is EARS-formatted
5. **Self-contained task briefs** — engineer reads ONLY the task brief (no other spec files)
6. **Model right-sizing** — stated per skill (Opus for exploratory design, Sonnet for
   structured generation, Haiku for DoR/DoD formatting)
7. **Adversarial review step** — after drafting, critic pass: "what would a sceptical
   senior engineer ask?" — add to Design Decisions section

### 5.3 Implementation Skills (updated `implement/SKILL.md`)

The implement skill is largely kept as an orchestrator but gains:

| New/Changed Element | Change |
|---|---|
| Loop mechanism | `/goal` with phase condition and `or stop after 60 turns`; Haiku evaluates condition |
| HITL gate granularity | Phase-gated groups of epics (PO-defined in roadmap); not per-epic |
| Progress state | Commit `progress.json` after every task (not just phase) |
| SubagentStop hook | Enhanced to detect task completion, inject summary back |
| Cost guard | `/goal` with 60-turn cap per epic |

**No decomposition needed**: implement orchestrates engineer + qa agents. The complexity
is in those agents, not the orchestration skill.

### 5.4 QA Skill (enhanced `qa/SKILL.md`)

Existing 10-category validation is good. Add:

- **EARS compliance check** — verify every AC follows `WHEN … THE SYSTEM SHALL …` format
- **Anthropic Agent SDK/AgentCore conventions** — when generated code uses Anthropic Agent SDK, verify
  pattern conformance against `spec-templates/few-shot/` Anthropic Agent SDK examples
- **Mutation testing gate** — Stryker (TS) / mutmut (Python), ≥ 70% mutation score

### 5.5 New Skills

| Skill | Purpose |
|---|---|
| `phase-gate` | Phase completion ceremony: security-review, kanban summary, AskUser Approve/Amend/Reject |
| `stack-config` | Interactive wizard to set Weave's opinionated defaults in `settings.json` |
| `harness-init` | Bootstrap a new project with dark-factory-ready structure |
| `model-budget` | Utility: given a skill name, return the right model + effort level |

---

## 6. Hook Architecture Changes

### Current hooks (assessment)

| Hook | Event | Purpose | Status |
|---|---|---|---|
| `check-no-secrets` | PreToolUse Edit\|Write | Blocks hardcoded secrets | **Keep** |
| `check-uv-over-pip` | PreToolUse Edit\|Write + Bash | Enforces uv | **Keep** |
| `mark-anatomy-stale` | PostToolUse Edit\|Write | Flags anatomy as stale | **Keep** |
| `notification` | Notification | Logs messages | **Keep** |
| `check_setup_status` | SessionStart | Warns missing git hooks | **Keep** |
| `completion_review` | Stop | Injects review prompt + exit(2) | **Replace with /goal** |
| `drift_check` | Stop | Context hygiene suggestions | **Keep (useful)** |
| `subagent_stop` | SubagentStop | Task completion detection | **Enhance** |
| `pre_compact` | PreCompact | Snapshot state | **Keep (stub, enhance)** |
| `session_end` | SessionEnd | Flush/persist state | **Keep (stub, enhance)** |

### Proposed changes

**1. Stop hook: remove `completion_review`, add `phase_gate`**

```python
def phase_gate(payload: dict) -> None:
    """Fires at phase completion — presents HITL gate before next phase."""
    if payload.get("stop_hook_active"):
        return  # already handled
    if not _current_phase_is_complete():
        return  # not a phase boundary
    msg = _format_phase_completion_prompt()
    sys.stderr.write(f"[{msg}]\n")
    sys.exit(2)
```

`completion_review` is removed — `/goal` handles loop termination conditions natively.
`drift_check` is kept as-is.

**2. SubagentStop: task summary injection**

```python
def subagent_stop(payload: dict) -> None:
    """After engineer/QA subagent stops — inject task summary as context."""
    task_id = _extract_task_id_from_payload(payload)
    if not task_id:
        return
    summary_path = f".claude/state/summaries/{task_id}.md"
    if Path(summary_path).exists():
        context = Path(summary_path).read_text()
        # Write as additionalContext for parent to pick up
        sys.stderr.write(f"[Task summary for {task_id}:\n{context}\n]\n")
```

**3. PostToolUse: auto-commit progress.json**

Add a new matcher on progress.json writes:

```json
{
  "matcher": "Write|Edit",
  "hooks": [{
    "type": "command",
    "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/scripts/hooks.py post-tool-use commit-progress",
    "timeout": 10000,
    "async": true
  }]
}
```

The `commit_progress` handler auto-commits `.claude/state/progress.json` after each write,
enabling overnight routines to see accurate state on a fresh clone.

---

## 7. Opinionated Stack Defaults

The following defaults are **baked into Weave's skills** (not deferred to a lookup table).
Use them for all generated projects unless the PRD explicitly overrides with justification.

### Application layer

| Dimension | Default | Rationale |
|---|---|---|
| Backend language | Python 3.12+ | Anthropic Agent SDK primary; data science ecosystem |
| Backend framework | FastAPI | Async, OpenAPI-native, Pydantic |
| Package manager | uv | Speed, lockfile, enforcement hook exists |
| Frontend language | TypeScript (strict) | Type safety, Next.js ecosystem |
| Frontend framework | Next.js 15 (App Router) | SSR, RSC, Vercel + AWS deploy |
| UI components | Tailwind CSS + shadcn/ui | Utility-first, accessible, no CSS bloat |
| API style | REST (OpenAPI 3.1) + GraphQL for graph traversal | OpenAPI for CRUD; GQL for ontology queries |

### AI / Agents layer

| Dimension | Default | Rationale |
|---|---|---|
| Agent authoring | Anthropic Agent SDK (Python + TS 1.0) | Open-source, MCP + A2A, runs on Anthropic direct or Bedrock |
| Agent runtime | AWS Bedrock AgentCore | GA Oct 2025, managed ops layer, session isolation |
| LLM provider | Anthropic Claude (primary) via Bedrock | claude-opus-4-8 for reasoning, claude-sonnet-4-6 for generation, claude-haiku-4-5 for validation |
| Guardrails | AWS Bedrock Guardrails | PII detection, content policy, topic blocking |

### Data layer

| Dimension | Default | Rationale |
|---|---|---|
| RDF/SPARQL store | Oxigraph (dev/test) → evaluate Neptune/Jena Fuseki (prod) | Neptune = managed but expensive; decision deferred to Constitution Engine tech spec |
| Vector store | AWS S3 Vectors (GA 2025) | Serverless, native S3 integration, cost-efficient |
| Relational | AWS Aurora PostgreSQL | Serverless v2, pgvector, Pydantic ORM via SQLAlchemy async |
| Caching | Redis (ElastiCache) | Session, SPARQL result cache |

### Infrastructure

| Dimension | Default | Rationale |
|---|---|---|
| IaC | Terraform | Declarative, multi-cloud, community |
| Compute | AWS Lambda (primary) + ECS Fargate (long-running) | Serverless-first; Fargate for AgentCore workers |
| CDN / SPA hosting | AWS CloudFront + S3 | Standard static hosting |
| API gateway | AWS API Gateway (REST) | Lambda integration, auth, rate limiting |
| Secrets | AWS Secrets Manager | Never in env files |
| CI/CD | GitHub Actions | OIDC to AWS, environment protection rules |
| Observability | AWS CloudWatch + OpenTelemetry | Structured logs, X-Ray traces |

### Semantic web

| Dimension | Default | Rationale |
|---|---|---|
| Ontology language | OWL 2 DL (Turtle serialisation) | Reasoning, inference, W3C standard |
| Validation | SHACL (shapes-based) | Machine-readable constraints |
| Provenance | PROV-O | Change tracking, audit trail |
| Vocabulary mapping | SKOS | Glossary, terminology alignment |
| Architecture modelling | ArchiMate 3 (where used) | EA notation standard |
| Query | SPARQL 1.1 | Standard; SPARQL Update for mutations |

---

## 8. Dark Factory Loop Design

The "dark factory" is an unattended build loop that implements all tasks in a roadmap phase
with no human intervention, pausing at phase-completion gates for human review. Gate granularity
= **one phase** (a PO-defined group of epics from the roadmap; phases include checkpoint metadata).

> **Prerequisite:** `.claude/state/` and `.claude/scripts/progress.sh` must exist before this
> loop is runnable. These are created as task ZERO.

### Interaction model

```
Human: /implement (or /schedule routine trigger)

  Dark Factory Loop (per roadmap phase):
  ┌──────────────────────────────────────────────────────────────────┐
  │  Implement skill reads progress.json → picks current phase/epic  │
  │  User (or routine) runs: /goal all tasks in current phase done,  │
  │  or stop after 60 turns — Haiku evaluates each turn              │
  │                                                                  │
  │  For each task in phase (dependency-ordered across all epics):   │
  │    PLAN  → read task brief + dependency summaries                │
  │    TDD   → engineer subagent (worktree isolated)                 │
  │    QA    → qa subagent (worktree isolated)                       │
  │    CODIFY→ progress summary + commit progress.json               │
  │                                                                  │
  │  Phase complete? → Stop hook fires: phase_gate()                 │
  └─────────────────┬────────────────────────────────────────────────┘
                    │
                    ▼
          AskUserQuestion:
          "Phase N complete. Review kanban + PR list + phase summary.
           Approve → next phase  |  Amend → specify  |  Reject → replan"
                    │
                    ▼ (if Approve)
              next phase loop
```

**Note on naming:** The hook is `phase_gate()` (not `epic_gate()`). It fires when
`progress.json` shows all tasks in the current phase at `done` status.

### State management

```
.claude/state/                   ← MUST be created as task ZERO
  progress.json               ← committed after every task (routines and resumed sessions read this)
  summaries/TASK-NNN.md       ← written by engineer before QA handoff
  summaries/PHASE-N.md        ← written at phase-gate before human review
  escalations/TASK-NNN-blocker.md  ← written by engineer on ambiguity, triggers human review
  complexity-waivers.md       ← cyclomatic/cognitive threshold overrides
```

**OQ4 note (council raised as P4 blocker):** decide before building hooks whether
`progress.json` is the authoritative record (mutable, simple) or a materialized view over
`events.jsonl` (append-only, enables replay/audit, consistent with PROV-O promise).

### Overnight / unattended pattern

Overnight runs use the `/schedule` cloud routine skill. The routine:
1. Reads committed `progress.json` from a fresh clone
2. Picks the next unstarted phase
3. Runs the implement loop up to `max_turns`
4. Commits state and opens a PR

**Council finding (Solutions Architect):** Verify that Claude Code scheduled routines execute
without an open interactive session. If not, use EventBridge cron invoking Lambda shelling to
the Claude Code CLI as the overnight trigger.

### Cost guards

1. `/goal` condition includes `or stop after 60 turns` — evaluated by Haiku, not hand-rolled
2. `/effort low` for Haiku-tier validation tasks
3. QA retry cap: 3 cycles, then write to `escalations/` and surface to human
4. Model tier declared per skill (canonical table: see § 5 model columns)

---

## 9. Persona Agent Changes

The persona agents (`agents/product-owner.md`, `agents/tech-architect.md`, etc.) become
**orchestration shells** — they hold the sequence, laws, and handoff contracts but delegate
all artifact production to the per-artifact skills.

### Product Owner agent (updated sequence)

```
Phase 1: Context ingestion → call elicit (20Q or interview)
Phase 2: Brief → invoke po-brief skill (HITL: section-by-section)
Phase 3: PRD → invoke po-prd skill (HITL: section-by-section)
Phase 4: Roadmap → invoke po-roadmap skill (HITL: section-by-section)
Phase 5: Epics → invoke po-epic skill once per epic (HITL: section-by-section)
Handoff: signal architect "PO artifacts complete and approved"
```

### Tech Architect agent (updated sequence)

```
Phase 1: Verify PO artifacts approved
Phase 2: Stack → invoke arch-stack skill
Phase 3: C4 architecture → invoke arch-c4 skill
Phase 4: OpenAPI → invoke arch-openapi skill
Phase 5: Data model → invoke arch-data-model skill
Phase 6: Flows → invoke arch-flows skill
Phase 7: Class diagram → invoke arch-class skill
Phase 8: CI/CD → invoke arch-cicd skill
Phase 9: Testing strategy → invoke arch-testing skill
Phase 10: DoR + DoD → invoke arch-dod + arch-dor skills
Phase 11: Infrastructure → invoke arch-infra skill (if deployment in scope)
Phase 12: ADRs → invoke arch-adr for each key decision
Phase 13: Task briefs → invoke arch-task-brief per task (HITL: batches of 3)
Handoff: signal implement "spec complete and approved"
```

---

## 10. Research Findings to Incorporate

The following findings from harness research should be folded into skill implementations:

1. **EARS notation** (from AWS Kiro): acceptance criteria format
   `WHEN [event] THE SYSTEM SHALL [behaviour]` — makes every AC directly testable.
   Adopt across all `po-epic`, `arch-task-brief`, and QA validation.

2. **BMAD-METHOD pattern**: each role emits a versioned artifact as inter-agent protocol.
   Weave already mirrors this; strengthen by making artifact version/status explicit in
   YAML frontmatter on every spec file.

3. **OpenHands event-sourced state**: model state as an append-only event log, not mutable JSON.
   Consider `.claude/state/events.jsonl` as the authoritative record with `progress.json` as a
   derived materialized view. Enables replay and audit.

4. **Prompt caching**: cache static system prompts (skills, laws, templates) at the Bedrock
   level; exclude dynamic tool results from the cache boundary. Expected 41-80% cost reduction
   on repeated skill invocations.

5. **Boris Cherny principle**: "lean context + tool retrieval." Anatomy.md + jcodemunch enable
   this. Skills should prefer tool-based context assembly over large static preambles.

6. **Karpathy's autonomy slider**: harness configuration should expose a tunable autonomy level
   per run — not binary. Implementation: a pre-run AskUserQuestion on gate frequency before
   the dark factory loop starts.

---

## 11. Council of 6 — Findings (completed 2026-06-25)

Council ran as 6-persona Workflow (2 Opus + 4 Sonnet). Verdicts: 2 mixed (Cherny, Karpathy),
2 mixed (PO, VC), 2 solid (Architect, Engineer). Full synthesis in workflow output.

### Consensus strengths (4+ personas)

- **Per-artifact skill decomposition** is correct — template seams are the right cut point
- **Model right-sizing** (Opus/Sonnet/Haiku per tier) is correctly calibrated
- **Opinionated stack** should be baked into CLAUDE.md immediately (done ✅)
- **Execution-based verification** (TDD, mutation, Playwright) is the right quality model

### Blockers raised (must resolve before implementation)

| # | Blocker | Raised by | Resolution |
|---|---|---|---|
| B1 | ~~`/goal` phantom~~ — confirmed real (CLI built-in, v2.1.139+). Council's grep searched `.claude/commands/`; `/goal` is not a file there. Verified from primary docs. | Cherny, Karpathy, Architect, Engineer | Resolved: use `/goal` with `or stop after 60 turns` clause. See revised § 4.3. |
| B2 | State spine (`progress.sh`, `.claude/state/`) not yet created | Cherny, Architect, Engineer | Task ZERO in implementation sequence |
| B3 | Gate granularity contradicts itself in 4 places | Karpathy, Architect | Resolved: phase-gated (PO-defined groups). Hook renamed `phase_gate()` |
| B4 | AgentCore 8-hr window — no checkpoint-resume for overnight runs | Architect, Engineer | Verify `/schedule` routine session model; EventBridge fallback |

### Divided opinions (no resolution required now)

| Topic | Side A | Side B |
|---|---|---|
| Rebuild scope | Cherny: too broad, just fix one hook; ship po-brief + stack defaults | Architect/Engineer: per-artifact decomp addresses a confirmed deficiency |
| 40+ skills count | Cherny: start with 4-5, expand after validation | Others: incremental expansion is acceptable |
| Event-sourced state | Architect/VC: decide now, retrofit is costly | Cherny: drop from v1, progress.json works |
| Harness vs product priority | PO/VC: get a customer first | Technical personas: harness is correct focus |

### Product-level findings (for a parallel track)

- Palantir AIP went GA with the same value prop in April 2026 — no stated answer in any doc
- No non-technical user story exists; every artifact assumes OWL/SPARQL fluency
- No ICP (ideal customer profile) or 90-day MVP path to first revenue
- PROV-O tamper-evident claim needs hash-chaining + CloudTrail + S3 Object Lock for SOC 2
- AWS-only stack is a procurement blocker for ~40% of enterprise accounts (Azure/GCP)

---

## 12. Implementation Sequence

> **Note:** The user will run `/po`, `/architect`, and `/implement` to formally develop and
> build these changes. This sequence is a proposed order of operations.

1. **[✅] Write `docs/claude-harness-overview.md`** — done 2026-06-24
2. **[✅] Stack defaults in `CLAUDE.md`** — done 2026-06-25
3. **[✅] Council of 6 review** — done 2026-06-25; findings in § 11
4. **[ ] TASK ZERO: Port `progress.sh` to `.claude/scripts/`; create `.claude/state/`** — nothing in dark factory is testable without this
5. **[ ] Decide OQ4** — event-sourced `events.jsonl` vs mutable `progress.json` before building any hooks
6. **[ ] Verify overnight routine model** — does `/schedule` run without an open session? (council blocker B4)
7. **[ ] Reconcile model-tier tables** — resolve conflicting tiers for `arch-task-brief` across § 5.2, harness overview, and skill text
8. **[ ] Create skill skeleton files** — one `SKILL.md` stub per proposed skill in the inventory
9. **[ ] Implement `po-brief` skill** — first and most critical; proves the per-artifact pattern
10. **[ ] Implement remaining PO skills** — `po-prd`, `po-roadmap`, `po-epic`
11. **[ ] Update `agents/product-owner.md`** — orchestration shell pointing to new skills
12. **[ ] Implement Architect skills** — `arch-stack` first (needed by all others), then in order
13. **[ ] Update `agents/tech-architect.md`** — orchestration shell
14. **[ ] Update hooks** — remove `completion_review`, add `phase_gate`, enhance `subagent_stop`
15. **[ ] Add `phase-gate` skill** — phase completion ceremony
16. **[ ] Update `implement/SKILL.md`** — dark factory loop with turn-counter cost guard

---

## 13. Open Questions

| # | Question | Needed for | How to resolve |
|---|---|---|---|
| OQ1 | Production triplestore: Neptune vs Jena Fuseki vs continue with Oxigraph? | Constitution Engine tech spec | `/elicit --method stochastic "production RDF triplestore"` |
| OQ2 | CRDT library for real-time graph collaboration (RDF triple-level, not just text)? | Graph Explorer tech spec | Research round during that spec phase |
| OQ3 | Multi-tenant data isolation strategy for the ontology graph (row-level vs separate graphs vs separate Neptune clusters)? | Constitution Engine + infra | Architect phase |
| OQ4 | Should `progress.json` be event-sourced (`events.jsonl` + materialized view) for audit/replay? | Dark factory design | Decision before implement harness changes |
| OQ5 | Should the dark factory routines run as AWS Lambda (triggered by GitHub event) or as Claude Code scheduled routines (needs the REPL open)? | Overnight automation | Evaluate Claude Code routine cost vs AWS Lambda cost |
| OQ6 | `arch-task-brief` model: Opus is expensive for many task briefs. Is a Sonnet + critic pattern (Sonnet drafts, Haiku validates against DoR) acceptable? | Cost control | Empirical test |
