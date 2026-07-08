---
type: TechSpec
title: "Build Engine — Spec Invariants (M1 pointer + M2 + v1 checklists)"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify. M1 invariants remain in architecture.md §Invariants (in force verbatim); this file adds
  the M2 and v1 sets, one line each with a verify-by selector."
tags: [build-engine, arch, tech-spec, invariants, m2, v1]
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
- Breakingness is read from CE-DIFF-1 `versions[].breaking` ONLY (CE computes it at publish,
  covering function-signature AND shape/kind changes); Build never re-derives it from SHACL
  diff triples or the function list — verify-by: sdk generator breaking check + grep
  `versions` (no `added|removed|modified` inspection in the breaking-check path)
- Generated function methods raise `NotExecutableUntilPostV1(fn_iri)` in M2 and v1
  (execution is post-v1, CE ADR-009) — verify-by: emitter templates + grep
  `NotExecutableUntilPostV1`
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

## v1 invariants

M1 + M2 invariants stay in force verbatim. v1 adds (context in [`v1-delta.md`](v1-delta.md)):

- Every PM mutation passes the Role Guard; a denial returns 403 AND writes PLAT-AUDIT-1 —
  verify-by: role guard module + grep `403` and `PLAT-AUDIT-1` in the same handler path
- Reader prompts are rejected 403 + audited; editor/admin prompts enqueue a standard run —
  verify-by: grep `should return 403 and audit entry when reader submits prompt`
- Prompt runs reuse the M1 run lifecycle unchanged (caps, gates, HITL, external repo) —
  verify-by: prompt dispatcher + grep `trigger` (no second orchestrator entry point)
- A prompt run synthesises an FR-018-conformant typed brief in PLAN and passes the FR-046 DoR
  gate before DELEGATE; a raw prompt is never dispatched — verify-by: grep
  `should synthesise typed brief from prompt before delegate`
- Role overlay resolves from the PLAT-IDENTITY-1 JWT `roles` claim (tenant + project/domain
  grants); no workspace-role claim, no bespoke role lookup — verify-by: role guard module +
  grep `roles` (no `workspace_role`)
- The source-control token is write-only: stored in Secrets Manager, never echoed by any
  API response or log — verify-by: source-control config handler + grep `token` (no token
  field in any response model)
- Cost figures are estimates from the PLAT-SETTINGS-1 rate card, labelled `estimated`; Build
  never reconciles against invoices — verify-by: grep `estimated` in cost payload builder
- FR-008 breach halts at the next safe checkpoint reading the local rollup synchronously —
  verify-by: grep `should halt run at next checkpoint when cost rollup breaches binding cap`
- Dashboard tiles fail independently; no tile error blanks the page — verify-by: grep
  `should render tile error state and keep page alive`
- Decision Log and Audit tab never fabricate entries; unreachable audit ⇒ "audit unavailable"
  — verify-by: grep `audit unavailable`
- Pin upgrade requires explicit human confirmation and is audited; no auto-upgrade path —
  verify-by: pin upgrade handler + grep `confirm`
- GE-CANVAS-1 stays unimported in Build at v1.0 (FR-032 is post-v1) — verify-by: grep
  `GraphCanvas|ge-canvas` in Build source returns nothing
- No connector credential is stored in Build; `external_bindings` holds instance-handle
  references only — verify-by: migration + grep `connector_ref` (no token/secret column)
- Every new v1 table carries RLS + repo-layer base filter — verify-by: migrations + grep
  `ENABLE ROW LEVEL SECURITY` on `project_contributors`, `external_bindings`, `cost_events`,
  `project_prompts`
- State is never conveyed by colour alone on board/tree (legend always visible) — verify-by:
  grep `should display state legend alongside colour coding`
