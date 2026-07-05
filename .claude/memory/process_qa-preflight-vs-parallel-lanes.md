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

**Why:** in the serial `/implement` loop the engineer/coordinator writes the summary before QA is
invoked, so the preflight never trips. In parallel lanes the lane finishes code-only (no state write),
so QA trips the preflight on first launch and wastes a round.

**How to apply:** when a parallel lane reports done, the coordinator **pre-writes**
`.claude/state/summaries/<TASK-ID>.md` from the lane's completion receipt (decisions, deviations,
migration-collision notes, downstream context) in the **main repo** checkout, THEN launches QA — and
tells the QA agent the summary is at the main-repo path and not to re-block on the worktree's copy (the
summary lives on main, not the feature branch). See [[project_harness-refinement]] and the ADV-004 lane
rules.
