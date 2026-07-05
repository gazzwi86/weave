# QA cross-task findings ledger

Coordinator-owned (ADV-004: lane subagents never write `.claude/state/**`; QA agents surface findings
in their reports and the coordinator records them here). Findings that span more than one task, or a
shared/pre-existing dependency, so a single fix closes several tasks.

Status legend: OPEN · IN-PROGRESS · RESOLVED (with fix commit).

---

## XT-001 — 401 auth-error contract mismatch (shared dependency)

- **Severity:** Major · **Status:** RESOLVED on `feature/BE-EPIC-001` (`0064eea` + `9961c85`) — lands on
  main when BE-EPIC-001 merges, retroactively closing BE-TASK-001's AC-3. Fix: custom `UnauthorisedError`
  + `unauthorised_exception_handler` (JSONResponse) → top-level `{"error":"unauthorised"}` +
  `Www-Authenticate: Bearer`; `token_ttl_exceeded`/`session_revoked` left on their own contracts. Full
  backend suite green, no other router regressed.
- **Affects:** BE-TASK-001 (AC-3), BE-TASK-003 (AC-5) — same literal AC wording, same shared code.
- **Found by:** BE-TASK-003 QA (live in-process app verification, not test-suite self-report).
- **Symptom:** unauthenticated request returns `{"detail": "missing bearer token"}` with no
  `Www-Authenticate` header. The AC contract is `{"error": "unauthorised"}` + `Www-Authenticate: Bearer`.
- **Root cause:** shared `_bearer_token` / `get_current_principal` in
  `packages/backend/src/weave_backend/auth/dependencies.py:42` (pre-existing platform code — not
  introduced by either task's diff). Mapped tests assert `status_code == 401` only, so the body/header
  mismatch was never caught. BE-TASK-001 merged to main (#24) carrying the gap.
- **Fix (single point, root-cause):** normalise the shared dependency to emit the AC contract on 401 for
  every router. Dispatched to the BE-TASK-003 lane with a blast-radius guard (full-suite verify;
  stop-and-report if the change breaks a large set of unrelated tests, which would mean the contract is
  not platform-wide and needs a dedicated auth task). Closing this closes BE-TASK-001's AC-3 too.
- **Classification:** interface.

---

## XT-002 — spike-mode write-back guard is unwired

- **Severity:** Major (deferred) · **Status:** OPEN (blocked — target route doesn't exist yet)
- **Affects:** BE-TASK-005 (AC-7 defines the guard), BE-TASK-006 / BE-TASK-007 (whichever ships
  `POST /api/operations/apply` / CE-WRITE-1).
- **Found by:** BE-TASK-005 QA.
- **Symptom:** `assert_not_spike_write_back` (`build/guards.py`) is correctly unit-tested but never wired
  to any route or middleware — `/api/operations/apply` does not exist in the codebase yet. AC-7's literal
  promise ("spike-mode write-back attempts MUST return 403") is therefore not verifiable end-to-end.
- **Action:** whichever task adds the write-back route MUST wire the guard in and add an HTTP-level 403
  test. Not fixable in BE-TASK-005 (YAGNI — no route to guard). Left unit-tested only.
- **Classification:** deferred / cross-task (no defect in BE-TASK-005 itself).

---

## XT-003 — CE-READ-1 grounding forwards no tenant/auth context

- **Severity:** Major (deferred) · **Status:** OPEN (blocked — CE-READ-1 endpoint doesn't exist yet)
- **Affects:** BE-TASK-002 (briefs grounding), the task that ships CE-READ-1.
- **Found by:** BE-TASK-002 QA (forward-looking).
- **Symptom:** `briefs/ce_read_client.get_bpmo_context` forwards no Authorization/tenant context to
  CE-READ-1, and `routers/briefs.py` never verifies the caller's tenant owns the `project_iri` path param
  before grounding. Same pattern as the existing `ce_version_client`. Not testable/blockable today (the
  real CE-READ-1 endpoint doesn't exist), but becomes a **cross-tenant data-exposure risk** once it lands.
- **Action:** when CE-READ-1 ships, forward tenant/auth context on the grounding call and add a caller-owns-
  `project_iri` check + a cross-tenant-denied test.
- **Classification:** deferred / cross-task (potential tenancy hole once dependency exists).

---

## XT-004 — ui_verify Lighthouse can't reach auth-gated routes (harness gap)

- **Severity:** Major · **Status:** OPEN (harness change — needs advisor consult + HITL per governance)
- **Affects:** every auth-gated UI route in every epic (surfaced by GE-TASK-002 on `/explorer`).
- **Found by:** GE-TASK-002 QA (read `.lighthouse.json` directly — `finalUrl` was
  `/auth/login?return_to=%2Fexplorer`, not `/explorer`).
- **Symptom:** `ui_verify.sh`'s Lighthouse step has no scripted login, so for any auth-gated route it
  measures the sign-in redirect page, not the real target — Lighthouse-100 conformance on authenticated
  screens is silently UNVERIFIED (it also runs against `next dev`, unoptimised, not a prod build).
- **Action:** `ui_verify.sh` needs a scripted login (mock-OIDC token injection) before the Lighthouse
  pass on auth-gated routes. This is a **harness change** (`.claude/scripts/**`) → advisor consult +
  HITL required; do NOT let a lane fix it inline. Until then, Lighthouse PASS on any auth-gated screen
  is not trustworthy — the functional Playwright + axe layers still hold.
- **Classification:** dependency / harness.

---

## XT-005 — Explorer kind→shape pairing deferred (WCAG 1.4.1)

- **Severity:** Minor (deferred) · **Status:** OPEN (brief-sanctioned deferral)
- **Affects:** GE-TASK-002 (single ellipse in M1), GE-TASK-003/004/005 (richer node rendering).
- **Found by:** GE-TASK-002 QA.
- **Symptom:** node meaning is conveyed by colour only (single ellipse shape), so WCAG 1.4.1 ("meaning
  never colour-only") is not met. Explicitly deferred by the brief's Design Decision table (OQ-08:
  single ellipse in M1) — NOT a TASK-002 defect.
- **Action:** whichever GE task introduces kind→shape/icon pairing must close WCAG 1.4.1. Tracked, not
  fixed in M1.
- **Classification:** deferred / cross-task.
