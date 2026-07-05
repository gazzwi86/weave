-- PLAT-TASK-009: PLAT-AUDIT-1 hash-chained, ed25519-signed, append-only
-- audit trail. Replaces the 0001 placeholder `audit_events` table (no
-- production data exists yet -- dark-factory build, pre-v1) with the
-- canonical `audit_entries` shape every route now writes through
-- `HashChainAuditEmitter`.

DROP TABLE IF EXISTS audit_events;

CREATE TABLE IF NOT EXISTS audit_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    seq BIGINT NOT NULL CHECK (seq > 0),
    -- Canonical ISO-8601 string used verbatim in the hashed payload --
    -- stored as TEXT (not TIMESTAMPTZ) so `verify_chain` re-fetching a row
    -- reproduces the exact bytes hashed at emission time (ADR-010).
    ts TEXT NOT NULL,
    actor_principal_iri TEXT NOT NULL,
    engine TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_iri TEXT NOT NULL,
    diff_summary JSONB,
    prev_hash TEXT NOT NULL CHECK (char_length(prev_hash) = 64),
    hash TEXT NOT NULL CHECK (char_length(hash) = 64),
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, seq)
);

ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_entries
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Belt-and-braces (billing_usage precedent): weave_app can never UPDATE or
-- DELETE by grant alone. The trigger below is the real enforcement, since
-- it also binds the superuser migration role that GRANT/REVOKE can't
-- constrain (triggers fire regardless of role -- unlike RLS/GRANTs, which a
-- table owner/superuser bypasses).
GRANT SELECT, INSERT ON audit_entries TO weave_app;

CREATE OR REPLACE FUNCTION audit_entries_append_only() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entries_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION audit_entries_append_only();
