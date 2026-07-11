# Progress: CE-V1-TASK-005 — Tenant-Scoped Governance Shapes (NL→SHACL, Isolation, Cache Invalidation) (EPIC-005)

`constitution-engine` EPIC-005. LANE E worktree `../weave-CE-V1-EPIC-005`, branch `feature/CE-V1-EPIC-005` (has CE-007 done
too). Backend. Built across many passes (all committed). Coordinator-authored from engineer receipt, pre-QA. HEAD `c2237fb`.

## What shipped (8 commits)
- Tenant-scoped SHACL validation (framework ∪ own-tenant shapes, fail-closed); NL→SHACL + raw-SHACL candidate generation
  (JSON+Pydantic via ai/providers, not tool-calling); tenant-shapes commit writer + PROV-O DUAL-ACTOR (LLM generator +
  human approver); NL-authoring surface (503 when AI down, raw-SHACL stays live); wired into CE-WRITE-1 pipeline.py.
  Real **ADR-023** created (governance shapes) — `7efe431`.
- Tenant shapes live in OXIGRAPH named graph (`tenant_shapes_graph_iri`) — NO Postgres table, NO migration.

## Per-AC (engineer-reported, all 7 tested — QA re-verify): AC-005-01 PROV dual-actor commit-on-approval · -02 enforced
next-commit (single + cross-worker) · -03 tenant B unaffected by A's shape · -04 framework∪own-tenant only · -05 invalid
shape not committed, raw-SHACL live · -06 AutomatableShape when weave:automatable · -07 AI-down→503, raw-SHACL live.

## QA MUST VERIFY
1. **Multi-tenancy (critical):** tenant A's custom shape does NOT apply to/leak into tenant B's writes (test_tenant_a_shape_does_not_leak).
2. **Cache invalidation cross-worker** — Redis version-token driven (proven via spawn-process test), not in-process signalling.
3. **Shared pipeline.py regression (XT-WRITEPATH-2)** — full unit suite 975/975 green; non-governance writes unaffected.
4. PROV dual-actor stamp correct; 503 degradation; AutomatableShape.

## Gates: mypy 0/443, ruff 0, bandit 0, full unit 975/975, coverage 98% touched modules, 6/6 integration (real stack, marker).
## Commits (feature/CE-V1-EPIC-005): f0b704f · c5dbf7e · 7e60a26 · 7efe431 · 2dc06f3 · 9e1d2dc · 5708773 · c2237fb (HEAD).
## Dep: did NOT need CE-001 (candidate shapes = BPMO predicates only; brief's blocked_by is for a not-yet-built glossary-aware feature).
## Epic status: EPIC-005 has CE-006 remaining + CE-007(done). Lane E continues CE-006 after this QA. Restack onto green main at close
(pipeline.py XT-WRITEPATH-2 union with CE-008/CE-009; XT-CE007-2 dangling-ADR: CE-007 mis-cites ADR-023 — needs own number).
