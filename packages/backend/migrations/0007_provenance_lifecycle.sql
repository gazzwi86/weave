-- CE-TASK-002: draft->published lifecycle on graph_versions (extends 0006),
-- and a durable outbox so PLAT-AUDIT-1 delivery never blocks or rolls back
-- a graph commit (ADR-002).

ALTER TABLE graph_versions ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));
ALTER TABLE graph_versions ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE graph_versions ADD COLUMN actor_iri TEXT NOT NULL DEFAULT '';

-- 0006 only granted SELECT/INSERT (append-only); publish is the one
-- legitimate UPDATE, enforced by the relaxed trigger below.
GRANT UPDATE ON graph_versions TO weave_app;

-- Relax 0006's append-only trigger to allow exactly the publish transition
-- (draft -> published, setting published_at) -- every other column, and a
-- second transition away from 'published', stays forbidden.
CREATE OR REPLACE FUNCTION graph_versions_append_only() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'graph_versions is append-only';
    END IF;
    IF OLD.status = 'published'
        OR OLD.version_iri <> NEW.version_iri
        OR OLD.semver <> NEW.semver
        OR OLD.tenant_id <> NEW.tenant_id
        OR OLD.workspace_id <> NEW.workspace_id
        OR OLD.created_at <> NEW.created_at
        OR OLD.actor_iri <> NEW.actor_iri
        OR NEW.status <> 'published' THEN
        RAISE EXCEPTION
            'graph_versions is append-only (draft -> published is the only permitted update)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS audit_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    event_type TEXT NOT NULL CHECK (event_type <> ''),
    actor_iri TEXT NOT NULL,
    subject_iri TEXT NOT NULL,
    engine TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS audit_outbox_pending_idx
    ON audit_outbox (tenant_id, created_at) WHERE delivered_at IS NULL;

ALTER TABLE audit_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_outbox
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON audit_outbox TO weave_app;
