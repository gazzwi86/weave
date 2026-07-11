# ============================================================
# ✅ PHASE COMPLETE — build-engine-v1/phase-1 (phase-check confirmed 2026-07-12)
# ============================================================
78/125 tasks, 40/67 epics done. The remaining PLAT/CE/ONB backlog is LATER phases/milestones, not this phase.
NOT blocked — this is a PHASE-GATE boundary. Sequence for the morning:
  1. MERGE the 3 HELD PRs (they carry the last of this phase's code): #64 EPIC-003 (migr 0065/0067), #65 CE-EPIC-005 (multi-tenancy), EPIC-001 BE-024 (migr 0068). All green + review-clean.
  2. Then run **/phase-gate**: /security-review across phase changes, mutation ≥60% (mutmut), ledger remediation sweep (clear open PROJ-* / XT-* findings), docs generation, then Approve/Amend/Reject.
  3. Phase-gate can't meaningfully run until the 3 HELD PRs are on main (their code isn't merged yet).


# ============================================================
# ☀️ MORNING BATCH — surface 9am-8pm AEST (2026-07-12)
# ============================================================
## PHASE STATUS: M2/V1 near-complete, ready-set EXHAUSTED (only BE-024 left, in QA-retry).
77/125 tasks done. 15 epics merged to main this session. Autonomous lanes are now BLOCKED — further progress needs your input on the items below.

## A. TWO HELD PRs — READY TO MERGE (your call, both fully green + review-clean):
   - #64 EPIC-003 (Project Dashboard + Direct Project Prompt) — migrations 0065+0067 (schema tier).
   - #65 CE-EPIC-005 (governance shapes + Rules/validate + metrics) — multi-tenancy tier.
   Merging these UNBLOCKS their dependent tasks (currently blocked on code-on-main, PROJ-008).

## B. BLOCKED CHAINS needing a decision to unblock more M2/V1 work:
   - **PROJ-009 + PROJ-010** (Build E2E infra): project-create 503 (no seeded published CE version) + creator-403 on own source-control. Blocks real Playwright E2E across Build UI (all shipped E2E-met-by-inference). Fix-lane now vs phase-gate batch?
   - **EPIC-012 CE** (CE-014 blocked_by deferred CE-015) — build CE-015 or descope?
   - **CE-023 EPIC-017** re-scope (9 ACs, role-threading + inspector organism — L-sized, was laned S/M).
   - **PLAT-014** (2× overflow — needs re-scope/split).
   - **ONB M1** (4 prereqs) — 19 ONB tasks backlogged behind them.

## C. GOVERNANCE / DEBT decisions (defaults noted, proceeding unless vetoed):
   - XT-CE008-AC03: publish-event spec self-contradiction → default: file follow-up task.
   - PROJ-008: ready-graph = task-done not code-on-main → harness fix (advisor+HITL).
   - PROJ-006: 3× ADR-022 renumber sweep. role-slug harmonization (XT-PLAT027-ROLE + PROJ-009).
   - PROJ-012: sdkgen TS template will break under TS7 (low-pri, not breaking today).
   - build-engine tasks 001-009 milestone-tag consolidation (governance).
   - UI-gate debt: Lighthouse/axe/ui_verify deferred on BE-017/018/019 + CE-006 + BE-021/024 → phase-gate sweep.
   - IDEAS.md → default park post-v1 (offer: OKF-vs-RDF/BPMO trade study).

## D. PHASE-GATE (when M2/V1 tasks all closed): /security-review, mutation ≥60%, ui_verify/Lighthouse/axe sweep, PROJ-014 audit of tests/unit for unmocked network seams, docs generation.

## In flight now: BE-024 (EPIC-001, Build Request Form) QA-retry-1 — fixing governance-test regression + repo_name passthrough. On pass → EPIC-001 auto-merges. Then fully blocked pending A/B above.
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

## BE-024 PARKED + PROJ-008 (cross-epic false-ready) — decision needed (2026-07-11)
**BE-V1-TASK-024 (Build Request Form v2) BLOCKED, parked.** Its brief hard-gates AC-2/AC-8 on `EntityRef`/`KindChip`
design-system atoms ("do not hand-roll — wait on PLAT-V1-TASK-026"). PLAT-026 IS task-status `done` and DID build those
atoms (commit 3c519ae) — but on branch `feature/PLAT-V1-EPIC-011`, which is **NOT merged to main** (EPIC-011 incomplete:
PLAT-027 still backlog). BE-024 branched off main → atoms absent → 2 of 8 ACs unbuildable. Engineer correctly refused to
hand-roll (Law 11), made zero code/state edits, escalated. Worktree `weave-BE-V1-EPIC-001` parked (branch = bare main, no
commits). **UNBLOCKS when EPIC-011 merges to main** (needs PLAT-027 done + EPIC-011 close). Interim: lane refilled with BE-019.
Decision options: (a) prioritise finishing EPIC-011 (PLAT-027) so its atoms land on main → unblocks BE-024 cleanly; (b) let
BE-024 stack on `feature/PLAT-V1-EPIC-011` instead of main (couples epics, restack on EPIC-011 merge); (c) split BE-024 =
build 6 unblocked ACs now + follow-up task for AC-2/AC-8. Recommend (a) — atoms are a shared bottleneck (canvas-legend.tsx
also hand-rolls a KindChip with a flagged-unclosed gap).

