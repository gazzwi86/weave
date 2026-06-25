---
title: Harness redesign session summary
date: 2026-06-25
sessions: a8605934-71fe-4e2b-9e67-7d162d92a5af (prev), current
type: session-summary
---

# Weave Harness Redesign — Complete Session Summary

This document captures everything completed across the two-session harness redesign sprint
(2026-06-24 and 2026-06-25). The harness is now production-ready for Weave spec work.

---

## What was built

### Skill decomposition (18 new skills)

The original monolithic `po/SKILL.md` and `architect/SKILL.md` have been
**deleted**. They are replaced by 18 per-artifact skills under `.claude/skills/`:

**Product Owner skills** (4)
| Skill | Output path |
|---|---|
| `po-brief` | `.claude/specs/<entity>/01-brief/brief.md` |
| `po-prd` | `.claude/specs/<entity>/02-prd/prd.md` |
| `po-roadmap` | `.claude/specs/<entity>/03-roadmap/roadmap.md` |
| `po-epic` | `.claude/specs/<entity>/02-prd/epics/EPIC-NNN.md` |

**Architect skills** (13)
| Skill | Output path |
|---|---|
| `arch-stack` | `04-arch/tech-spec/stack.md` |
| `arch-c4` | `04-arch/tech-spec/architecture.md` |
| `arch-openapi` | `04-arch/tech-spec/openapi.yaml` |
| `arch-data-model` | `04-arch/tech-spec/data-model.md` |
| `arch-flows` | `04-arch/tech-spec/flows.md` |
| `arch-class` | `04-arch/tech-spec/class-diagram.md` |
| `arch-cicd` | `04-arch/tech-spec/ci-cd.md` + workflow stubs |
| `arch-testing` | `04-arch/tech-spec/testing-strategy.md` |
| `arch-dod` | `04-arch/tech-spec/definition-of-done.md` |
| `arch-dor` | `04-arch/tech-spec/definition-of-ready.md` |
| `arch-infra` | `04-arch/tech-spec/infrastructure.md` + env-schema.yaml |
| `arch-adr` | `04-arch/decisions/ADR-NNN.md` |
| `arch-task-brief` | `04-arch/tasks/TASK-NNN.md` |

**Support skill** (1)
| Skill | Purpose |
|---|---|
| `phase-gate` | HITL ceremony invoked by `phase_gate()` Stop hook |

### Agent orchestration shells (2 updated)

Both persona agents are now **orchestration-only** — they sequence skills, enforce Laws, and
manage HITL contracts. They do not write artifacts directly.

- `agents/product-owner.md` — sequences: `po-brief → po-prd → po-roadmap → po-epic`
- `agents/tech-architect.md` — sequences: `arch-stack → arch-c4 → ... → arch-task-brief` (14 phases)

### Dark factory loop

The implementation loop uses two complementary mechanisms:

1. **`/goal` CLI built-in** (v2.1.139+) — Haiku-evaluated condition after each turn:
   ```
   /goal all tasks in the current phase are done and committed to their feature branches, or stop after 60 turns
   ```
   This is NOT a custom file. It is a native Claude Code CLI built-in. It does not appear in
   `.claude/commands/`.

2. **`phase_gate()` Stop hook** — fires when `progress.sh phase-check` returns COMPLETE
   AND there are tasks in `progress.json`. Invokes the `phase-gate` skill for the HITL ceremony.
   Guard added: does NOT fire on an empty task list (false-positive fix).

### State spine

Progress tracking lives at `.claude/state/progress.json` (previously `docs/state/`).

State directory structure:
```
.claude/state/
  progress.json          — project/phase/epic/task state
  summaries/             — TASK-NNN.md written by Engineer subagent post-implementation
  escalations/           — TASK-NNN-blocker.md for human-blocked tasks
  complexity-waivers.md  — cyclomatic/cognitive waivers (created by QA)
  discovery/             — scout-plan.md and scout outputs (brownfield)
  context/scouts/        — per-domain scout output for large brownfield investigations
```

