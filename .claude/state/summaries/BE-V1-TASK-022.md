# Progress: BE-V1-TASK-022 — External-Space Bindings (FR-010): Confluence/Jira/ServiceNow by Reference

`build-engine` EPIC-002. Coordinator-authored from engineer receipts (capped 3×; coordinator
committed the integration-test tail + drove the AC-7-test reconciliation). Written before QA.

## Outcome

Impl complete + committed (backend + AC-6 + full frontend UI + proxy + E2E). Backend unit lane 847
pass, docker lane 12 pass, frontend app/build 44/44, bandit clean. QA full checklist pending. **Two
honestly-flagged gaps (below) for QA to rule on.** Full ui_verify --full runs at epic close.

## What shipped

- **Backend**: bindings CRUD routes through `pm/bindings.py` (external_bindings repo from TASK-010 —
  NO new migration); typed `DuplicateBinding` error on whole-key `(tenant,project,system,space_ref)`
  violation (AC-4); connector-stub client (PLAT-CONNECTOR-1 seam); mutations gated
  `require_project_role` (admin). `58f3c9b` CRUD · `439107e` connector-stub · `059a30e` dup-reject.
- **AC-6 run-context**: external bindings injected into the generation run-context
  (`generation/service.py` → `generate_app`'s bpmo dict). `4f33afc`, real-Postgres proof `55e5e58`.
- **Frontend**: made TASK-015's stubbed `binding-slots.tsx` REAL — `binding-card.tsx`,
  `bind-dialog.tsx` (bind + remove-confirm), health/status badge (colour+text). Cards use the SAME
  labels Confluence/Jira/ServiceNow. `deriveProjectRole` role-gating (admin-only edit; server 403 is
  the boundary). `1201349` UI · `856ddb0` proxy routes · `505b344` E2E ·
  `98b57be` AC-7 test reconciled (old "three disabled stubs" → "three bindable system cards").

## Decisions / nuances

- Whole-key uniqueness rejects a duplicate binding with a TYPED `DuplicateBinding` (not raw asyncpg
  error) — this broke a stale TASK-010 test that expected the raw error; fixed in `55e5e58`.
- No new migration (external_bindings table exists from TASK-010).
- Design tokens only (no ad-hoc hex/px), colour+text status badges (not colour-alone).

## Gaps (flagged, for QA/phase-gate — not hidden)

1. **Health-badge isolation UNIMPLEMENTED**: the brief's named scenario `should isolate slow health
   read to one badge` (a slow health-check for one system must not block the others' badges) is not
   built or tested. Real AC gap — QA to rule FAIL vs accept-with-followup.
2. **E2E not runnable locally**: `should bind jira board see health badge end to end` is Law-B-shaped
   but `BUILD_CONNECTOR_STUB_INSTANCES` isn't wired into any dev-stack launch (`.env.example` is
   outside the engineer's permission boundary). Runs at epic-close ui_verify once wired.

## Design GAPS (from design-agent brief section)

- `HealthBadge` unavailable→`--color-info` mapping is inference (not pinned); no combobox zero-options
  standard; no jtbd/R-bundle for Build settings (leaned on TASK-015). Phase-gate.

## Commits

- `58f3c9b`·`dad2afe`·`439107e`·`c63b73d`·`059a30e`·`4ee96d2` (backend) · `4f33afc` AC-6 ·
  `1201349`·`856ddb0`·`505b344` (frontend) · `98b57be` AC-7 fix · `55e5e58` AC-6 real-pg test + stale-test fix

## Dependencies unlocked

- (none direct) — completes the External-Space Bindings surface TASK-015 stubbed.

## QA pass (2026-07-10) — VERDICT: FAIL (logic/interface, AC-3)

Re-ran all gates independently: backend unit 20/20 (19 orig + 1 new), docker 13/13, frontend
app/build 44/44, ruff/mypy/bandit clean, tsc clean, eslint 0 errors, coverage 100% backend
bindings files / ≥82% frontend binding components. AC-1/2/4/5/6 all confirmed with real
assertions (AC-4 typed `DuplicateBinding` at DB level; AC-5 403 test; AC-6 real-Postgres
write-then-read into `bpmo["external_bindings"]`).

**Gap 3a ruled FAIL, not WARN/followup**: `should isolate slow health read to one badge` is
named as a required Integration Test in the brief's Test Requirements (not GAPS/advisory),
mapped directly to AC-3 in the AC-to-Test table, and the underlying mechanism (parallel reads +
short per-read timeout) is specified three separate times (pseudocode, API Contract,
Implementation Hints). `_read_health` in `routers/project_bindings.py` isolates *errors*
(try/except -> "unavailable") but has no timeout, so `asyncio.gather` in `list_bindings_route`
still blocks the entire GET on the slowest connector. Added
`test_list_bindings_route_isolates_slow_health_read_from_the_others` (commit `815897d`) —
empirically fails today (0.30s elapsed vs a 0.1s isolation bound), proving a slow Confluence/
Jira/ServiceNow health call degrades the whole bindings tab, not just its own badge, and
threatens the endpoint's stated p95 ≤ 400ms budget.

**Design conformance WARN (not blocking)**: `bind-dialog.tsx`'s `BindDialog`/`RemoveBindingDialog`
use `--radius-base`/`--space-5`/no `--z-modal` instead of the brief's cited `--radius-lg`/
`--space-6`/`--z-modal`; the value matches the codebase's one pre-existing Radix dialog
(`components/explorer/confirm-dialog.tsx`, same pattern, same deviation) — a repo-wide Modal
token-conformance gap, not unique to this task. `--z-modal` is unused anywhere in the frontend.
Recommend a follow-up to either add the token to the shared dialog primitive or correct the
brief's citation.

**Gap 3b confirmed non-blocking**: the Playwright E2E (`project-settings.spec.ts`) is written
correctly — binds via UI, asserts the row via an independent backend `GET`, removes, asserts
gone via `GET` again (real Law B backend-state assertion). It cannot run locally only because
`BUILD_CONNECTOR_STUB_INSTANCES` isn't wired into the dev-stack launch — correctly deferred to
epic-close `ui_verify`, not a task-blocking defect.

Full Lighthouse / axe / `ui_verify.sh` re-run deferred: task already has a hard logic FAIL: this
task returns to the Engineer regardless, and the DoD's "no ui_verify run yet, epic-close only"
note already covers UI-gate timing. Re-run those once the AC-3 timeout fix lands.
