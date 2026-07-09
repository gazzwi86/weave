---
type: Task
title: "Task: TASK-024 — Build Request Form v2: Labelled Fields + Visible Request Record (E1-S5, F-D20)"
description: "Extend the M1 Request Studio intake form (BE-TASK-003/004, POST /api/requests) with
  the fields the IA proposal and JTBD always specified but M1 never shipped: request name, a
  graph-backed grounding-entity picker, and a target-repo name — every field visibly labelled
  (no placeholder-only labels) — plus a new visible request record (GET /api/requests/{id})
  showing status and a provenance link. Closes design finding F-D20."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-001
milestone: v1.0
created: 2026-07-09
blocked_by: [PLAT-V1-TASK-026]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-09
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-09T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-024.md
---

# Task: TASK-024 — Build Request Form v2: Labelled Fields + Visible Request Record (E1-S5, F-D20)

## Story

**Epic:** [EPIC-001 — Request Studio](../../../build-engine.md#epic-001--request-studio)
**Status:** Backlog
**Priority:** Should Have

**As a** product owner submitting a build request
**I want** to name my request, ground it in specific entities from the company graph, and choose
a name for the new repository it will create — with every field clearly labelled — and then see
a visible record of what I submitted
**So that** the factory builds against my actual intent with traceable provenance, instead of an
anonymous prompt I can no longer find or explain to anyone else

> **Scope traceability:** Request Studio's intake form shipped at M1 (`BE-TASK-003`/`BE-TASK-004`,
> both `status: done` in `progress.json`) with only `prompt` + `run_mode` (+ optional
> `description`) persisted — FR-001's shipped scope. The IA proposal
> (`docs/design/poc-ia-proposal.md` line 111: *"Request application form: name, grounding
> entities, target repo"*) and the JTBD map (`docs/design/jtbd.md` "Build → Request application")
> always specified three more fields that M1 never built. The design assessment
> (`docs/design/design-assessment-2026-07-09.md` F-D20) confirms the gap by direct inspection of
> the running PoC: *"Request form is missing the spec'd fields: grounding entities... and target
> repo... Currently: one big unlabeled textarea, run-mode select, optional description."* F-D20
> was approved into the v1 requirement set 2026-07-09 as R11
> (`docs/design/v1-design-requirements.md`).
>
> This is the **only** v1 task revisiting the intake form — it extends `EPIC-001` /
> `POST /api/requests` in place and does **not** touch or duplicate M1's drafting pipeline
> (streaming, blast-radius, cost gate, sign-off all unchanged — see AC-3). It is **distinct**
> from `TASK-021` (Direct Project Prompt, FR-065) — that task is a prompt box on an **existing**
> project that triggers a new dark-factory run; this task is the **first-ever** request that
> creates the project in the first place.
>
> **Epic-ID note:** this brief cites the epic as `EPIC-001` (matching `build-engine.md`'s own
> numbering and `progress.json`'s `BE-EPIC-001`), not a new "v2" epic — see the epic-definition
> commit for why a new epic ID was not created.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|----------|-------------|
| AC-1 | WHEN the build request form renders, THE SYSTEM SHALL display four labelled fields — "Request name", "Grounding entities", "Target repo name", "Run mode" — each with a `<label>` bound to its input via `htmlFor`/`id` (no placeholder-only labels, F-D20/R11). | e2e: `request-form-fields-labelled.spec.ts` |
| AC-2 | WHEN a user types 2 or more characters into the Grounding entities field, THE SYSTEM SHALL query `CE-READ-1` (`GET /api/sparql`, SELECT-only, `?version=latest`, label-substring filter, paginated — the same typeahead pattern already used for process-typeahead in the events-actions-engine) and render matching entities as selectable options showing friendly label + `KindChip`; selecting one adds its IRI to the field's value and renders it as a removable `EntityRef` chip. | integration: `test_grounding_typeahead_returns_matching_entities` |
| AC-3 | WHEN `POST /api/requests` is submitted with `name` (required, 1-200 chars), `run_mode` (unchanged FR-001 validation), `grounding_entity_iris` (optional array, 0+ IRIs), and `target_repo_name` (see AC-5), THE SYSTEM SHALL persist all four fields on the request record and start the drafting pipeline exactly as `BE-TASK-003` AC-1 (same `202` response `{request_id, status: "drafting", stream_url}`, same streaming behaviour) — the two new fields never alter the drafting call when both are empty. | integration: `test_create_request_persists_new_fields_pipeline_unchanged` |
| AC-4 | IF `name` is empty or exceeds 200 characters, THE SYSTEM SHALL return `422` with `{"error": "validation_error", "field": "name"}` before creating any request record. | unit: `test_reject_empty_or_oversized_name` |
| AC-5 | IF `run_mode` is not `draft_spec_only` AND `target_repo_name` is missing or fails the kebab-case pattern (`^[a-z0-9-]{3,100}$`), THE SYSTEM SHALL return `422` with `{"error": "validation_error", "field": "target_repo_name"}`; WHEN `run_mode` is `draft_spec_only`, `target_repo_name` MAY be omitted (no project/repo is created at that mode). | unit: `test_reject_missing_or_invalid_target_repo_name_unless_draft_mode` |
| AC-6 | IF any IRI in `grounding_entity_iris` does not resolve via `CE-READ-1` (`GET /api/ontology/resource/{iri}` returns `404`), THE SYSTEM SHALL return `422` with `{"error": "grounding_entity_not_found", "iri": "<iri>"}` before creating the request record — no partial request is persisted. | unit: `test_reject_unresolvable_grounding_entity_iri` |
| AC-7 | WHEN `GET /api/requests/{id}` is called by the request's own tenant, THE SYSTEM SHALL return the visible request record — `name`, `status`, `run_mode`, and for each grounding entity a chip deep-linking to `/ce/resource/{iri}`; WHEN zero grounding entities were selected, THE SYSTEM SHALL show the pinned `CE-VERSION-1` link instead (recorded at `BE-TASK-003` AC-2) — the record always carries at least one provenance link, never zero. | integration: `test_request_record_shows_provenance_links_or_pinned_version_fallback` |
| AC-8 | WHEN the grounding-entity typeahead query is issued, THE SYSTEM SHALL return results within 400ms p95 under 10 concurrent users (thin `CE-READ-1` SPARQL pass-through — no new store, no caching layer). | integration: `test_typeahead_p95_under_400ms_10_concurrent` |

## Implementation

### Pseudocode

```text
# Migration: extend the existing `requests` table (BE-TASK-003) — no new table
ALTER TABLE requests ADD COLUMN name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN grounding_entity_iris JSONB NOT NULL DEFAULT '[]';
ALTER TABLE requests ADD COLUMN target_repo_name VARCHAR(100) NULL;

function create_request(jwt, name, prompt, run_mode, grounding_entity_iris=[], target_repo_name=None, description=None):
  claims = cognito.verify(jwt)                                   # -> 401 (unchanged, BE-TASK-003)

  # Input gates (AC-4, AC-5, AC-6) — before any store write
  if not (1 <= len(name) <= 200):
    return 422 with {"error": "validation_error", "field": "name"}
  if run_mode not in ALLOWED_RUN_MODES:                          # unchanged, BE-TASK-003 AC-6
    return 422 with {"error": "validation_error", "field": "run_mode", "allowed": ALLOWED_RUN_MODES}
  if run_mode != "draft_spec_only":
    if not target_repo_name or not KEBAB_CASE_RE.match(target_repo_name):
      return 422 with {"error": "validation_error", "field": "target_repo_name"}
  for iri in grounding_entity_iris:
    resource = ce_read_client.get_resource(iri)                  # GET /api/ontology/resource/{iri}
    if resource is None:
      return 422 with {"error": "grounding_entity_not_found", "iri": iri}

  # Core logic (unchanged pipeline entry point, BE-TASK-003)
  request_id = uuid4()
  aurora.execute(
    "INSERT INTO requests (id, tenant_id, name, prompt, run_mode, grounding_entity_iris, "
    "target_repo_name, status, created_at) VALUES (...)",
    id=request_id, name=name, prompt=prompt, run_mode=run_mode,
    grounding_entity_iris=grounding_entity_iris, target_repo_name=target_repo_name,
  )
  background_tasks.add_task(run_drafting_pipeline, request_id, claims.tenant_id, prompt, run_mode)
  return 202 with {"request_id": request_id, "status": "drafting", "stream_url": f"/api/requests/{request_id}/stream"}


function get_request_record(jwt, request_id):
  claims = cognito.verify(jwt)                                   # -> 401
  request = aurora.get_request(request_id, tenant=claims.tenant_id)
  if not request: return 404 with {"error": "not_found"}

  if request.grounding_entity_iris:
    provenance_links = [{"iri": iri, "href": f"/ce/resource/{iri}"} for iri in request.grounding_entity_iris]
  else:
    provenance_links = [{"iri": request.pinned_ce_version_iri, "href": f"/ce/versions/{request.pinned_ce_version_iri}"}]

  return 200 with {
    "request_id": request_id, "name": request.name, "status": request.status,
    "run_mode": request.run_mode, "provenance_links": provenance_links,
  }


function grounding_entity_typeahead(jwt, q):                     # AC-2, AC-8
  claims = cognito.verify(jwt)                                   # -> 401
  if len(q) < 2: return 200 with {"results": []}
  rows = ce_read_client.sparql(                                  # GET /api/sparql, SELECT-only, paginated
    "SELECT ?iri ?label ?kind WHERE { ?iri rdfs:label ?label ; a ?kind . "
    "FILTER(CONTAINS(LCASE(?label), LCASE(?q))) } LIMIT 20",
    version="latest", q=q,
  )
  return 200 with {"results": [{"iri": r.iri, "label": r.label, "kind": r.kind} for r in rows]}

# Downstream (BE-TASK-004, unchanged code path — additive param only):
#   submit_sign_off's auto-create call already does:
#     project = projects_client.post("/api/projects", jwt=jwt, name=request.name)
#   this task supplies a REAL request.name for the first time (BE-TASK-004 assumed it existed);
#   extend that one call site to also pass repo_name_hint=request.target_repo_name, consumed by
#   BE-TASK-010's repo bootstrap when creating the NEW repo (falls back to a slugified
#   request.name if target_repo_name is absent — draft_spec_only requests never reach this call).
```

### API Contracts

**`POST /api/requests`** (extends `BE-TASK-003` — same endpoint, additive fields)

Request body:

```json
{
  "name": "string — 1-200 chars (required)",
  "prompt": "string — natural-language description (required, unchanged)",
  "run_mode": "string — draft_spec_only | spec_to_build | spike (required, unchanged)",
  "grounding_entity_iris": "string[] — 0+ CE entity IRIs (optional)",
  "target_repo_name": "string | null — kebab-case, 3-100 chars (required unless run_mode is draft_spec_only)",
  "description": "string | null — unchanged, optional"
}
```

Response `202` (unchanged shape, BE-TASK-003 AC-1):

```json
{ "request_id": "string", "status": "drafting", "stream_url": "string" }
```

Error responses (new rows added to BE-TASK-003's table):

| Status | Condition | Body |
|--------|------------------------|-------------------------------------------|
| 401 | Missing/invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 422 | `name` empty or > 200 chars | `{"error": "validation_error", "field": "name"}` |
| 422 | `target_repo_name` missing/invalid and `run_mode != draft_spec_only` | `{"error": "validation_error", "field": "target_repo_name"}` |
| 422 | A `grounding_entity_iris` entry does not resolve | `{"error": "grounding_entity_not_found", "iri": "<iri>"}` |

**`GET /api/requests/{request_id}`** (new endpoint — the visible request record, AC-7)

Response `200`:

```json
{
  "request_id": "string",
  "name": "string",
  "status": "string — drafting | partial | timed_out | pending_approvals | approved | returned_to_draft",
  "run_mode": "string",
  "provenance_links": [{ "iri": "string", "href": "string — /ce/resource/{iri} or /ce/versions/{iri}" }]
}
```

Error responses:

| Status | Condition | Body |
|--------|------------------------|-------------------------------------------|
| 401 | Missing/invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Request not found or belongs to another tenant | `{"error": "not_found"}` |

**`GET /api/ontology/entities/typeahead?q={string}`** (new thin route on the Platform/Build API —
wraps `CE-READ-1`'s existing `GET /api/sparql`, does not add a new CE endpoint)

Response `200`: `{ "results": [{"iri": "string", "label": "string", "kind": "string"}] }` — p95
≤ 400ms (AC-8). `q` shorter than 2 chars returns `{"results": []}` without querying CE.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|---------|---------|
| Sequence | `../tech-spec/business-process.md` | `#request-status-states` | Pending — to be added alongside `BE-TASK-004`'s diagram debt (already a DoR blocker there); this task adds no new states, only fields |
| State | `../tech-spec/business-process.md` | `#request-status-states` | N/A — no new status values introduced by this task |
| Data Model | `../tech-spec/data-model.md` | `#requests-table` | Pending — the `requests` table needs its column list documented (`name`, `grounding_entity_iris`, `target_repo_name` added here); DoR blocker carried forward from `BE-TASK-003`/`004` |

### Design requirements

- `EntityRef` renders the grounding-entity chip as a friendly label plus a `--font-mono` secondary
  ID, never a bare IRI — per `TASK-026` (weave-platform, Storybook foundation) Design requirements,
  citing F-D08 (raw machine identity leaking onto surfaces).
- `KindChip` (14 BPMO kind colours + shape, never colour alone) renders the kind badge in the
  typeahead results list — per `color.md` "Why colour alone is never enough" (accessibility
  requirement), same component the typeahead in AC-2 must reuse, not re-implement.
- Every form field carries a real `<label>` element (`htmlFor`/`id` bound) — cited from F-D09
  ("several forms use placeholder-only labels") and R11 ("labelled fields (no placeholder-only)").
- The post-submit request record is the JTBD success criterion for "Build → Request application"
  (`jtbd.md`): *"after submit, a visible request record with status and a provenance link"* —
  AC-7 implements this verbatim.
- Advisory: this task does not prescribe the Grounding-entities field's exact input pattern
  (multi-select combobox vs. tag input) — `TASK-026`'s `EntityRef`/`KindChip` atoms are pinned,
  but the containing molecule is not yet named in `visual-direction.md`'s component list; the
  engineer should request one be added to the Storybook bundle if none fits, per the atomic-design
  constraint below, rather than hand-rolling a one-off.

**Atomic-design constraint (binding, `visual-direction.md` §Delivery / R13):** this surface
consumes design-system **templates/pages**; the app/container layer (this task's route +
API-binding code) binds data only — it does not own presentational markup. If no existing
template fits the Grounding-entities picker or the request-record layout, add the template to the
design system (`TASK-026`'s Storybook bundle) **first**, then consume it here. Do not build a
parallel one-off component.

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|-------------------|
| Extend the existing `requests` table — no new table | `BE-TASK-003` schema (`INSERT INTO requests ...`) | One migration (`ALTER TABLE requests ADD COLUMN ...`); no new store, no new ORM model |
| `target_repo_name` is a NAME HINT for the NEW repo `BE-TASK-010` creates — never a reference to an existing repo | decision B9 (`build-engine.md` §2.5) / `BE-TASK-010` AC-1 ("create a NEW external repository... never reuse") | Validated as a kebab-case slug, not a URL; passed through as `repo_name_hint`, never treated as a selector against an existing repo |
| Grounding-entity typeahead reuses the `CE-READ-1` SELECT-only SPARQL pass-through already established for process-typeahead | [contracts.md `CE-READ-1`](../../../../contracts.md#ce-read-1); precedent: `events-actions-engine` `TASK-016` "typeahead via CE-READ-1" | No new CE endpoint; one thin wrapper route, same pattern as the existing precedent — do not invent a second typeahead mechanism |
| `request.name` closes a pre-existing gap in `BE-TASK-004`'s pseudocode, which already called `projects_client.post(..., name=request.name)` against a field that did not exist in the M1 schema | `BE-TASK-004` pseudocode (line: `name=request.name`) | This task supplies the real column; `BE-TASK-004`'s auto-create call now resolves correctly — no behavioural change to `BE-TASK-004` itself, only the missing data it was already assuming |
| Provenance link always falls back to the pinned `CE-VERSION-1` when no grounding entities are chosen — never zero links | `BE-TASK-003` AC-2 (pinned version recorded to `PLAT-AUDIT-1`) | AC-7's record view is never empty-provenance; matches the project's honest-state convention (never a blank/fabricated result) |
| Epic stays `EPIC-001` (no new "v2" epic ID minted) | `build-engine.md` has no precedent for per-milestone epic IDs — `EPIC-002` extends across M1/v1.0 via a Milestone note instead, not a second ID | `progress.json`/`build-engine.md` cross-references (`BE-EPIC-001`) keep working unchanged; this task's epic note follows the same `EPIC-002` pattern rather than minting `EPIC-013` or a "v2" ID |

## Test Requirements

### Unit Tests (minimum 5)

- `should reject empty or oversized name`
- `should reject missing or invalid target_repo_name when run_mode is not draft_spec_only`
- `should allow missing target_repo_name when run_mode is draft_spec_only`
- `should reject unresolvable grounding entity iri`
- `should accept zero grounding entities`
- `should render a label element bound to each request-form field` (component test)

### Integration Tests (minimum 5)

- `test_create_request_persists_new_fields_pipeline_unchanged` — new fields stored; drafting
  pipeline call args identical to `BE-TASK-003` AC-1 when both new fields are empty
- `test_grounding_typeahead_returns_matching_entities` — seeded CE fixture; query returns label +
  kind matches, respects the 2-char minimum
- `test_request_record_shows_provenance_links_or_pinned_version_fallback` — record with entities
  shows their `/ce/resource/{iri}` links; record with zero entities shows the pinned version link
- `test_typeahead_p95_under_400ms_10_concurrent` — load profile per AC-8
- `should pass target_repo_name through to project creation on sign-off approval` — extends
  `BE-TASK-004`'s auto-create call site with `repo_name_hint`; falls back to a slugified `name`
  when `target_repo_name` is absent

### E2E Tests (Playwright, minimum 1)

- `should fill labelled request-form fields, submit, and see the visible request record with a
  provenance link` — editor session: fill name/grounding-entity/target-repo/run-mode, submit,
  assert `202`, navigate to the record, assert provenance link renders and is clickable (Plugin
  Law B: UI + backend state)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | E2E | `should fill labelled request-form fields, submit, and see the visible request record with a provenance link` |
| AC-2 | Integration | `test_grounding_typeahead_returns_matching_entities` |
| AC-3 | Integration | `test_create_request_persists_new_fields_pipeline_unchanged` |
| AC-4 | Unit | `should reject empty or oversized name` |
| AC-5 | Unit | `should reject missing or invalid target_repo_name when run_mode is not draft_spec_only` |
| AC-6 | Unit | `should reject unresolvable grounding entity iri` |
| AC-7 | Integration | `test_request_record_shows_provenance_links_or_pinned_version_fallback` |
| AC-8 | Integration | `test_typeahead_p95_under_400ms_10_concurrent` |

## Dependencies

- **blocked_by:** `PLAT-V1-TASK-026` (weave-platform, Storybook design-system foundation) — this
  task consumes its `EntityRef`/`KindChip` atoms (see Design requirements); not a build-engine
  task, so it carries no `TASK-NNN` number in this engine's own sequence
- **unlocks:** — (none; no other v1 task yet depends on this one)
- **External prerequisites:** `BE-TASK-003`/`BE-TASK-004`/`BE-TASK-010` live (all `done` in
  `progress.json`); `CE-READ-1` reachable in staging

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~24k input, ~12k output
- **Estimated cost:** ~$1.00 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (if applicable)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Design requirements section present (cited)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided
- [ ] `PLAT-V1-TASK-026` complete (cross-engine dependency; not yet started as of this brief)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. full-loop E2E)
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] `ui_verify` passes on the request form and record view; design tokens only, zero ad-hoc
      hex/px/duration
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-001

## Implementation Hints

- Reuse `BE-TASK-003`'s existing `create_request` handler and `requests` table — this is a
  migration + additive validation, not a new pipeline. Do not fork a second intake code path.
- The typeahead route is deliberately dumb (no caching, `LIMIT 20`, `q` length gate before
  querying CE at all) — mirrors the "thin pass-through" hint already used for `CE-EVENT-1` proxy
  routes elsewhere in this spec (`weave-platform` `TASK-024`).
- `target_repo_name`'s kebab-case regex is a naming convention, not a tunable business threshold —
  no `PLAT-SETTINGS-1` lookup needed for it (unlike the cost cap or turn caps elsewhere).
- Do not add a second entity-picker or chip component — wait on `PLAT-V1-TASK-026`'s `EntityRef`/
  `KindChip` atoms; if the containing combobox/tag-input molecule doesn't exist yet, request it
  added to that Storybook bundle rather than hand-rolling one here (atomic-design constraint).
- `BE-TASK-004`'s sign-off auto-create call site needs exactly one new keyword argument
  (`repo_name_hint`) — grep `projects_client.post(` in that task's implementation before touching
  it; do not restructure the sign-off flow.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
