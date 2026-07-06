-- BE-TASK-006 (build-engine, EPIC-011): dark-factory execution engine --
-- persisted, RLS-isolated run state (FR-044), dependency-summary handoff
-- store (FR-043), and a per-task retry-count ledger. RLS follows the same
-- FORCE ROW LEVEL SECURITY precedent as task_briefs/request_sign_offs
-- (0010/0011); `tenant_id` is TEXT to match every other tenancy-scoped
-- table in this schema (Cognito's tenant_id claim is a string).
--
-- `dep_summaries`/`task_retries` are keyed by (project_iri, task_id, ...)
-- rather than task_id alone -- task ids are not guaranteed globally unique
-- across tenants/projects (Implementation Hints), so task_id alone risks
-- a cross-tenant collision. `tenant_id` is carried in the key too (belt
-- and braces over relying solely on project_iri's embedded tenant_id).
CREATE TABLE IF NOT EXISTS state_spines (
    project_iri TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    run_id TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'running',
    dispatch_count INTEGER NOT NULL DEFAULT 0,
    turn_cap INTEGER NOT NULL,
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE state_spines ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_spines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON state_spines
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON state_spines TO weave_app;

CREATE TABLE IF NOT EXISTS dep_summaries (
    project_iri TEXT NOT NULL,
    task_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_iri, task_id, tenant_id)
);
ALTER TABLE dep_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dep_summaries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dep_summaries
    USING (tenant_id = current_setting('app.tenant_id', true));

-- UPDATE is required alongside INSERT: `write_dep_summary` does
-- `INSERT ... ON CONFLICT (project_iri, task_id, tenant_id) DO UPDATE`,
-- which Postgres enforces as an UPDATE-privilege check on the conflict path.
GRANT SELECT, INSERT, UPDATE ON dep_summaries TO weave_app;

-- Per-(project, task, failure_class) retry ledger named in the Data Model
-- tech-spec section (pending, see task brief Diagram References). Not yet
-- wired into application code in M1 -- BE-TASK-005's `handle_agent_result`
-- tracks retry counts in-process (`build/store.py`, an explicit M1 stub
-- per its own module docstring) rather than against Aurora. The table is
-- created now so the schema exists ahead of that persistence follow-up
-- (see the BE-TASK-006 progress summary for the tracked gap).
CREATE TABLE IF NOT EXISTS task_retries (
    project_iri TEXT NOT NULL,
    task_id TEXT NOT NULL,
    failure_class TEXT NOT NULL,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    retry_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_iri, task_id, failure_class, tenant_id)
);
ALTER TABLE task_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_retries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task_retries
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON task_retries TO weave_app;
