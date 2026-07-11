-- BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059): two 0031 gaps found only
-- once the already-committed integration tests were run (Engineer Law 11 --
-- both are additive, non-destructive fixes, not a test-file change).
--
-- 1. `run_id UUID` (0015) cannot hold the SDK lifecycle's runtime-chosen
--    identifiers -- `run_sdk_generation`/`update_sdk_run_status`/`get_sdk_run`
--    round-trip whatever `run_id` the caller supplies (the trigger route
--    always passes back the real `gen_random_uuid()`-default value from
--    `insert_sdk_generation_run`, but nothing in the SDK lifecycle requires
--    that -- `gate_results.run_id` (0013) is already `TEXT`, unconstrained,
--    for the identical reason). Widened to `TEXT`, default switched to
--    `gen_random_uuid()::text` so the M1 app-gen INSERT path (which never
--    specifies `run_id`, relies on the column default) is unaffected --
--    still a valid UUID string, just no longer type-enforced.
-- 2. `weave_app` was only ever granted `SELECT, INSERT` (0015) -- the SDK
--    lifecycle's `queued -> running -> breaking_hold -> passed|failed`
--    transitions are `UPDATE`s (`update_sdk_run_status`), which 0031 needed
--    but never granted.
ALTER TABLE generation_runs ALTER COLUMN run_id DROP DEFAULT;
ALTER TABLE generation_runs ALTER COLUMN run_id TYPE TEXT USING run_id::text;
ALTER TABLE generation_runs ALTER COLUMN run_id SET DEFAULT gen_random_uuid()::text;

GRANT UPDATE ON generation_runs TO weave_app;
