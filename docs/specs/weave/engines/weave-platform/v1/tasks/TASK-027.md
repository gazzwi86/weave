---
type: Task Brief
title: "Task: TASK-027 — App shell v2 (V4-hybrid chrome refit)"
description: "Refit the M1 app shell (TASK-002/TASK-005) onto the TASK-026 design-system library:
  icon-rail nav + contextual secondary sidebar, PageHeader/breadcrumb, gradient-border CommandBar
  with a working Cmd+K palette, a real bell panel (day-grouped, deep-linking, mark-read, session-
  batched model.version.published, non-suppressible audit.chain.invalid), avatar menu, single
  button hierarchy, and company-scope chrome copy (workspace switcher removed for members)."
tags: [weave-platform, arch, task, v1, design-system, app-shell, notifications, tenancy]
timestamp: 2026-07-09T00:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-011
milestone: v1
created: 2026-07-09
blocked_by: [TASK-026]
unlocks: []
adr_refs: []
---

# Task: TASK-027 — App shell v2 (V4-hybrid chrome refit)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Contracts:** [contracts.md](../../../../contracts.md) ·
**Design inputs:** [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md),
[visual-direction.md](../../../../../../design/visual-direction.md),
[notifications-recommendation.md](../../../../../../design/notifications-recommendation.md)

> **Scope traceability:** bundles R1 (`v1-design-requirements.md` R1, findings F-D01/02/03/05/06/
> 07/09) + R7 (F-D04, the binding tenancy-wording ruling) + the R10 remainder not already covered
> by a v1 task (bell panel presentation, `model.version.published` batching, `audit.chain.invalid`
> non-suppressibility). TASK-005 (M1) built the nav/search/dashboard shell and TASK-007 (M1) built
> the `PLAT-NOTIFY-1` backend, but the design assessment (2026-07-09, live inspection of the
> running PoC) found the *built* chrome regressed from both specs: Cmd+K is a no-op (F-D01), there
> is no header search (F-D02), notifications render as a text label with an unstyled overlay
> (F-D03), and the workspace switcher still shows the deprecated intra-tenant model contradicting
> the tenancy ruling locked the same week (F-D04). No existing v1 task owns "make the M1 shell
> match its own spec" — this task closes that gap on the TASK-026 component library rather than
> patching the M1 markup in place.

## Story

**Epic:** EPIC-011 Design System & App Shell v2
**Priority:** Must Have

