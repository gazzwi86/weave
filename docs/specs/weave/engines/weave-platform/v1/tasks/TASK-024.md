---
type: Task Brief
title: "Task: TASK-024 — Recent-edits collaboration widget polling the CE-EVENT-1 seq feed (E2-S9)"
description: "The M2-eligible portion of E2-S9: a dashboard widget showing recent graph edits by
  contributor, polling the CE-EVENT-1 transactional change-feed through a tenant-scoped platform
  proxy (GET /api/proxy/events?since_seq={n}). Draft rows (version_iri: null) badged, 410 Gone
  re-baseline, poll-only at M2 (push is post-v1). Explorer realtime sub-widgets (presence,
  active sessions) stay post-v1 and render the defined not-yet-available state."
tags: [weave-platform, arch, task, m2, dashboard, ce-event]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Should Have
entity: weave-platform
epic: EPIC-002
milestone: v1
created: 2026-07-08
blocked_by: [TASK-016]
unlocks: []
adr_refs: [ADR-013, ADR-014]
---

# Task: TASK-024 — Recent-edits collaboration widget polling the CE-EVENT-1 seq feed (E2-S9)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) ·
**Contracts:** [contracts.md](../../../../contracts.md)

> **Scope traceability:** E2-S9 splits by milestone: "recent graph edits by contributor" from
> `CE-EVENT-1` actor data is **M2-eligible** (spec §Epic 2); Explorer realtime presence /
> active-canvas-session sub-widgets are **post-v1** (no presence contract exists yet). This
> task ships the M2 portion and gates the rest — closing the red-team Blocker that no M2 task
> covered E2-S9.

## Story

**Epic:** EPIC-002 Widget Library — E2-S9 (Collaboration activity, CE-sourced M2 portion)
**Priority:** Should Have

**As a** company member on the dashboard
**I want** a widget showing who edited what in the graph recently
**So that** I can see the model is alive — who is contributing, what changed, and whether a
change is still a draft or already published.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the recent-edits widget refreshes, THE SYSTEM SHALL poll the tenant-scoped proxy `GET /api/proxy/events?since_seq={n}` (pass-through to the `CE-EVENT-1` beta seq feed `GET /api/events?since_seq={n}&limit={m}` — ordered rows + `latest_seq`, per-tenant monotonic `seq`), resuming from the cursor persisted in the widget instance's server-side state; **poll only at M2** — no push/WebSocket transport (push fan-out is a post-v1 additive upgrade per contracts.md). | integration: `test_recent_edits_polls_seq_feed_from_cursor` |
| AC-2 | WHEN event rows render, THE SYSTEM SHALL show actor, `change_type`, entity, and time, grouped newest-first with a top-contributors summary (count by `actor` over the retained rows, default 50, tunable); rows with `version_iri: null` SHALL carry a "Draft" badge (they are draft commits) and published rows SHALL cite their `version_iri`; an entity row SHALL deep-link via `CE-READ-1` `/resource/{iri}` (FR-016 pattern). | integration: `test_rows_render_actor_drafts_and_deep_links` |
| AC-3 | IF the proxy returns `410 Gone` (cursor aged out of the 30-day retention) THEN THE SYSTEM SHALL re-baseline — reset the cursor to the feed's current `latest_seq`, re-seed the display via `CE-READ-1` (recently-updated entities), and render a "history truncated — showing activity from now" notice — NEVER a silent empty page (contracts.md CE-EVENT-1). | integration: `test_410_rebaseline_never_silent_empty` |
| AC-4 | IF the feed/proxy errs or times out THEN THE SYSTEM SHALL keep the last successful render with the stale badge + timestamp (honest-state matrix, m2-delta §6) and SHALL NOT blank or fabricate rows. | integration: `test_feed_error_degrades_stale_never_blank` |
| AC-5 | WHERE the Explorer realtime sub-widgets (presence, active canvas sessions) are requested, THE SYSTEM SHALL render the defined "available post-v1" state via the engine-availability registry (no fabricated rows) — joining TASK-016's not-yet-available regression. | integration: `test_realtime_subwidgets_post_v1_gated` |
| AC-6 | WHEN `GET /api/proxy/events` is called, THE SYSTEM SHALL enforce Cognito JWT + RBAC (M1 middleware) and forward ONLY the caller's tenant context to CE — a caller SHALL never receive another tenant's events (cross-tenant-read test family), and unauthenticated calls SHALL 401. | integration: `test_proxy_tenant_scoped_cross_tenant_zero_rows` |
| AC-7 | WHILE the widget is pinned, THE SYSTEM SHALL refresh on the standard cadence (default 5 min, tunable via `PLAT-SETTINGS-1` — FR-009) and on manual refresh; the advanced cursor and retained rows persist server-side in the widget instance state (ADR-013/ADR-014 — cross-device, RBAC-scoped, never localStorage). | integration: `test_cursor_persists_server_side_cross_device` |

