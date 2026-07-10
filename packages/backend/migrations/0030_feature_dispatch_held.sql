-- BE-TASK-006 (build-engine, EPIC-011) AC-7: env-verification dispatch gate.
--
-- Tri-state, nullable: NULL = rich scaffold not yet run on this project;
-- TRUE = scaffold complete, mandatory env-verification HITL gate fired,
-- feature-task dispatch held; FALSE = a non-self human approved the gate,
-- dispatch released. `run_dark_factory`'s step-0 scaffold call is the only
-- writer of TRUE, `approve_env_verification` the only writer of FALSE --
-- "one boolean, not a new FSM state" per the task brief's implementation hint.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS feature_dispatch_held BOOLEAN;
