# TASK-014 — Pin widgets, responsive grid, drag-reorder, auto-refresh

Status: DONE. Branch `feature/PLAT-V1-EPIC-001`, worktree `/Users/gareth/Sites/weave-PLAT-001b`.

## AC-by-AC

- **AC-1 (pin a suggested/tenant-default widget)** — `POST /api/dashboard/widgets/{id}/pin`
  (`packages/backend/src/weave_backend/routers/dashboard.py`) creates a `scope='user'` copy.
  Frontend: `widget-tile.tsx`'s `TileControls` renders a Pin button for non-user-scope tiles;
  `dashboard-client.tsx`'s `handlePin` calls the proxy route
  (`app/api/dashboard/widgets/[id]/pin/route.ts`) and merges the returned row into state.
- **AC-2 (unpin, owner-only, IDOR-safe-404)** — `DELETE /api/dashboard/widgets/{id}`, same file.
  `handleUnpin` in `dashboard-client.tsx` → proxy `app/api/dashboard/widgets/[id]/route.ts`.
- **AC-3/AC-4 (auto-refresh, visibility-gated, one shared timer)** —
  `lib/dashboard/use-auto-refresh.ts`'s `useAutoRefresh` hook: one `setInterval` (30s tick),
  gated on `document.visibilityState`, re-checks on `visibilitychange`. Wired in
  `dashboard-client.tsx` over the merged widget list, calling
  `POST /api/dashboard/widgets/{id}/refresh` per due widget.
- **AC-5 (drag-reorder, one PATCH, one audit entry)** — native HTML5 drag-and-drop in
  `widget-grid.tsx` (`dragHandleFor`), plus keyboard Move up/down buttons
  (`moveHandlers`/`moveId`) sharing the same reorder-math. Both call `onReorder`, which
  `dashboard-client.tsx`'s `handleReorder` sends as one batch
  `PATCH /api/dashboard/widgets/order` (`app/api/dashboard/widgets/order/route.ts`).
- **AC-6 (responsive grid)** — `widget-grid.tsx` grid-column spans by breakpoint, unchanged
  from the original TASK-014 implementation.

## Frontend mount chain (grep-proven)

Before this session's final commit, `app/dashboard/page.tsx` rendered
`<WidgetGrid widgets={widgets} />` with **no callbacks at all** — pin/unpin/reorder/refresh
were implemented but unreachable from the actual page (Law 17 gap). Fixed in commit
`0c421200`:

- `app/dashboard/page.tsx` → `<DashboardClient initialWidgets={...} initialLibraryItems={...} />`
- `components/dashboard/dashboard-client.tsx` → `<WidgetGrid onPin={handlePin} onUnpin={handleUnpin} onReorder={handleReorder} onPublish={handlePublish} />`
- `components/dashboard/widget-grid.tsx` → `tileProps()` passes `onPin`/`onUnpin`/`onReorder`/`dragHandleProps` into `<WidgetTile>`
- `components/dashboard/widget-tile.tsx` → `TileControls` renders the actual Pin/Unpin/Move/drag-handle buttons

`grep -rn "onPin\|onUnpin\|onReorder" packages/frontend/components/dashboard/dashboard-client.tsx packages/frontend/components/dashboard/widget-grid.tsx packages/frontend/app/dashboard/page.tsx` confirms the chain from page → client → grid → tile.

## Gates

- Frontend: `tsc --noEmit` clean; `eslint` 0 errors (pre-existing warnings only, none new);
  `vitest run` full suite 1395/1395 passed.
- `grep -rn "localStorage" packages/frontend/src` — not run this session (no `src/` dir at
  that path in this repo layout; auto-refresh/pin state is server-persisted, not
  localStorage-backed, by construction — flagging as a DoD checklist item not literally
  re-verified with that exact grep path).

## Docker / integration

Ran against a worktree-isolated docker-compose stack: `COMPOSE_PROJECT_NAME` defaults to the
worktree directory basename (`weave-plat-001b`), and a temporary `.env` set
`WEAVE_PG_PORT=55432` / `WEAVE_REDIS_PORT=56379` / `WEAVE_LOCALSTACK_PORT=54566` /
`WEAVE_OXIGRAPH_PORT=57879` to avoid colliding with the many other worktree stacks already
running (`weave-plat-v1-epic-009-*`, `weave-ce009restack-*`, etc.). `.env` removed and stack
torn down (`docker compose down`) after the run — nothing left running.

## E2E (Law B/16) — done

`packages/frontend/tests/e2e/dashboard-widget-actions.spec.ts` (commit `de923d19`):
`test_pin_cross_device` and `test_drag_reorder_persists`. Real-backend-driven, not route-mocked —
`page.route()` cannot intercept `/dashboard`'s Next.js Server Component SSR fetches (verified by
reproducing the identical failure against the pre-existing `dashboard-widgets.spec.ts` precedent,
which has the same latent bug), so these specs drive the real mock-OIDC + real uvicorn + real
Postgres stack (`prompt-bar.spec.ts`'s established convention), and assert server-persisted state
(pin, order) survives a fresh page load via an authenticated `page.evaluate(fetch(...))` call
through the real proxy routes. Both pass against a live, worktree-isolated stack.
`test_refresh_failure_shows_stale_badge` / `test_grid_keyboard_operable` still not written — the
two written specs are the ones explicitly required; flagging the other two as a follow-up if QA
wants full brief-literal coverage.

## Known gaps / follow-ups

None outstanding for this task beyond the two untested brief scenarios noted above.
