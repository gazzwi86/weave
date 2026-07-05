-- GE-TASK-001: Explorer-owned Aurora layout-positions schema (server-side
-- drag-position persistence, FR-008 / E1-S5). Unblocks TASK-004.
--
-- Column types and the RLS policy expression below are AC-4's exact,
-- explicit spec (task brief TASK-001) -- reproduced verbatim, not
-- paraphrased, because AC-4 quotes the DDL literally.
--
-- Divergence from the platform-tenancy convention (0001_tenancy.sql,
-- flagged for the Architect at TASK-001 sign-off): every other migration in
-- this repo scopes RLS on `tenant_id TEXT` via
-- `current_setting('app.tenant_id', true)` (missing_ok=true, no cast). AC-4
-- instead specifies `tenant_id UUID NOT NULL` and
-- `current_setting('app.current_tenant_id')::uuid` (missing_ok defaults to
-- false -- a connection that never calls SET LOCAL gets a hard error here,
-- not a silent all-rows-denied). This migration follows AC-4 exactly as the
-- task brief's authoritative spec; TASK-004's FastAPI middleware must call
-- `SET LOCAL app.current_tenant_id = '{tenant_id}'` (a UUID string) inside
-- every `async with session.begin()` block on this table -- `SET LOCAL` is
-- connection-scoped and SQLAlchemy async pools reuse connections, so it
-- cannot be set once at startup.
--
-- FORCE ROW LEVEL SECURITY and the weave_app GRANT follow the repo-wide
-- pattern (see 0001_tenancy.sql's comment on why FORCE matters for a
-- non-superuser table owner); AC-4 does not mention either, but neither
-- weakens what AC-4 requires.
CREATE TABLE IF NOT EXISTS explorer_layout_positions (
    tenant_id     UUID              NOT NULL,
    workspace_id  UUID              NOT NULL,
    graph_id      TEXT              NOT NULL,
    node_iri      TEXT              NOT NULL,
    position_x    DOUBLE PRECISION  NOT NULL,
    position_y    DOUBLE PRECISION  NOT NULL,
    locked        BOOLEAN           NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, workspace_id, graph_id, node_iri)
);

ALTER TABLE explorer_layout_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE explorer_layout_positions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON explorer_layout_positions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON explorer_layout_positions TO weave_app;
