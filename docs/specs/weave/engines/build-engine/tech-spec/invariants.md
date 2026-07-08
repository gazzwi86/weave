---
type: TechSpec
title: "Build Engine — Spec Invariants (M1 pointer + M2 checklist)"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify. M1 invariants remain in architecture.md §Invariants (in force verbatim); this file adds
  the M2 set, one line each with a verify-by selector."
tags: [build-engine, arch, tech-spec, invariants, m2]
status: Draft
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/tech-spec/invariants.md
source: hand-authored
confirmed_by: none
entity: build-engine
---

# Build Engine — Spec Invariants

**M1 invariants:** `architecture.md` §Invariants — in force verbatim (CODIFY non-skippable,
resume-from-CODIFY, HITL fail-closed, no-self-approval, safety-gate atomicity, repo-bootstrap
fail-closed, spike no-write-back, cross-tenant zero rows, SCM-token confidentiality, write-back
target from context, model-routing halt, secrets never in env/code/logs).

## M2 invariants

- Brand gate is the sixth member of the atomic safety-gate set; any gate failing commits
  nothing — verify-by: `safety gate pipeline module` + grep `brand` in the ordered gate list
- One critical VoiceRule failure fails the brand gate regardless of score — verify-by: brand
  gate tests + grep `should fail brand gate on one critical rule failure`
- Brand pass bar (0.90) and staleness threshold (2) resolve via PLAT-SETTINGS-1, never
  hardcoded — verify-by: gate/staleness modules + grep `PLAT-SETTINGS-1|settings` (no literal
  `0.90`/`2` without a settings fallback comment)
- SDK emit path contains no LLM call — verify-by: sdk generator package + grep
  `anthropic|bedrock|agentcore` returns nothing
- SDK generation is atomic: staging dir + validators before a single commit; no partial
  package — verify-by: sdk generator + grep `staging` and `commit_workspace` (one call site)
- SDK regeneration across a `breaking: true` span halts to HITL; ack persisted as
  `sdk_breaking_ack` gate row — verify-by: grep `sdk_breaking_ack`
- Generated function methods raise `NotExecutableUntilV1(fn_iri)` in M2 (no execution) —
  verify-by: emitter templates + grep `NotExecutableUntilV1`
- Unmappable SHACL constraint ⇒ named generation error, never silent `Any` — verify-by: IR
  mapper + grep `Any` (no bare fallback branch)
- Retrieval is deterministic: same graph + seeds ⇒ same 200 nodes; seeds always survive
  truncation — verify-by: grep `should select same 200 nodes` in tests
- Truncated retrieval is disclosed (`retrieval_truncated` in run log + prompt preamble) —
  verify-by: grep `retrieval_truncated`
- Investigator runs are read-only, cannot spawn sub-investigators, return ≤ 500-token summary —
  verify-by: investigator dispatch + grep `sub-investigator|read_only`
- Missing predecessor dep-summary holds the task in Ready (FR-043 now enforcing) — verify-by:
  grep `should hold task in Ready when predecessor dep summary missing`
- Pre-scaffold cascade check blocks on critical gap (FR-055 now enforcing) — verify-by: grep
  `should block scaffolding on critical cascade gap`
- Ceremony is fail-closed: any ceremony-step error keeps the gate shut — verify-by: grep
  `should keep ceremony gate closed when a ceremony step errors`
- Unavailable QA category records `not_verified` and fails the suite — verify-by: grep
  `not_verified`
- Ambiguous spec-coverage item counts as MISSING; halt below 90% DELIVERED or any MISSING —
  verify-by: coverage audit module + grep `MISSING`
- Preflight checks credential references (names), never secret values; missing critical dep
  stops to HITL — verify-by: preflight module + grep `describe_secret|reference` (no
  `get_secret_value` in preflight)
- Standards effective set = active company rows overlaid by same-key project rows; whole-key
  replacement, no prose merge — verify-by: standards service + grep `standard_key`
- Standards absence degrades to demo-default stack with a run-log warning, never halts —
  verify-by: prompt assembly + grep `demo-default|standards missing`
- `standards_documents` carries RLS + repo-layer base filter like every Build table —
  verify-by: migration + grep `ENABLE ROW LEVEL SECURITY` on `standards_documents`
- Staleness shows `"unknown"` when CE unreachable — never a fake healthy value — verify-by:
  grep `unknown` in staleness module
- GE-CANVAS-1 is not imported anywhere in Build M2 (embed is post-v1) — verify-by: grep
  `GraphCanvas|ge-canvas` in Build source returns nothing