### Hooks

| Event | Module | Function | What it does |
|---|---|---|---|
| PostToolUse (Edit/Write) | hooks.py | `commit-progress` | Auto-commits progress.json changes |
| Stop | stop.py | `phase_gate()` | Fires HITL ceremony when phase complete |
| Stop | stop.py | `drift_check()` | Suggests /compact or /clear on context drift |
| SubagentStop | lifecycle.py | `subagent_stop()` | Injects task summary into parent context |
| SessionStart | lifecycle.py | `check_setup_status()` | Warns if git hooks not wired |

### CLAUDE.md SDLC section

Fully rewritten with:
- Workflow commands list (`/po`, `/architect`, `/elicit`, `/implement`, `/qa`, `/spec-review`, `/status`)
- Per-artifact skills table
- Spec location table (01-brief, 02-prd, 03-roadmap, 04-arch)
- Dark factory loop diagram
- State spine reference

### Spec path

All Weave specs live under `.claude/specs/<entity>/<phase>/`. Not `docs/specs/`. The entity
is the Weave sub-system being specified (e.g.
`constitution-engine`, `build-engine`, `weave-platform`).

---

## Architecture summary

```
/po           → product-owner agent (orchestration)
                  → po-brief skill    → .claude/specs/<entity>/01-brief/brief.md
                  → po-prd skill      → .claude/specs/<entity>/02-prd/prd.md
                  → po-roadmap skill  → .claude/specs/<entity>/03-roadmap/roadmap.md
                  → po-epic skill     → .claude/specs/<entity>/02-prd/epics/EPIC-NNN.md

/architect    → tech-architect agent (orchestration)
                  → arch-stack skill         → 04-arch/tech-spec/stack.md
                  → arch-c4 skill            → 04-arch/tech-spec/architecture.md
                  → arch-openapi skill       → 04-arch/tech-spec/openapi.yaml
                  → arch-data-model skill    → 04-arch/tech-spec/data-model.md
                  → arch-flows skill         → 04-arch/tech-spec/flows.md
                  → arch-class skill         → 04-arch/tech-spec/class-diagram.md
                  → arch-cicd skill          → 04-arch/tech-spec/ci-cd.md + workflow stubs
                  → arch-testing skill       → 04-arch/tech-spec/testing-strategy.md
                  → arch-dod skill           → 04-arch/tech-spec/definition-of-done.md
                  → arch-dor skill           → 04-arch/tech-spec/definition-of-ready.md
                  → arch-infra skill         → 04-arch/tech-spec/infrastructure.md
                  → arch-adr skill           → 04-arch/decisions/ADR-NNN.md
                  → arch-task-brief skill    → 04-arch/tasks/TASK-NNN.md

/implement    → implement skill (dark factory loop)
                  → /goal clause              loops until phase done or 60 turns
                  → Engineer subagent (TDD, per task, worktree isolation)
                  → QA subagent (validate, extend tests)
                  → phase_gate() Stop hook   → phase-gate skill (HITL ceremony)
```

---

## What is NOT done

- `docs/state/` directory: files were copied to `.claude/state/` but the old directory has not
  been removed. Delete it manually: `rm -rf docs/state`
- Weave product specs: none yet started. Harness is ready; begin with `/po` for
  `constitution-engine` (ships first per CLAUDE.md strategy).
- `qa/SKILL.md` and other inherited skills (discover, init, interview, reconcile,
  scout, status) — these are still present and are now updated to `.claude/state/` paths, but
  have not been tested with Weave's greenfield project layout. Review before invoking them.

---

## How to start Weave spec work

```
/po
```

Choose entity: `constitution-engine` (ships first per the platform strategy).

The full flow:
1. `/po` → product-owner agent → produces brief, PRD, roadmap, epics for constitution-engine
2. `/architect` → tech-architect agent → produces full tech spec + task briefs
3. `/spec-review` → validates spec completeness before implementation
4. `/implement` → dark factory loop → builds everything task by task, phase by phase
