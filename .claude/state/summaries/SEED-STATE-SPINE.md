---
type: State Handoff
title: "State-spine seeding — per-entity model + reseed obligation"
description: "How progress.json is seeded for /implement, why only one entity is loaded at a time, and what the next session must do at each phase boundary."
timestamp: 2026-07-01T00:00:00Z
status: Active
owner: gazzwi86
---

# State-spine seeding — read before `/implement`

## What was seeded (2026-07-01)

`.claude/state/progress.json` now holds **only the Weave Platform engine's M1 tasks**:

- 8 epics: `EPIC-000, 003, 004, 005, 006, 007, 008, 009`
- 9 tasks: `TASK-001 … TASK-009` (bare IDs, within-engine `blocked_by` DAG)
- `phase: "weave-platform/phase-1"`

`progress.sh ready` returns `TASK-001` (monorepo scaffold, no deps) — the correct first task.

## Why only Platform — the harness is one-entity-at-a-time

The `/implement` loop is **not** designed to hold all engines' tasks at once. Three constraints in
`.claude/skills/implement/SKILL.md` force one entity per `progress.json`:

1. **Brief path is built from the bare task ID** — `docs/specs/weave/engines/<entity>/04-arch/tasks/{TASK_ID}.md`
   (lines 146, 326). So the ID in `progress.json` MUST be the bare `TASK-001`, never namespaced.
2. **`<entity>` comes from `phase`, not from the task** (line 40). If `ready` ever returned a task from a
   different engine than the one named in `phase`, the loop would read the WRONG brief file
   (`weave-platform/.../TASK-001.md` for what is actually `constitution-engine/TASK-001.md`).
3. **`progress.sh` dedupes by bare ID**, and all four engines reuse `TASK-001…`. Seeding them flat would
   silently drop every engine's tasks after the first.

Platform is correctly first: it is the shell everything runs in, has no upstream engine dependency, and
delivers the six `PLAT-*` contracts the other engines consume (`weave-platform.md` §4 Roadmap).

## ⚠️ The phase gate does NOT reseed the next entity

`/implement` Step 4 (phase gate) advances the `phase` field but does **not** seed the next engine's tasks.
When Platform's 9 tasks are all `done`, `phase-check` returns COMPLETE and the loop will find **zero ready
tasks** for the next engine until someone seeds it. There is no automated hand-off.

### To seed the next entity (Constitution Engine, after Platform's phase gate passes)

Build order is **Platform → Constitution → Graph Explorer ∥ Build** (`weave-spec.md` §7).

1. Re-run the same pattern for CE's 8 briefs (`constitution-engine/04-arch/tasks/TASK-001…008.md`):
   bare IDs, epic + `blocked_by` read from each brief's frontmatter, `phase: "constitution-engine/phase-1"`.
2. **Drop cross-engine `blocked_by` edges.** CE `TASK-001` has `blocked_by: ["PLAT-SETTINGS-1 provisioned"]`.
   That dep is NOT a CE task ID, so `ready`'s `deps.every(d => doneIds.has(d))` would leave it permanently
   unready. Drop it — it is satisfied by construction, because Platform's phase gate passed first.
3. Graph Explorer (5 tasks) and Build (9 tasks) follow the same recipe; both have only within-engine
   `blocked_by`, so no edges to drop.

## Remaining gates before a clean run (all engines still `status: Draft`)

- `/spec-review weave-platform` — runs automatically inside `/implement` Step 1.5; may flag deferred
  artifacts (e.g. per-engine `invariants.md`, CI stubs). Run standalone first to de-risk.
- Optional HITL: flip the 4 MVP engines `status: Draft → Approved` once satisfied with the tech specs.
