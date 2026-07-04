-- PLAT-TASK-008: billing usage/metering (PLAT-BILLING-1). Budget caps
-- themselves are plain PLAT-SETTINGS-1 settings rows (key
-- `ai.budget.per_period_usd`) -- no separate caps table needed, the
-- existing `settings` table + cascade already covers cap storage.

CREATE TABLE IF NOT EXISTS billing_usage (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    workspace_id TEXT NOT NULL CHECK (workspace_id <> ''),
    -- AC-3 (token_usage) / AC-4 (run) -- one table, two record shapes.
    record_type TEXT NOT NULL CHECK (record_type IN ('token_usage', 'run')),
    principal_iri TEXT,
    model_tier TEXT,
    input_tokens BIGINT,
    output_tokens BIGINT,
    run_id TEXT,
    status TEXT,
    cost_usd NUMERIC(12, 4) NOT NULL,
    period TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage-summary route's exact query shape: tenant (+ optional workspace) +
-- period, aggregated.
CREATE INDEX IF NOT EXISTS billing_usage_period_idx
    ON billing_usage (tenant_id, workspace_id, period);

ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_usage
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT ON billing_usage TO weave_app;
