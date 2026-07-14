-- ONB-TASK-011 fix: `onboarding_state` FORCEs row-level security (0082), so
-- a plain `SELECT DISTINCT tenant_id FROM onboarding_state` on the
-- untenanted `weave_app` connection (`app.tenant_id` unset -- the scheduler
-- doesn't know which tenant to scope to yet, that's the whole point of this
-- query) returns zero rows, always -- the RLS policy denies every row when
-- `current_setting('app.tenant_id', true)` is NULL. `scheduler.py`'s
-- `_fetch_tenant_ids` silently found nothing, so neither the poller nor the
-- dispatcher ever discovered a real tenant to work -- caught only by a real
-- (RLS-enforcing) Postgres integration test, not the unit tests' FakeConn.
--
-- Same fix as 0002_identity.sql's `resolve_workspace_tenant`: a narrow,
-- read-only, single-column `SECURITY DEFINER` function that bypasses RLS
-- deliberately for this one cross-tenant "list the tenants" query.

CREATE OR REPLACE FUNCTION list_pollable_tenants()
RETURNS TABLE (tenant_id TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT tenant_id FROM onboarding_state;
$$;

GRANT EXECUTE ON FUNCTION list_pollable_tenants() TO weave_app;
