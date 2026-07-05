-- BE-TASK-001 (build-engine, EPIC-002): M1 Project Bootstrap Stub.
--
-- Minimal project record: a deterministic `project_iri`, the CE version it
-- pinned at creation time (CE-VERSION-1), and an optional source-control
-- provider/token-reference pair (config only -- the token *value* lives in
-- AWS Secrets Manager, never in this table; see TASK-001 brief's "M1
-- producer for TASK-010" note).
--
-- RLS follows the 0001_tenancy.sql precedent exactly (ADR-003): FORCE ROW
-- LEVEL SECURITY so even the table owner is bound by the policy, since the
-- app connects as the non-superuser `weave_app` role (created in 0001).
CREATE TABLE IF NOT EXISTS projects (
    project_iri TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    slug TEXT NOT NULL CHECK (slug <> ''),
    name TEXT NOT NULL CHECK (name <> ''),
    description TEXT,
    pinned_graph_version_iri TEXT NOT NULL,
    source_control_provider TEXT CHECK (source_control_provider IN ('github', 'gitlab')),
    source_control_token_secret_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug)
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO weave_app;
