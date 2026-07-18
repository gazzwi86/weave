# G15 — operator-tenant management endpoints

PR: https://github.com/gazzwi86/weave/pull/148 (branch `feat/operator-tenant-gaps`, base `main`)

## What shipped

3 endpoints under `/api/operator/companies` (list, provision, suspend/unsuspend), all gated by
`require_super_admin` (pure-JWT `scope=platform` check, ADR-023). Suspension enforced at the shared
`get_current_principal` auth dependency so every route gets it for free. New `tenants` registry table
(migration 0085) is deliberately non-RLS'd — `require_super_admin` is the sole isolation boundary for
that one table (ADR-023 point 2/3).

## Decisions

- Provisioning is synchronous, single transaction per company — no async job queue, no per-tenant
  framework-kind seeding (BPMO is a global SHACL shape set). ADR-023 point 4.
- Suspension check fails OPEN on DB error or missing registry row (pre-G15 tenant) — a missing
  operator record must never mean "nobody can log in". ADR-023 point 3.
- Full design write-up: `docs/specs/weave/engines/weave-platform/decisions/ADR-023.md`.

## Bug found + fixed mid-task

`tests/integration/test_operator_companies.py`'s `operator_client` fixture applied a whole-test
`app.dependency_overrides[get_current_principal]` override, which silently stubbed the
`/api/workspaces/active` calls meant to prove suspension enforcement too — so the CRITICAL isolation
assertion was passing against the stub, not the real auth path. Fixed with a narrowly-scoped
`_as_super_admin()` context manager used only around the three operator calls.

## Known gap — NOT resolved, needs a human call

Task instructions asked me to tick G15 in `docs/design/remediation-2-api-gaps.md`. That file does not
exist on `main` or on this branch's history. It exists, divergently, on two other unmerged branches:

- `feat/build-data-gaps` — G1–G12 ticked with resolution notes, no G15 entry at all
- `feature/refit-home-operator` (also on `origin`) — G1–G14 all unticked/stale, but DOES have an
  unticked G15 entry

Editing this file here would create a THIRD divergent copy and make `main` wrong about whichever other
lane's gaps aren't reflected. I did not touch it — see the escalation for options. The PR description
states the work is done; the tracker tick is a separate reconcile question.
