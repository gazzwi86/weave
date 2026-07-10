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

## `sdk_trigger.py` (`packages/backend/src/weave_backend/generation/sdk_trigger.py`)

- **Threshold:** file ≤ 300 lines (Law E).
- **Actual:** 353 physical lines (BE-V1-TASK-005, EPIC-008).
- **Reason:** one cohesive single-transaction SDK-delivery flow — `trigger_sdk_generation` /
  `run_sdk_generation` / `approve_sdk_breaking_ack` and their commit machinery
  (`_generate_and_commit`, `_commit_generated_sdk`) all funnel to the **single `commit_workspace`
  call site**, which is an explicit DoD invariant (verified holds) and a security-relevant
  atomicity guarantee. ~40% of the file is docstring/comment (house "explain the why" style), so
  the code-only count is comfortably under 300. A minimal split (moving `_commit_generated_sdk` +
  helpers to a new module) removes only ~48 lines — still over cap — while a fuller split would
  fragment one atomic operation across files, obscure the single-commit-site invariant, and force
  retargeting of already-committed test monkeypatches (`sdk_trigger.generate_sdk` /
  `tenant_connection` / `update_sdk_run_status` bare-name attrs) with no readability or safety
  gain. No Python file-length linter enforces this locally (ruff has no such rule). Left as one
  cohesive module with this waiver.
