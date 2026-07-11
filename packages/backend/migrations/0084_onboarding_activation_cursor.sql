-- ONB-TASK-011 (onboarding engine, EPIC-005): since-version poll cursor
-- for the activation detector (ADR-004). One column, keyed by the existing
-- (tenant_id, user_id) primary key on onboarding_state -- not a new table:
-- the cursor is per-user, per-workspace state, same cardinality as the
-- spine row it lives on. NULL until the poller's first completed cycle for
-- that user (never checked a version yet).
ALTER TABLE onboarding_state ADD COLUMN activation_poll_cursor TEXT;
