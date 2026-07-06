-- BE-TASK-008 (build-engine, EPIC-008): `generation_runs` -- one row per
-- POST .../generate call (AC-6), recording the 5 M1 safety-gate outcomes
-- inline in `gate_results` JSONB rather than a separate `gate_results`
-- table (0013 is not merged on this branch -- coordinator direction, see
-- task brief). Same tenancy/RLS shape as 0012_state_spines.sql: `tenant_id`
-- TEXT (Cognito's tenant_id claim is a string, not a uuid), FORCE ROW LEVEL
-- SECURITY, a `tenant_isolation` policy keyed off `app.tenant_id` -- the
-- exact setting name `db/pool.py`'s `tenant_connection` sets via
-- `set_config('app.tenant_id', ...)`.
CREATE TABLE IF NOT EXISTS generation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    project_iri TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
    gate_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    branch TEXT,
    commit_sha TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON generation_runs
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT ON generation_runs TO weave_app;
