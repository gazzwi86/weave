---
type: Task Brief
title: "Task: TASK-015 — Publish widgets to the tenant (company) widget library; independent per-user copies (E1-S5)"
description: "Tenant-scoped (company) widget library — workspace ≡ tenant: publish a pinned widget with name + description
  (author permission enforced, 403 otherwise), list with author + date, and add-to-my-dashboard
  creating an independent (tenant,user) copy that refreshes the same contract and is
  independently refinable."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: M2
created: 2026-07-08
blocked_by: [TASK-014]
unlocks: []
adr_refs: [ADR-014]
---

# Task: TASK-015 — Publish widgets to the tenant (company) widget library; independent per-user copies (E1-S5)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** workspace member who built a useful widget
**I want** to publish it to the shared company (tenant) library so teammates can add it to their own
dashboards as their own copy
**So that** good views spread across the team without anyone's dashboard being coupled to mine.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a user publishes a pinned widget with name + description, THE SYSTEM SHALL store it **server-side, tenant-scoped** (the "workspace library" = the company library; workspace ≡ tenant, no `workspace_id` column — m2-delta §4) in `widget_library_items` and list it in the Library panel with author + publish date (FR-011; mirrors Explorer Saved Views `D2`). | integration: `test_publish_stores_tenant_scoped` |
| AC-2 | IF the publishing user lacks `author` authority (M1 RBAC, `PLAT-SETTINGS-1`-resolved), THEN THE SYSTEM SHALL return HTTP 403 with reason and record the denial to `PLAT-AUDIT-1` (FR-011 failure AC; M1 FR-024 pattern). | integration: `test_publish_without_author_403_audited` |
| AC-3 | WHEN another member adds a library widget, THE SYSTEM SHALL create an **independent (tenant, user) copy** (`widget_instances` row, `library_item_id` provenance FK) that refreshes the same data-source contract and is independently refinable — refining or unpinning the copy never mutates the library item or any other member's copy (E1-S5). | integration: `test_add_creates_independent_copy` |
| AC-4 | WHEN the library lists items, THE SYSTEM SHALL return name, description, author principal, publish date, and the spec's component type + data-source contract(s) for preview — visible to all tenant members (read authority suffices to VIEW and ADD; author is required only to PUBLISH). | integration: `test_library_visibility_by_authority` |
| AC-5 | WHEN a publish or add occurs, THE SYSTEM SHALL write `PLAT-AUDIT-1` entries (`dashboard.library.published` / `.added`) in the same transaction. | integration: `test_library_actions_audited` |
| AC-6 | WHEN a library item's underlying category becomes non-GA-sourced or its contract errors, copies render the m2-delta §6 states like any widget (no special library failure mode); the library panel itself renders items whose source is not GA with the same "source engine not yet available" tag. | unit: `test_library_items_state_tagged` |

## Implementation

### Pseudocode

```text
# Publish (packages/backend/dashboard/library.py)
POST /api/dashboard/library  { widget_id, name, description }
  rbac.require(caller, area="dashboard", level="author")        # 403 + audit denial (M1 helper)
  widget = load widget_instances[widget_id] (owner-only, 403 otherwise)
  txn:
    item = insert widget_library_items(tenant, name, description,
                                       spec=widget.spec,        # spec SNAPSHOT, not reference
                                       author_principal_iri=caller, published_at=now())
    audit.emit(caller, "dashboard.library.published", target=item.id)
  return 201 item

# Add to my dashboard
POST /api/dashboard/library/{id}/add
  item = load widget_library_items[id]                          # RLS: same tenant
  txn:
    row = insert widget_instances(scope='user', owner=caller, spec=item.spec,  # copy
                                  library_item_id=item.id, position=max+1, status='fresh')
    audit.emit(caller, "dashboard.library.added", target=item.id)
  return 201 row   # from here it is an ordinary pinned widget: TASK-010 SWR, TASK-013 refine

# List
GET /api/dashboard/library -> items + availability tag per item
  tag = availability.source_available(item.spec.data_source_contracts)  # pinned signature, m2-delta §1

# Library panel (packages/frontend/src/dashboard/LibraryPanel.tsx)
side panel from dashboard header; cards: name, description, author, date, component icon,
contract footer, availability tag; "Add to my dashboard" button -> POST add -> grid updates
publish entry point: widget header menu "Publish to library" -> name+description modal
```

### API Contracts

