# BE-TASK-003 — Request Studio: Intake Form & AI Spec Drafting

**Epic:** BE-EPIC-001 · **Branch:** `feature/BE-EPIC-001` · **Status:** implemented, QA in progress
**Commits:** `3c0b45e` test (RED) · `0bdf606` feat (GREEN) · `279ca01` docs (ADR-001)
**Coverage:** 97% pipeline/store (independently re-measured), router/schemas 87/100% (corroborated)
**Tests:** 265 non-docker + 3 docker green + QA edge cases `97907bb` · **Migration:** none needed
**Status:** QA PASS (2 retries) — AC-5 shared-auth 401 contract fixed · epic needs BE-004 for PR
**Fix commits:** `0064eea` (header + generic-token → unauthorised) · `9961c85` (top-level body via handler)

> Coordinator-authored from the lane receipt (ADV-004: lanes never write `.claude/state/**`).

## QA outcome (retry 1/3, interface)

7 of 8 ACs PASS (AC-1/2/3/6/7/8 + AC-4 timeout logic), 97% coverage on independently-measured files,
ADR-001's 4 decisions all judged sound, RedisLike-removal casts confirmed test-only (not masking a prod
bug). **One blocking FAIL — AC-5:** 401 returns `{"detail":"missing bearer token"}` (no
`Www-Authenticate` header) instead of the AC's `{"error":"unauthorised"}` + `Www-Authenticate: Bearer`.
**Root cause is shared** `auth/dependencies.py:42` (pre-existing, not this task's diff) → **cross-task
finding XT-001** (also affects merged BE-TASK-001 AC-3). Fix dispatched: single-point change in the
shared auth dependency + full-suite blast-radius verify. See `qa-cross-task-findings.md#XT-001`.

**WARNs (non-blocking):** AC-2 CE-READ-1 grounding is nominal (pins a version IRI into the prompt, never
executes `GROUNDING_QUERY` against real BPMO) — a transparent DoR-driven M1 scope cut per ADR-001,
**needs PO sign-off for M1**; AC-4 "first token within 5s p95" budget unmeasured (no k6 harness in repo
yet — first occurrence); store.py CRUD-helper docstrings absent (minor).

## What was built

Request-intake pipeline: a form-submitted request is stored, an AI spec draft is generated
(tier-routed, offloaded off the event loop), and progress streams back via SSE.

- `requests/store.py` — request-record persistence in **Redis** (not Postgres — see ADR-001).
- `requests/pipeline.py` — AI spec-drafting orchestration; LLM call via `asyncio.to_thread` (100%).
- `routers/requests.py` — intake + SSE stream endpoints (87%).
- `schemas/requests.py` — request/response models (100%).
- `__init__.py` — router + shutdown wiring.
- `docs/specs/weave/engines/build-engine/decisions/ADR-001.md`.

## Decisions (ADR-001) & coordinator-guided fix

1. **Redis, not Postgres, for request records** — ephemeral intake state, TTL-friendly.
2. **Redis list, not pub/sub, for the SSE stream** — replayable, survives a reconnect within TTL.
3. **`asyncio.to_thread` for the LLM call** — blocking SDK call kept off the event loop (same bug
   class as prior STS/ai_route fixes).
4. **CE-READ-1 grounding scoped to CE-VERSION-1 pinned-version lookup** — given the DoR gap, grounding
   is limited to the pinned-version type read rather than the full ontology.
5. AC-4 wording resolved: `timed_out` vs `partial` distinction documented.

**Coordinator-guided mid-task fix:** dropped the `RedisLike` Protocol (it structurally mismatched
`redis.asyncio.Redis`'s real signatures and caused 34 mypy errors) — typed store/pipeline/router
directly as `redis.Redis`, test doubles kept via existing `# type: ignore[arg-type]` casts. A
one-implementation protocol was an abstraction not worth its type friction (ponytail rung 1).

## Context for downstream tasks

- Request records live in Redis under a TTL — not a durable audit source; the audit trail is
  `PLAT-AUDIT-1` separately.
- SSE stream is a Redis list; consumers replay from list head within TTL.
- Router registered in `__init__.py` — expect a merge with sibling BE lanes' registrations.

## Environment note

Worktree `packages/frontend` had no `node_modules`; ran `npm install` to unblock the shared
`make lint` pre-commit gate. One-time worktree fix, no config touched.
