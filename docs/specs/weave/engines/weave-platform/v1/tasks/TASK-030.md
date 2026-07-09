---
type: Task Brief
title: "Task: TASK-030 — Settings completeness (Members + notification preferences)"
description: "Close the two missing sections design assessment F-D24 found in Settings: a Members
  page (list/invite/revoke/role, backed by a new list endpoint) and a Notifications preferences
  page (8-type x channel matrix per PLAT-NOTIFY-1, role-scoped defaults, audit.chain.invalid
  locked non-suppressible for admin/compliance), plus the R7 company-scope copy sweep on the
  settings landing page."
tags: [weave-platform, arch, task, v1, design-system, settings, members, notifications]
timestamp: 2026-07-09T00:00:00Z
status: Backlog
priority: Should Have
entity: weave-platform
epic: EPIC-004
milestone: v1
created: 2026-07-09
blocked_by: [TASK-026]
unlocks: []
adr_refs: []
---

# Task: TASK-030 — Settings completeness (Members + notification preferences)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Contracts:** [contracts.md](../../../../contracts.md) ·
**Design inputs:** [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md),
[notifications-recommendation.md](../../../../../../design/notifications-recommendation.md)

> **Scope traceability:** bundles R9 (`v1-design-requirements.md` R9, finding F-D24) + the R7
> settings-copy sweep. Reading the live app confirms F-D24 exactly: `packages/frontend/app/
> settings/` has `page.tsx` (landing), `models/page.tsx`, and `workspaces/page.tsx` (super-admin
> workspace provisioning) — **no Members page and no Notifications preferences page exist at all**.
> The backend is partially ready and partially not: `POST /api/workspaces/{workspace_id}/members`
> (invite) and `DELETE /api/workspaces/{workspace_id}/members/{user_sub}` (revoke) already exist
> (`weave_backend/routers/tenancy.py`, M1 `PLAT-TASK-003`), but **there is no `GET` to list current
> members** — a UI cannot render a Members table without one, so this task adds the missing read
> endpoint rather than inventing client-side state to fake it. Symmetrically,
> `PUT /api/notifications/preferences` exists (`weave_backend/routers/notifications.py`, M1
> `PLAT-TASK-007`) but **there is no `GET` to read a principal's current preferences** — the
> settings page needs one to pre-fill the toggle matrix before the user changes anything. No M1 or
> existing v1 task owns "build the missing Settings sections"; TASK-003/TASK-007 shipped the
> backend actions this task's UI now surfaces completely.

## Story

**Epic:** EPIC-004 Authentication, RBAC & Agent Identity (extended for v1 — Settings & Membership UI)
**Priority:** Should Have

