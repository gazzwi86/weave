# Law E complexity waivers

Format: one entry per waiver, non-empty reason required (Law E, `.claude/rules/plugin-laws.md`).

## `create_request_route` (`packages/backend/src/weave_backend/routers/requests.py`)

- **Threshold:** params ≤ 5 (Law E).
- **Actual:** 6 (`body`, `background_tasks`, `principal`, `ce_client`, `provider`, `authorization`).
- **Reason:** fixing CE-VERSION-1 grounding (graph_context stuck at "unavailable") requires
  forwarding the caller's `Authorization` header into the `BackgroundTasks`-detached drafting
  pipeline, which has no live `Principal` by the time it calls CE-VERSION-1. The header must be
  captured here, at the route, before backgrounding. 4 of the 5 existing params are FastAPI
  `Depends`/framework params already at the route boundary (`body`, `background_tasks`,
  `principal`, `ce_client`, `provider`); splitting the route into a wrapper only to keep a param
  count under a number would add an unrequested layer for one caller. Left as-is with this waiver
  rather than restructuring.

## `put_standard_route` (`packages/backend/src/weave_backend/routers/standards.py`)

- **Threshold:** params ≤ 5 (Law E).
- **Actual:** 6 (`scope`, `key`, `body`, `principal`, `ce_client`, `authorization`).
- **Reason:** `scope`/`key` are the route's path params (AC-7's scope/key identity), `body` is the
  Pydantic request schema (Law 13), `principal` and `ce_client` are FastAPI `Depends` (tenant-admin
  authz per ADR-010, CE-READ-1 client for AC-1/AC-2), and `authorization` is the raw header
  forwarded into `get_entity` for the CE-READ-1 call (same header-forwarding shape as
  `create_request_route` above). All six are framework/DI params already at the route boundary --
  none is app-owned business data that could be grouped into one dataclass without adding an
  unrequested wrapper layer for a single caller.

## `NewProjectForm` (`packages/frontend/app/build/new-project-form.tsx`)

- **Threshold:** function ≤ 50 lines (Law E).
- **Actual:** 77.
- **Reason:** the "New project" modal's form body (AC-8 name/description + AC-6 secret-reference
  chip + error row + cancel/create actions) is already split out of `NewProjectModal` (which owns
  the `<dialog>`/open-close/submit-to-backend concerns) specifically to keep both under budget.
  The remaining length is five `<label>` blocks of genuinely declarative JSX with no shared
  branching logic (cyclomatic 1) -- fragmenting each field into its own single-field component
  would add four unrequested wrapper components for a form this small, purely to dodge a line
  count, with no readability or reuse benefit. Left as one component with this waiver.


## `renderer-adapter.ts` (`packages/frontend/lib/explorer/renderer-adapter.ts`)

- **Threshold:** file ≤ 300 lines (Law E) — ESLint `max-lines` severity is WARN (not error) for TS.
- **Actual:** 330 lint-counted / 436 raw (CE-V1-TASK-020, EPIC-015).
- **Reason:** the single Cytoscape↔app adapter seam — was already over (323 lines at e74dbe8, prior
  task) before TASK-020 added the batched filter-visibility apply (+115). It's one cohesive
  imperative-graph-mutation boundary (all `cy.batch`/hide/show/style calls funnel here by design, so
  the rest of the app never touches Cytoscape directly). Splitting it fragments that single-seam
  invariant. WARN-level, pre-existing violation class. **Follow-up queued:** extract the
  filter-visibility apply into a sibling module before it grows further (tracked in overnight-queue).

## `start_or_resume_run` (`packages/backend/src/weave_backend/build/state_spine.py`)

- **Threshold:** params ≤ 5 (Law E).
- **Actual:** 6 (`conn`, `tenant_id`, `project_iri`, `run_id`, `turn_cap`, `prompt_context`).
- **Reason:** BE-V1-TASK-021 (FR-065) adds `prompt_context` (the direct-project-prompt payload
  that also carries the "is this a prompt-triggered run" signal — a non-`None` value implies
  `trigger="prompt"`, so no separate `trigger` param was added). The other five params are
  each independent identity/config values a caller must supply (`conn` DI, `tenant_id`,
  `project_iri`, a fresh `run_id`, and the resolved `turn_cap`) — grouping them into a
  dataclass would add an unrequested wrapper layer for a single call site
  (`routers/runs.py`, `routers/prompts.py`). Left as a waiver rather than restructuring.

## `ExplorerInteractions` (`packages/frontend/components/explorer/explorer-interactions.tsx`)

- **Threshold:** function ≤ 50 lines (Law E) — ESLint `max-lines-per-function` severity is WARN (not error).
- **Actual:** 78 lint-counted lines (CE-V1-TASK-024, EPIC-017).
- **Reason:** pre-existing violation (76 lines before this task, from prior composition-root growth
  across TASK-004/005/020/022/023/026/027) — this task added 2 lines (one `useEditingState` call, two
  new props threaded to `NodeInteractionOverlays`). The hook logic itself is already extracted
  (`useEditingState`, `useCanvasChromePanels`, `useContextMenuActions`, etc. all pulled out per the
  established pattern); what remains in the body is one line per already-extracted hook plus the JSX
  composition, which is the intentional shape of this file (a single "wire everything onto the
  renderer-adapter seam" composition root). WARN-level, out of TASK-024's wiring scope to restructure.
  **Follow-up queued:** split `ExplorerInteractions`'s JSX return into a sibling
  `ExplorerInteractionsChrome` component the next time a task touches this file.

## `describe("ExplorerInteractions -- TASK-024 property edit + delete", ...)` (`packages/frontend/components/explorer/__tests__/explorer-interactions.test.tsx`)

- **Threshold:** function ≤ 50 lines (Law E) — ESLint `max-lines-per-function` severity WARN.
- **Actual:** 59 lint-counted lines.
- **Reason:** this test file already carries 7 pre-existing WARN-level line-budget violations of the
  same class (its top-level `describe` blocks each run 50-225 lines; `max-lines` itself is already
  breached at 551 lines before this task). Splitting one new `describe` block while its 6 siblings
  stay over budget doesn't change the file's actual complexity profile. WARN-level, consistent with
  the file's existing (already-waived-by-convention) shape.

## `useExplorerCanvas` (`packages/frontend/components/explorer/use-explorer-canvas.ts`)

- **Threshold:** file ≤ 300 lines (Law E).
- **Actual:** 358 lines (Explore-canvas lane, item 1: minimap node-dot wiring).
- **Reason:** pre-existing violation (326 lines before this task, mostly dev-only Playwright
  introspection hooks -- `resetDevIntrospection`/`nodeInfoLookup`/`exposeDevIntrospection`/
  `clearDevIntrospection` -- untouched here). This task's own addition (`minimapNodes` state +
  threading it through `LoadCanvasParams`/`wireCanvas`) is already minimised: the actual per-node
  scaling/colour-lookup logic was pulled into a new sibling file
  (`compute-minimap-state.ts`, independently unit-tested) rather than inlined, so the net growth
  here is ~32 lines of plumbing, not the full feature. Restructuring the pre-existing dev-hook debt
  is out of this task's scope ("touch only what you must"). **Follow-up queued:** split the
  dev-introspection hooks into their own sibling file next time this file is touched.
