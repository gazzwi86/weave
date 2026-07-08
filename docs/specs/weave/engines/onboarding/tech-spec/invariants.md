---
title: "Onboarding — Spec Invariants"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify (Arch Law 10). M1 set lifted from architecture.md §Invariants; M2 additions from
  m2-delta.md §9. Each entry has a verify-by selector (file path + grep pattern); paths under
  apps/ and packages/ are the planned code locations — QA re-anchors selectors if layout moves."
status: Draft
date: 2026-07-08
entity: onboarding
---

# Onboarding — Spec Invariants

One line per invariant. `verify-by:` = file path + grep pattern (test names are the primary
selectors — each invariant maps to a release-gate test per testing-strategy.md).

## M1

- Sandbox reads/writes touch only the caller's own sandbox workspace graph; zero cross-user
  triples — verify-by: `apps/api/tests/onboarding/test_isolation.py` + grep `test_user_a_sees_zero_user_b_triples`
- Non-content-admin write to the canonical Hammerbarn template ⟹ 403 + PLAT-AUDIT-1 record —
  verify-by: `apps/api/tests/onboarding/test_isolation.py` + grep `test_canonical_write_403_audited`
- Unscoped sandbox query under tenant-A JWT returns zero tenant-B rows/triples (two-tenant
  seeded gate) — verify-by: `apps/api/tests/onboarding/test_isolation.py` + grep `test_cross_tenant_zero_leak`
- Reset is all-or-nothing (latest canonical batch or unchanged, never partial); completion flags
  cleared on success — verify-by: `apps/api/tests/onboarding/test_reset.py` + grep `test_reset_atomic`
- Activation fires exactly once per `(tenant, user, milestone)` via `ON CONFLICT DO NOTHING` +
  transactional outbox; re-trigger never double-fires — verify-by: `apps/api/tests/onboarding/test_activation.py` + grep `test_retrigger_single_fire`
- Absent/unmounted anchor ⟹ skip/hide + warn log, never a blocked tour or orphaned tooltip —
  verify-by: `e2e/onboarding/tour-resilience.spec.ts` + grep `absent anchor`
- Not-shipped engine area ⟹ all three overlay types + demo area uniformly flagged off
  ("Coming soon", never broken/empty) — verify-by: `packages/shared/onboarding/__tests__/phase-gating.test.ts` + grep `flags off`
- Role-path resolution is total: canonical RBAC via PLAT-IDENTITY-1 (never raw Cognito groups),
  10→4 exhaustive, multi-role prompts, zero-role/Viewer → Business read-only — verify-by: `apps/api/tests/onboarding/test_role_paths.py` + grep `test_mapping_total`
- Onboarding state is server-side per `(tenant, user)` with fail-closed RLS; localStorage is
  cache-only — verify-by: `apps/api/tests/onboarding/test_rls.py` + grep `test_no_session_context_zero_rows`
- Every overlay passes WCAG 2.1 AA zero axe violations and is keyboard-navigable; advancing
  never requires touching the highlighted element — verify-by: `e2e/onboarding/a11y.spec.ts` + grep `toHaveNoViolations`
- Content CI fails on dead "Take tour" CTA, unregistered anchor, missing phase/role tag, or
  copy-budget breach; all strings are i18n keys — verify-by: `packages/shared/onboarding/__tests__/content-ci.test.ts` + grep `dead-CTA`
- Both-ways `data-tour-id` audit: unregistered attribute or shipped-phase registry entry missing
  from code fails CI — verify-by: `scripts/tour-anchor-audit` + grep `both ways|two-way`
- Tests use in-process FastAPI + in-memory Oxigraph + pytest-postgresql + stubbed PLAT-*/CE
  clients — no real cloud (Law F) — verify-by: `apps/api/tests/conftest.py` + grep `stub`

## M2 (delta — m2-delta.md §9, red-team remediated 2026-07-08)

- M2 tours/beacons target only the m2-delta §3 registry anchors (11); canvas-rendered internals
  are never anchor targets — verify-by: `packages/shared/onboarding/anchors.ts` + grep `phase: "m2"`
- Per-anchor shipped signal (ADR-008): every m2 anchor carries `shipped` + `planted_by`; the
  two-way audit fails on shipped-without-attribute AND attribute-without-shipped; overlays are
  offered only when all their anchors are shipped — verify-by: `scripts/tour-anchor-audit` + grep `shipped`
- Competency-question guidance is onboarding-rendered only (manual checklist item + role-home
  beacon, M1 self-mark machinery); no CE read, no schema change, no new endpoint anywhere in
  the window — verify-by: `apps/api/tests/onboarding/test_competency_guidance.py` + grep `test_no_ce_calls_on_competency_path`
- Competency beacon derives from the checklist item's server-side open/complete state; manual
  completion is exactly-once (idempotent re-mark) — verify-by: `apps/api/tests/onboarding/test_competency_guidance.py` + grep `test_self_mark_idempotent`
- With any M2 overlay open, the owning page still meets its engine's Lighthouse/axe gate;
  modals trap focus and return it on close — verify-by: `e2e/onboarding/m2-overlays.spec.ts` + grep `focus trap|overlay open`
- E3-S2 Business-path CE-METRICS-1 tile un-omit is Platform availability-registry /
  starter-widget behaviour (Platform E1-S6, Platform M2 TASK-010): onboarding asserts it in
  E2E, implements nothing — verify-by: `e2e/onboarding/m2-overlays.spec.ts` + grep `starter tile`
- Release gate fails while any m2 registry anchor is `shipped: false` — verify-by: `e2e/onboarding/m2-overlays.spec.ts` + grep `shipped`
- Zero new endpoints, services, queues, schema members, or DDL in the M2 window; all state on
  the M1 `/api/onboarding/*` router — verify-by: `docs/specs/weave/engines/onboarding/tech-spec/m2-delta.md` + grep `zero new`
