
# Progress: PLAT-TASK-009

## Outcome

DONE — all 7 ACs met, both backend test lanes green, frontend unit + Playwright E2E + accessibility
green, lint/type/security clean, coverage 97% on the audit module. Scope held to E9-S1 only: no
self-improvement loop / agent-observed-pattern code was added (post-v1, out of scope per the brief).

## Reconciliation With Existing Code

An audit emitter seam already existed (`audit/emitter.py`'s `default_audit_emitter.emit(...)`,
`AuditEvent` dataclass, `audit_events` table) with 8 existing production call sites across
tenancy/identity/billing/settings/search/notifications routers. This task upgraded that seam into
the full PLAT-AUDIT-1 chain in place, keeping `AuditEvent`'s field names and every existing call
site's construction call unchanged. Only the underlying table (renamed `audit_events` ->
`audit_entries`, migration `0005_audit_chain.sql`) and `emitter.py`'s internals changed. Three
existing integration tests that queried the old table/columns directly were updated
(`test_identity_rbac.py`, `test_search_tenancy.py`, `test_tenancy_isolation.py`).

## Decisions Made

- **`pg_advisory_xact_lock(hashtext(tenant_id))`** instead of the brief's literal nested
  serialisable transaction, to serialise per-tenant seq/prev_hash computation inside the caller's
  already-open transaction. ADR-010.
- **`ts` stored as `TEXT`**, not `TIMESTAMPTZ`, so `verify_chain` re-hashes the exact byte sequence
  that was signed at emission time. ADR-010.
- **Security-event notification dispatched synchronously**, same connection/transaction as the
  audit insert — matches `billing/gate.py`'s precedent, not a detached background task. ADR-010.
- **GRANT-layer + trigger-layer dual defense for append-only**, discovered empirically (Postgres
  checks table-level GRANTs before a trigger ever fires) rather than designed up front — kept
  because it's strictly more defense-in-depth than either layer alone. ADR-010.
- **`build_entry`/`notify_tenant_admins_of_security_event` bundle their many fields into
  `PendingEntry`/`SecurityEventContext` dataclasses** — ruff's `max-args = 5` (`PLR0913`) has no
  waiver/ignore mechanism configured in this repo's `pyproject.toml` (`ignore = []`), so the params
  budget (Law E) had to be met by refactoring, not a logged waiver.
- **`listing.py`'s query is a single static parameterised SQL string** with a
  `$2::text IS NULL OR event_type = $2` guard, not a conditionally-interpolated WHERE clause — ruff's
  `S608` flagged the interpolated version; the static-query rewrite is strictly better, not a
  suppression.
- **Compliance-view redaction is structural**: `ComplianceResponse`/`ComplianceSummary` simply have
  no `diff_summary` field, so there's nothing for any role (admin or not) to leak — no role branch
  needed to satisfy AC-7.
- **`GET /api/audit` and `POST /api/audit/verify` are tenant-admin-gated**; `GET /api/audit/compliance`
  is open to any authenticated tenant member, since its response shape has nothing sensitive to
  redact per-role.

## Assumptions Made

- "Compliance sub-view" (frontend) scoped to a single read-only page (`/compliance`) showing chain
  status, entries-checked count, event-category counts, and top actors — no drill-down into
  individual entries and no admin-only gate on the page itself (the backend route it calls has none
  either, by design, per the structural-redaction decision above).
