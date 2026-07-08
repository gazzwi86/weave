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