## Implementation

### Pseudocode

```text
# Events proxy (packages/backend/dashboard/events_proxy.py) — thin, tenant-scoped
def proxy_events(ctx, since_seq: int, limit: int = 100):
  # JWT + RBAC already enforced by M1 middleware; tenant from ctx, never from params
  resp = ce_client.get("/api/events", tenant=ctx.tenant_id,
                       params={"since_seq": since_seq, "limit": limit})   # timeout 5s
  return resp  # rows[] + latest_seq, or 410 passed through unchanged

# Recent-edits binding — one new entry in the TASK-016 CATEGORIES registry
CATEGORIES["collaboration-activity"] = Binding(
  contracts=["CE-EVENT-1", "CE-READ-1"], fetch=recent_edits, shapes=[activity_feed])

def recent_edits(tenant, widget_state):
  cursor = widget_state.get("last_seq", None)
  if cursor is None:                                   # first render: baseline
      cursor = proxy_events(ctx, since_seq=0, limit=1).latest_seq - TAIL   # bounded tail
  resp = proxy_events(ctx, since_seq=cursor)
  if resp is 410:                                      # AC-3: aged-out cursor
      widget_state.last_seq = current latest_seq (from a fresh baseline call)
      rows = ce_read.recently_updated_entities(limit=RETAIN)   # CE-READ-1 re-seed
      return rows + notice("history truncated — showing activity from now")
  widget_state.last_seq = resp.latest_seq
  rows = (widget_state.rows + resp.rows) keep newest RETAIN (default 50, tunable)
  contributors = count rows by actor                   # top-contributors summary
  # draft badge: version_iri is null => draft commit; else cite version_iri
  persist widget_state (server-side, ADR-014 tables)   # AC-7
  return activity_feed(rows, contributors)

# Explorer realtime sub-widgets (AC-5): availability.is_ga("explorer") is false at M2
# => registry-driven "available post-v1" state; no presence contract exists to bind
```

### API Contracts

**Endpoint (new):** `GET /api/proxy/events?since_seq={n}&limit={m}` — p95 **≤ 300 ms**
(+ upstream CE latency; thin pass-through, Arch Law 2)

**Response (200):**

```json
{
  "rows": [
    { "seq": 4812, "change_type": "updated", "entity_iri": "urn:weave:e:...",
      "version_iri": null, "last_published_version": "urn:weave:v:...",
      "actor": "urn:weave:principal:user:...", "ts": "2026-07-08T11:58:00Z" }
  ],
  "latest_seq": 4812
}
```

**Response (410):** cursor aged out (30-day retention, tunable via `PLAT-SETTINGS-1`) —
client re-baselines per AC-3. **(401/403):** M1 auth convention. Shape and semantics are
`CE-EVENT-1` (contracts.md) — the proxy adds tenant scoping + RBAC, never reshapes rows.

Widget CRUD, pin, refresh reuse the m2-delta §5 endpoints unchanged.

### Diagram References

| Diagram | Notes |
|---------|-------|
| Component delta (Category Bindings → CE-EVENT-1 edge) | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — this task exercises the existing CB→CE edge and adds the proxy route |
| Honest-state matrix | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §6 — stale + re-baseline states map onto it |
| Poll / re-baseline sequence | Inline Mermaid below |

