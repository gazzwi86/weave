# CE-V1-TASK-024 — Side-Panel Property Edit + Delete Node/Edge + Concurrency Guard

**Branch:** `feature/CE-V1-EPIC-017` (worktree `weave-CE-024w`)
**Final HEAD:** `d6b0afe3` (`feat(explorer): mount usePanelEdit into SidePanel — edit/delete UI (TASK-024)`)

## What shipped

- `lib/explorer/draft-head.ts` — session-local drift-guard counter (ADR-021: CE-WRITE-1 has no
  server-side conditional write/409 yet; this is the GE-side stand-in).
- `lib/explorer/edit-controller.ts` — `commitUpdate`, `buildDeleteOps`/`elementIdsForDeleteOps`,
  `commitDelete`, all bumping the drift head on success and reconciling/removing canvas elements
  via the `RendererAdapter` seam.
- `components/explorer/use-panel-edit.ts` — `usePanelEdit` (composed from `useEditForm` +
  `useDeleteFlow` + `saveEdit`, split to stay under Law E's 50-line function budget).
- `components/explorer/side-panel.tsx` — **mounted**: Edit/Delete buttons, an inline edit form
  (label + each key property as a plain-text input — CE's SHACL `sh:datatype` coerces/validates
  server-side, AC-4), a conflict-notice component (AC-2: yours vs. server value, "Save anyway" /
  "Discard my changes"), and a Radix delete-confirm dialog showing the incident-edge batch count
  (AC-5).
- `components/explorer/explorer-interactions.tsx` — `useEditingState` composition hook (bundles
  `canEditCanvas` + `usePanelEdit`, `retry`/`close` as `onSaved`/`onDeleted`), threaded into
  `NodeInteractionOverlays` → `SidePanel`.
- 8 hook-level unit tests (`use-panel-edit.test.ts`) + 3 `ExplorerInteractions` integration tests
  (conflict notice, delete-confirm-then-commit, delete-timeout-leaves-canvas-untouched).
- 2 Playwright E2E scenarios (`tests/e2e/explorer-edit-delete.spec.ts`) — see gap below.

## Per-AC status

| AC | Status |
|---|---|
| AC-1 (open edit form) | mounted + tested (hook unit test + integration) |
| AC-2 (conflict notice on drift) | mounted + tested |
| AC-3 (edit form fields) | mounted + tested |
| AC-4 (422 violations surfaced) | mounted (hook-tested; not separately integration-tested — same `commitUpdate` path as AC-1/AC-3) |
| AC-5 (delete confirm shows incident batch) | mounted + tested |
| AC-6/AC-7 (delete commit / failure leaves canvas untouched) | mounted + tested |
| AC-8 (readonly gating, viewer/versions-readonly) | mounted via `canEditCanvas` reuse (hook-tested in TASK-023's suite + this task's unit tests); **not** independently re-tested here since the gate itself (`canEditCanvas`) is unchanged from TASK-023 |

## Discovered gap (not fixed, flagged for backlog)

**No E2E-loginable identity can reach `canEditCanvas`'s editor-role gate today.**
`lib/auth/session-claims.ts`'s mock-oidc fallback only ever maps a seeded login to `"admin"` or
`"author"` (there is no real workspace-role source yet — see its own `ponytail:` comment).
`canEditCanvas` only allows `business_analyst_sme`/`enterprise_architect`. So the Edit/Delete
buttons this task built are UI-reachable and integration-tested, but **not currently reachable
through any real browser E2E login path**. Both `explorer-edit-delete.spec.ts` scenarios
(`edit-property-commit-persists`, `delete-node-removes-incident-edges`) are written in full
(including real backend-state assertions per Law 16) but `test.fixme`'d with this root cause
documented inline. Un-fixme once mock-oidc (or a seeded workspace-role fixture) can issue an
editor role. This is a pre-existing auth/session gap, not scoped to TASK-024.

**Also pre-existing, unfixed** (flagged in TASK-024's earlier work, still true): `fetch-node-props.ts`
and the CE-READ-1 proxy route expect response fields (`key_properties`, `type_label`, `bpmo_kind`,
`neighbours`, `raw_iri`) that the real backend's `ResourceResponse` schema doesn't yet produce.
Doesn't block this task (tests mock `fetchNodeProps`), but blocks real-backend E2E for the whole
side-panel family, compounding the gap above.

## Complexity waivers logged

Two WARN-level (not error) entries added to `.claude/state/complexity-waivers.md`:
- `ExplorerInteractions` (78/50 lines) — pre-existing violation (76 lines before this task) that
  this task's wiring marginally grew by 2 lines; already using the established extracted-hook
  pattern (`useEditingState` alongside `useCanvasChromePanels` etc.).
- The new `describe("... TASK-024 ...")` test block (59/50 lines) — the test file already carries
  7 pre-existing violations of the same class.

`useEditForm` itself was fixed (not waivered) by splitting `saveEdit` out in a prior commit
(`385aa3e2`) — confirmed 0 eslint warnings on `use-panel-edit.ts`.

## Gate results (this pass)

- `tsc --noEmit`: 0 errors.
- `eslint` (changed files): 0 errors, 0 new warnings beyond the two logged waivers above (both
  pre-existing violation classes, marginally touched).
- `eslint` (whole repo): pre-existing warnings elsewhere (unrelated files), 0 errors.
- `npx vitest run`: 319 files / 1572 tests passed, 0 failed.
- Playwright E2E: 2 scenarios written, both `test.fixme`'d (see gap above) — not run.
- No backend files touched this pass → no migration reserved (0085–0086 untouched), no new pytest
  integration/docker gate applicable, no poison-endpoint test relevant.

## Authorization / tenancy re-confirmation

Unchanged from TASK-023 (no backend/proxy files touched in this mounting pass):
- `app/api/proxy/operations/apply/route.ts:36` — `Authorization: Bearer ${jwt}` forwarded.
- Same route — fail-closed 401 on missing session (`unauthenticated`) / missing principal
  (`no_principal`).
- `routers/operations.py:215,227` — `tenant_connection(principal.tenant_id)` on every write.
