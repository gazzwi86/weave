# Epic: EPIC-008 - Generation, Anatomy, Project Ontology & Deployment

## Overview

**Phase:** Phase 1 (MVP — S1 app gen, S3 anatomy, S4 demo) · Phase 2 (S2 agent gen, S3 ontology embed, S4 release, S5 SDK)
**PRD Reference:** [prd.md](../prd.md#epic-8-generation-anatomy-project-ontology--deployment)
**Status:** Backlog
**Priority:** Must Have (S1, S3-anatomy, S4-demo) / Should Have (S2, S3-ontology, S4-release, S5)

## Description

This epic turns an approved spec into a deployed artefact with measured conformance. It generates a
Next.js UI + FastAPI API behind a battery of falsifiable quality gates, generates AI agents on the
Anthropic Agent SDK (Phase 2), maintains a project Anatomy/Wiki and an embedded project-ontology
view, deploys to a demo environment with 8-state visual capture and a release/rollback plan, and
generates a typed client SDK plus a standalone graph-surface OpenAPI contract from a pinned
Constitution ontology version (Phase 2). Every generated artefact is grounded in the company's
process-centric (BPMO) graph and its brand/voice.

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK-001 | Generate an application with measured conformance (E8-S1) | Backlog | Must Have |
| TASK-002 | AI-agent and pipeline generation (Anthropic Agent SDK) (E8-S2) | Backlog | Should Have |
| TASK-003 | Anatomy/Wiki and project-ontology view (E8-S3) | Backlog | Must Have (anatomy) / Should Have (ontology embed) |
| TASK-004 | Deployment, visual-state capture, demo, and release/rollback plan (E8-S4) | Backlog | Must Have (demo + capture) / Should Have (release plan) |
| TASK-005 | Generate a typed client SDK and a standalone graph-surface OpenAPI contract (E8-S5) | Backlog | Should Have |

## Acceptance Criteria (Epic Level)

- [ ] Conformance is measured, not asserted: before any commit the pipeline runs **all** of SAST,
      mypy/tsc, delta-scoped mutation ≥70%, a package-existence (slopsquatting) hard-block, secret
      scan, and a `CE-BRAND-1` conformance check (default ≥90%, no critical violations) — each gate
      a distinct falsifiable AC, and any one failing commits nothing (atomic).
- [ ] Generated config across all targets (app and agent) uses only confirmed model ids
      (`claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`) — no prototype placeholder id
      (`sonnet-4-5`, `opus-4-1`) appears anywhere in generated config.
- [ ] Generation and deployment are grounded in one consistent pinned graph version: the app
      pipeline, the agent scaffold, the anatomy, the embedded ontology view, and the SDK/OpenAPI
      generator all read spec + the project's slice of the process-centric (BPMO) graph via
      `CE-READ-1` — the BPMO kinds and relationships the artefact realises (the processes/activities
      and their actors, systems, services, data assets, capabilities, goals, and governing policies)
      — and brand/voice via `CE-BRAND-1` against the same pin.
- [ ] No half-deployed or stale state is ever presented as ready: a deploy failure retains the prior
      demo URL and surfaces the error, visual-state captures diff against the last passing baseline,
      an unavailable `GE-CANVAS-1` falls back to a `CE-READ-1` entity list rather than a blank
      canvas, and SDK generation fails atomically (no partial package emitted) when `CE-READ-1` is
      unreachable or the pinned version's SHACL shapes cannot be resolved.
- [ ] The generated SDK stays derived from the model, not hand-maintained: typed classes map to BPMO
      node shapes (`Process`, `Activity`, `Actor`, `System`, `Service`, `DataAsset`/`Field`, and the
      rest of the BPMO kind set), typed fields map to the shape's declared properties
      (datatype/cardinality from the SHACL shape), and named SPARQL SELECTs map to typed query
      methods — both the SDK (TypeScript/npm + Python/pip) and the standalone OpenAPI 3.1 contract
      are versioned to the pinned CE version, carry the `BE-ARTEFACT-1` provenance header, and are
      client-owned and forkable.

## Dependencies

- **Blocked by:** Constitution Engine `CE-READ-1` (spec + project ontology + BPMO kinds + SHACL
  shapes for the SDK), `CE-BRAND-1` (design tokens + VoiceRules), `CE-VERSION-1` (pinned version the
  SDK/OpenAPI are generated against), `CE-DIFF-1` (SDK regeneration on a pin change, S5); Graph
  Explorer `GE-CANVAS-1` (Phase-2 ontology embed only); Weave Platform `PLAT-IDENTITY-1`
  (generated-agent principals); EPIC-006/EPIC-011 (execution dispatches the pipeline); EPIC-005
  (approved spec + brief).
- **Blocks:** EPIC-009 (write-back operates on the deployed artefact and reuses the `BE-ARTEFACT-1`
  provenance header the SDK also carries); EPIC-003 (dashboard demo thumbnails reuse the E8-S4
  captures); EPIC-010 (self-healing observes the deployed app); client engineering teams (consume
  the generated graph SDK, S5); the program-level MVP "generate one working app" criterion depends
  on E8-S1/S3/S4.

## Technical Notes

- **Partition with Epic 12:** E8-S1 owns the **generation gates** that run before a single commit;
  Epic 12 owns the task/phase quality ceremonies that wrap them and reference E8-S1's gates as a
  subset (DoD).
- Generated agents (E8-S2) use the Anthropic Agent SDK (Python primary), act under their own named
  `PLAT-IDENTITY-1` service principal with RBAC from the graph, and fail generation if a required
  permission falls outside graph RBAC.
- "Visual-state capture" = 8 named UI states (default, hover, focus, active, disabled, loading,
  empty, error) diffed against a stored baseline — it replaces the undefined prototype "visual test".
- Project-ontology embed parameters: `GE-CANVAS-1` with `mode: "c4"|"force"`, `filterByIri = project
  IRI`, `readonly`; edits route through `CE-WRITE-1`, never mutating the graph directly.
- Conformance pass bar and mutation gate defaults (≥90%, ≥70%) are tunable per workspace via
  `PLAT-SETTINGS-1` / CLAUDE.md.
- SDK generation (E8-S5, `BE-SDK-1`) reads the BPMO kinds + SHACL shapes via `CE-READ-1` against a
  pinned `CE-VERSION-1`: a SHACL node shape → a typed class, its declared properties → typed fields
  (datatype + cardinality from the shape), a named SPARQL SELECT → a typed query method. It emits a
  TypeScript/npm package, a Python/pip package, and a standalone OpenAPI 3.1 contract for the graph
  query/write surface (a client-facing wrapper over `CE-READ-1`/`CE-WRITE-1`, not a redefinition of
  CE's API). All artefacts are versioned to the pin, carry the `BE-ARTEFACT-1` provenance header,
  are regenerable on a `CE-DIFF-1` delta (bumped tag, prior package retained), and are client-owned
  and forkable. Generation is atomic per E8-S1 — `CE-READ-1` unreachable or unresolvable shapes →
  fail with the shape/version named, no partial package.

---
*Generated by Weave Architect agent.*
