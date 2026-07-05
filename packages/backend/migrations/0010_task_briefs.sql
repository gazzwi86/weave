-- BE-TASK-002 (build-engine, EPIC-005): Task-Brief Schema & Architect Agent
-- Generation (FR-018). Persists the Architect agent's validated `TaskBrief`
-- document, keyed by the deterministic `task_id` (UUID5 of
-- `project_iri + task_description`, see `briefs/store.py`).
--
-- `task_id` is the primary key (not a surrogate UUID) -- same pattern as
-- `0009_projects.sql`'s `project_iri` PK: the id is already
-- globally-unique-by-construction, so a second row for the same id is
-- always a retry, not a distinct entity (AC-1's idempotent-INSERT
-- requirement). `tenant_id` is TEXT (not UUID) to match every other
-- tenancy-scoped table in this schema (`projects`, `notifications`,
-- `audit_entries`) -- Cognito's `tenant_id` claim is a string, not
-- necessarily a UUID literal.
CREATE TABLE IF NOT EXISTS task_briefs (
    task_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    project_iri TEXT NOT NULL,
    brief_iri TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE task_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_briefs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task_briefs
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON task_briefs TO weave_app;
