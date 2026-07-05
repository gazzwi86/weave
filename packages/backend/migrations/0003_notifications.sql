-- PLAT-TASK-007: notification store, per-user preferences, and Slack
-- connector health (PLAT-NOTIFY-1). M1 scope note (2026-07-02): Slack
-- delivery itself is a stub until PLAT-CONNECTOR-1 lands at v1.0 -- this
-- schema is the full, permanent shape either way (delivered_channels/
-- connector_health don't change when the real connector arrives).

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    recipient_iri TEXT NOT NULL CHECK (recipient_iri <> ''),
    -- PLAT-NOTIFY-1: open/registerable taxonomy -- never a CHECK/enum
    -- constraint here, each engine mints its own event_type strings.
    event_type TEXT NOT NULL CHECK (event_type <> ''),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivered_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exact query shape of the notification-centre page (brief hint):
-- tenant + recipient + unread filter, newest first.
CREATE INDEX IF NOT EXISTS notifications_recipient_idx
    ON notifications (tenant_id, recipient_iri, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    recipient_iri TEXT NOT NULL CHECK (recipient_iri <> ''),
    event_type TEXT NOT NULL CHECK (event_type <> ''),
    channels TEXT[] NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Upsert target for PUT /api/notifications/preferences.
    UNIQUE (tenant_id, recipient_iri, event_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_preferences
    USING (tenant_id = current_setting('app.tenant_id', true));

-- AC-4: per-tenant Slack connector health (error_count), same table shape
-- regardless of stub vs real PLAT-CONNECTOR-1 -- only the write frequency
-- changes when the real connector replaces the M1 stub.
CREATE TABLE IF NOT EXISTS connector_health (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    connector TEXT NOT NULL CHECK (connector <> ''),
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, connector)
);

ALTER TABLE connector_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_health FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON connector_health
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON notifications, notification_preferences, connector_health
    TO weave_app;