```mermaid
sequenceDiagram
    participant W as Widget (grid refresh)
    participant P as Platform API /api/proxy/events
    participant CE as CE-EVENT-1 seq feed

    W->>P: GET ?since_seq=4700 (JWT; cursor from server-side widget state)
    P->>CE: GET /api/events?since_seq=4700 (tenant ctx from JWT, never params)
    CE-->>P: rows[] (draft rows version_iri:null) + latest_seq
    P-->>W: pass-through
    W->>W: render feed + top contributors; persist last_seq=latest_seq

    Note over W,CE: cursor older than retention (30 d)
    W->>P: GET ?since_seq=12
    P->>CE: GET /api/events?since_seq=12
    CE-->>P: 410 Gone
    P-->>W: 410 Gone
    W->>W: re-baseline: cursor=latest_seq; CE-READ-1 re-seed; "history truncated" notice
```

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Poll-only at M2; the seq feed IS the polled transport | contracts.md CE-EVENT-1 (beta, ADR-008 CE-side): push fan-out is post-v1 additive; no "since-version poll on CE-READ-1" fallback exists | No WebSocket/SSE transport here; refresh cadence = FR-009; do not invent a version-filtered read |
| Draft visibility via `version_iri: null` rows | contracts.md CE-EVENT-1 event shape | Draft badge is a null-check, not a second query; `last_published_version` shown when present |
| `410 Gone` → re-baseline via CE-READ-1, never silent empty | contracts.md CE-EVENT-1 retention rule | AC-3 notice state joins the m2-delta §6 honest-state matrix |
| Proxy route, tenant ctx from JWT only | PRD §2.2 isolation; cross-tenant-read test family | One thin pass-through; CE trusts platform-forwarded tenant context as with other CE reads |
| One new CATEGORIES entry (11th binding) | TASK-016 registry pattern (Arch Law 6) | Resolver/tiles/role-home pick it up mechanically; footer cites `CE-EVENT-1` + `CE-READ-1` |
| Cursor + retained rows in server-side widget state | ADR-013 (`last_result` SWR), ADR-014 (Aurora RLS tables) | Cross-device, RBAC-scoped, audit-visible; never localStorage (FR-008 family) |
| Presence / active-session sub-widgets stay dark | spec E2-S9: Explorer surface not yet contracted (post-v1) | Registry-gated not-yet-available state; no contract ID is invented (epic AC) |

## Test Requirements

### Unit Tests (minimum 3)

- `test_binding_cites_ce_event_and_ce_read` — the `collaboration-activity` CATEGORIES entry
  binds only `CE-EVENT-1` + `CE-READ-1`; shape is `activity_feed` (TASK-016 AC-1 walk covers it)
- `test_draft_badge_null_version_iri` — row with `version_iri: null` ⟹ Draft badge; row with
  a version IRI ⟹ cited version, no badge
- `test_top_contributors_count_by_actor` — retained rows ⟹ correct per-actor counts, newest-first
- `test_retain_window_tunable` — retained-row cap resolves via settings (default 50), not literal

### Integration Tests (minimum 5)

- `test_recent_edits_polls_seq_feed_from_cursor` — seeded CE fixture feed; two refreshes;
  second call passes the advanced `since_seq`; no duplicate rows rendered
- `test_rows_render_actor_drafts_and_deep_links` — mixed draft/published fixture rows ⟹
  actor + badge + `/resource/{iri}` links per AC-2
- `test_410_rebaseline_never_silent_empty` — fixture returns 410 ⟹ cursor reset to
  `latest_seq`, CE-READ-1 re-seed rendered, truncation notice present, page not empty
