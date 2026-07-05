-- CE-TASK-001: records each committed version of a workspace's working
-- graph. `versioning.mint_version` reads the latest row per
-- (tenant_id, workspace_id) under a `pg_advisory_xact_lock` before
-- inserting the next one, so two concurrent applies never mint the same
-- semver.

CREATE TABLE IF NOT EXISTS graph_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    workspace_id TEXT NOT NULL CHECK (workspace_id <> ''),
    semver TEXT NOT NULL,
    version_iri TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, workspace_id, semver)
);

CREATE INDEX IF NOT EXISTS graph_versions_latest_idx
    ON graph_versions (tenant_id, workspace_id, created_at DESC);

ALTER TABLE graph_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON graph_versions
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT ON graph_versions TO weave_app;

-- Version history is append-only, same as audit_entries (0005).
CREATE OR REPLACE FUNCTION graph_versions_append_only() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'graph_versions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER graph_versions_no_update_delete
    BEFORE UPDATE OR DELETE ON graph_versions
    FOR EACH ROW EXECUTE FUNCTION graph_versions_append_only();
