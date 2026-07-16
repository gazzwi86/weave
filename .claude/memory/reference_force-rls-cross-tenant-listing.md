---
name: reference_force-rls-cross-tenant-listing
description: A table with FORCE ROW LEVEL SECURITY returns ZERO rows to an untenanted connection — cross-tenant enumeration (schedulers/pollers) needs a SECURITY DEFINER function
metadata:
  type: reference
---

Landmine found on ONB-011 (activation poller/dispatcher, migration 0084): a background scheduler
that must enumerate ALL tenants (to then poll/dispatch each one) queried `onboarding_state` over an
**untenanted** connection to list distinct tenant IDs. That table has `FORCE ROW LEVEL SECURITY`, so
with no `app.tenant_id` set the RLS predicate matches nothing → the query returned **zero rows** →
neither the poller nor the dispatcher ever discovered a single tenant. Silent in unit tests (they set
a tenant); **dead in production**. Only a real-Postgres integration test that drives the scheduler
end-to-end catches it.

**Rule:** any cross-tenant enumeration over a FORCE-RLS table must go through a `SECURITY DEFINER`
SQL function that returns only the minimum (a bare list of tenant IDs — never row data), with an
explicit `SET search_path` to close the injection surface, mirroring the existing
`resolve_workspace_tenant` pattern. The per-tenant work then runs inside a normal
`tenant_connection(tenant_id)` (RLS-scoped via `set_config`), NOT the untenanted connection — and
each write still carries an explicit `WHERE tenant_id = $n` for defence-in-depth (RLS + explicit
filter, belt and suspenders). Untenanted connection = list tenants only; tenant_connection = do the
work. See [[decision_tenancy-workspace-alignment]] for the tenancy model.
