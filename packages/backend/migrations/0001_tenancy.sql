-- PLAT-TASK-003: tenancy (workspaces, members), settings cascade, audit events.
--
-- RLS enforcement note (ADR-003): Postgres never applies row-security
-- policies to a superuser connection, even with FORCE ROW LEVEL SECURITY --
-- that clause only changes behaviour for the *table owner* when it is not a
-- superuser. Locally, `weave` (the migration/admin role) IS a superuser, so
-- the application must connect as a separate, non-superuser role for RLS to
-- have any effect at all. `weave_app` is that role.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'weave_app') THEN
        CREATE ROLE weave_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    slug TEXT NOT NULL CHECK (slug <> ''),
    display_name TEXT NOT NULL,
    named_graph_iri TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug)
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workspaces
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    workspace_id UUID NOT NULL REFERENCES workspaces (id),
    -- null until the invited person accepts and is identified by a real sub.
    user_sub TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role <> ''),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    -- PR #11 finding 2: tenant-scoped, not just (workspace_id, email) -- a
    -- global unique index let a second tenant's INSERT ON CONFLICT
    -- silently overwrite another tenant's real invite for the same
    -- workspace_id+email. The router-level ownership check (routers/
    -- tenancy.py) is the primary fix; this is belt-and-braces at the
    -- schema level. No deployed environments yet, so amending 0001
    -- directly is acceptable rather than adding a migration to fix a
    -- migration.
    UNIQUE (tenant_id, workspace_id, email)
);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workspace_members
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    scope TEXT NOT NULL CHECK (scope IN ('company', 'domain', 'workspace', 'project')),
    scope_rank SMALLINT NOT NULL,
    scope_iri TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scope_iri, key)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON settings
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    event_type TEXT NOT NULL,
    actor_iri TEXT NOT NULL,
    subject_iri TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_events
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT USAGE ON SCHEMA public TO weave_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, workspace_members, settings, audit_events TO weave_app;
