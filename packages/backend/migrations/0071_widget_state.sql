-- PLAT-V1-TASK-010: widget-state foundation (ADR-014 Aurora + M1 RLS,
-- ADR-013 SWR last-result). Three tenant-scoped tables -- no workspace_id
-- anywhere (workspace ≡ tenant, m2-delta.md §4). Follows the notifications
-- migration's RLS/grant pattern verbatim (tenant_id TEXT, no `tenants` FK --
-- this codebase has no `tenants` table, tenant_id is a plain scoped string
-- everywhere, see migrations/0002_identity.sql).

CREATE TABLE IF NOT EXISTS widget_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'tenant_default', 'role_home')),
    -- NULL for tenant_default/role_home; required for scope='user' (E1-S5
    -- independent per-user copies, E1-S6 starters).
    owner_principal_iri TEXT,
    spec JSONB NOT NULL,
    "position" INTEGER NOT NULL,
    refresh_interval_s INTEGER NOT NULL DEFAULT 300,
    -- SWR payload (ADR-013); NULL until first successful fetch.
    last_result JSONB,
    fetched_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'unavailable'
        CHECK (status IN ('fresh', 'stale', 'pending', 'unavailable', 'source_not_ga')),
    library_item_id UUID,
    -- E1-S6 starter flag; cleared on first pin/remove.
    suggested BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (scope <> 'user' OR owner_principal_iri IS NOT NULL),
    CHECK (scope = 'user' OR owner_principal_iri IS NULL)
);

CREATE INDEX IF NOT EXISTS widget_instances_scope_idx
    ON widget_instances (tenant_id, scope, owner_principal_iri);

-- Idempotent-seed backstop (implementation hint: two parallel first
-- requests must not double-seed). NULLs aren't distinct in a plain unique
-- index, so owner_principal_iri (NULL for tenant_default) is coalesced --
-- one functional index covers both the tenant_default provisioning race
-- (AC-2) and the per-user starter race (AC-8): no two rows may claim the
-- same grid position for the same (tenant, scope, owner).
CREATE UNIQUE INDEX IF NOT EXISTS widget_instances_position_uniq
    ON widget_instances (tenant_id, scope, COALESCE(owner_principal_iri, ''), "position");

ALTER TABLE widget_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON widget_instances
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS widget_library_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    name TEXT NOT NULL,
    description TEXT,
    spec JSONB NOT NULL,
    author_principal_iri TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS widget_library_items_tenant_idx
    ON widget_library_items (tenant_id);

ALTER TABLE widget_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_library_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON widget_library_items
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS widget_refinements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    widget_instance_id UUID NOT NULL REFERENCES widget_instances (id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    spec JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (widget_instance_id, step)
);

CREATE INDEX IF NOT EXISTS widget_refinements_widget_idx
    ON widget_refinements (tenant_id, widget_instance_id);

ALTER TABLE widget_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_refinements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON widget_refinements
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON widget_instances, widget_library_items, widget_refinements
    TO weave_app;
