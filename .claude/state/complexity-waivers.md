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
