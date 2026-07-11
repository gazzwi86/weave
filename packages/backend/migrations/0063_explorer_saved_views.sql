-- TASK-025: Explorer Persistence Service -- explorer_saved_views (FR-023,
-- FR-028, FR-030). Normative DDL is m2-delta-explorer.md §2; ADR-025
-- documents one deliberate divergence: the spec's literal `tenant_id UUID`
-- + `::uuid` RLS cast is the exact pattern 0014_fix_layout_tenant_text.sql
-- already proved broken for this codebase's real (TEXT slug) tenant ids --
-- m2-delta-explorer.md §2's own header says these tables use "the same RLS
-- pattern as explorer_layout_positions", whose current (post-0014) form is
-- TEXT + missing_ok=true. This migration conforms to that prose, not the
-- stale UUID code block.
CREATE TABLE explorer_saved_views (
    tenant_id     TEXT        NOT NULL,
    view_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    created_by    TEXT        NOT NULL,  -- principal IRI (ADR-019)
    definition    JSONB       NOT NULL,  -- filters, overlays, domain focus, viewport
    pinned        BOOLEAN     NOT NULL DEFAULT FALSE,  -- featured views (FR-030)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, view_id),
    UNIQUE (tenant_id, name)   -- FR-028 collision -> overwrite/rename prompt
);

ALTER TABLE explorer_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE explorer_saved_views FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON explorer_saved_views
    USING (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON explorer_saved_views TO weave_app;
