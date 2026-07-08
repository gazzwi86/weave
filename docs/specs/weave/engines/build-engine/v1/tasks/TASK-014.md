---
type: Task
title: "Task: TASK-014 — Source-Control Provider Config UI (E2-S6, FR-061/B9)"
description: "Settings tab + endpoints for the M1 backend source-control config: provider
  select (GitHub/GitLab), write-only token entry stored straight to Secrets Manager (reference
  name only ever returned), current-config display. Closes the E2-S6 v1 UI gap — the config
  existed since M1 with no surface."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-006]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-014.md
---

# Task: TASK-014 — Source-Control Provider Config UI (E2-S6, FR-061/B9)

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** project admin
**I want** to configure my project's source-control provider and token from the settings tabs
**So that** repo bootstrap (FR-061) is configurable without an operator poking `PLAT-SETTINGS-1`
and Secrets Manager by hand — the M1 config path finally gets its surface

> **FRs covered:** FR-061/B9 settings surface (E2-S6 — the M1 slice was "a config value only,
> NOT the full settings UI"; this is that UI). The E2-S6 AC applies verbatim: provider
> (GitHub or GitLab) via `PLAT-SETTINGS-1`, **token in AWS Secrets Manager only — never in
> Build, never displayed after entry**; an invalid/absent token fails repo bootstrap closed
> (M1 behaviour, unchanged here). Source control is NOT a `PLAT-CONNECTOR-1` connector.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/source-control` is called, THE SYSTEM SHALL return `{provider, token_secret_ref, configured_by, configured_at}` — the Secrets Manager **reference name**, never a token value, in any code path including errors | `should never echo source-control token in any response` |
| AC-2 | WHEN `PUT /api/projects/{id}/source-control` is called with `{provider, token}`, THE SYSTEM SHALL write the token to Secrets Manager, persist only the reference via `PLAT-SETTINGS-1` (project scope; domain scope is Platform-side config), emit a `PLAT-AUDIT-1` entry (provider + reference name, no value), and never log the token | `should store token to secrets manager and persist reference only` |
| AC-3 | WHEN a provider outside `github`/`gitlab` is submitted, THE SYSTEM SHALL reject with 422 naming the allowed values | `should reject unknown provider` |
| AC-4 | WHEN the settings tab renders an existing config, THE SYSTEM SHALL show provider + reference name + configured-by/at with a write-only "replace token" field — no reveal affordance exists | `should render config with reference name and no reveal affordance` |
| AC-5 | WHEN no config exists, THE SYSTEM SHALL render the setup state explaining repo bootstrap fails closed without it (FR-061) | `should render unconfigured setup state` |
| AC-6 | WHEN the config is mutated, THE SYSTEM SHALL require the SETTINGS guard class (project admin / company-or-domain admin-owner); denial = 403 + audit | Role Guard suite (TASK-002); route registration asserted here |

## Implementation

### Pseudocode

```
GET /api/projects/{id}/source-control (guard: read — any company member):
    cfg = settings.resolve("build.source_control", ctx)   # M1 config path, PLAT-SETTINGS-1
    return {provider, token_secret_ref, configured_by, configured_at} | 404 if unset (AC-5 UI)
    # response model has NO token field — value is structurally unreturnable (AC-1)

PUT /api/projects/{id}/source-control (guard: SETTINGS):
    validate body.provider in ("github", "gitlab")                     # AC-3
    ref = secrets.put(f"build/{tenant}/{project_id}/scm-token", body.token)  # write-only
    settings.set("build.source_control", {provider, token_secret_ref: ref}, scope=project)
    emit_audit("source_control_configured", {provider, ref})           # no value — AC-2
    return the GET shape (reference only)

UI (settings tabs, TASK-006 family — new "Source control" tab):
    configured -> ProviderBadge + RefName + ReplaceTokenField(write-only)   # AC-4
    unconfigured -> SetupCard("repo bootstrap fails closed without this")   # AC-5
```

### API Contracts

`GET/PUT /api/projects/{id}/source-control` — p95 ≤ 500 ms (v1-delta §3). Errors: 401, 403
(+audit), 404 (project / unset config on GET), 422 (provider), 500. Consumes `PLAT-SETTINGS-1`
(config), Secrets Manager via the M1 secrets module (write + describe only — the PM API never
calls `get_secret_value`), `PLAT-AUDIT-1` emitter. Repo bootstrap consumption (FR-061,
M1 TASK-010 drivers) is unchanged — same config key it has read since M1.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 source-control bullet | Settings-tab surface over the M1 config path |
| M1 baseline | `../../../build-engine.md` | §EPIC-002 E2-S6 AC | Canonical behaviour incl. fail-closed bootstrap |
| Data model | `../../tech-spec/data-model.md` | §Projects Table | No new columns — config lives in PLAT-SETTINGS-1 + Secrets Manager |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Token is write-only end to end | E2-S6 AC / M1 SCM-token confidentiality invariant | Response models carry no token field; there is no code path that could leak it |
| Reuse the M1 config key, add no table | E2-S6 M1 slice | This task is a surface over existing plumbing — zero schema change, zero new bootstrap logic |
| No "test connection" button in v1 | FR-061 fail-closed AC | Bootstrap already fails closed with a named error on a bad token; a pre-flight ping is additive later, not required (YAGNI) |
| Domain-level provider default stays Platform-side | PLAT-SETTINGS-1 cascade | Build writes project scope only; domain defaults resolve through the cascade read |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject unknown provider`
- `should render config with reference name and no reveal affordance` (component)
- `should render unconfigured setup state` (component)

### Integration Tests (minimum 2)

- `should store token to secrets manager and persist reference only` (secrets stub asserts
  put; settings stub asserts reference; audit payload carries no value — Law B)
- `should never echo source-control token in any response` (PUT then GET; response-shape
  assertion incl. error paths)

### E2E Tests (Playwright, minimum 1)

- `should configure provider and token end to end` (admin session: setup state → save →
  reference name shown; secrets stub received the value server-side; token absent from DOM
  and network responses after entry)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should never echo source-control token in any response` |
| AC-2 | Integration | `should store token to secrets manager and persist reference only` |
| AC-3 | Unit | `should reject unknown provider` |
| AC-4 | Unit + E2E | `should render config with reference name and no reveal affordance` / E2E flow |
| AC-5 | Unit | `should render unconfigured setup state` |
| AC-6 | Integration | Role Guard suite; route registration check |

## Dependencies

- **blocked_by:** [TASK-006] (settings tabs this mounts in; TASK-002 guard transitively)
- **unlocks:** []
- **External prerequisites:** M1 secrets module + `build.source_control` settings key (live
  since M1 TASK-010); PLAT-SETTINGS-1 write API (live)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~12k input, ~6k output
- **Estimated cost:** ~$0.40 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. the token-absence E2E)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] No token field in any response model; no `get_secret_value` in the PM API
      (invariants.md verify-by)
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the settings
      route with the source-control tab live (v1-delta §6)
- [ ] `ui_verify` passes; design tokens only
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- The M1 repo-bootstrap step (TASK-010) already reads this config — change nothing on the read
  side; this task is purely the authoring surface. Verify the exact settings key name in the
  M1 code before hardcoding it here.
- Secrets naming: follow the existing M1 secret-path convention (grep the M1 secrets module) —
  do not invent a new prefix scheme.
- The write-only token field is the design system's password-style input; clear it after
  submit and never re-populate from any response.
- Audit event type: `build.source_control.configured` (dotted convention, PLAT-AUDIT-1).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
