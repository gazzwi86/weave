-- BE-TASK-007 (build-engine, EPIC-012): `gate_results` -- persisted record
-- of every DoR/DoD/pre-scaffold gate evaluation (ADR-004).
--
-- The tech-spec's `gate_results` table (data-model.md#gate-results-table)
-- is modelled for the 5 M1 *safety* gates (SAST/type_check/mutation/
-- pkg_existence/secret_scan): keyed on `run_id` FK -> `generation_runs`,
-- `result` a `passed|failed` enum, `command_executed` singular. This
-- task's three gates don't fit that shape -- DoR/DoD key on `task_id`,
-- pre-scaffold keys on `project_iri`, and each returns a differently-shaped
-- payload (`failing_checks[]` | `commands[]` | `findings[]`), plus a wider
-- result vocabulary (READY|NOT_READY|PASS|FAIL|PROCEED).
--
-- Decision (ADR-004): one `gate_results` table serves both families.
-- `task_id`/`project_iri`/`run_id` are all nullable -- a given gate
-- populates whichever one it keys on -- and the variable payload lands in
-- a single `payload JSONB` column instead of three separate array columns.
-- `result` stays an open TEXT enum (no CHECK constraint) so both
-- vocabularies coexist without a migration conflict later. RLS follows the
-- same `tenant_id TEXT` + `FORCE ROW LEVEL SECURITY` precedent as
-- 0010_task_briefs.sql/0012_state_spines.sql (not the tech-spec's UUID --
-- every other tenancy-scoped table in this schema already uses TEXT, since
-- Cognito's `tenant_id` claim is a string).
CREATE TABLE IF NOT EXISTS gate_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    gate TEXT NOT NULL CHECK (gate <> ''),
    result TEXT NOT NULL CHECK (result <> ''),
    task_id TEXT,
    project_iri TEXT,
    run_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A gate result always references at least one of the three keys --
    -- never a fully-untargeted row.
    CHECK (task_id IS NOT NULL OR project_iri IS NOT NULL OR run_id IS NOT NULL)
);
ALTER TABLE gate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_results FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gate_results
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT ON gate_results TO weave_app;
