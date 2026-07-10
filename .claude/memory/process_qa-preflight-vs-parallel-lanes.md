---
name: process_qa-preflight-vs-parallel-lanes
description: QA agent preflight needs the task summary to exist first, but ADV-004 lanes can't write state — coordinator must pre-write it
metadata:
  type: project
---

The `quality-assurance` agent has a **preflight gate**: it refuses to validate unless
`.claude/state/summaries/<TASK-ID>.md` already exists (it hard-fails and does no AC/coverage/lint work
if absent). This collides with **ADV-004 parallel-lane discipline**, under which lane subagents never
write `.claude/state/**` (coordinator owns all state) and the `/implement` loop's CODIFY step (write
summary) normally runs *after* ASSESS (QA), not before.

**Why:** this trips in SERIAL lanes too, not just parallel — confirmed 2026-07-10 on BE-V1-TASK-012.
When the coordinator (correctly, per state-discipline) tells the engineer subagent NOT to write
`.claude/state/**`, no summary gets written, so QA hard-fails preflight even though the code is fine.
The loop's CODIFY-writes-summary-AFTER-QA ordering directly contradicts the QA agent's
summary-must-exist-BEFORE preflight. The old assumption ("in serial the engineer writes it first") is
wrong once engineers are barred from state.

**How to apply (ALL lanes, serial + parallel):** the coordinator **pre-writes**
`.claude/state/summaries/<TASK-ID>.md` (namespaced ID, e.g. `BE-V1-TASK-012.md`) from the engineer's
completion receipt — what shipped, decisions, deviations/ADRs, coverage/gates, commits, downstream
context — in the **main repo** checkout, THEN launches QA. Never rely on the engineer to write it.
Finalize/expand at CODIFY. Watch two adjacent traps seen the same session: (1) engineers repeatedly
hit the 100-tool-use cap and leave work UNCOMMITTED — resume with a commit-FIRST instruction and
verify the tree on every engineer return; (2) summary filename must be the namespaced ID
(`BE-V1-TASK-NNN.md`), not the brief-local `TASK-NNN.md`. See [[project_harness-refinement]] and the
ADV-004 lane rules.
