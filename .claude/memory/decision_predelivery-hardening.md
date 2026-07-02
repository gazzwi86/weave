---
name: Pre-delivery hardening decisions (2026-07-02)
description: Ratified decision set from the pre-/implement spec+harness hardening pass — M1 scope,
  persona-gap dispositions, two-tier model policy, hook philosophy, engine-end HITL gates.
type: decision
created: 2026-07-02
---

gazzwi86 ratified six decision groups before the first `/implement` run (commits c56070e..f1c3a3c):

1. **M1 scope**: kept as specced, single cut — connectors deferred to v1.0 (platform TASK-006 →
   `v1/tasks/`; notifications in-app-only at M1, Slack rides the connector timeline). CE
   Should-Haves and Platform UX extras deliberately NOT cut.
2. **Persona gaps** (personas.md §4, now Active/confirmed): document corpus store (CE FR-043,
   ADR-003) + pre-ingestion context capture (CE FR-044) committed at v1.0; data steward added as
   10th canonical role; ideation/prototyping mode = post-v1 Build candidate; SME interview loop,
   risk-artefact ingestion, non-generated-code audit, scan-reality = recorded candidates only.
3. **Two-tier model policy**: `claude-fable-5` (tech-architect + product-owner agents; judgement
   seats) and `claude-sonnet-5` (everything else incl. QA/validation). Haiku dropped everywhere —
   product stack and harness agents alike.
4. **Hook philosophy**: commit-fast (secrets + lint), push = Semgrep + manifest/OKF parity
   (the `claude -p /security-review` pre-push call removed — AI security review runs once per
   phase in the phase-gate ceremony), heavy pyramid (full tests, mutation, Lighthouse) in CI only.
   Never install husky / Python pre-commit alongside the harness hooksPath.
5. **Engine-end HITL gates**: progress.json carries `phase_plan`
   (platform → constitution-engine → graph-explorer → build-engine); progress.sh
   phase-check/ready/next scope to the current phase's engine, so the stop-hook gate fires at
   every engine boundary; task/epic IDs are engine-namespaced (PLAT-/CE-/GE-/BE-) and each task
   entry carries its `brief` path — the implement loop must use namespaced IDs with progress.sh.
6. **Role model**: CTO/exec sponsor = viewer + billing visibility (not admin); dark-factory
   principals are exactly 5 per contracts.md §PLAT-IDENTITY-1 (Architect/Engineer/QA/Review/
   Sandbox — orchestrator is not a principal); Plugin Laws live once in
   `.claude/rules/plugin-laws.md`.

**Why:** the owner's stated fear is a platform he cannot reason about or amend — hence hard
engine-boundary stops, deterministic hooks, and strict scope discipline before delivery began.
**How to apply:** treat these as settled when running /implement, /architect, or /po; reversals
need explicit owner sign-off. The canonical detail lives in the specs/harness files themselves —
this memory records that the set was ratified and why.
