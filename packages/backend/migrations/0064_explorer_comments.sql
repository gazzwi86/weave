-- TASK-025: Explorer Persistence Service -- explorer_comments (FR-024).
-- Same tenant_id TEXT / RLS-key divergence rationale as
-- 0063_explorer_saved_views.sql (see ADR-025).
CREATE TABLE explorer_comments (
    tenant_id     TEXT        NOT NULL,
    comment_id    UUID        NOT NULL DEFAULT gen_random_uuid(),
    target_kind   TEXT        NOT NULL CHECK (target_kind IN ('node', 'view')),
    target_ref    TEXT        NOT NULL,  -- node IRI or view_id
    author        TEXT        NOT NULL,  -- principal IRI (ADR-019)
    body          TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, comment_id)
);

CREATE INDEX idx_comments_tgt ON explorer_comments (tenant_id, target_kind, target_ref);

ALTER TABLE explorer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE explorer_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON explorer_comments
    USING (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON explorer_comments TO weave_app;