**PROJ-008 (harness/process finding):** `progress.sh ready` marks a task READY when its `blocked_by` tasks are STATUS=done —
but NOT that the dependency CODE is merged to main. Cross-epic deps (task in epic X depends on a done task in still-open epic
Y) are **false-ready**: the consumer branches off main and the provider's code isn't there. Bit BE-024. Mitigation applied:
engineer briefs now carry a STEP-0 "code-on-main dependency guard" (grep the required symbols in the worktree before building;
STOP if absent). Proper fix (morning): make `ready` also require each blocking task's epic to be merged to main (or same-epic),
OR add an explicit `code_on_main` gate. Same-epic sequential deps are unaffected (same branch).

## EPIC-009 PR #59 — HELD, green + review-CLEAR (2026-07-11)
CE-EVENT-1 change-feed. Migration 0062 = schema tier → HELD for human merge. cavecrew review CLEAR (no Blocker/Major):
migration 0062 RLS ENABLE+FORCE + append-only trigger (BEFORE UPDATE/DELETE RAISE) + weave_app SELECT/INSERT-only +
BIGSERIAL seq USAGE grant all verified; pipeline.py union gate→mutate→emit, one event/commit, rollback drops the event,
422 never emits; actor=JWT principal; cross-tenant RLS isolation. CI: api/integration/web/semgrep/secrets pass (mutation
pending at checkpoint), ce-perf non-blocking-fail. **Ready for your merge — just needs the schema-tier human sign-off.**

---

## HELD PRs (green but risky-tier — need human merge)

_(none yet)_

## Spec-review gaps (block an engine's lanes)

### ONB (onboarding) — CRITICAL, mechanical. **DECISION NEEDED.**
The 15 M1 onboarding task briefs (`docs/specs/weave/engines/onboarding/m1/tasks/TASK-001..015`,
fully written) are NOT registered in `progress.json` — no `onboarding` base task group, no
`onboarding/phase-1` phase_plan entry (every other engine has both base + `-v1` groups). So the M1
onboarding foundation (TourEngine, beacon machinery, anchor registry, checklist self-mark) is
unbuilt, and every ONB-V1 task's DoR names that M1 machinery as a hard prerequisite → the loop has
no path to satisfy ONB-V1-TASK-001's DoR. **ONB-V1 (all 5 tasks) is blocked until M1 is built.**
- Fix is mechanical (register the 15 briefs into progress.json `tasks[]` + add `onboarding/phase-1`),
  but building ONB M1 is ~15 extra tasks and M1 is not strictly "M2/V1" scope.
- **Question for user:** build the ONB M1 foundation now (unlocks all onboarding), or skip
  onboarding this run? Onboarding lanes are off tonight either way; CE+PLAT fill all 5 lanes.