**As a** signed-in Weave user on any tenant
**I want** the app chrome (nav, search, notifications, account menu) to actually work as specified
and to describe my tenant correctly (one company, not a workspace I might switch out of)
**So that** I can navigate, search, and stay informed without hitting dead controls, and nothing in
the chrome contradicts what my company's admin told me about how Weave is scoped.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a signed-in user views any page, THE SYSTEM SHALL render the far-left icon rail (`NavRail`, logo mark top, area icons with tooltips, avatar bottom) and a contextual `SecondarySidebar` for the active area, both consumed from the TASK-026 design system, with a working collapse toggle whose state persists across page loads (per-user, `PLAT-SETTINGS-1`). | E2E: `test_nav_rail_and_sidebar_collapse_persists` |
| AC-2 | WHEN a page renders, THE SYSTEM SHALL show a `PageHeader` with breadcrumb, a title at `--text-h1` (36px/700), a one-line purpose statement, and action buttons following the single primary/secondary/ghost button rule (`components.md` Button) — no page SHALL render a bespoke h1 size or a second full-width bright button competing with the primary action. | unit: `test_page_header_uses_text_h1_and_button_hierarchy` |
| AC-3 | WHEN the user presses Cmd+K (or Ctrl+K) from any page, THE SYSTEM SHALL open the `CommandBar` (gradient-border, per `visual-direction.md` signature chrome accent) at `--z-command`, focus its input, and show grouped results (Navigation / Entities / Actions) with keyboard hints (arrow keys to move, Enter to select, Esc to dismiss) — reusing TASK-005's tenant-scoped search endpoint for the Entities group. | E2E: `test_cmd_k_opens_grouped_command_bar_with_keyboard_nav` |
| AC-4 | WHEN a notification-worthy event exists for the signed-in user, THE SYSTEM SHALL show a bell icon with an unread-count badge (never a bare "Notifications" text label); opening the bell SHALL render a panel grouped by day, each row deep-linking to its `target_iri` via `CE-READ-1` `/resource/{iri}` (or the relevant engine route), with a mark-read control per row and a mark-all-read control for the panel. | E2E: `test_bell_panel_day_grouped_deep_links_mark_read` |
| AC-5 | WHEN two or more `model.version.published` notifications for the same recipient arrive within one browser session, THE SYSTEM SHALL collapse them into a single bell entry summarising the version range (e.g. "v0.3.0 -> v0.3.4 published") rather than rendering one row per publish, per the resolved MCQ in `notifications-recommendation.md`. | unit: `test_version_published_batches_per_session` |
| AC-6 | WHEN an `audit.chain.invalid` notification exists for a workspace admin or compliance officer, THE SYSTEM SHALL render it in the bell panel and SHALL NOT expose a mute/suppress/dismiss-without-read control for that notification type — attempting to call the preference toggle for `audit.chain.invalid` on an admin/compliance role SHALL be rejected client-side before any `PUT /api/notifications/preferences` call is made. | unit: `test_audit_chain_invalid_not_suppressible_for_admin_compliance` |
| AC-7 | WHEN the signed-in user opens the avatar menu, THE SYSTEM SHALL show their profile name, their canonical role (from the RBAC roles resolved via `PLAT-IDENTITY-1`), a help/guided-tour link, and a "Sign out" action — "Sign out" SHALL NOT render as a bare header link outside the menu. | unit: `test_avatar_menu_shows_profile_role_and_signout` |
| AC-8 | WHEN a regular (non-super-admin) member views the header, THE SYSTEM SHALL NOT render a workspace switcher, and every settings/budget copy string that previously read "applies to every workspace" SHALL read company-scoped language instead (e.g. "applies to this company"); WHEN a Weave super admin views the header, THE SYSTEM SHALL continue to see the provisioning entry point, relocated to Settings -> Workspaces (not the header switcher). | E2E: `test_member_no_switcher_super_admin_settings_workspaces` |
| AC-9 | WHEN any page renders a machine identity or a raw timestamp, THE SYSTEM SHALL render it via `EntityRef` (friendly label + mono ID as secondary metadata) and a relative-time component (raw ISO on hover/expand) respectively — a raw `urn:weave:principal:*` string or a raw ISO-8601 timestamp rendered as primary text anywhere in the shell SHALL fail the shell-wide identity-formatting check. | integration: `test_no_raw_principal_or_iso_timestamp_in_shell` |

## Implementation

### Pseudocode

```text
# packages/frontend/app/notifications/group-bell-entries.ts
# Client-side grouping over the existing GET /api/notifications response (TASK-007, PLAT-NOTIFY-1);
# no backend change — this is presentation-layer batching per the resolved MCQ.

function groupBellEntries(notifications, sessionStartedAt):
  if not notifications: return []
  grouped = []
  versionPublishBuffer = []  # consecutive model.version.published entries this session

  for entry in notifications.sortedByCreatedAtAscending():
    if entry.event_type != "model.version.published":
      flushVersionBuffer(versionPublishBuffer, grouped)   # emit any pending batch first (keeps order)
      grouped.push(entry)
      continue
    if entry.created_at < sessionStartedAt:
      grouped.push(entry)          # published before this session opened: show as its own row
      continue
    versionPublishBuffer.push(entry)

  flushVersionBuffer(versionPublishBuffer, grouped)
  return grouped.sortedByCreatedAtDescending()  # bell panel renders newest first, grouped by day

function flushVersionBuffer(buffer, grouped):
  if buffer.length == 0: return
  if buffer.length == 1:
    grouped.push(buffer[0])
  else:
    first = buffer[0]; last = buffer[-1]
    grouped.push({
      ...last,
      "summary": "{from_semver} -> {to_semver} published".format(
        from_semver=first.payload.semver, to_semver=last.payload.semver),
      "batched_count": buffer.length,
    })
  buffer.clear()

# packages/frontend/components/organisms/BellPanel/bell-panel-row.tsx (binding, not markup)
function canSuppressNotificationType(event_type, role):
  if event_type == "audit.chain.invalid" and role in ["workspace_admin", "compliance_officer"]:
    return false   # AC-6: no mute control rendered, no PUT call reachable from this row
  return true

# packages/frontend/app/shell/header-scope.ts
function resolveSwitcherVisibility(principal):
  if principal.isWeaveSuperAdmin:
    return { showHeaderSwitcher: false, showSettingsWorkspacesEntry: true }  # AC-8: relocated, not removed
  return { showHeaderSwitcher: false, showSettingsWorkspacesEntry: false }   # AC-8: members never see it
```

