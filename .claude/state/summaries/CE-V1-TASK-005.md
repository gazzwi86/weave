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

## QA PASS (2026-07-11, afb7b34, retry 0) — CE-V1-TASK-005 CLOSES
Adversarial QA, 7/7 ACs each with a passing test. **Tenant isolation — Blocker-class CLEAR, no leak, structurally fail-closed:**
both the governance-commit path (`routers/governance.py` ShapeCommit.tenant_id = JWT principal only; ShapeRuleCommitRequest has
no client tenant field) AND the enforcement path (`routers/operations.py` ApplyContext.tenant_id = JWT only; ApplyRequest has NO
tenant field, `actor` explicitly "never trusted for authorization") are JWT-sourced. `_tenant_shapes_graph` never fetches for a
tenant with no version key → can't leak by construction. Unit (`test_tenant_a_shape_never_leaks_into_tenant_b_validation`) +
integration (commit as A, write as B, 201 unaffected) both green. **Cross-worker cache invalidation genuine** — spawn-context
multiprocessing test, real separate interpreter/cache; Redis version-token `ce:governance:shapes-version:{tenant_id}` is sole
signal, bumped every commit. **PROV dual-actor** — approver=Person always; generator=SoftwareAgent + qualifiedAssociation
(hadRole weave:generator) when generator_iri given; unit + real-Oxigraph integration assert 2 distinguishable agents.
AC-005-05 (invalid shape → 422, commit_spy not called), AC-005-07 (AI down → 503, raw-SHACL stays live) both PASS unit+integration.
**Shared pipeline.py regression CLEAN** — `_apply_uncached` routes through `validate_graph_for_tenant`; full unit suite 975/975,
non-governance writes unaffected. QA added edge test `f5ce9f8` (2nd shape commit is additive `append_graph` not replace — both
shapes independently enforced). Gates: ruff 0, mypy 0, 975/975 unit, 7/7 integration (real stack). retry=0.

**Earlier integration failures = QA-ENV, not code:** docker port collisions with stale OTHER-worktree containers (weave-ce009event
holding 4572/7880). Rebound to free ports → clean pass. Met-by-inference.

**WARN (non-blocking):** (1) coverage not re-measured this pass (engineer claims 98%); (2) **p95<2s-with-shapes NOT benchmarked**
— same gap as XT-CE008-PERF; add ADR-004 in-process benchmark before phase gate (O(1) Redis version-check on hit → low risk).
(3) doc-nits: ADR-024 "a unit test asserts sole-writer" overclaim (no such test; mirrors unenforced M1 invariant); `ai_generated`
field is client-spoofable but documented descriptive-only + drives only PROV generator stamp, breaks no AC (compliance will ask).

## EPIC-005 status: INCOMPLETE — **CE-006 is the last remaining task** (CE-007 done, CE-005 done). Sequential on
feature/CE-V1-EPIC-005 (same worktree/branch). On CE-006 QA-pass → EPIC-005 closes → restack (pipeline.py union w/ EPIC-009) → PR.

## QA (original placeholder below) MUST VERIFY
1. **Multi-tenancy (critical):** tenant A's custom shape does NOT apply to/leak into tenant B's writes (test_tenant_a_shape_does_not_leak).
2. **Cache invalidation cross-worker** — Redis version-token driven (proven via spawn-process test), not in-process signalling.
3. **Shared pipeline.py regression (XT-WRITEPATH-2)** — full unit suite 975/975 green; non-governance writes unaffected.
4. PROV dual-actor stamp correct; 503 degradation; AutomatableShape.

## Gates: mypy 0/443, ruff 0, bandit 0, full unit 975/975, coverage 98% touched modules, 6/6 integration (real stack, marker).
## Commits (feature/CE-V1-EPIC-005): f0b704f · c5dbf7e · 7e60a26 · 7efe431 · 2dc06f3 · 9e1d2dc · 5708773 · c2237fb (HEAD).
## Dep: did NOT need CE-001 (candidate shapes = BPMO predicates only; brief's blocked_by is for a not-yet-built glossary-aware feature).
## Epic status: EPIC-005 has CE-006 remaining + CE-007(done). Lane E continues CE-006 after this QA. Restack onto green main at close
(pipeline.py XT-WRITEPATH-2 union with CE-008/CE-009; XT-CE007-2 dangling-ADR: CE-007 mis-cites ADR-023 — needs own number).
