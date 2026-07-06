-- FIX 2 (P1, poc-usability): explorer_layout_positions.tenant_id was UUID
-- (0008_explorer_layout_positions.sql, AC-4's exact spec), with RLS cast
-- `current_setting('app.current_tenant_id')::uuid`. Every real tenant_id in
-- this codebase is actually a free-text slug (e.g. `acme-corp` --
-- 0001_tenancy.sql's `workspaces.tenant_id TEXT`), which never casts to
-- ::uuid -- every save/load through routers/layout.py 500s inside Postgres,
-- surfaced to the API as a 503 (`_layout_connection`'s PostgresError
-- catch-all). Layout persistence has never worked for a real tenant.
--
-- Keeps the separate `app.current_tenant_id` RLS key (ADR-004 decision 3,
-- deliberately stricter/distinct from the platform's `app.tenant_id`) --
-- only the column type and the cast are wrong, not the key name. Uses
-- `missing_ok=true` on `current_setting` to match every other TEXT-tenant
-- table in this schema (0009_projects.sql, 0010-0012).
DROP POLICY IF EXISTS tenant_isolation ON explorer_layout_positions;

ALTER TABLE explorer_layout_positions
    ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;

CREATE POLICY tenant_isolation ON explorer_layout_positions
    USING (tenant_id = current_setting('app.current_tenant_id', true));