**As a** workspace admin
**I want** to see and manage who's in my company's workspace and control which notifications I
receive, from Settings
**So that** I don't have to ask an engineer to run a script to add a teammate or guess whether a
notification type can be turned off.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a workspace admin requests the member list, THE SYSTEM SHALL expose `GET /api/workspaces/{workspace_id}/members` returning `{ members: [{ user_sub, email, display_name, role, status, invited_at }] }`, scoped to the caller's own workspace (`_require_own_tenant`-equivalent check, per the existing invite/revoke routes' pattern) — a cross-workspace request SHALL return 403. | integration: `test_list_members_endpoint_scoped_to_own_workspace` |
| AC-2 | WHEN a workspace admin opens Settings -> Members, THE SYSTEM SHALL render every member from AC-1's endpoint in a `DataTable` (name, email, role, status), with a working "Invite" action (binds to the existing `POST /api/workspaces/{workspace_id}/members`) and a working "Revoke" action per row (binds to the existing `DELETE /api/workspaces/{workspace_id}/members/{user_sub}`). | E2E: `test_settings_members_page_invite_and_revoke_work` |
| AC-3 | WHEN the invite form's role selector renders, THE SYSTEM SHALL offer only the 10 canonical in-tenant roles enumerated in `weave-platform.md` §"Canonical human roles" (never the Weave-super-admin role, which is not workspace-assignable) — an invented or out-of-enumeration role value SHALL be rejected client-side before the invite request is sent. | unit: `test_invite_role_selector_limited_to_canonical_roles` |
| AC-4 | WHEN a signed-in user requests their notification preferences, THE SYSTEM SHALL expose `GET /api/notifications/preferences` returning the 8 `PLAT-NOTIFY-1` types grouped as `notifications-recommendation.md` specifies (Model/Build/Governance/Account), each with its current per-type in-app enabled/disabled state and role-derived default if unset. | integration: `test_get_preferences_returns_all_eight_types_with_current_state` |
| AC-5 | WHEN a user opens Settings -> Notifications, THE SYSTEM SHALL render an 8-row x channel matrix (rows = the 8 types grouped by category, columns = in-app [togglable] and email [disabled, "post-v1" pill]) pre-filled from AC-4, and toggling an in-app cell SHALL call the existing `PUT /api/notifications/preferences`. | E2E: `test_settings_notifications_matrix_prefilled_and_toggle_saves` |
| AC-6 | WHEN the signed-in user's role is workspace admin or compliance officer, THE SYSTEM SHALL render the `audit.chain.invalid` row's in-app toggle as locked/disabled (mirroring TASK-027 AC-6's bell-panel gate) — attempting to toggle it SHALL NOT issue a `PUT` request. | unit: `test_audit_chain_invalid_toggle_locked_for_admin_compliance` |
| AC-7 | WHEN Settings renders its landing page and any copy string referencing scope, THE SYSTEM SHALL use company-scope language (e.g. "applies to this company") rather than "applies to every workspace," and THE SYSTEM SHALL default the landing view to Members (not an empty overview) — closing the remainder of F-D24 and the R7 copy sweep for this surface. | integration: `test_settings_landing_defaults_to_members_with_company_scope_copy` |

## Implementation

### Pseudocode

```text
# packages/backend/src/weave_backend/routers/tenancy.py — new route (AC-1)
@router.get("/workspaces/{workspace_id}/members", response_model=MemberListResponse)
async def list_members_route(workspace_id, principal):
  _require_own_tenant(principal, workspace_id)   # same guard invite/revoke already use
  return MemberListResponse(members=await members_store.list_for_workspace(workspace_id))

# packages/backend/src/weave_backend/routers/notifications.py — new route (AC-4)
@router.get("/notifications/preferences", response_model=PreferencesResponse)
async def get_preferences_route(principal):
  stored = await preferences_store.get(principal.iri)
  defaults = ROLE_DEFAULT_MATRIX[principal.primary_role]   # notifications-recommendation.md Role -> default matrix
  return PreferencesResponse(
    types=[
      { "event_type": t, "in_app_enabled": stored.get(t, defaults[t]), "email_enabled": False, "email_locked_post_v1": True }
      for t in NOTIFICATION_TYPES   # the 8 types, grouped Model/Build/Governance/Account
    ]
  )

# packages/frontend/app/settings/notifications/notification-matrix.tsx (binding, not markup)
function canToggleInApp(event_type, role):
  if event_type == "audit.chain.invalid" and role in ["workspace_admin", "compliance_officer"]:
    return false   # AC-6 -- same rule TASK-027 AC-6 enforces in the bell panel, one source of truth
  return true

function handleToggle(event_type, nextValue, role):
  if not canToggleInApp(event_type, role):
    return   # AC-6 -- no PUT constructed, mirrors TASK-027's client-side gate exactly
  PUT /api/notifications/preferences with { event_type, in_app_enabled: nextValue }
```

### API Contracts

Two new read endpoints, both extending existing `PLAT-NOTIFY-1`/`PLAT-IDENTITY-1`-adjacent routers
rather than inventing new contract families:

- `GET /api/workspaces/{workspace_id}/members` -> `{ "members": [{ "user_sub": str, "email": str,
  "display_name": str, "role": str, "status": "active"|"invited", "invited_at": str }] }`. Errors:
  `403` if `workspace_id` is not the caller's own workspace (same guard as the existing invite/
  revoke routes).
- `GET /api/notifications/preferences` -> `{ "types": [{ "event_type": str, "in_app_enabled": bool,
  "email_enabled": false, "email_locked_post_v1": true }] }` for all 8 types. No new error shape —
  standard 401 if unauthenticated.
- Existing, unchanged: `POST /api/workspaces/{workspace_id}/members` (invite), `DELETE /api/
  workspaces/{workspace_id}/members/{user_sub}` (revoke), `PUT /api/notifications/preferences`
  (already validates `audit.chain.invalid` server-side per TASK-007 — this task's client gate in
  AC-6 does not weaken that, it prevents the request from being constructed at all).

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | N/A | N/A | Pending — the two new GET routes are simple reads with no branching worth a sequence diagram; flag for tech-spec if the members-list query needs pagination at scale. |
| State | N/A | N/A | No new state machine — member `status` (active/invited) and preference `in_app_enabled` are the only states, both already modelled by TASK-003/TASK-007. |
| Data Model | N/A | N/A | No new entities — this task reads existing membership and preference records; it does not change either schema. |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| Settings landing defaults to Members, not a blank overview | `v1-design-requirements.md` R9 ("settings overview or Members as landing") | AC-7; Members is the more frequently-needed action (invite/revoke) than a static overview, so it wins the landing slot |
| `audit.chain.invalid` non-suppressible is enforced in exactly one place conceptually, mirrored in two UIs | [notifications-recommendation.md](../../../../../../design/notifications-recommendation.md) role/type matrix, same rule as [TASK-027](TASK-027.md) AC-6 | AC-6; the settings matrix and the bell panel must never disagree about which roles can suppress which type — both read the same `canSuppressNotificationType`/`canToggleInApp` logic shape |
| Role vocabulary is the single normative enumeration, never restated ad hoc | `contracts.md` PLAT-IDENTITY-1 "Role vocabulary" -> `weave-platform.md` §"Canonical human roles" | AC-3; the invite role selector reads this enumeration, it does not hardcode a second copy of the role list |
| Company-scope wording (no "every workspace" copy) | `v1-design-requirements.md` R7 (binding ruling), same rule as [TASK-027](TASK-027.md) AC-8 | AC-7; this task's slice of the R7 copy sweep is Settings' own landing/Members/Notifications copy specifically |

