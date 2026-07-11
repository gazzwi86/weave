-- BE-V1-TASK-005 (build-engine EPIC-008): widen `generation_runs` to also
-- carry the SDK-generation lifecycle (queued|running|breaking_hold|passed|
-- failed), reusing the M1 app-gen table rather than a new one (task brief:
-- "reuse generation_runs, no new table"). The M1 CHECK (0015) only allows
-- 'passed'|'failed' -- too narrow for a queued/running/breaking_hold run
-- that has no commit outcome yet. Dropped, not narrowed, following the same
-- open-TEXT-enum precedent as `gate_results.result`
-- (0013_gate_results.sql: "`result` stays an open TEXT enum (no CHECK
-- constraint) so both vocabularies coexist without a migration conflict
-- later") -- a future run kind's status vocabulary never forces another
-- migration here. See ADR-022 for the full brief-vs-reality writeup.
ALTER TABLE generation_runs DROP CONSTRAINT generation_runs_status_check;

-- `run_kind` distinguishes an SDK-generation row ('sdk') from the existing
-- app-gen rows (NULL, unchanged) -- nullable and additive, so
-- `insert_generation_run`'s hard-coded 'passed' INSERT (M1 app-gen path)
-- keeps working unmodified; only the new SDK code path ever writes
-- run_kind = 'sdk'.
ALTER TABLE generation_runs ADD COLUMN run_kind TEXT;

-- `payload` carries the SDK-lifecycle's variable-shaped data
-- (package_version | breaking_version_iris | failure_cause) -- same
-- `payload JSONB` pattern as `gate_results.payload` (0013). App-gen rows
-- never write this column (default stays `{}`); their own gate outcomes
-- keep using the pre-existing `gate_results` array column, untouched.
ALTER TABLE generation_runs ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
