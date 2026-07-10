-- PLAT-V1-TASK-010 AC-2: one-time backfill of the fixed default dashboard
-- tiles for every tenant that already existed before 0045_widget_state.sql
-- shipped (new tenants get seeded going forward by
-- create_workspace_route -> seed_tenant_default_tiles, dashboard/store.py).
--
-- Runs as the migration role, which bypasses RLS (db/migrate.py) -- the only
-- way to insert across every tenant in one statement. `tenant_id` here is
-- read from `workspaces`, this codebase's only source of "which tenants
-- exist" (there is no dedicated `tenants` table, see 0002_identity.sql).
--
-- The six literal tiles below MUST stay byte-for-byte in sync with
-- DEFAULT_TILES in src/weave_backend/dashboard/default_tiles.py -- this file
-- is frozen migration history and can't import that module.

INSERT INTO widget_instances (tenant_id, scope, owner_principal_iri, spec, "position")
SELECT DISTINCT w.tenant_id, 'tenant_default', NULL, tile.spec, tile.position
FROM workspaces w
CROSS JOIN (
    VALUES
        (0, '{
            "component_type": "kpi_card",
            "title": "Entities in model",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "entity_count_by_kind", "aggregate": "sum"},
            "column_span": 3
        }'::jsonb),
        (1, '{
            "component_type": "bar_chart",
            "title": "Entities by kind",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "entity_count_by_kind"},
            "column_span": 6
        }'::jsonb),
        (2, '{
            "component_type": "kpi_card",
            "title": "Latest published version",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "latest_version"},
            "column_span": 3
        }'::jsonb),
        (3, '{
            "component_type": "kpi_card",
            "title": "Draft vs published changes",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "draft_published_delta"},
            "column_span": 3
        }'::jsonb),
        (4, '{
            "component_type": "bar_chart",
            "title": "SHACL errors by severity",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "shacl_errors_by_severity"},
            "column_span": 6
        }'::jsonb),
        (5, '{
            "component_type": "kpi_card",
            "title": "OWL inconsistencies",
            "data_source_contracts": ["CE-METRICS-1"],
            "bindings": {"field": "owl_inconsistencies"},
            "column_span": 3
        }'::jsonb)
) AS tile(position, spec)
ON CONFLICT (tenant_id, scope, COALESCE(owner_principal_iri, ''), "position")
DO NOTHING;
