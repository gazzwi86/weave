-- BE-TASK-009 (build-engine, EPIC-008/EPIC-009): three write-back columns
-- on `projects` -- `demo_output_location_ref` (the published S3 bundle's
-- durable URI, AC-1), `write_back_complete` (AC-7's CE-WRITE-1 commit
-- flag, defaults false so a project created before any deploy reads as
-- "not written back" without a backfill), `write_back_artefact_iri` (the
-- resolvable BE-ARTEFACT-1 IRI once committed). No RLS change -- `projects`
-- already carries a `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy
-- from 0009_projects.sql; a plain `ALTER TABLE ADD COLUMN` inherits it.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS demo_output_location_ref TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS write_back_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS write_back_artefact_iri TEXT;
