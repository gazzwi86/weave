# Overnight decision queue — surface 9am–8pm AEST

HITL is paused overnight (user out ~20:20 AEST 2026-07-10 → resume 9am AEST 2026-07-11). Every item
needing human input is logged here instead of blocking a lane; the coordinator moves to other
unblocking work. Present this batch at 9am.

**Standing policy this run (user-approved 2026-07-10):**
- Auto-merge epic PRs that are CI-green + code-review-clean, EXCEPT any touching
  migrations/schema, auth, multi-tenancy, or the harness → those are HELD here for morning review.
- Spec-review each M2/V1 engine (CE/PLAT/ONB) before implementing it; critical gaps → logged here,
  that engine's lanes skipped tonight.
- 5 concurrent worktree lanes, max-unlock cross-engine roots, docker 1-slot interim rule.

---

## HELD PRs (green but risky-tier — need human merge)

_(none yet)_

## Spec-review gaps (block an engine's lanes)

_(none yet)_

## Escalations (spec-ambiguity / design forks / gate concerns)

_(none yet)_

## Notes / decisions the coordinator made autonomously (FYI, can be reverted)

- EPIC-008 TASK-005: SDK-gen persistence = widen `generation_runs` (migration 0031, ADR-022),
  user-approved via MCQ before going out. Its epic PR will land in **HELD PRs** (migration).
