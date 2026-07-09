---
name: parallel-lanes-cap-5
description: User raised the /implement concurrent-lane cap to 5 (from ADV-004's 3), gated on the dependency graph + blocking changes
metadata:
  type: feedback
---

**User directive (2026-07-10): run up to 5 tasks at a time**, not the ADV-004 default of 3 —
"depending on the dependency graph and blocking changes."

**Why:** faster throughput on the /implement build loop; the user explicitly authorises more
parallelism than the harness default.

**How to apply:**
- Up to **5 concurrent lanes**. Draw only tasks/epics with **no dependency path between them** (an
  independent ready-set). Tasks WITHIN one epic stay strictly sequential on the shared
  `feature/{EPIC_ID}` branch — parallelism is ACROSS independent epics, never within one.
- **All other ADV-004 lane rules still hold** (they were not waived, only the cap changed): each
  lane gets its own git worktree + branch; **coordinator alone** writes/commits `.claude/state/**`
  and pre-writes each `summaries/{TASK-ID}.md`; migration numbers pre-assigned per lane; QA-ledger
  findings assigned to at most one lane; escalations serialized (no NEW lane starts while an HITL
  escalation is pending).
- **Docker bottleneck (interim):** until the compose port-parameterization PR merges, only **ONE**
  lane may use the shared docker/Postgres stack at a time. So the practical mix is ~1 docker-backend
  lane + up to 4 non-docker lanes (frontend UI / pure-unit). Honour this or integration tests collide.
- Every engine phase gate still fires in order; nothing merges past an unapproved gate.

**Worktree mechanics (the isolation primitive — load-bearing, not optional for simultaneous tasks):**
- One lane = one git worktree + one `feature/{EPIC_ID}` branch. A branch cannot be checked out in two
  worktrees at once, so each concurrent lane MUST have a distinct branch + its own worktree dir.
- Spawn each lane's engineer/QA either with the Agent tool's `isolation: "worktree"` option, or
  create the worktree explicitly (`git worktree add ../weave-lane-{EPIC} -b feature/{EPIC_ID}`) and
  point the subagent at that path. The coordinator's PRIMARY checkout hosts at most ONE lane and is
  the ONLY place `.claude/state/**` is written/committed.
- Tasks WITHIN an epic still run sequentially in that epic's single worktree (no per-task worktree —
  same branch-can't-live-in-two-worktrees constraint).
- Cleanup after the epic PR merges: `git worktree remove <path>` + `git worktree prune`. On resume,
  reuse an existing lane worktree (don't recreate) — see ADV-004 resume rule.
- Docker/port isolation per lane: distinct `COMPOSE_PROJECT_NAME` + port block; interim = only 1 lane
  on the shared docker stack at a time until the compose port-parameterization PR lands.

Amends the cap only — see ADV-004 and [[process_qa-preflight-vs-parallel-lanes]]. This is a user
instruction recorded as memory, not a harness-file edit; if the `implement` skill's literal "cap: 3"
is ever changed to 5, that edit goes through harness-governance (advisor + HITL).
