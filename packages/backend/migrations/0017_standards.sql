-- BE-TASK-001 (build-engine, EPIC-002): standards catalogue (E2-S7) --
-- company-scope + project-scope override documents, plus the two `projects`
-- SDK-bookkeeping columns TASK-005 consumes. One migration owns both per
-- the task brief.
--
-- RLS follows the 0001_tenancy.sql / 0009_projects.sql precedent exactly
-- (ADR-003): ENABLE + FORCE ROW LEVEL SECURITY so even the table owner is
-- bound by the policy, since the app connects as the non-superuser
-- `weave_app` role. The policy is fail-closed: `current_setting(...,
-- true)` returns NULL when `app.tenant_id` isn't set for the session, and
-- `tenant_id = NULL` never matches any row.
CREATE TABLE IF NOT EXISTS standards_documents (
    standard_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    scope TEXT NOT NULL CHECK (scope IN ('company', 'project')),
    -- AC-7 db-level backstop (the app layer rejects this with 422 before
    -- ever reaching here) -- company scope never carries a project_id,
    -- project scope always does.
    project_id TEXT CHECK (
        (scope = 'project' AND project_id IS NOT NULL)
        OR (scope = 'company' AND project_id IS NULL)
    ),
    standard_key TEXT NOT NULL CHECK (standard_key <> ''),
    title TEXT NOT NULL CHECK (title <> ''),
    body_md TEXT NOT NULL,
    stack_pins JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_iri TEXT NOT NULL CHECK (policy_iri <> ''),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
    created_by TEXT NOT NULL CHECK (created_by <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Two partial unique indexes (not one plain UNIQUE) because Postgres treats
-- NULL as distinct-from-itself in a unique constraint -- a plain
-- UNIQUE(tenant_id, scope, project_id, standard_key) would let unlimited
-- company-scope duplicates (project_id always NULL there) through. Each
-- scope gets its own upsert conflict target instead (standards/store.py).
CREATE UNIQUE INDEX IF NOT EXISTS standards_company_key_idx
    ON standards_documents (tenant_id, standard_key)
    WHERE scope = 'company' AND project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS standards_project_key_idx
    ON standards_documents (tenant_id, project_id, standard_key)
    WHERE scope = 'project';

ALTER TABLE standards_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON standards_documents
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON standards_documents TO weave_app;

-- TASK-005's SDK-generation bookkeeping (this task only adds the columns --
-- TASK-005 owns the write path). No RLS change: `projects` already carries
-- FORCE ROW LEVEL SECURITY + `tenant_isolation` from 0009_projects.sql; a
-- plain ALTER TABLE ADD COLUMN inherits it (same precedent as
-- 0016_projects_write_back.sql).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_sdk_version_iri TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sdk_generation_count INTEGER NOT NULL DEFAULT 0;
