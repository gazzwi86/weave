-- CE-V1-TASK-008 (CE-EVENT-1 beta, ADR-008): append-only, tenant-scoped
-- change-feed. `seq` is a single GLOBAL bigserial (not a per-tenant
-- MAX(seq)+1 read -- two concurrent commits would collide/deadlock on
-- that), read filtered per tenant via the `graph_change_events_tenant_seq_idx`
-- index below -- a global monotonic sequence is trivially per-tenant
-- monotonic too (task brief implementation hint).

CREATE TABLE IF NOT EXISTS graph_change_events (
    seq BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    change_type TEXT NOT NULL
        CHECK (change_type IN ('added', 'updated', 'deleted', 'constraint-violated')),
    entity_iri TEXT NOT NULL,
    -- Real CE-VERSION-1 IRI on publish events; NULL on draft commits (this
    -- task's CE-WRITE-1 hook only ever mints drafts -- see events.py
    -- module docstring) and on constraint-violated events.
    version_iri TEXT,
    last_published_version TEXT,
    actor TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS graph_change_events_tenant_seq_idx
    ON graph_change_events (tenant_id, seq);

CREATE INDEX IF NOT EXISTS graph_change_events_tenant_ts_idx
    ON graph_change_events (tenant_id, ts);

ALTER TABLE graph_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_change_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON graph_change_events
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Belt-and-braces (audit_entries/graph_versions precedent): weave_app can
-- never UPDATE or DELETE by grant alone; the trigger is the real
-- enforcement since it also binds roles GRANT/REVOKE can't constrain.
GRANT SELECT, INSERT ON graph_change_events TO weave_app;
-- BIGSERIAL's implicit sequence isn't covered by the table GRANT above --
-- weave_app needs USAGE to nextval() it on INSERT (audit_entries/
-- graph_versions use gen_random_uuid() PKs instead, so this grant has no
-- precedent to copy; it's the standard pairing for a SERIAL PK owned by a
-- different role than the inserting role).
GRANT USAGE, SELECT ON SEQUENCE graph_change_events_seq_seq TO weave_app;

CREATE OR REPLACE FUNCTION graph_change_events_append_only() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'graph_change_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER graph_change_events_no_update_delete
    BEFORE UPDATE OR DELETE ON graph_change_events
    FOR EACH ROW EXECUTE FUNCTION graph_change_events_append_only();