- Task-brief CONTENT is excellent/red-team-hardened — this is purely a spine-registration gap.
- Non-blocking warnings (fix later): onboarding.md M2-window roadmap section thin (no entry/exit/HITL
  gate vs siblings); PRD stories E2-S1/E2-S3/E3-S1 not amended for M2-window surfaces; tech-spec
  m2-delta.md + invariants.md still `status: Draft`; TASK-004 mis-cites `GET /api/validate` as a
  contracts.md entry (it's CE-internal).

## Escalations (spec-ambiguity / design forks / gate concerns)

### PLAT spec-review gaps (sr-platform) — morning remediation
1. **EPIC-011 (design system) + EPIC-012 (marketing) tagged milestone "v1" — which is NOT a defined
   milestone** (cascade has only M1/M2/v1.0/post-v1; real v1.0 goal = managed connectors only, doesn't
   include these). No phase-gate exit criteria to sign off TASK-026/027/028/029/030. **DECISION:** fold
   EPIC-011/012 into v1.0 scope with amended exit criteria, OR give "v1" its own Goal/entry-exit/gate in
   the roadmap. Coordinator is BUILDING TASK-026 tonight anyway (content is complete, user-priority,
   library needed regardless); this only blocks the epic CLOSE gate → held for morning either way.
2. **TASK-023** uses superseded status enum `healthy/degraded/offline`; canonical is
   `connected/degraded/disconnected` (data-model.md CHECK constraint). Unbuildable as written. Not a
   root (nothing blocked_by it). Fix the brief before TASK-023 is scheduled. Also `adr_refs: []` should
   list ADR-013/ADR-014 (cited in body); orphan `PLAT-NOTIFY-1` citation.
3. **TASK-027 + TASK-030** hard-code role literal `workspace_admin`/`compliance_officer` — contradicts
   the canonical 10-role table AND the workspace-drop tenancy decision
   ([[decision_tenancy-workspace-alignment]]). No snake_case role-slug convention exists anywhere =
   systemic. These tasks are ABOUT removing stale workspace language yet use it. Needs: (a) establish a
   role-slug convention in the spec, (b) fix both briefs. Blocks 027/030 (downstream of 026).
4. Cosmetic (fix anytime): PLAT-010/011/012/013/014/015/016/017/024 frontmatter `milestone: v1` but
   owning epics are `M2` in roadmap — label-only, Gate M2 covers the work. TASK-021 unit-test count
   self-inconsistent (says 8, table names 5). Test-section format split across briefs.

## Scope decisions (user-approved via MCQ, 2026-07-10 ~20:40 AEST)

- **CE ingest (EPIC-012):** KEEP in v1 → TASK-012 (spine) + 013 (conversational doc-ingest, USER
  PRIORITY) + 014 (corpus/retrieval). **DEFER to post-v1** → 015 (ArchiMate/BPMN), 016 (AI
  diagram/image-to-data), 017 (R2RML structured-data), 018 (SKOS). Briefs MOVED to
  `constitution-engine/post-v1/tasks/` (never deleted). 019 (Import & Ingest page) stays v1 but its
  brief must be trimmed to the doc-ingest-only surface when it's built (follow-up).
- **CE Phase-2 gate:** user's "build doc-ingest" = go-ahead; TASK-012 opened treating M1-green as
  sufficient. Roadmap prose still shows a stale Phase-2→v1.0 gate → one-line reconcile owed (queue).
- **Onboarding:** register the 15 M1 briefs + BUILD the ONB M1 foundation now (user chose build-now
  over skip). ONB M1 backfills lanes as they free; ONB-V1 unblocks once M1 done.

## Follow-up tasks to file (tracked, not blocking)

- **mock-OIDC roles-claim fixture gap (recurring, test-infra):** `mock_oidc/tokens.py::issue_token_pair`
  has no `roles`-claim parameter, so every HTTP-driven test gets `principal.roles == []`. Any role-gated
  feature can only prove role-appropriateness at the store/unit level, never end-to-end over real HTTP
  (hit first in PLAT-010 AC-8; will recur in PLAT-027/030 role work + any RBAC route). FILE a small
  test-infra task to add a `roles` param to the shared issuer so role-gated ACs get real-token E2E proof.
  Coordinator accepted store-level proof for PLAT-010; this closes the gap for future role tasks.

- **CE-020 property filters (AC-4/AC-5) ship data-latent by design.** evalFilter logic + UI built
  correct + tested, but the M1 bulk graph load (`map-rows-to-elements.ts`) only sets id/label/bpmo_kind;
  `key_properties` is lazy-loaded per-node on click, never at bulk load. So property filters match
  nothing until a follow-up plumbs a **bounded** key_properties set into the bulk load over CE-READ-1
  (10k-node perf-sensitive — bound it). FILE this as a CE task; property filters go live when it lands.
  Chose this over scope-creeping the SPARQL query into the filters-panel task.
- **14-icon authoring task (NEW, design-agent-owned):** D-2 of CE-020 cites `--shape-kind-*` = 14
  hand-drawn SVG icons (silhouette + inner glyph, strict stroke/corner rules per iconography.md) that
  DO NOT EXIST — no tokens, no sprite file. This is asset-authoring, not engineer wiring; iconography.md
  says this set resolves PRD OQ-08 (still open). CE-020 ships colour+label legend now (satisfies WCAG
  1.4.1 / AC-8) with a shape-glyph seam for drop-in. FILE a design-owned task to author the 14 icons;
  legends/nodes get shape glyphs when it lands. `--shape-kind-*` are icon IDs, NOT CSS tokens.
- **iconography.md token-naming discrepancy:** specs hyphenated `--shape-kind-*`, but shipped
  `--color-kind-*` are no-hyphen (`businessdomain`). PLAT-026 (design-system authority) is resolving to
  the shipped no-hyphen convention in its component library; iconography.md needs a spec-fix to match.
- **Cross-lane note:** CE-020 + PLAT-026 both edit `globals.css`/design tokens on separate branches →
  trivial additive merge-reconcile expected at PR time; PLAT-026's definitions are canonical. Watched.

## Notes / decisions the coordinator made autonomously (FYI, can be reverted)

- EPIC-008 TASK-005: SDK-gen persistence = widen `generation_runs` (migration 0031, ADR-022),
  user-approved via MCQ before going out. Its epic PR will land in **HELD PRs** (migration).
- Spine surgery (descope 015-018 + register 15 ONB M1 + mark CE-012 in_progress) delegated to a
  sonnet agent, coordinator-reviewed before commit to main [skip ci].
- 5-lane plan: BE-005 (bk·docker), CE-020 filters (fe), CE-012 ingest-spine (bk·docker),
  PLAT-010 widget-state (fe), PLAT-026 design-system (fe). Docker capped at 2 (BE-005 + CE-012).

## Epics ready to close (batch: /anatomy refresh once, then ui_verify + PR + CI + auto-merge)

- **CE-V1-EPIC-015 (Filters & Layers Panel) — COMPLETE, QA PASS, ready to close.** Single-task epic
  (TASK-020 only). Frontend, non-risky → AUTO-MERGE eligible (CI-green + code-review-clean). UI epic →
  needs `ui_verify --full` at close. Branch `feature/CE-V1-EPIC-015` HEAD `d0468aa` (24 commits +
  token gap-fill 6590851 + QA edge test d0468aa). Base main. Pre-push needs `/anatomy refresh` first.
  Follow-up: extract renderer-adapter.ts filter-visibility apply (Law E WARN, waivered).

## Parallel-session collision — RESOLVED (2026-07-11 ~05:00 AEST)
2nd /implement session ran same-named agents in same worktrees for a window, then went dormant (~4h no
activity confirmed via source-file mtimes). Reconciled: discarded orphaned 83-file `ruff format` sweep in
weave-PLAT-V1-EPIC-001; committed CE-020's legit z-index token gap-fill to CE-015 (6590851). All 4 lane
worktrees clean + committed HEADs green. LESSON: never run two /implement sessions on the same repo — they
share worktrees + progress.json + agent names and clobber each other. a351d70 (CE-012 in_progress, no
trailer) was likely this session's spine-surgery EDIT-3, benign.

## Follow-up: light-mode-safe series palette (design authority) — CE-021
`--color-series-1..6` (domain-colouring overlay fills, CE-V1-TASK-021) ship DARK-MODE ONLY. color.md's
brand-spectrum stops (teal/magenta/purple/amber/lime + cyan) have dark hex only — light-mode was only ever
computed for accent-primary/hover/soft. On a LIGHT Explorer canvas, adjacent domain fills (e.g. amber #fbbf24
vs lime #a3e635) are near-white + fail WCAG 1.4.11 (non-text contrast) — indistinguishable. The jsdom axe
test runs effectively dark-mode so does NOT catch this. **ACTION (design authority):** compute light-mode-safe
hex for the 5 unaliased series stops (AA/1.4.11 on white), same process kind colours got their light variants.
MUST land before any light-mode ship of the Explorer canvas. Coordinator approved dark-only-for-now (option 2)
— dark-first product, decorative fill, honest code-comment + report flag. Related: iconography/token follow-ups.

## Follow-up: heatmap value→colour mappings source missing — CE-021 (low-sev)
CE-V1-TASK-021's brief sources heatmap value→colour lists from `prototype-findings.md`, which exists only in
the old `.history` folder, not on this branch or in docs. Engineer ships `heatmapMappings` EMPTY (commented) —
a valid AC-6 state ("no data for this dimension → all-grey + legend notice, no error", tested). Overlay shows
all-grey until real value→colour pairs are filled in. ACTION: recover the mappings from prototype-findings.md
(or have design author them) + wire into config. Non-blocking; the empty state is honest + tested.

## Cross-task note: dashboard Cmd+K guard vs TASK-027 shell refit
PLAT-V1-TASK-011 adds a `usePathname` guard to `components/shell/command-palette.tsx` so the global
entity-search Cmd+K no-ops on `/dashboard` (dashboard PromptBar owns Cmd+K there — AC-8). PLAT-V1-TASK-027
(App shell v2 chrome refit, parked/spec-blocked) touches this same shell — it MUST preserve the context-scoped
Cmd+K guard (don't silently re-break it). Coordinator approved the guard (cleanest AC-8 impl, only shared-file edit).

## PRIORITY: PROJ-013 — pytest-cov + asyncpg segfault (3rd task hit, escalating)
`pytest-cov` + `asyncpg` SSL-connect under the coverage tracer segfaults (exit 139) inside the
`platform_stack` fixture — now hit by BE-TASK-001, BE-V1-TASK-001, AND CE-V1-TASK-012. Blocks a merged
coverage number on every docker-lane task (unit-lane coverage looks low because the DB/HTTP paths only the
docker lane exercises can't be instrumented). **ACTION (test-infra, HITL-gated):** either a real fix, or a
documented `--no-cov` carve-out for the docker integration lane per `docs/standards/testing-py.md` (the
carve-out note already exists on PROJ-013 in qa-project-issues.md). Prioritize before a 4th task hits it —
recurring drag on backend QA confidence. Not blocking task DONE (functional correctness proven by the docker
tests; only the % is unmeasurable), but worth fixing at the phase gate or sooner.

## Relocation: happy-path generate E2E → PLAT-V1-TASK-012 (not TASK-011)
PLAT-V1-TASK-011's intent resolver (`dashboard/intent.py::resolve()`) is an intentional STUB that always raises
`ProviderUnavailable` — the REAL classifier is PLAT-V1-TASK-012 (Declarative intent→component mapping,
blocked_by TASK-011). Playwright E2E runs against a live uvicorn, so the in-process `dependency_overrides` fake
resolver can't reach it → every prompt 503s. So TASK-011's E2E covers only the ACHIEVABLE real path (prompt →
provider_503 renders correctly in browser — genuine Law-B). **The happy-path E2E (real generation → widget
fills → GET /api/dashboard/widgets?scope=user asserts the new suggested=false row) is RELOCATED to
PLAT-V1-TASK-012's brief** — when TASK-012 (real resolver) is built, its engineer MUST include this happy-path
E2E. Per never-delete-descoped-briefs: relocated, not dropped. Coordinator-approved option A (avoids
fake-resolver theater; keeps Law B honest).

## Follow-up: 11 of 13 ADR-018 closure predicates lack SHACL shapes — CE-028 (governed ontology decision)
`ontology/shapes/framework.shacl.ttl` declares only 2 of the 13 ADR-018 impact-closure relationship predicates
as `sh:property` shapes (performedBy, servesGoal). The other 11 (dependsOn, runsOn, accesses, consumes,
triggeredBy, hasStep, hasField, governedBy, produces, realizes, partOf) are undeclared → `GET /api/ontology/types`
won't serve them → CE-028's drift guard correctly detects this as REAL drift → impact-traversal is inert
end-to-end against the currently-shipped CE until the shapes land. CE-028 builds+tests the guard against fixtures
(clean + missing-predicate) and surfaces it LOUD (banner + disabled traversal, exactly AC-2). NOT fixed by CE-028:
TASK-004's shapes file has a written decision against speculative relationship shapes, and adding sh:class ranges
from ADR-018's table is a governed ontology change with validation risk (could newly fail seed data). ACTION
(governed): complete the 11 closure-predicate SHACL shapes when backend ontology completion is scheduled — same
degrade-gracefully pattern as CE-020/021's data gaps. Not a surprise at QA/demo: the guard makes it visible.

## Clarification: sandbox has NO Postgres for live-server E2E (affects XT-PLAT010-2 + all UI-epic E2E)
The Playwright webServer (real uvicorn) throws `ConnectionRefusedError` to Postgres in this sandbox — there's no
DB for the live E2E backend. So NO browser E2E that touches a DB route can run here (prompt-bar, dashboard-widgets,
explorer filters/overlays all fail the same way). They TYPE-CHECK now + run at epic-close ui_verify (real env).
XT-PLAT010-2's fix (rewrite dashboard E2E against real backend) is still correct but ALSO only verifiable at
epic-close, not in-sandbox. Don't treat these E2E sandbox failures as code defects.

## Follow-up: native tool-calling on ModelProvider (deferred — CE-013 used JSON+Pydantic instead)
CE-V1-TASK-013's brief specified "typed tool output" but the repo has ZERO tool-calling infra —
`ai/providers.py::ModelProvider.complete()` is plain-text in/out across all 3 providers (Anthropic/Bedrock/
Ollama), and Ollama doesn't share Anthropic's tool-calling API. Coordinator approved option B: extraction uses
the proven `authoring/nl_parser.py` pattern (prompt-for-JSON → fence-strip → json.loads → strict Pydantic
validation) — same typed-output guarantee (rejects off-shape), zero new deps, ADR'd in-task. If native
tool-calling is ever genuinely wanted, that's a SEPARATE infra task: add a `complete_tool()` method to the
shared 3-provider ModelProvider interface (Anthropic tool_use blocks, Bedrock tool config, an Ollama shim) —
a real architecture change touching router.py/nl_parser.py callers, not something to fold into a feature task.

## MORNING ARCHITECT: TASK-028 brief self-contradicts on scope + live-traversal-client follow-up
`constitution-engine/v1/tasks/TASK-028.md` is internally inconsistent: the dated "Scope correction (2026-07-08
red-team)" prose says TASK-028 OWNS the live traversal client (SPARQL fetch walking the closure + canvas
highlight + beyond-depth-cap badges, delivers orphaned M1 AC-6/AC-7, unlocks TASK-030) and names 4 tests — but
the AC table, Test Requirements, pseudocode, DoD, and cost estimate ($0.32) describe ONLY config + drift-guard +
overlay-consuming-a-traceResult, with NO traversal-client tests/pseudocode. The correction was added to prose,
never propagated to the tables.
- **Coordinator interim (overnight):** built TASK-028 NARROW (per the testable AC/DoD of record — overlay consumes
  the in-memory closure walk / fixture, not a live SPARQL client). Zero rework either way (overlay is identical).
- **ARCHITECT (morning):** reconcile the brief — update AC/DoD/cost to match wherever the live client lands.
- **FOLLOW-UP TASK to file (HARD prerequisite for TASK-030):** the live SPARQL traversal client — CE-READ-1 fetch
  that walks the ADR-018 closure, highlights results on canvas, badges beyond-depth-cap, delivering M1 TASK-013
  AC-6/AC-7. This preserves the scope-correction's intent (unblock 030) in its own testable task. NOTE also blocked
  end-to-end by the 11/13 undeclared SHACL closure predicates (see CE-028 ontology follow-up above).

## OPS: docker-lane collision (stack removed 3× mid-QA) + ce013 doc-parsing dep
- **Docker collision:** during TASK-011 QA, the shared `weave-plat-v1-epic-001-postgres-1`/`redis-1` stack was
  fully REMOVED 3× (not by the QA agent) — cost real time, could false-fail lanes. Two docker lanes ran
  concurrently (TASK-011 QA + CE-013). ROOT: lanes not using distinct COMPOSE_PROJECT_NAME, or a stack-teardown
  test (`docker compose down -v`), or a lingering process. MORNING: enforce per-lane COMPOSE_PROJECT_NAME + port
  isolation (the deferred compose-parameterization PR), OR strictly serialize docker lanes to 1 at a time.
- **ui_verify follow-up:** TASK-011 QA did NOT run ui_verify/axe/Lighthouse (docker churn ate time) — a11y/token
  by code-read only. Run the automated UI gate at EPIC-001 epic-close (once docker host is stable).
- **CE-013 new dep:** ce013 added a document-parsing dependency to `packages/backend/pyproject.toml`+`uv.lock`
  (uncommitted at its 3rd death) + a `document_parsing.py`. Law A (common-stack-first) — the continuation must
  JUSTIFY the dep (or use stdlib) + document it; flag if it's an exotic add needing bus-factor acknowledgement.

## CORRECTION: docker collision is fixable NOW (compose is already parameterized)
`packages/backend/docker-compose.yml` already parameterizes ALL ports via env (`${WEAVE_PG_PORT:-5432}`,
`${WEAVE_REDIS_PORT:-6379}`, `${WEAVE_OXIGRAPH_PORT:-7878}`, `${WEAVE_LOCALSTACK_PORT:-4566}`). So per-lane docker
isolation needs NO new PR — each docker lane just exports distinct `COMPOSE_PROJECT_NAME` + a distinct port block
before `docker compose up -d`. The 3× stack-removal collision happened because concurrent docker lanes used the
DEFAULT project name + ports (shared stack). CHEAP FIX (apply going forward): coordinator assigns each docker lane
a COMPOSE_PROJECT_NAME + WEAVE_*_PORT block (like migration blocks). Supersedes the "compose port-parameterization
PR deferred" assumption in the ADV-004 lane rules — the parameterization already shipped.

## HELD PRs (human merge required)
- **PR #54** BE-V1-EPIC-008 (SDK Trigger) — migrations 0021/0031/0032. Restacked clean onto origin/main (zero backend conflict), green (1011 unit + 241 integration). Awaiting your migration review. Opened 2026-07-11.

## ONB-001 QA open items (2026-07-11)
- **AC-001-03 ADR needed** (non-blocking): onboarding user-scoping is enforced by never accepting a client-supplied identity (tenant/user from JWT Principal only), not a runtime 403. QA PASSED it met-by-construction; formalize via ADR/ADR-003 amendment so a future reviewer doesn't reopen as a gap.
- **mutmut CLI gap** (tooling, phase-gate): mutmut 3.6.0 in-repo has no `--paths-to-mutate` run-flag (config-file only) → QA-scoped mutation runs not achievable; DoD "mutation ≥60%" unverified for ONB-001. Fix mutmut config for phase-gate mutation.

## EPIC-012 (CE ingest) PARKS after CE-013 — dependency inconsistency (2026-07-11)
CE-014 (Document Corpus Store) is `blocked_by` CE-012/CE-013/**CE-015**, but CE-015 was deferred to post-v1 (per your
"defer file/diagram importers" MCQ). So CE-014 can't start in v1, and CE-019 (needs CE-014) is likewise blocked →
**EPIC-012 cannot close in v1.** DECISION NEEDED: (a) also defer CE-014+CE-019 to post-v1 (accept EPIC-012 closes at
CE-012+CE-013 only), or (b) un-defer CE-015 (the corpus-store dep) back into v1, or (c) the CE-014→CE-015 blocked_by is
stale and should be dropped. CE-012 + CE-013 are DONE + QA-passed; whichever way, EPIC-012's mergeable content is those two.

## ONB-002 BLOCKED — DoR 4/4 unmet (2026-07-11) — HITL/infra prerequisites
Engineer correctly STOPPED (no code). The Hammerbarn content-seeding path needs these before ANY ONB content task runs:
1. **ADR-002 + ADR-007** move Proposed → Approved (`docs/specs/weave/engines/onboarding/decisions/`).
2. **Hammerbarn content brief** move Draft → Approved (`docs/specs/weave/hammerbarn-content-brief.md`).
3. **content-admin service principal** provisioned via PLAT-IDENTITY-1 (none exists in `identity/registry.py`).
4. **GitHub Actions HITL publish-gate environment** created (repo has ZERO environments) — e.g. `ce-publish` with protection.
Also: brand/voice individuals ship via CE-BRAND-1 which has ZERO backend impl yet (CE-003 lane building it now) — hard dep.
Engineer orientation (kept): parse content brief turtle blocks + synthesize §4/§9/§10 tables (turtle alone = ~3/7 caps → 422);
cross-batch edges resolve via cumulative ApplyResponse.ref_map; convergence needs no new dedup code (server dedups).
Task-brief header links to content-brief/business-process are WRONG paths (real: hammerbarn-content-brief.md, onboarding/tech-spec/business-process.md).
**ONB M1 content-seeding PARKED pending 1-4.** ONB-001 (foundation) already done+merged-ready.

## CE-003 AC-003-06 perf-half deferred (2026-07-11) — scope decision
CE-BRAND-1's perf half (p95 ≤400ms @100k triples, locust) NOT built — the only perf harness (scripts/benchmarks/ce-perf/)
is scoped to CE-008's spike. Engineer flags: extend that harness with a brand corpus, OR defer to CE-BRAND-1's M2
Build-conformance gate (contracts.md scopes that gate to M2). QA to confirm the M2-scoping; likely met-by-deferral.

## CE-023 ESCALATED — oversized + 2 decisions (2026-07-11) — needs you/architect
CE-V1-TASK-023 (explorer Edit Controller) is NOT done — laned as S/M, actually L. Prior continuations mis-reported
"7 ACs pass" (brief has 9; hooks built but UNMOUNTED → unreachable in browser). Genuinely done: AC-1/2/4/5/8 (edit
controller + write proxy logic, unit-tested). NEEDS:
1. **AC-7 role-source DECISION (architectural):** client canEditCanvas needs a role; explorer page threads none from
   server. How does the client get role? (likely thread a server-fetched session prop into ExplorerPage — confirm.)
2. **AC-9 glass inspector scope DECISION:** a 4-tab Properties/Edges/PROV inspector organism (own D-1..D-7 reqs) that
   doesn't exist yet — Complexity-L. In this task, or split? (brief says split = circular dep → probably in-scope.)
Then buildable: rel-type picker UI + mount hooks into ExplorerInteractions + inspector + 2 E2E. Work preserved on
feature/CE-V1-EPIC-017 (HEAD 62bf816). Lane PARKED. Recommend re-scoping the brief (S/M→L) or splitting AC-9.

## EPIC-008 MERGED (#54, squash) — 2026-07-11 ~13:10 by user
origin/main advanced 67fc6ef → ba818b9. Local main state rebased clean. Worktree/branches removed. Held→CLEARED.
**Restack-at-close note:** active lanes (CE-001/003/007/009, PLAT-012) branched off 67fc6ef → base now behind by EPIC-008.
EPIC-008 changed only `generation/*` (SDK trigger + brand SAFETY-GATE) + migrations 0021/0031/0032 — NOT graph_ops or CE
domain dirs → restacks should be LOW-conflict. Each lane restacks onto ba818b9 at its epic-close (freeze rule: not mid-work).
NEW lanes from here branch off ba818b9. CE-003 brand MODEL + EPIC-008 brand GATE are complementary (gate consumes CE-BRAND-1).

## PLAT-014 PARKED — overflows twice during orientation (2026-07-11)
PLAT-V1-TASK-014 (EPIC-001 last task) overflowed 2× just reading files before building anything (large task, likely
dashboard grid/layout). EPIC-001 close is HITL-blocked anyway (XT-PLAT010-2 + milestone-"v1" gate). Parked. Needs a
smaller-scoped brief or manual decomposition before re-attempting. Low ROI until EPIC-001's close-blockers resolve.

## EPIC-009 (Provenance & Version Lifecycle) — CLOSE HELD, migration 0062 (2026-07-11)
CE-008 (change-feed) QA-PASS → EPIC-009 COMPLETE (sole task). Restacked onto green main (pipeline.py union), pushed, PR
opened, driven green + review-clean — but **HELD for human merge: migration 0062 `graph_change_events` = schema tier**
(RLS + grant + append-only trigger). Not auto-merged. **2 morning decisions from CE-008 QA:**
1. **XT-CE008-AC03 (spec self-contradiction):** brief AC-008-03 table says publish events carry a real CE-VERSION-1 IRI, but
   the Scope section + m2-delta §10 diagram (no publish arrow) + §11 invariant only wire the CE-WRITE-1 draft path — publish
   route never emits an event. DECISION: (a) publish-side CE-EVENT-1 hook is in scope → file a new task, or (b) the brief AC
   table is wrong → fix the brief to match Scope/diagram. QA shipped it as DELIVERED-for-scope (documented, not a defect).
2. **XT-CE008-PERF (benchmark gap):** GET /api/events has no ADR-004 in-process perf benchmark (CE-007 has one). Endpoint is
   an indexed cursor SELECT → met-by-inference now; add a benchmark before the phase gate. (This is PROJ-002 territory — the
   locust WARN QA raised is already resolved by the in-process-benchmark approach; CE-008 just lacks its own benchmark file.)

## EPIC-010 MERGED (#58, squash) — main GREEN (2026-07-11) — 5th epic
main → 6c030c4. CE-009 (CE-FUNCTION-1 registry + pipeline.py immutability gate) + CE-011 (kind skos:definition descriptions).
RDF-only, no migration → auto-merged (CI-green + review-clean, non-risky). Restack unioned framework.shacl.ttl (17 shapes +
14 defs) and fixed 2 merge-surfaced bugs: C901 (`_dispatch_pipeline` extract) + a REAL IRI-namespace collision (catalogue
matched by local-name only → glossary skos:Concept stole BPMO weave:Concept slot; now requires the weave namespace). 5 epics
on main: 015, 008, 003, 004, 010.

## EPIC-003 MERGED (#55) — main GREEN again (2026-07-11 ~16:40)
Sequence completed: red-main fix #56 merged (main green 091451b) → EPIC-003 #55 restacked onto green main (empty-iri Blocker
fix 213a756) → CI green → MERGED (4a019c8). 3 epics on main: EPIC-015, EPIC-008, EPIC-003. EPIC-004 union-restack in flight
(a012a574): graph_ops XT-WRITEPATH-1 union (CE-001 punning + CE-003 datatype) + framework.shacl.ttl (glossary + brand shapes).
On green → open EPIC-004 PR → merge. Then re-expand to 5 task lanes.

## HELD PR READY FOR MERGE: #64 EPIC-003 (2026-07-11) — fully green + review-clean
Project Dashboard (BE-019) + Direct Project Prompt (BE-021). Migrations **0065** (generation_runs clock_timestamp) + **0067** (state_spines_trigger) = schema tier → your merge. All blocking CI green (api/integration/web/semgrep/secrets/mutation-a/mutation-b); ce-perf non-blocking. cavecrew review CLEAR (reader-403+audit, no-2nd-cost-path, router union, parameterized SQL). Two CI-only fixes landed post-QA: hermetic prompt-synthesis unit test (was hitting LocalStack) + ruff I001 import-sort. **Ready to merge now.**

## HELD PR: #65 CE-EPIC-005 (2026-07-11) — multi-tenancy tier
Governance shapes (CE-005) + Rules screen + /api/validate (CE-006) + metrics (CE-007). No migration but tenant-scoped SHACL = multi-tenancy → HELD for your merge. 3-way pipeline.py union verified (CE-009 gate + CE-005 tenant-SHACL + CE-008 event). Whole-tree green: ruff 0, mypy 0/540, pytest 1218 passed, integration 306/307 (1 pre-existing flake). Review + CI in flight. Carries the HITL-approved 10k validate perf amendment (ADR-026).

## #65 CE-EPIC-005 NOW FULLY GREEN (2026-07-12) — HELD ready for merge
mutation a/b pass, all blocking green, review-clear. Multi-tenancy tier → your merge. Both #64 (EPIC-003) + #65 (CE-EPIC-005) ready.

## #67 EPIC-001 NOW FULLY GREEN (2026-07-12) — HELD ready for merge
mutation a/b pass, all blocking green, review-CLEAR. Migration 0068 schema tier → your merge. **ALL 3 HELD PRs now fully green + review-clean + ready: #64 (EPIC-003, migr 0065/0067), #65 (CE-EPIC-005, multi-tenancy), #67 (EPIC-001, migr 0068).** Phase build-engine-v1/phase-1 complete on merge → run /phase-gate.

### Caveat for morning: #64/#65 show mergeable=UNKNOWN (pushed before #66 BE-EPIC-005 merged). If GitHub reports a conflict at merge (likely just __init__.py router union), restack: in the worktree `git fetch origin main && git merge origin/main`, resolve routers-union, re-run the 5 CI-discipline checks, `git push --force-with-lease`. #67 = MERGEABLE, clean. Merge order does not matter (independent epics); restack any that conflict after the first lands.

---
## 2026-07-11 (late eve) — ALL-ENGINES v1 build resumed (user: "plod on till all v1 complete")

**Scope (user-set):** complete every non-post-v1 backlog task across CE, PLAT, ONB (BE done). Batch phase-gate to the END across all engines — do NOT phase-gate per-engine.
**Merge policy (user-relaxed 2026-07-11):** auto-merge any epic PR CI-green (ignore ce-perf + mutation-strict noise) + review-clean, INCLUDING migrations/schema/auth/multi-tenancy. Only HARNESS PRs held for human.
**Strategy (user-approved):** PARTIAL-EPIC PRs — the 4 prior-run branches are mid-epic with cross-epic circular deps; land their BUILT tasks, defer unbuilt ones to fresh tasks off main. Breaks the deadlock (CE-016's TASK-021 ⇄ CE-020/022/018).

**Crons (session-only, 7-day expiry — NOT durable):** ca00e4f4 /compact @30min · 65bbaa34 /implement all-engines @5h · d557a251 main-CI guardian @5h (auto-fix+push, ignores ce-perf/mutation-strict). ⚠️ If session dies, crons die — offered user a committed GitHub Actions scheduled workflow for durable guardian; awaiting decision.

**Wave 1 (running) — 4 partial-epic reconcile lanes:**
- CE-V1-EPIC-012 → land TASK-012/013; migrations 0040/0041→0069/0070; defer 014/019
- CE-V1-EPIC-016 → land TASK-020/021/028; no new migration; defer 030 (release-gate)
- PLAT-V1-EPIC-001 → land TASK-010/011/012/013; migrations 0045/0046→0071/0072; defer 014/015
- CE-V1-EPIC-017 → ASSESS-first (STALE/UNCLEAR); land TASK-023 if coherent+tested, else report; defer 024

**Wave 2 (after wave-1 merges unblock deps):** fresh tasks off main — CE-010(EPIC-007), CE-022(020), CE-027(022), CE-026(018), CE-031(023), CE-032(024), PLAT-028/029/030, PLAT-014/015, ONB-002/003/006, ONB-V1-001, etc. Fan out ≤5 lanes, max-unlock first, docker ≤1-2 lanes serial.

**Open flags for human (surface at return):**
- Connectors epic PLAT-V1-EPIC-007 (TASK-006/018/019/020/021/022/025: Atlassian/ServiceNow/Slack/OAuth) — CLAUDE.md says managed connectors "deferred to v1.0". Ambiguous whether that = current v1 scope or post-v1. HOLDING these until confirmed. Everything else proceeds.
