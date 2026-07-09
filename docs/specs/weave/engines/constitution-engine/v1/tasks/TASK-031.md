---
type: Task Brief
title: "Task: TASK-031 — Instance browser v2 — browse/search surface + SHACL drawer + glass chat aside"
description: "Rebuilds the Constitution 'Instances / Data' screen from a chat-transcript-plus-form
  into a real browse/search surface (kind-chip filter, dense table, right inspector) with
  authoring — guided SHACL form in a drawer, chat as a glass aside — as actions ON that surface,
  not a replacement for it. Bundle R3; closes Blocker F-D11 and Major F-D12/F-D13."
tags: [constitution-engine, arch, task, v1, design-refit]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-023
milestone: v1
created: 2026-07-09
blocked_by: [PLAT-V1-TASK-026]
unlocks: []
adr_refs: []
timestamp: 2026-07-09T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-031 — Instance browser v2 — browse/search surface + SHACL drawer + glass chat aside

> **Scope traceability:** M1 shipped the backend and a first-pass frontend for this surface —
> `m1/TASK-005` (Instance Data Population: add/edit/delete/browse/search over CE-WRITE-1 /
> CE-READ-1) and `m1/TASK-006` (Authoring Surfaces: chat panel + guided forms) — both **done**.
> No v1 task has revisited the resulting UI since. The design assessment run on 2026-07-09 found
> the shipped surface has **no browse/search/list view at all** (the "Instances / Data" page is a
> chat transcript + an "Add entity" form; F-D11, Blocker), that the chat panel is a command
> parser presented as NL chat with a repeating "I'm not sure what you mean" failure loop (F-D12,
> Major), and that the guided form hides which kind is being authored and uses free text for
> object properties (F-D13, Major). The user's ruling on 2026-07-09 made closing F-D11 a **v1
> requirement** (bundle R3, `docs/design/v1-design-requirements.md`). This task is the v1 rebuild
> that closes that gap — it does not touch the CE-WRITE-1/CE-READ-1 backend TASK-005 already
> built.

## Story

