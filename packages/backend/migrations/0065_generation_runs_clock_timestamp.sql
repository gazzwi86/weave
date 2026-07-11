-- BE-V1-TASK-019: `generation_runs.created_at` used `DEFAULT now()`, which
-- returns the *transaction* start time -- identical for every row inserted
-- inside one transaction. The dashboard's demo/ribbon tiles order by
-- `created_at DESC LIMIT 1` to find the latest run; two runs seeded in the
-- same transaction (a real path -- see `orchestrator.py`'s per-task
-- generate+record flow) could tie and return either row. `clock_timestamp()`
-- is per-statement wall time, so insertion order is always preserved.
ALTER TABLE generation_runs ALTER COLUMN created_at SET DEFAULT clock_timestamp();
