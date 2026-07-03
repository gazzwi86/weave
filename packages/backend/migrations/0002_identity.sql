-- PLAT-TASK-004: agent/human principal registry (RBAC + agent identity).
--
-- `principals.sub` is the single RBAC join key for both principal types: a
-- human's Cognito/mock-OIDC `sub`, or an agent's `sha256(iam_role_arn)[:16]`
-- (see identity/registry.py). It is the same string embedded in the JWT's
-- `sub` claim, so `workspace_members.role` lookups (keyed on `user_sub`) work
-- identically for a human or an agent principal (ADR-005 uniform-RBAC-path
-- decision) -- no route or dependency needs to branch on principal type.
-- `iri` is deterministic from `sub` alone (see human_principal_iri /
-- agent_principal_iri) -- it is NOT tenant-namespaced in its string form, so
-- it must not be the table's primary key: two different tenants can each
-- mint a principal whose `sub` happens to collide (a low-cardinality dev/test
-- sub, or -- for agents -- LocalStack's STS emulator always resolving to the
-- same root ARN regardless of input), which is a legitimate distinct row per
-- tenant, not a collision. `(tenant_id, sub)` is the true uniqueness
-- constraint and the idempotent-upsert target; `id` is a plain surrogate key
-- matching the pattern already used by workspace_members/settings/audit_events.
CREATE TABLE IF NOT EXISTS principals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iri TEXT NOT NULL,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    type TEXT NOT NULL CHECK (type IN ('human', 'agent')),
    sub TEXT NOT NULL CHECK (sub <> ''),
    display_name TEXT NOT NULL,
    iam_role_arn TEXT,
    workspace_id UUID REFERENCES workspaces (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotent mint target: a second login/registration for the same
    -- (tenant_id, sub) upserts the existing row rather than duplicating it.
    UNIQUE (tenant_id, sub)
);
CREATE INDEX IF NOT EXISTS principals_tenant_iri_idx ON principals (tenant_id, iri);
ALTER TABLE principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON principals
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON principals TO weave_app;

-- ADR-005: agent identity minting (POST /api/auth/agent-token) is handed a
-- `workspace_id` but no `tenant_id` -- it must resolve which tenant owns that
-- workspace *before* `app.tenant_id` can be set for the RLS-scoped
-- `weave_app` connection, which is otherwise a chicken-and-egg problem (every
-- policy on `workspaces` denies all rows until `app.tenant_id` is already
-- set). `SECURITY DEFINER` runs this one narrow, read-only, single-column
-- lookup with the *function owner's* (the migration/admin role's) privileges
-- -- which is a real Postgres superuser locally (see ADR-003) and so bypasses
-- RLS entirely, same as any other superuser session already does. Grantees
-- can only ever learn a workspace's tenant_id, never any other column or row.
CREATE OR REPLACE FUNCTION resolve_workspace_tenant(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM workspaces WHERE id = p_workspace_id;
$$;

GRANT EXECUTE ON FUNCTION resolve_workspace_tenant(UUID) TO weave_app;
