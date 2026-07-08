---
type: Task
title: "Task: TASK-009 — Anatomy Indexer, Staleness, Release Plan + M1-Stub Upgrades (E8-S3/S4, E9-S2, FR-043/FR-055)"
description: "Implement the anatomy/wiki auto-index in generated repos (FR-031), the
  CE-VERSION-1 staleness indicator (FR-036), the release/rollback-plan artefact (FR-034), and
  flip both M1 pass-through stubs to enforcing: dep-summary read-and-gate (FR-043) and
  pre-scaffold cascade blocking (FR-055)."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-008
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-009.md
---

# Task: TASK-009 — Anatomy Indexer, Staleness, Release Plan + M1-Stub Upgrades (E8-S3/S4, E9-S2, FR-043/FR-055)

## Story

**Epic:** [EPIC-008 — App Generation](../../../build-engine.md#epic-008) (plus E9-S2, E11-S3,
E12-S6 story slices)
**Status:** Backlog · **Priority:** Must Have

**As a** dark-factory agent (and the operator watching it)
**I want** generated repos self-describing (anatomy/wiki), drift visible (staleness), rollout
reversible (release plan), and the two M1 courtesy checks now enforcing
**So that** agents load context instead of re-discovering it, nobody ships against a stale
graph unknowingly, and the M1 "records but never blocks" grace period is over

> **FRs covered:** FR-031 (anatomy/wiki — **M2 exit criterion 4**), FR-036 (staleness), FR-034
> (release/rollback plan), FR-043 (dep-summary read-and-gate, M1 stub → enforcing), FR-055
> (pre-scaffold cascade blocking, M1 stub → enforcing).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a generation run commits, THE SYSTEM SHALL regenerate `ANATOMY.md` + `docs/wiki/` in the generated repo (files, functions, capability descriptions, ADRs) as part of the run's atomic commit set | `should refresh anatomy in same commit set` |
| AC-2 | WHEN an agent starts a task in a project repo, THE SYSTEM SHALL load the repo's anatomy index into the task context before DELEGATE | `should load anatomy into task context before delegate` |
| AC-3 | WHEN a project is read, THE SYSTEM SHALL compute staleness as CE-VERSION-1 version-lag vs the project's pinned version and set the indicator at lag ≥ threshold (default 2, PLAT-SETTINGS-1) | `should set staleness indicator at lag threshold` |
| AC-4 | WHEN CE is unreachable during staleness computation, THE SYSTEM SHALL report `"unknown"` — never `0`, never the last cached healthy value presented as current | `should report unknown staleness when CE unreachable` |
| AC-5 | WHEN a run reaches deploy readiness, THE SYSTEM SHALL generate a release/rollback-plan artefact (markdown, committed to the project repo): rollout sequence, feature-flag rollback path (FR-035 linkage), approvers, target date | `should commit release plan artefact with required sections` |
| AC-6 | WHEN PLAN runs for a task with predecessors, THE SYSTEM SHALL read each predecessor's dep-summary; a missing summary SHALL hold the task in `Ready` with hold reason `dep_summary_missing` (FR-043 — no longer best-effort) | `should hold task in Ready when predecessor dep summary missing` |
| AC-7 | WHEN the pre-scaffold gate detects a critical cascade gap, THE SYSTEM SHALL return `BLOCKED` naming the failing transition and halt scaffolding (FR-055 — the M1 always-PROCEED behaviour is removed) | `should block scaffolding on critical cascade gap` |
| AC-8 | WHEN the pre-scaffold gate blocks, THE SYSTEM SHALL fire `PLAT-NOTIFY-1` `spec_gap_critical` as a blocking event (not the M1 warning) and record the gate row `result: "BLOCKED"` | `should fire blocking notify and record BLOCKED row` |

## Implementation

### Pseudocode

```
# FR-031 — runs inside the generate pipeline, after gates pass, before commit_workspace
function refresh_anatomy(staging, project):
  index = scan(staging)      # files, exported functions/classes, capability map from spec,
                             # ADRs from decisions/
  write(staging / "ANATOMY.md", render_anatomy(index))
  write_tree(staging / "docs/wiki/", render_wiki_pages(index))
  # part of the same commit set — atomic with the run (AC-1)

function load_task_context(task):                       # AC-2 — PLAN pre-step
  anatomy = scm_driver.read(task.project.repo, "ANATOMY.md")
  task.context.prepend(anatomy)                          # before retrieval slice (TASK-003)

# FR-036
function staleness(project):
  try:
    latest = ce_client.get("/api/ontology/versions", latest=True)     # CE-VERSION-1
    lag = version_distance(project.pinned_graph_version_iri, latest)
    threshold = settings.resolve("build.staleness.threshold", default=2)
    return {"lag": lag, "stale": lag >= threshold}
  except CeUnavailable:
    return {"lag": None, "stale": "unknown"}             # AC-4 — honest, never fake-healthy

# FR-034 — deploy-readiness hook
function emit_release_plan(run, project):
  plan = render_release_plan(
    rollout=run.deploy_sequence, flags=run.feature_flags,      # FR-035 rollback path
    approvers=project.signoff_roles, target_date=run.target_date)
  scm_driver.commit_file(project.repo, "docs/release-plan.md", plan)

# FR-043 — replaces the M1 best-effort reader in the PDAC loop
function check_dep_summaries(task):
  for pred in task.dep_chain.predecessors:
    if repo.dep_summaries.get(pred) is None:
      task.hold(status="Ready", reason="dep_summary_missing", missing=pred)   # AC-6
      raise TaskHeld

# FR-055 — replaces the M1 always-PROCEED return
function run_pre_scaffold_gate(project_iri):
  findings = cascade_findings(project_iri)         # M1 checker unchanged
  critical = [f for f in findings if f.critical]   # e.g. tech_spec absent, impl_ready unset
  if critical:
    plat_notify.fire("spec_gap_critical", blocking=True, findings=critical)  # AC-8
    record_gate(project_iri, "pre_scaffold", "BLOCKED", {"findings": critical})
    return BLOCKED(failing=critical[0].step)       # AC-7
  return PROCEED(findings)                          # non-critical findings still recorded
```

