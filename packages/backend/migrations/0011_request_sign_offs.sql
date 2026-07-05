-- BE-TASK-004 (build-engine, EPIC-001): durable stakeholder sign-off records.
--
-- Unlike Request Studio's ephemeral Redis-backed request state (ADR-001), a
-- sign-off is a governance record -- same durability tier as `projects`
-- (0009_projects.sql). RLS follows the same FORCE ROW LEVEL SECURITY
-- precedent (ADR-003): the app connects as the non-superuser `weave_app`
-- role (created in 0001_tenancy.sql).
--
-- NOTE for merge: this is migration number 0011 by explicit coordinator
-- assignment (0010 already claimed by two sibling epics not yet merged) --
-- reconcile the numbering at merge time if a conflict has since landed.
CREATE TABLE IF NOT EXISTS request_sign_offs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id TEXT NOT NULL CHECK (request_id <> ''),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    stakeholder_iri TEXT NOT NULL CHECK (stakeholder_iri <> ''),
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
    rejection_reason TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id, stakeholder_iri)
);
ALTER TABLE request_sign_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_sign_offs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON request_sign_offs
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON request_sign_offs TO weave_app;