**Epic:** [EPIC-023](../../../constitution-engine.md#epic-023--instance-browser-v2--v1)
**Status:** Backlog · **Priority:** Must Have

**As a** business analyst or data steward maintaining the company's operating model
**I want** to browse, search, and filter every instance in the graph by kind, inspect any one of
them in detail, and author or edit through a guided form that always shows me what kind I'm
authoring
**So that** I can read, verify, and correct the model without falling back to Explorer or SPARQL
just to see what the graph already holds.

Covers FR-020, FR-021, FR-034 ([constitution-engine.md §2.1](../../../constitution-engine.md#21-functional-requirements)),
EPIC-002 stories E2-S1/E2-S2/E2-S4 (already built by TASK-005/TASK-006; this task rebuilds their
UI, not their backend), and EPIC-011 (chat aside conventions).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|-------------------|--------------|
| AC-1 | WHEN the Instance Browser v2 screen loads, THE SYSTEM SHALL fetch the kind list from CE-READ-1 `GET /api/ontology/types` and render one filter chip per kind (colour + glyph per kind, `KindChip` component) above a dense table (columns: name, kind chip, key relationship, updated) populated from a CE-READ-1 `GET /api/sparql` browse query, with no kind filter active by default. | integration: `test_kind_chips_render_from_ontology_types` |
| AC-2 | WHEN a user types into the search box, THE SYSTEM SHALL filter table rows by case-insensitive match on label/description (TASK-005's existing browse/search query, reused unchanged) AND intersect with the active kind-chip filter (AND, not OR), paginating at 50 rows/page (tunable) with no silent truncation. | integration: `test_search_and_kind_filter_intersect_and_paginate` |
| AC-3 | WHEN a table row is selected, THE SYSTEM SHALL open a right inspector panel (`InspectorPanel`) showing the entity's properties, incoming/outgoing edges, and PROV-O history from CE-READ-1 `GET /api/ontology/resource/{iri}`, plus an "Edit" entry point — without navigating away from the table. | integration: `test_row_select_opens_inspector_with_props_edges_prov` |
| AC-4 | WHEN the inspector is open, THE SYSTEM SHALL render a "View on canvas" cross-link that deep-links to the Explorer canvas with the selected entity's IRI as the focus target (`?focus=` deep-link pattern, per the existing Explorer async-load poll fix). | integration: `test_view_on_canvas_link_carries_focus_iri` |
| AC-5 | WHEN a user opens "Add" or the inspector's "Edit" entry, THE SYSTEM SHALL open a guided SHACL-driven form in a drawer where the entity's kind is shown in a persistent, always-visible header field (never disappearing after selection — the direct fix for F-D13) and every object-typed property renders as an entity picker (search-and-select against CE-READ-1) rather than a free-text box. | integration: `test_authoring_drawer_kind_persistent_and_entity_pickers` |
| AC-6 | WHILE a field in the authoring drawer loses focus, THE SYSTEM SHALL run a client-side structural check against the field's SHACL shape metadata (datatype, cardinality, pattern — already fetched for form generation per TASK-005) and render any violation inline next to that field, never as a toast; THE SYSTEM SHALL ALSO map any CE-WRITE-1 `422 {violations:[{focus_node, path, severity, message}]}` returned at submit time onto the matching field by `path`, for violations only the store can detect (e.g. referential/cross-entity constraints). | integration: `test_onblur_structural_check_and_submit_422_map_to_field` |
| AC-7 | WHEN the authoring drawer is submitted and CE-WRITE-1 returns `201 {activity_iri, applied_count, version_iri}`, THE SYSTEM SHALL show a confirmation naming the entity's friendly label plus a mono-styled short-ID chip (`EntityRef`) — never the raw IRI — and update the table row in place without a full page reload. | integration: `test_create_confirmation_friendly_label_mono_id_no_raw_iri` |
| AC-8 | WHERE the chat aside is open, THE SYSTEM SHALL render it as a `GlassPanel` with quick-start template chips and a clear-history action; WHEN a message cannot be parsed, THE SYSTEM SHALL reply with a specific, actionable message (naming what was ambiguous) plus 2-3 example phrasings — never repeating the same generic "I'm not sure what you mean" reply twice in one session (the F-D12 regression). | integration: `test_chat_aside_cant_parse_gives_specific_reply_not_generic_loop` |
| AC-9 | IF the AI provider is unavailable (HTTP `502` — backend `model_provider_unavailable` or proxy `upstream_unavailable`, the real M1 signals) THEN THE SYSTEM SHALL show a clear inline provider-unavailable message in the chat aside while the browse/search table and the guided form remain fully functional (FR-001). | integration: `test_chat_provider_unavailable_table_and_form_stay_live` |
| AC-10 | WHEN the browse/search table renders up to 500 rows, THE SYSTEM SHALL complete client-side render within a p95 of 500 ms measured from the CE-READ-1 response arriving (excludes network/query time — consistent with the SPIKE-CE-PERF-1 default budget). | integration: `test_table_render_p95_500ms_at_500_rows` |

## Implementation

### Pseudocode

```text
# packages/frontend/app/constitution/instances/page.tsx — container (data-binding only,
# per the atomic-design constraint; presentational markup lives in the design-system templates)

function loadInstanceBrowser(activeKindFilter, searchTerm, page):
  # Input gates
  if page < 1: return 400 with {"error": "invalid_page"}

  kinds = ce_read.get("/api/ontology/types")            # AC-1: chip source, cached per session
  query = build_browse_query(kind=activeKindFilter, search=searchTerm, page=page, pageSize=50)
  # named store op: CE-READ-1 SPARQL SELECT, same pattern TASK-005 already ships
  results = ce_read.get("/api/sparql", params={"query": query, "version": "latest", "page": page})

  return render InstanceTable(rows=results.rows, kinds=kinds, activeKindFilter, page=results.page)
  # happy path: table + chips rendered; no rows -> DataTable's own empty-state, not a new one

function openInspector(iri):
  if not isIRI(iri): return 400 with {"error": "invalid_iri", "field": "iri"}
  entity = ce_read.get("/api/ontology/resource/{iri}")   # AC-3
  if entity is 404: return render InspectorPanel(state="not_found")
  return render InspectorPanel(props=entity.properties, edges=entity.edges,
                                prov=entity.provenance, editAction=openAuthoringDrawer(iri),
                                canvasLink="/explorer?focus=" + encodeURIComponent(iri))  # AC-4

function onFieldBlur(kind, fieldPath, value, shapeMeta):
  # AC-6, structural half — client-side, no network call
  violation = checkAgainstShape(shapeMeta[fieldPath], value)   # datatype/cardinality/pattern
  if violation:
    return renderInlineFieldError(fieldPath, violation)        # non-blocking; user can keep editing
  return clearInlineFieldError(fieldPath)

function submitAuthoringForm(mode, kind, fields, targetIri = null):
  # Input gates
  if not kind: return 422 with {"error": "missing_kind", "field": "kind"}
  for each objectProperty in fields where fields[objectProperty].isObjectRef:
    if not isIRI(fields[objectProperty].value):
      return 422 with {"error": "invalid_entity_ref", "field": objectProperty}

  op = mode == "create"
    ? {type: "add_node", kind: kind, properties: fields}
    : {type: "update_node", iri: targetIri, properties: fields}   # partial-update, FR-034

  # named store op: CE-WRITE-1, the ONLY mutation entry point (contracts.md CE-WRITE-1)
  resp = ce_write.post("/api/operations/apply",
                        body={operations: [op], actor: currentPrincipalIri(), target: "draft"})

  if resp.status == 422:
    # AC-6, store half — map each violation onto its field by `path`
    for v in resp.body.violations: renderInlineFieldError(v.path, v.message)
    return 422 with resp.body                       # form stays open, nothing committed
  else:
    # AC-7
    upsertTableRow(iri=resp.body.applied_count > 0 ? resolvedIri(op) : targetIri)
    return render CreatedConfirmation(label=friendlyLabel(fields), idChip=shortId(resp.body.activity_iri))

function onChatMessage(message):
  # AC-8/AC-9: reuses the existing M1 chat client unchanged --
  # useCeChatActions.parseIntent() (packages/frontend/app/ce/chat/use-ce-chat-actions.ts),
  # which posts to POST /api/ontology/authoring/nl (Next.js proxy onto the M1
  # CE-TASK-004/006 backend route). That internal route is an M1 implementation
  # detail this task does not change -- there is no new "/api/chat" endpoint.
  resp = ceChat.parseIntent(message)                     # existing handleParse() path

  if resp.networkError or resp.status == 502:
    # AC-9: the real "provider unavailable" signal -- backend
    # `{error:"model_provider_unavailable"}` or the proxy's own
    # `{error:"upstream_unavailable"}`, both surfaced today as HTTP 502.
    return render ChatAside(state="provider_unavailable")   # table/form untouched

  if not resp.ok or resp.operations.isEmpty():
    # AC-8: 422 {error:"nl_parse_failed", message} or 200 with no operations --
    # both mean "could not parse". resp.message already names the specific
    # ambiguity (existing NlParseError text); add example phrasings plus a
    # same-session repeat guard on top of it -- the F-D12 fix, never the same
    # generic reply twice in a row.
    if resp.message == lastCantParseReason: resp.message = pickAlternatePhrasing(resp.message)
    lastCantParseReason = resp.message
    return render ChatAside(state="cant_parse", reason=resp.message,
                             examples=exampleTemplatesFor(activeKindFilter))

  return render ChatAside(state="proposal", operations=resp.operations)  # TASK-006 flow, unchanged
```

### API Contracts

**N/A — no new backend endpoints.** This task is a frontend rebuild consuming the existing
contracts unchanged:

- **CE-READ-1:** `GET /api/ontology/types`, `GET /api/ontology/resource/{iri}`,
  `GET /api/sparql?version=<iri|latest>&page=<n>` (browse/search query, TASK-005's pattern).
- **CE-WRITE-1:** `POST /api/operations/apply` — request `{operations, actor, target}`; response
  `201 {activity_iri, applied_count, version_iri}` or `422 {violations: [{focus_node, path,
  severity, message}]}` (contracts.md CE-WRITE-1, verbatim).
- **Chat transport:** the glass aside reuses the M1 chat client unchanged
  (`useCeChatActions.parseIntent`, `POST /api/ontology/authoring/nl` proxied to the
  CE-TASK-004/006 backend route) — an M1 implementation detail this task does not modify, not a
  new contract.

No `Www-Authenticate` / rate-limit table is added here — those are already enforced by the M1
middleware (FR-032) this task's calls flow through unchanged.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | [`m1/tasks/TASK-005.md`](../../../m1/tasks/TASK-005.md) | `#api-contracts` | The add/edit/delete/browse data flow this UI now surfaces — unchanged by this task |
| Sequence | [`m1/tasks/TASK-006.md`](../../../m1/tasks/TASK-006.md) | whole file | The chat-authoring proposal flow the glass aside wraps — unchanged by this task |
| State | — | — | Pending — the new UI states (kind-chip filter selection, drawer open/close, inspector open/closed, chat-aside cant-parse) have no existing tech-spec diagram; **flagged as a DoR blocker** — add a state diagram to `tech-spec/business-process.md` before implementation starts, or accept this brief's pseudocode as the state contract (architect's call at DoR review). |
| Data Model | [`tech-spec/data-model.md`](../../../tech-spec/data-model.md) | BPMO kinds section | The 13 framework kinds + SHACL shapes the kind-chip filter and entity pickers read from |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| On-blur validation is split: client-side structural check (datatype/cardinality/pattern from SHACL shape metadata) on blur; authoritative CE-WRITE-1 `422` mapping only at submit | No dry-run/validate-only mode exists on CE-WRITE-1 (contracts.md) — it always clones, applies, and commits on zero violations (FR-004). A literal per-keystroke network call to CE-WRITE-1 would either commit prematurely or require inventing an endpoint contracts.md does not define. | AC-6 is implemented as two halves, not one network round-trip per blur; referential/cross-entity violations only surface at submit, which is disclosed in the AC wording itself |
| Kind-chip colour + glyph mapping | `design-assessment-2026-07-09.md` F-D11/13; `visual-direction.md` `KindChip` atom | One `KindChip` component instance reused across the filter row, table cells, and the authoring drawer header — never three separate implementations |
| "View on canvas" reuses the existing `?focus=` deep-link | Recent fix `5cfd916` ("poll for async graph load before ?focus= deep-link centering") | AC-4's link format matches the Explorer's already-fixed focus mechanism; no new canvas-side work needed |
| No task-specific ADR for the backend — all mutation/read semantics are inherited from CE-WRITE-1/CE-READ-1 as fixed in contracts.md | [CLAUDE.md](../../../../../../CLAUDE.md#stack-confirmed--final-unless-a-prd-justifies-otherwise) | This task changes no backend contract or data model; it is UI-only |

### Design requirements

- Kind-chip filter row with colour + glyph per kind, searchable dense table (name, kind chip,
  key relationship, updated), right inspector (properties, edges, PROV, edit entry), "view on
  canvas" cross-link — `v1-design-requirements.md` R3.
- Guided SHACL form in a drawer with the kind always visible and entity pickers for object
  properties, inline on-blur validation rendering CE-WRITE-1 `422`s per field — `v1-design-requirements.md`
  R3; closes Blocker **F-D11** and Major **F-D13** (`design-assessment-2026-07-09.md`).
- Chat as a glass aside — template chips, clear-history, graceful can't-parse replies; created-entity
  confirmations show a friendly label + mono ID chip, never a raw IRI — `v1-design-requirements.md`
  R3; closes Major **F-D12**.
- JTBD: "browse and search entities by kind and relationship... author (chat, guided form) is an
  action ON this surface, not a replacement for it" — `jtbd.md` §Constitution → Instances / Data.
- Atomic-design constraint: the screen consumes `KindChip`, `DataTable`, `InspectorPanel`,
  `GlassPanel` from the design-system library; the container (`page.tsx`) binds data only — if a
  layout this screen needs does not exist in the design system yet, it is added there first, not
  patched locally — `visual-direction.md` §Delivery (Advisory pending the design-system task's
  existence; see Dependencies).

## Test Requirements

### Unit Tests (minimum 3)

- `should_map_kind_to_chip_colour_and_glyph_deterministically` — same kind always resolves to the
  same `KindChip` colour/glyph pair
- `should_flag_structural_violation_on_blur_without_network_call` — a cardinality/datatype
  mismatch renders an inline error using only already-fetched shape metadata
- `should_intersect_search_and_kind_filter_predicates` — filter-building unit covers the AND
  semantics of AC-2 independent of the network layer

### Integration Tests (minimum 5)

- `test_kind_chips_render_from_ontology_types`
- `test_search_and_kind_filter_intersect_and_paginate`
- `test_row_select_opens_inspector_with_props_edges_prov`
- `test_view_on_canvas_link_carries_focus_iri`
- `test_authoring_drawer_kind_persistent_and_entity_pickers`
- `test_onblur_structural_check_and_submit_422_map_to_field`
- `test_create_confirmation_friendly_label_mono_id_no_raw_iri`
- `test_chat_aside_cant_parse_gives_specific_reply_not_generic_loop`
- `test_chat_provider_unavailable_table_and_form_stay_live`
- `test_table_render_p95_500ms_at_500_rows`

### E2E Tests (minimum 1)

- `test_analyst_browses_filters_inspects_and_edits_an_instance` — Playwright: open Instances /
  Data, filter by kind, search, select a row, edit a field via the drawer, see the 422-then-fixed
  flow, submit, and see the friendly-label + mono-ID confirmation with the table row updated in
  place

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_kind_chips_render_from_ontology_types` |
| AC-2 | Integration + Unit | `test_search_and_kind_filter_intersect_and_paginate`, `should_intersect_search_and_kind_filter_predicates` |
| AC-3 | Integration | `test_row_select_opens_inspector_with_props_edges_prov` |
| AC-4 | Integration | `test_view_on_canvas_link_carries_focus_iri` |
| AC-5 | Integration | `test_authoring_drawer_kind_persistent_and_entity_pickers` |
| AC-6 | Integration + Unit | `test_onblur_structural_check_and_submit_422_map_to_field`, `should_flag_structural_violation_on_blur_without_network_call` |
| AC-7 | Integration | `test_create_confirmation_friendly_label_mono_id_no_raw_iri` |
| AC-8 | Integration | `test_chat_aside_cant_parse_gives_specific_reply_not_generic_loop` |
| AC-9 | Integration | `test_chat_provider_unavailable_table_and_form_stay_live` |
| AC-10 | Integration | `test_table_render_p95_500ms_at_500_rows` |
| — | E2E | `test_analyst_browses_filters_inspects_and_edits_an_instance` |

## Dependencies

```
blocked_by: ["PLAT-V1-TASK-026 — Storybook design-system foundation (visual-direction.md
             §Delivery, ruling R13), authored in the same 2026-07-09 architect pass and tracked
             in progress.json. This task consumes its KindChip, DataTable, InspectorPanel,
             GlassPanel and AskBar components and cannot start implementation before they
             exist."]
unlocks:    []
```

## Cost Estimate

```
Complexity:        L
Estimated tokens:  ~52K input, ~24K output
Estimated cost:    ~$3.40 (claude-fable-5 pricing at time of writing, per CLAUDE.md §Stack)
```

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (N/A — reuses CE-READ-1/CE-WRITE-1 unchanged, documented above)
- [ ] Diagram references included — state diagram for the new UI states is **Pending** (see
  Diagram References); DoR blocker until the architect either adds it or accepts this brief's
  pseudocode as the state contract
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined — blocked_by PLAT-V1-TASK-026 (Storybook design-system foundation,
  authored + tracked in the same architect pass) (see
  Dependencies); resolve before implementation starts
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- Reuse TASK-005's browse SPARQL pattern (`?kind ?label ?iri`, `LIMIT 50 OFFSET n`) verbatim for
  AC-1/AC-2 — do not write a second browse query.
- Reuse TASK-006's chat proposal-review flow for AC-8's "proposal" state — the glass-panel
  restyle is presentational only, the accept/reject-per-proposal mechanics do not change.
- The client-side structural check in AC-6 needs the same shape-to-form mapping TASK-005's hints
  already describe (`sh:datatype` → field type, `sh:minCount` → required); cache it per kind,
  do not re-fetch on every field blur.
- `# ponytail: client-side structural check covers datatype/cardinality/pattern only; referential
  violations (e.g. a dangling required relationship) are only knowable at CE-WRITE-1 submit time
  — upgrade path is a dry-run flag on CE-WRITE-1 if product wants earlier feedback on those, but
  that is a backend contract change outside this task's scope.`
- Verify the exact CE-WRITE-1 `422` violation field names (`focus_node` vs `focusNode`, etc.)
  against the live OpenAPI schema before wiring the field-mapping in AC-6 — contracts.md is
  PRD-level, the tech-spec/OpenAPI is the byte-exact source (per the harness's live-CE-VERSION-1
  grounding convention).

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
