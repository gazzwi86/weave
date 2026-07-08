---
type: Task
title: "Task: TASK-006 — Orchestrator Hardening: Preflight, Self-Verification, Rich Scaffold + Env-Verification Gate (E11-S6/S7)"
description: "Implement preflight credential-reference checks (FR-049), the agent
  self-verification block at HITL handoffs (FR-048), and the rich repo scaffold with mandatory
  environment-verification HITL gate (FR-050/FR-062) extending the M1 create-and-push floor."
tags: [build-engine, arch, task, m2]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-011
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
resource: docs/specs/weave/engines/build-engine/m2/tasks/TASK-006.md
---

# Task: TASK-006 — Orchestrator Hardening: Preflight, Self-Verification, Rich Scaffold + Env-Verification Gate (E11-S6/S7)

## Story

**Epic:** [EPIC-011 — Dark-Factory Orchestration](../../../build-engine.md#epic-011)
**Status:** Backlog · **Priority:** Should Have

**As a** build operator
**I want** runs to verify their prerequisites before spending budget, agents to prove rule
compliance at every handoff, and new repos to arrive fully scaffolded behind a human
environment check
**So that** runs fail in second one instead of minute nine, silent rule violations stop at the
handoff, and no feature work starts on a repo whose CI/secrets/protections aren't verified

> **FRs covered:** FR-049 (preflight), FR-048 (self-verification block), FR-050 + FR-062 (rich
> scaffold + environment-verification gate; M1 FR-061 create-and-push remains the floor).
> **Preflight closes M2 exit criterion 5.**

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a run starts and at each phase boundary, THE SYSTEM SHALL verify every required credential **reference** resolves (Secrets Manager describe — names only, never values) and record a `gate_results` row `gate: "preflight"` | `should record preflight row at run start and phase boundary` |
| AC-2 | WHEN a critical credential reference is missing or unresolvable, THE SYSTEM SHALL STOP the run to HITL naming the missing reference — never proceed degraded | `should stop to HITL when critical credential reference missing` |
| AC-3 | WHEN preflight reads a credential, THE SYSTEM SHALL never call `get_secret_value` — describe/list only; no secret value in logs, gate rows, or API responses | `should never call get_secret_value in preflight` |
| AC-4 | WHEN an agent hands off at any HITL boundary, THE SYSTEM SHALL attach a self-verification block — one line per applicable rule, `complied\|violated\|n/a` + confidence note — persisted on the handoff record in the state spine | `should persist self-verification block on handoff` |
| AC-5 | WHEN any self-verification line reads `violated`, THE SYSTEM SHALL stop that task for revision (not Done, not next phase) | `should stop task for revision on violated line` |
| AC-6 | WHEN a project repo is bootstrapped (run step 0), THE SYSTEM SHALL additionally apply the rich scaffold: branch-protection rules, full CI workflow, secrets wiring (references), health route + smoke test, git hooks, harness boilerplate | `should apply rich scaffold on bootstrap` |
| AC-7 | WHEN the rich scaffold completes, THE SYSTEM SHALL fire a mandatory environment-verification HITL gate and SHALL NOT dispatch any feature task until a human (non-self, D9) approves it | `should hold feature tasks until env verification approved` |
| AC-8 | WHEN any scaffold step fails (e.g. branch-protection API rejects), THE SYSTEM SHALL halt fail-closed with the failing step named — the M1 floor (create+push) does not silently substitute | `should halt naming failing scaffold step` |

## Implementation

### Pseudocode

```
function preflight(run, phase):
  refs = required_refs(run)        # SCM token, deploy role, CE endpoint, per-project extras
  results = []
  for ref in refs:
    ok = secrets.describe(ref.name) is not None     # names only — AC-3
    results.append({ref: ref.name, ok, critical: ref.critical})
  record_gate(run, "preflight", all(r.ok for r in results), {"refs": results, "phase": phase})
  missing_critical = [r for r in results if r.critical and not r.ok]
  if missing_critical:
    fire_hitl_gate("preflight_failed", refs=[r.ref for r in missing_critical])   # AC-2
    raise RunHalted

function self_verify(agent_result, applicable_rules):
  block = agent_result.self_verification      # produced by agent prompt template (FR-048)
  validate block covers every applicable_rule with complied|violated|n/a  # missing line = violated
  state_spine.attach(agent_result.handoff_id, block)                      # AC-4
  if any(line.status == "violated" for line in block):
    task.status = "revision"                                             # AC-5
    raise HandoffRejected(block.violated_lines)

function rich_scaffold(project):              # extends M1 ensure_project_repo (step 0)
  ensure_project_repo(project)                # M1 floor: create + initial push (FR-061)
  for step in [branch_protection, ci_workflow, secrets_wiring,
               health_route_and_smoke, git_hooks, harness_boilerplate]:
    try: step.apply(project)
    except ScmError as e:
      raise ScaffoldFailed(step=step.name, cause=e)                       # AC-8 — fail closed
  fire_hitl_gate("env_verification", project=project)                     # AC-7
  project.feature_dispatch_held = True        # released only by gate approval (D9 non-self)
```

### API Contracts

No new public endpoint — orchestrator-internal; the env-verification gate surfaces through the
existing M1 HITL web gate (`PLAT-NOTIFY-1` event + Approve/Amend/Reject). Preflight adds
≤ 5 s p95 per boundary (within pipeline budget).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | Preflight before loop; Rich Scaffold extends step 0 |
| Gate flow | `../../tech-spec/m2-delta.md` | §3.4 | Self-verification at handoffs |
| M1 baseline | `../../tech-spec/architecture.md` | §Level 3 | scm_step0 + hitl components this task extends |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| References, never values | FR-049 / security rule | `describe_secret` only; invariants.md greps preflight for `get_secret_value` absence |
| Missing self-verify line = violated | this brief (fail-safe) | An agent that omits a rule line is treated as violating it — no silent gaps |
| Env-verification reuses M1 HITL gate | FR-050/FR-062 | D9 no-self-approval + fail-closed inherited; no new approval flow |
| Scaffold fail-closed, M1 floor never substitutes silently | FR-062 / M1 repo-bootstrap invariant | Halt + named step; operator decides, not fallback logic |
| Self-verify block stored on state spine, no new table | m2-delta §3.4 | JSONB on the existing handoff record |

## Test Requirements

### Unit Tests (minimum 5)

- `should never call get_secret_value in preflight` (spy on secrets client)
- `should treat missing rule line as violated`
- `should stop task for revision on violated line`
- `should halt naming failing scaffold step`
- `should classify non-critical missing ref as warning not halt`

### Integration Tests (minimum 4)

- `should record preflight row at run start and phase boundary`
- `should stop to HITL when critical credential reference missing`
- `should persist self-verification block on handoff` (state-spine row asserted)
- `should apply rich scaffold on bootstrap` (SCM stub asserts protection+CI+hooks calls)
- `should hold feature tasks until env verification approved` (dispatch attempted pre-approval
  is refused; approved by non-self principal releases)

### E2E Tests

N/A — orchestrator-internal; the env-verification web gate reuses the M1 HITL surface already
covered by M1 E2E.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should record preflight row at run start and phase boundary` |
| AC-2 | Integration | `should stop to HITL when critical credential reference missing` |
| AC-3 | Unit | `should never call get_secret_value in preflight` |
| AC-4 | Integration | `should persist self-verification block on handoff` |
| AC-5 | Unit | `should stop task for revision on violated line` |
| AC-6 | Integration | `should apply rich scaffold on bootstrap` |
| AC-7 | Integration | `should hold feature tasks until env verification approved` |
| AC-8 | Unit | `should halt naming failing scaffold step` |

## Dependencies

- **blocked_by:** []
- **unlocks:** []
- **External prerequisites:** M1 ScmDriver + HITL gate machinery + state spine (all live);
  Secrets Manager stubbed in tests (Law F); GitHubDriver/GitLabDriver branch-protection API
  support (extend both drivers behind the one interface)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~9k output
- **Estimated cost:** ~$0.65 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (internal; HITL surface reused)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] No `get_secret_value` in preflight module (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-011

## Implementation Hints

- `required_refs(run)` derives from project config + run mode — keep it a data table, not
  branching logic; per-project extras come from `PLAT-SETTINGS-1`.
- The self-verification block is produced by the **agent prompt template** — this task adds the
  validator/persistence side and the template line-format contract; the applicable-rule list per
  principal comes from the M1 agent-role config.
- Branch protection differs across GitHub/GitLab APIs — implement in each driver behind the
  existing `ScmDriver` interface method (`apply_branch_protection`); do not leak provider
  branching into the orchestrator.
- Harness boilerplate content: render from the effective standards set when present (TASK-001)
  else the demo-default templates — one call, already-built resolution.
- `feature_dispatch_held` lives on the project record; the loop's dispatch guard checks it —
  one boolean, not a new FSM state.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