### Design requirements

- `DataTable` (TASK-026 organism) for the Members list — cites R13's "surfaces refit onto the
  library rather than owning bespoke CSS."
- Role names rendered exactly as enumerated in `weave-platform.md` §"Canonical human roles," no
  paraphrase or abbreviation — cites `contracts.md` PLAT-IDENTITY-1 "Role vocabulary" directly.
- Email column rendered visibly disabled with a "post-v1" pill, never hidden — cites
  `contracts.md` PLAT-NOTIFY-1 "Email channel (SES) is post-v1 ... UI-gated (hidden/disabled) ...
  never silently ignored" and `notifications-recommendation.md` "Channels."
- Company-scope copy (no "applies to every workspace") on the Settings landing and Members pages —
  cites R7 and F-D04.
- Advisory: whether the Members table paginates at seed-tenant scale (a handful of members) is not
  pinned by any F-D/R citation — ship unpaginated for v1, flag a follow-up if a tenant's member
  count grows enough to matter.

## Test Requirements

### Unit Tests (minimum 4)

- `should limit the invite role selector to the 10 canonical in-tenant roles, excluding Weave super admin`
- `should lock the audit.chain.invalid in-app toggle for workspace_admin and compliance_officer roles`
- `should render the email column disabled with a post-v1 pill, never hidden`
- `should pre-fill the notification matrix from GET /api/notifications/preferences response`

### Integration Tests (minimum 3)

- `should scope GET /api/workspaces/{workspace_id}/members to the caller's own workspace, 403 otherwise`
- `should return all eight notification types grouped by category from GET /api/notifications/preferences`
- `should default unset preference types to their role-derived default from the role -> default matrix`

### E2E Tests (minimum 2)

- `should invite a member from Settings -> Members and see them appear in the list, then revoke them`
- `should toggle an in-app preference in Settings -> Notifications and see it persist on reload`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_list_members_endpoint_scoped_to_own_workspace` |
| AC-2 | E2E | `test_settings_members_page_invite_and_revoke_work` |
| AC-3 | Unit | `test_invite_role_selector_limited_to_canonical_roles` |
| AC-4 | Integration | `test_get_preferences_returns_all_eight_types_with_current_state` |
| AC-5 | E2E | `test_settings_notifications_matrix_prefilled_and_toggle_saves` |
| AC-6 | Unit | `test_audit_chain_invalid_toggle_locked_for_admin_compliance` |
| AC-7 | Integration | `test_settings_landing_defaults_to_members_with_company_scope_copy` |

## Dependencies

- **blocked_by:** [TASK-026] — `DataTable` and the settings page scaffolding come from the TASK-026
  design system.
- **unlocks:** [] — no other v1 task depends on this task.

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~32K input, ~14K output
- **Estimated cost:** ~$2.00

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (two new GET routes, toggle-lock gate)
- [x] API contracts defined (two new read endpoints; existing write endpoints reused, reasoned)
- [x] Diagram references included (N/A rows, reasoned; sequence flagged as pending for scale)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic <= 10, cognitive <= 15, fn <= 50 lines)
- [ ] JSDoc / prop docs on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- The two new GET routes are additive reads next to existing POST/DELETE/PUT routes in the same
  routers (`tenancy.py`, `notifications.py`) — do not create new router files for them.
- `ROLE_DEFAULT_MATRIX` (AC-4's pseudocode) is a direct transcription of
  `notifications-recommendation.md` "Role -> default matrix" — do not re-derive defaults from
  scratch, copy the table's own groupings (Workspace admin / Compliance officer / Enterprise
  architect-data steward / Engineer / Analyst-SME-other).
- `# ponytail: Members list ships unpaginated — a seed tenant has a handful of members; add
  pagination only when a real tenant's member count makes the unpaginated table slow.`
- Reuse TASK-027's `canSuppressNotificationType` shape for this task's `canToggleInApp` — same rule,
  two call sites (bell panel, settings matrix); keep the role/type check in one shared helper if
  TASK-027 lands first, rather than duplicating the condition.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