### API Contracts

No new endpoints. This task binds existing contracts into the TASK-026 design system:

- `GET /api/notifications` (TASK-007, `PLAT-NOTIFY-1`) — bell panel data source; client-side
  grouping per the pseudocode above, no request-shape change.
- `PUT /api/notifications/preferences` (TASK-007) — avatar-menu-linked preferences; the client
  SHALL NOT construct a request that disables `audit.chain.invalid` for an admin/compliance role
  (AC-6 — a client-side gate, the server-side enforcement already exists per TASK-007's open
  taxonomy validation).
- The tenant-scoped entity search endpoint delivered in TASK-005 (`GET`, 300ms budget per its own
  AC-3) — reused as the Entities result group in `CommandBar`.
- `GET /api/ontology/resource/{iri}` (`CE-READ-1`) — bell-row deep-link target for model-engine
  notification types.

Error responses: unchanged from the above owning tasks; this task adds no new failure mode beyond
"notification fails to load" — that degrades to the TASK-026 `EmptyState`/error story states, never
a blank bell.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | N/A | N/A | Pending — to be added to tech-spec before implementation starts (no sequence diagram exists yet for the bell-grouping client flow). |
| State | N/A | N/A | Bell entry states are the notification-store states from TASK-007 (unread/read) plus the client-only batched-summary state added here. |
| Data Model | N/A | N/A | No new data model — this task reads the existing `PLAT-NOTIFY-1` notification shape unchanged. |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| `model.version.published` batching is client-side, session-scoped, no backend change | [notifications-recommendation.md](../../../../../../design/notifications-recommendation.md) "Resolved (user MCQ, 2026-07-09)" | Defines the `groupBellEntries` pseudocode; keeps this task frontend-only, avoids re-opening `PLAT-NOTIFY-1`'s contract |
| `audit.chain.invalid` is non-suppressible for admin + compliance | [notifications-recommendation.md](../../../../../../design/notifications-recommendation.md) role/type matrix | Client-side gate in AC-6; server-side validation already exists in TASK-007's preference endpoint, this task must not regress it by exposing a UI path around it |
| Workspace switcher removed for members; super-admin provisioning relocated to Settings -> Workspaces | [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md) R7 (binding ruling) | AC-8 and the `resolveSwitcherVisibility` pseudocode; E2E tests must address the sandbox workspace by URL, never via member-visible UI (ruling's explicit test-authoring constraint) |
| Glass elevation only on modal/popover/command-palette/canvas-overlay | [components.md](../../../../../standards/design/components.md) "Glass vs flat" | `CommandBar`'s gradient-border + glass treatment is the one chrome surface allowed it; `NavRail`/`SecondarySidebar`/bell panel stay flat |

### Design requirements

- `--text-h1` (36px/700) on every `PageHeader` title — cites F-D07 (built app renders 28px/600).
- `--z-command` (500, above modals, per `tokens.md` zIndex table) for `CommandBar` — cites F-D01
  (Cmd+K currently a no-op with no dedicated render layer).
- Bell icon + unread badge, never a text label — cites F-D03 directly.
- `EntityRef` (friendly label + `--font-mono` secondary ID) and relative-time everywhere a
  principal URN or ISO timestamp currently renders as primary text — cites F-D08.
- Single primary/secondary/ghost button rule (`components.md` Button states) replacing the current
  full-width-bright/medium-teal/outline mix with no discernible rule — cites F-D09.
- Breadcrumb on every page per the IA wireframe (`Workspace / Constitution / Instances` pattern) —
  cites F-D06.
- Logo: cropped mark (~24px header use) and full lockup (marketing) generated from `logo.png`,
  replacing the fuzzy low-res render — cites F-D05.
- Company-scope wording sweep (no "applies to every workspace" copy for members) — cites F-D04 and
  the binding tenancy ruling in R7.
- Advisory: exact grouping window for "one browser session" (tab lifetime vs a rolling N-minute
  window) is not pinned by any F-D/R citation — default to tab-lifetime (simplest, matches "per
  session" literally); flag for a tech-spec ADR if product wants a rolling window instead.

## Test Requirements

### Unit Tests (minimum 5)

- `should render PageHeader title at --text-h1 token value, not a hardcoded 28px`
- `should collapse consecutive model.version.published notifications from the same session into one summary row`
- `should not batch a model.version.published notification created before the current session started`
- `should reject rendering a suppress control for audit.chain.invalid when role is workspace_admin or compliance_officer`
- `should show profile name, canonical role, and Sign out inside the avatar menu, never as a bare header link`

### Integration Tests (minimum 3)

- `should render EntityRef and relative-time components for every principal/timestamp field the shell binds, never raw strings`
- `should hide the header workspace switcher for a non-super-admin principal and show it nowhere else`
- `should show the Settings -> Workspaces provisioning entry only for a Weave-super-admin principal`

### E2E Tests (minimum 3)

- `should open the grouped CommandBar on Cmd+K, navigate with arrow keys, and select a result`
- `should open the bell panel, see day-grouped entries, deep-link into a target, and mark it read`
- `should persist the SecondarySidebar collapse state across a page reload for the same user`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | E2E | `test_nav_rail_and_sidebar_collapse_persists` |
| AC-2 | Unit | `test_page_header_uses_text_h1_and_button_hierarchy` |
| AC-3 | E2E | `test_cmd_k_opens_grouped_command_bar_with_keyboard_nav` |
| AC-4 | E2E | `test_bell_panel_day_grouped_deep_links_mark_read` |
| AC-5 | Unit | `test_version_published_batches_per_session` |
| AC-6 | Unit | `test_audit_chain_invalid_not_suppressible_for_admin_compliance` |
| AC-7 | Unit | `test_avatar_menu_shows_profile_role_and_signout` |
| AC-8 | Integration | `test_member_no_switcher_super_admin_settings_workspaces` |
| AC-9 | Integration | `test_no_raw_principal_or_iso_timestamp_in_shell` |

## Dependencies

- **blocked_by:** [TASK-026] — every component this task binds data into (`NavRail`,
  `SecondarySidebar`, `PageHeader`, `CommandBar`, `EntityRef`, Bell panel) is a TASK-026 deliverable.
- **unlocks:** [] — TASK-028/029/030 refit their own surfaces against the TASK-026 library directly
  and do not require this task's chrome refit to land first; they are parallel-safe.

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~46K input, ~20K output
- **Estimated cost:** ~$2.90

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (bell grouping, suppression gate, switcher visibility)
- [x] API contracts defined (existing endpoints bound, no new surface)
- [x] Diagram references included (N/A rows reasoned; sequence flagged as pending for tech-spec)
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

- Reuse TASK-005's existing tenant-scoped search implementation for `CommandBar`'s Entities group —
  do not re-implement graph search; the 300ms budget and tenant-scoping are already proven there.
- Reuse TASK-007's notification store as-is; `groupBellEntries` is a pure client-side transform on
  its response, so it needs no new backend test fixture beyond what TASK-007 already provides.
- `# ponytail: "session" = tab lifetime (in-memory sessionStartedAt), not a server-tracked session
  concept — upgrade to a rolling window only if product asks for cross-tab batching.`
- Grep every string literal containing "workspace" in existing Settings/budget copy before this
  task closes — F-D04 was found in more than one place (workspace switcher AND budget scope text).
- The regressed chrome findings map onto real files already in the repo — refit these, don't
  rewrite from zero: `components/shell/command-palette.tsx` (AC-3, currently a no-op per F-D01),
  `components/shell/notification-center.tsx` (AC-4/5/6, currently a text label per F-D03),
  `components/shell/{nav,section-rail}.tsx` (AC-1, `NavRail`/`SecondarySidebar`),
  `components/shell/app-shell.tsx` (AC-2/7, `PageHeader`/breadcrumb/avatar menu), and
  `components/shell/workspace-switcher.tsx` (AC-8 — remove for members, relocate provisioning
  entry for super-admins). Each one is refit to consume its TASK-026 organism rather than owning
  bespoke markup; the data-fetching/state stays here, the presentational layer moves to
  `components/organisms/**`.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