### API Contracts

- Staleness rides the existing `GET /api/projects/{id}` response as
  `staleness: {lag, stale: bool|"unknown"}` — ≤ 100 ms added latency (cached lag, m2-delta §7).
- `POST /api/projects/{project_iri}/gates/pre-scaffold` (M1 endpoint): response `result` gains
  `"BLOCKED"`; body adds `failing_step`. M1 shape otherwise unchanged.
- Anatomy/release-plan are repo artefacts, dep-summary hold is loop-internal — no new endpoints.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | Anatomy Indexer post-gates; stub upgrades in loop |
| Stub upgrades | `../../tech-spec/m2-delta.md` | §3.2 | Both flips specified |
| M1 baseline | `../../tech-spec/architecture.md` | §Level 3 | depsum + gates_quality components this replaces behaviour in |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Anatomy is part of the atomic commit set | m2-delta §2 / FR-031 | A run whose anatomy refresh fails is a failed run — no stale-index commits |
| Staleness `"unknown"` on CE outage | FR-036 / invariants.md | Mirrors CE-METRICS-1 pending-not-zero honesty rule |
| Release plan = repo artefact, not DB entity | m2-delta §3.5 | Markdown in the repo; approvers/date from project record — no new table |
| Hold reason is a named enum value | FR-043 | `dep_summary_missing` greppable; replan agent gets the missing predecessor id |
| M1 pass-through code paths removed, not flagged | FR-055 | No `if m2:` config toggle — the stub behaviour is deleted; M1 tests asserting always-PROCEED are updated to expect BLOCKED |

## Test Requirements

### Unit Tests (minimum 5)

- `should set staleness indicator at lag threshold`
- `should report unknown staleness when CE unreachable`
- `should hold task in Ready when predecessor dep summary missing`
- `should block scaffolding on critical cascade gap`
- `should proceed with recorded findings when gaps are non-critical`

### Integration Tests (minimum 4)

- `should refresh anatomy in same commit set` (SCM stub: one commit contains code + ANATOMY.md)
- `should load anatomy into task context before delegate` (loop fixture)
- `should commit release plan artefact with required sections` (section presence asserted)
- `should fire blocking notify and record BLOCKED row` (notify stub + gate row)

### E2E Tests

N/A — backend/loop internals; the exit-criterion-4 proof is `should load anatomy into task
context before delegate` running against a generated fixture repo.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should refresh anatomy in same commit set` |
| AC-2 | Integration | `should load anatomy into task context before delegate` |
| AC-3 | Unit | `should set staleness indicator at lag threshold` |
| AC-4 | Unit | `should report unknown staleness when CE unreachable` |
| AC-5 | Integration | `should commit release plan artefact with required sections` |
| AC-6 | Unit | `should hold task in Ready when predecessor dep summary missing` |
| AC-7 | Unit | `should block scaffolding on critical cascade gap` |
| AC-8 | Integration | `should fire blocking notify and record BLOCKED row` |

## Dependencies

- **blocked_by:** []
- **unlocks:** []
- **External prerequisites:** CE-VERSION-1 (M1, live); M1 dep-summary writer, pre-scaffold
  checker, PLAT-NOTIFY-1 (all live; this task changes their consumers' behaviour)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~8k output
- **Estimated cost:** ~$0.60 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (delta on existing endpoints; no new ones)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. updated M1 stub tests — expect BLOCKED, not PROCEED)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `unknown` staleness + `dep_summary_missing` + BLOCKED greppable (invariants.md verify-bys)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-008

## Implementation Hints

- Anatomy scan: language-aware but shallow — exported symbols + docstrings/JSDoc, not a full
  parse; capability descriptions come from the spec record, not inferred from code.
- `version_distance`: count published versions between pin and latest from the
  `GET /api/ontology/versions` ordered list — no semver arithmetic.
- Cache staleness per project with a short TTL (60 s) so project list reads don't fan out to CE;
  the cache stores the lag, never fabricates `stale: false` on miss (miss + CE down = unknown).
- FR-055 critical vs non-critical: critical = missing artefact in the cascade
  (brief/PRD/roadmap/tech-spec absent, impl_ready unset); non-critical = staleness/format
  findings. The M1 checker already tags these — reuse its classification.
- Update, don't duplicate, the M1 tests that pinned always-PROCEED (`test_pre_scaffold_gate_
  records_findings_and_proceeds_on_missing_prd` becomes the BLOCKED variant for critical gaps;
  keep a PROCEED test for the non-critical path).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
