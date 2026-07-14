-- TASK-009 (build-engine EPIC-008/EPIC-009) FR-034/AC-5: release-plan
-- artefact fields. Design Decisions ("Release plan = repo artefact, not DB
-- entity") puts approvers + target date on the `projects` record; rollout
-- sequence + feature-flag rollback path are per-deploy (pseudocode's
-- `run.deploy_sequence`/`run.feature_flags`), so those go on
-- `generation_runs` instead -- see ADR-020 for the full reconciliation of
-- the pseudocode's `run.target_date` vs the Design Decisions table's
-- "project record" placement (Design Decisions wins as authoritative).
-- All four columns nullable: population is a separate, not-yet-specced
-- write path (ADR-020) -- the renderer treats an unset value as "TBD",
-- never fabricates a plan section.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS signoff_roles JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE generation_runs ADD COLUMN IF NOT EXISTS deploy_sequence JSONB;
ALTER TABLE generation_runs ADD COLUMN IF NOT EXISTS feature_flags JSONB;
