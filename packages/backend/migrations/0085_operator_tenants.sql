-- G15/ADR-023: operator-console platform registry -- one row per company,
-- deliberately WITHOUT row-level security. Every other tenancy table
-- (workspaces, workspace_members, settings, audit_events, migration 0001)
-- FORCEs RLS because it holds per-tenant *data*; `tenants` IS the
-- cross-tenant list -- the one query G15 exists to serve reads across all
-- of them. The isolation boundary here is the app-layer `require_super_admin`
-- gate (rbac.py), not a row policy -- so no SECURITY DEFINER bypass function
-- is needed either, unlike migration 0084's `list_pollable_tenants()`.
--
-- `status` is read on every authenticated request (`get_current_principal`,
-- auth/dependencies.py) to enforce suspension -- indexed via the primary
-- key, so that lookup stays a single cheap row fetch.

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY CHECK (tenant_id <> ''),
    name TEXT NOT NULL CHECK (name <> ''),
    industry TEXT NOT NULL,
    region TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON tenants TO weave_app;
