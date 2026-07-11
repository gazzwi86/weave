-- TASK-012 (constitution-engine, EPIC-012): ingest pipeline spine tables.
--
-- `ingest_jobs` / `ingest_proposals` hold workflow state (upload -> extract
-- -> review -> accept/reject), not knowledge -- the graph itself is only
-- ever touched via CE-WRITE-1 (AC-001-08). RLS follows the 0009_projects.sql
-- precedent exactly (ADR-003): FORCE ROW LEVEL SECURITY so even the table
-- owner is bound, since the app connects as the non-superuser `weave_app`
-- role (created in 0001).
CREATE TABLE IF NOT EXISTS ingest_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    workspace_id TEXT NOT NULL CHECK (workspace_id <> ''),
    artefact_iri TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'extracting', 'awaiting-review', 'failed', 'done')),
    -- FR-044 raw context hold (source system, owner, date-of-truth, sensitivity,
    -- free-text) -- optional, persisted verbatim; annotated onto the ingest
    -- prov:Activity by the worker (AC-001-02), not read back structurally here.
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Minted by the worker at extraction time (start_ingest_activity); reused,
    -- not re-minted, at accept time so the one prov:Activity carries both the
    -- extraction context and the eventual approver (see operations/provenance.py).
    activity_iri TEXT,
    extractor_iri TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ingest_jobs
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON ingest_jobs TO weave_app;

CREATE TABLE IF NOT EXISTS ingest_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    job_id UUID NOT NULL REFERENCES ingest_jobs (id),
    -- CE-WRITE-1 `Op` list (schemas.operations.Op union, `model_dump()`'d) --
    -- accept replays this verbatim through the ADR-006 dispatch.
    ops JSONB NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    matched_iri TEXT,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ingest_proposals_job_id_idx ON ingest_proposals (job_id);
ALTER TABLE ingest_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ingest_proposals
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON ingest_proposals TO weave_app;