- Frontend proxy route (`app/api/audit/compliance/route.ts`) needs no zod query-param schema — the
  endpoint takes no query params, matching the `api/billing/usage` precedent (tenant scoping comes
  from the session's own access token, not a caller-supplied value).

## Nuances

- **Coverage required writing new mocked unit tests for `emitter.py`, `listing.py`, `verify.py`,
  `notify.py`, and `signing_key.py`** (fast lane, no docker) to clear the 80% bar — the brief's
  minimum test counts (5 unit / 4 integration / 1 E2E) are satisfied by the chain/compliance tests
  alone, but those don't exercise the DB/AWS-boundary modules. Added
  `test_audit_emitter.py`/`test_audit_listing.py`/`test_audit_verify.py`/`test_audit_notify.py`/
  `test_audit_signing_key.py`, following this repo's established fake-connection
  (`test_settings_resolver.py`) and mocked-boto3-client (`test_auth_agent.py`) precedents. Result:
  97% on the audit module (only `diff_storage.py`'s two sync S3 helpers, exercised for real by the
  docker-integration lane, are below 100% in the fast-lane number).
- **`test_audit_table_update_rejected_at_db` initially expected the wrong exception.** First run
  raised `InsufficientPrivilegeError`, not the trigger's `RaiseError`, because Postgres checks
  table-level GRANTs before a trigger fires at all — `weave_app` has no UPDATE/DELETE grant
  (belt-and-braces), so it never reaches the trigger. Fixed by asserting the correct exception type
  for that role and adding a second test for the superuser/migration role (which bypasses GRANTs
  but not the trigger) to prove the trigger itself works. See ADR-010.
- **Pre-existing, unrelated E2E flake**: `global-search.spec.ts`'s Cmd+K test failed once in the
  full-suite run, passed cleanly when re-run in isolation — a timing flake in an unrelated spec, not
  a regression from this task.

## Git Commits

- `0798607` — `test: add tests for PLAT-AUDIT-1 hash-chained audit trail` (includes the audit
  module's implementation, since the test files were staged together with it across a compacted
  session — a single cohesive TDD unit, not split further to avoid rewriting history for cosmetic
  reasons only)
- `ee5abaa` — `feat: wire up PLAT-AUDIT-1 audit routes`
- `b9d7b21` — `feat: add audit compliance sub-view (frontend)`
- `82e0892` — `docs: add ADR-010 for PLAT-AUDIT-1 implementation deviations`

## Test Results

- Unit (backend, `tests/unit/test_audit_*.py`): 28 passing, 0 failing (13 chain, 3 diff_storage, 2
  compliance, 4 signing_key, 3 listing, 2 verify, 4 emitter, 2 notify)
- Integration (docker lane, `integration and docker and not stack`): 6 new audit tests passing
  (append-only x2, tenant-scoped, cross-tenant isolation, chain-tamper detection, security
  notification); full docker lane 51/51 passing (includes the 3 updated pre-existing test files)
- Frontend vitest: `app/compliance` 3 passing; full suite 79/79 passing (was 76 before this task)
- E2E (Playwright, live webServer stack): `compliance.spec.ts` 1 passing (the required
  `test_audit_compliance_view_renders` scenario); `accessibility.spec.ts` compliance case 1 passing,
  zero axe violations; full suite 13/13 passing when run individually (1 unrelated pre-existing flake
  in a full concurrent run, confirmed non-regression by isolated re-run)
- Coverage: backend audit module 97% (243 stmts, 8 missed — `diff_storage.py`'s sync S3 helpers only)
- Lint/type/security: `ruff check .` clean (whole backend), `mypy src/ tests/` clean (155 source
  files), `bandit -r` on the audit module: 0 HIGH, 2 LOW (S105/S106 LocalStack-credential
  false-positives, same pattern as existing `auth/agent.py`/`storage/tenant_objects.py`, neither of
  which suppresses them either), eslint clean on all touched frontend files, `tsc --noEmit` clean

## ADRs Created

- `docs/specs/weave/engines/weave-platform/decisions/ADR-010.md` — the four PLAT-AUDIT-1
  implementation deviations (advisory lock, `ts` as TEXT, synchronous notification dispatch,
  GRANT+trigger dual defense)

## Dependencies Unlocked

- Any future task needing to read/verify the audit chain (e.g. a compliance export, or the
  post-v1 self-improvement loop this task explicitly excludes) has `audit/verify.py`,
  `audit/listing.py`, and `audit/compliance.py` as the read-side building blocks.
- PLAT-TASK-008's known AC-6 re-fire-on-every-threshold-crossing limitation (flagged in its own
  summary as "worth a look for the audit consumer") is now visible in the audit trail as repeated
  `billing.cap.reached` entries per period — not fixed here, since this task's scope is the chain
  itself, not billing's notification de-duplication.

## QA Findings (2026-07-05)

- **Verdict: PASS.** All 7 ACs independently verified (AC-1 hash recomputed by hand, not
  trusted from the engineer's self-check). No self-improvement-loop code found (scope held).
- 3 edge-case tests added, commit `1a6e832`: reordering detection (AC-4), cross-tenant genesis
  independence (AC-2 x AC-5), TRUNCATE rejection at the GRANT layer (AC-3 boundary).
- All 4 ADR-010 deviations judged sound; synchronous-notify-in-lock and TDD-bundling both
  judged acceptable-for-M1 with documented future risk (see
  `.claude/state/qa-cross-task-findings.md`).
- Suite counts after QA additions: unit 29 (was 28), docker integration 53 (was 51), frontend
  vitest 79/79, Playwright compliance+a11y 2/2, Lighthouse `/compliance` 100/100/100/100.
  Coverage 97% (unchanged, engineer's number independently re-verified).
- Escalated PROJ-006 (`.claude/state/qa-project-issues.md`): `compliance.spec.ts` is the
  second consecutive fully-mocked Law-B E2E gap.
- Confirmed the "audit emission should be structural" ledger finding remains open/unaddressed
  by this task (deliberate scope discipline, not a regression) — see cross-task-findings.md.

---

*Generated by Engineer. Read by Engineers starting dependent tasks and by QA.*