**Endpoint:** `POST /api/dashboard/library` — `{ "widget_id": "<uuid>", "name": "SHACL by domain", "description": "…" }` →
`201 { "id", "name", "author_principal_iri", "published_at" }` · `403 { "error": "author_required" }` · `404`. p95 ≤ 300 ms.
**Endpoint:** `GET /api/dashboard/library` →
`200 { "items": [{ "id", "name", "description", "author_principal_iri", "published_at", "component_type", "data_source_contracts": [], "source_available": true }] }`. p95 ≤ 300 ms.
**Endpoint:** `POST /api/dashboard/library/{id}/add` → `201` widget row · `404`. p95 ≤ 300 ms.

### Diagram References

| Diagram | Notes |
|---------|-------|
| Widget-state ERD | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §4 — `widget_library_items` + provenance FK |
| Honest-state matrix | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §6 — copies inherit it unchanged |
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Widget Service owns library routes |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Publish snapshots the spec (copy, not reference) | E1-S5 "independent copy" semantics | Later refinement of the source widget never changes the library item; library edits are re-publishes |
| Add = ordinary `widget_instances` row with provenance FK | ADR-014; m2-delta §4 | Copies get SWR/refine/pin behaviour for free from TASK-010/013/014 — zero special-casing |
| read may view/add; author required to publish | FR-011 + PRD persona table (Viewer has dashboards) | Single rbac.require difference between routes; both audited |
| No library-item update/delete surface at M2 | PRD scopes publish + add only (YAGNI) | Re-publish under a new name covers iteration; deletion is a post-M2 decision — noted, not built |
| Availability tag on library cards | FR-015 family; m2-delta §1 registry | A published Build-sourced widget (post-v1) won't masquerade as addable-and-working |

## Test Requirements

### Unit Tests (minimum 2)

- `test_library_items_state_tagged` — item whose contract is non-GA in the registry fixture ⟹ `source_available: false`
- `test_publish_snapshot_semantics` — mutate source widget spec after publish; library item spec unchanged
- `test_publish_requires_name` — empty name ⟹ 400

### Integration Tests (minimum 4)

- `test_publish_stores_tenant_scoped` — publish; list from another member of the same tenant shows it; different tenant ⟹ absent (DB RLS backstop, app predicate disabled)
- `test_publish_without_author_403_audited` — read-only member publishes ⟹ 403 + audit denial row
- `test_add_creates_independent_copy` — member B adds; refine B's copy; A's widget, the library item, and member C's copy all unchanged; B's copy refreshes same contract
- `test_library_visibility_by_authority` — read-authority member can GET list and POST add; cannot publish
- `test_library_actions_audited` — publish + add ⟹ two audit entries, same-txn atomicity

### E2E Tests (minimum 1)

- `test_publish_and_add_flow` — Playwright, two users: A pins + publishes with name/description; B opens Library panel, sees card with A as author + date, adds it; widget appears on B's grid with live data; B refines it; A's dashboard unchanged (backend rows assert independence — Plugin Law B)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_publish_stores_tenant_scoped` |
| AC-2 | Integration | `test_publish_without_author_403_audited` |
| AC-3 | Integration + E2E | `test_add_creates_independent_copy`, `test_publish_and_add_flow` |
| AC-4 | Integration | `test_library_visibility_by_authority` |
| AC-5 | Integration | `test_library_actions_audited` |
| AC-6 | Unit | `test_library_items_state_tagged` |

## Dependencies

- **blocked_by:** TASK-014 (publish operates on pinned widgets; grid renders added copies)
- **unlocks:** none (leaf)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~35K input, ~15K output
- **Estimated cost:** ~$2.50

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (snapshot vs reference decision explicit)
- [x] `widget_library_items` DDL pinned (m2-delta §4)
- [x] Authority split (view/add = read, publish = author) pinned — no engineer guessing
- [x] Copy-independence semantics specified with a three-party test

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Independence test proves refine-isolation across three parties
- [ ] 403 publish denial audited (matches M1 FR-024 pattern)
- [ ] Library cards show author + date + contract footer + availability tag
- [ ] Cross-tenant invisibility verified (DB RLS backstop alone)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add tenant widget library with independent copies`

## Implementation Hints

- The add route is ~5 lines by design: insert a widget_instances row from the item's spec.
  If it grows beyond that, something is being special-cased that TASK-010/013/014 already handle.
- Resolve the author's display name client-side from the principal IRI via the existing
  principals lookup — don't denormalise author name into the library row (it goes stale).
- Seed the copy's `last_result` from the library author's snapshot? No — leave NULL and let the
  first SWR refresh fill it: the copy must show the ADDING user's live tenant data path, and
  it's the same tenant anyway; a skeleton-for-one-refresh is honest and simpler.
- The Library panel reuses the grid's widget-card preview component in a static mode — don't
  build a second card renderer.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