- `test_feed_error_degrades_stale_never_blank` — feed 5xx/timeout ⟹ last render + stale badge
  (extends the TASK-016 degradation sweep with this category's case)
- `test_proxy_tenant_scoped_cross_tenant_zero_rows` — tenant B token against tenant A's seeded
  events ⟹ zero rows; no token ⟹ 401
- `test_realtime_subwidgets_post_v1_gated` — availability fixture (explorer: pending) ⟹
  "available post-v1" state (joins `test_not_yet_available_regression`)
- `test_cursor_persists_server_side_cross_device` — refresh on device A advances cursor;
  read from device B (same user) resumes from it; other tenant/user sees nothing

### E2E Tests (minimum 1)

- `test_recent_edits_widget_live_update` — Playwright: pin the recent-edits widget; commit a
  draft edit through the CE fixture; manual refresh ⟹ new row appears with Draft badge AND
  the persisted widget state row advanced in the backend (Plugin Law B: UI + backend state)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_recent_edits_polls_seq_feed_from_cursor` |
| AC-2 | Integration + Unit | `test_rows_render_actor_drafts_and_deep_links`, `test_draft_badge_null_version_iri`, `test_top_contributors_count_by_actor` |
| AC-3 | Integration | `test_410_rebaseline_never_silent_empty` |
| AC-4 | Integration | `test_feed_error_degrades_stale_never_blank` |
| AC-5 | Integration | `test_realtime_subwidgets_post_v1_gated` |
| AC-6 | Integration | `test_proxy_tenant_scoped_cross_tenant_zero_rows` |
| AC-7 | Integration + E2E | `test_cursor_persists_server_side_cross_device`, `test_recent_edits_widget_live_update` |

## Dependencies

- **blocked_by:** TASK-016 (CATEGORIES registry, degradation sweep, availability registry,
  CE fixture — this task adds the 11th binding; TASK-010/012 arrive transitively)
- **unlocks:** — (M2 gate consumes it; the post-v1 Explorer presence sub-widgets activate
  per source-engine GA, outside the M2 DAG)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~40K input, ~18K output
- **Estimated cost:** ~$2.50

## Definition of Ready Checklist

- [x] User story clear (E2-S9 M2 portion; post-v1 split stated)
- [x] All ACs have mapped tests
- [x] Pseudocode provided (proxy, cursor poll, 410 re-baseline, gating)
- [x] Feed semantics pinned from contracts.md (seq cursor, draft rows, 410, retention, poll-only)
- [x] New endpoint + p95 target stated (proxy ≤ 300 ms + upstream)
- [x] Story-to-milestone traceability recorded (red-team Blocker closed)
- [ ] TASK-016 complete

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Widget footer cites `CE-EVENT-1` + `CE-READ-1` (epic AC)
- [ ] No push transport, no invented CE read — the seq feed is the only event source
- [ ] 410 path shows the truncation notice; degradation sweep includes this category
- [ ] Cross-tenant-read test extended to the proxy route (zero rows)
- [ ] Cursor/rows live in the ADR-014 RLS tables; zero localStorage
- [ ] Dashboard page with this widget passes the E0-S5 gate: Lighthouse 100, axe-core 0
      violations (WCAG 2.1 AA); feed rows keyboard-navigable, badges text + colour
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add recent-edits collaboration widget on CE-EVENT-1 seq feed`

## Implementation Hints

- The proxy is deliberately dumb: no caching, no reshaping — CE already writes the event row
  in-transaction, so the row read is cheap; the widget's 5-min cadence keeps volume trivial.
- First render has no cursor: take one `limit=1` call for `latest_seq`, then read a bounded
  tail (`since_seq = latest_seq - TAIL`) rather than paging 30 days from seq 0.
  `# ponytail: bounded tail, not full-history pagination — upgrade only if product asks for scrollback`
- Reuse TASK-016's `settings(key, default)` helper for the retain cap and refresh cadence —
  zero literal thresholds (TASK-016 DoD grep applies here too).
- Actor IRIs are `PLAT-IDENTITY-1`-scheme principals — render human vs agent by prefix, same
  mapping the S11 agent-activity feed uses; do not build a second principal parser.
- Guard against seq gaps: `latest_seq` from the response is authoritative — never `max(rows)`
  (a `limit`-truncated page would silently skip events).

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
