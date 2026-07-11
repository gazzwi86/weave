-- PLAT-V1-TASK-016: growth-trend history (E2-S13). CE-METRICS-1 is
-- point-in-time only; the platform samples it on each successful fetch so
-- the growth chart has a series to render. Same RLS/grant pattern as
-- migrations/0071_widget_state.sql -- tenant_id is a plain scoped TEXT,
-- no `tenants` FK (see migrations/0002_identity.sql).

CREATE TABLE IF NOT EXISTS metrics_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    day DATE NOT NULL,
    entity_count INTEGER NOT NULL,
    counts_by_kind JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, day)
);

CREATE INDEX IF NOT EXISTS metrics_daily_snapshots_tenant_day_idx
    ON metrics_daily_snapshots (tenant_id, day);

ALTER TABLE metrics_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON metrics_daily_snapshots
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON metrics_daily_snapshots TO weave_app;
