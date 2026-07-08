---
type: Task
title: "Task: TASK-008 — Spec-Coverage Audit + Phase-Gate Ceremony (E12-S4/S5, FR-052/FR-053)"
description: "Implement the spec-coverage audit (every Must FR/NFR → DELIVERED/PARTIAL/MISSING,
  ambiguous = MISSING, halt below 90% or any MISSING) and the phase-gate ceremony that
  auto-triggers on phase-complete: security review, mutation, full QA (TASK-007), coverage audit,
  doc refresh, phase summary, then web HITL under no-self-approval. Any ceremony-step error =
  fail-closed. M2 exit criterion 3."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-012
milestone: v1
created: 2026-07-08
blocked_by: [TASK-007]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-008.md
---

# Task: TASK-008 — Spec-Coverage Audit + Phase-Gate Ceremony (E12-S4/S5, FR-052/FR-053)

## Story

**Epic:** [EPIC-012 — Quality Gates & Spec-Coverage](../../../build-engine.md#epic-012)
**Status:** Backlog · **Priority:** Must Have

**As a** phase approver
**I want** an auto-triggered ceremony that assembles security/mutation/QA/coverage evidence and
holds the phase for my sign-off
**So that** approving a phase means approving verified evidence — and a broken ceremony step
can never wave a phase through

> **FRs covered:** FR-052 (ceremony), FR-053 (spec-coverage audit). Consumes TASK-007's suite as
> step 3. **M2 exit criterion 3** (ceremony completes ≥ 1 phase boundary with web HITL sign-off
> under no-self-approval).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a phase reaches `phase-complete`, THE SYSTEM SHALL auto-trigger the ceremony — no manual invocation required, no way to skip it | `should auto-trigger ceremony on phase-complete` |
| AC-2 | WHEN the ceremony runs, THE SYSTEM SHALL execute in order: security review, delta-mutation score, full QA suite (TASK-007), spec-coverage audit, doc refresh + phase summary, web HITL — recording a `gate_results` row per step | `should run ceremony steps in order with gate rows` |
| AC-3 | WHEN the security review yields a CRITICAL finding, THE SYSTEM SHALL block the Approve action (Amend/Reject remain available) | `should block approve on critical security finding` |
| AC-4 | WHEN any ceremony step errors (tool crash, timeout, unreachable service), THE SYSTEM SHALL fail closed — ceremony halts, gate stays shut, error named in the ceremony record | `should keep ceremony gate closed when a ceremony step errors` |
| AC-5 | WHEN the spec-coverage audit runs, THE SYSTEM SHALL map every `Must` FR/NFR of the phase scope to code or test evidence as `DELIVERED\|PARTIAL\|MISSING`, classify ambiguous items MISSING, and halt the ceremony unless ≥ 90% DELIVERED and zero MISSING | `should mark ambiguous coverage item MISSING and halt below 90 percent` |
| AC-6 | WHEN the ceremony reaches HITL, THE SYSTEM SHALL present the evidence bundle via the web gate (PLAT-NOTIFY-1 event + Approve/Amend/Reject) and SHALL reject an approval whose principal equals any acting agent principal of the phase (D9) | `should reject self-approval of ceremony` |
| AC-7 | WHEN the audit service is unreachable at HITL time, THE SYSTEM SHALL keep the gate closed (M1 fail-closed invariant applies verbatim) | `should keep gate closed on audit outage` |
| AC-8 | WHEN the ceremony passes HITL, THE SYSTEM SHALL write the phase summary + evidence pointers to the state spine and emit `PLAT-AUDIT-1` `ceremony_approved` with approver principal | `should persist phase summary and audit approval` |

## Implementation

### Pseudocode

```
function on_phase_complete(phase, run):          # AC-1 — event-driven, non-skippable
  ceremony = start_ceremony(phase, run)
  STEPS = [
    ("ceremony_security", run_security_review),  # Semgrep/Bandit over phase diff + agent review
    ("ceremony_mutation", run_delta_mutation),   # < gate ⇒ RED (blocks approve like CRITICAL)
    ("qa_full",           lambda: run_full_qa(project, run)),      # TASK-007
    ("coverage_audit",    run_spec_coverage_audit),                # AC-5
    ("ceremony_summary",  build_doc_refresh_and_summary),
  ]
  for (gate_kind, step) in STEPS:
    try:
      verdict, evidence = step()
    except Exception as e:                        # AC-4 — ANY error fails closed
      record_gate(run, gate_kind, "failed", {"error": name(e)})
      ceremony.halt(reason=f"{gate_kind}: {name(e)}")
      return
    record_gate(run, gate_kind, verdict, evidence)
    if verdict in ("failed", "halt"):
      ceremony.halt(reason=gate_kind); return
  fire_hitl_gate("ceremony", evidence=ceremony.bundle(),
                 approve_blocked=ceremony.has_critical())          # AC-3
  # approval callback: D9 non-self check + audit-reachability fail-closed (M1 machinery)

function run_spec_coverage_audit(phase):
  musts = load_phase_scope(phase).requirements(priority="Must")    # FR + NFR
  rows = []
  for req in musts:
    evidence = find_evidence(req)     # code path refs + named tests, from AC↔test map + tree scan
    status = classify(evidence)       # full → DELIVERED, some → PARTIAL, none/ambiguous → MISSING
    rows.append({req: req.id, status, evidence})
  delivered = pct(rows, "DELIVERED")
  ok = delivered >= 0.90 and none(rows, "MISSING")
  return ("passed" if ok else "halt"), {"rows": rows, "delivered_pct": delivered}
```

### API Contracts

No new public endpoint — the HITL surface is the existing M1 web gate. Ceremony budget
≤ 10 min p95 excluding human wait (m2-delta §7). Consumes `PLAT-NOTIFY-1` (gate events) and
`PLAT-AUDIT-1` (approval record) — cite contracts.md.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Ceremony flow | `../../tech-spec/m2-delta.md` | §3.3 | Six-step sequence + fail-closed rule |
| M1 baseline | `../../tech-spec/architecture.md` | §Invariants | HITL fail-closed + no-self-approval invariants reused |
| Business process | `../../tech-spec/business-process.md` | §gate-flow | Phase lifecycle this hooks |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Ceremony steps as data, errors fail closed | FR-052 / m2-delta §3.3 | The `except` in the loop is the invariant; no per-step error creativity |
| Ambiguous = MISSING | FR-053 | `classify` defaults down, never up; the safe default is the spec |
| Approve blocked ≠ ceremony failed | FR-052 | CRITICAL finding leaves Amend/Reject live — humans decide the remediation, gate never auto-opens |
| Reuse M1 HITL + audit fail-closed machinery | M1 D9 | No new approval flow; AC-6/AC-7 largely inherit M1 tests' machinery |
| Evidence pointers, not blobs, in state spine | this brief | Bundle stores gate-row references + run-log offsets; the spine stays lean |

## Test Requirements

### Unit Tests (minimum 5)

- `should mark ambiguous coverage item MISSING and halt below 90 percent`
- `should classify partial evidence as PARTIAL not DELIVERED`
- `should block approve on critical security finding`
- `should keep ceremony gate closed when a ceremony step errors`
- `should compute delivered percentage over Must requirements only`

### Integration Tests (minimum 4)

- `should auto-trigger ceremony on phase-complete` (FSM event fixture)
- `should run ceremony steps in order with gate rows` (stub steps, assert order + rows)
- `should reject self-approval of ceremony` (approver == acting principal)
- `should keep gate closed on audit outage` (audit stub down at approval)
- `should persist phase summary and audit approval` (happy path end-to-end with stubs)

### E2E Tests

Ceremony E2E lane (exit criterion 3): fixture project through phase-complete → ceremony (real
TASK-007 suite against the fixture) → web HITL approve by second principal → phase advances.
Playwright drives the web gate; backend state (phase status + audit row) asserted (Law B).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should auto-trigger ceremony on phase-complete` |
| AC-2 | Integration | `should run ceremony steps in order with gate rows` |
| AC-3 | Unit | `should block approve on critical security finding` |
| AC-4 | Unit | `should keep ceremony gate closed when a ceremony step errors` |
| AC-5 | Unit | `should mark ambiguous coverage item MISSING and halt below 90 percent` |
| AC-6 | Integration | `should reject self-approval of ceremony` |
| AC-7 | Integration | `should keep gate closed on audit outage` |
| AC-8 | Integration | `should persist phase summary and audit approval` |

## Dependencies

- **blocked_by:** [TASK-007]
- **unlocks:** []
- **External prerequisites:** M1 HITL web gate + FSM phase events + PLAT-AUDIT/NOTIFY (live);
  security tooling (Semgrep/Bandit) in execution image

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~20k input, ~9k output
- **Estimated cost:** ~$0.70 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (existing surfaces cited; budget stated)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (TASK-007 suite)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. the ceremony E2E lane)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `MISSING` classification greppable in audit module (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-012

## Implementation Hints

- `find_evidence(req)`: primary source is the AC↔test mapping tables in the project's task
  briefs (machine-readable — TASK-002 M1 schema) + test-tree presence; a code-only match with no
  named test is PARTIAL, never DELIVERED.
- The `classify` ambiguity rule in one line: if the evidence needs a human judgement call, it is
  MISSING — encode as "no exact AC↔test row AND no unambiguous code ref ⇒ MISSING".
- Security review = tool pass (Semgrep/Bandit over the phase diff) + QA-agent triage of
  findings into CRITICAL/other; triage can downgrade tool noise but can never delete a finding
  from the record.
- `ceremony.halt` fires `PLAT-NOTIFY-1` `ceremony_halted` — operators must learn of a halt
  without polling.
- Reuse the M1 no-self-approval check verbatim: acting principals = every principal that
  produced a commit or gate row within the phase — not just the last agent.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
