-- ONB-TASK-001 (onboarding engine, EPIC-001): the six onboarding state
-- tables (data-model.md §Relational Schema, ADR-003). Per-(tenant, user)
-- progress state -- path, tour resume points, dismissals, exercise
-- completions, activations, and the transactional outbox that drains them
-- to PLAT-NOTIFY-1. No analytics tables (EPIC-008 deferred out of M1).
--
-- tenant_id/user_id are TEXT, not the tech-spec ERD's `uuid` -- every other
-- tenancy-scoped table in this schema already uses TEXT (Cognito's
-- `tenant_id` claim is a string; see 0013_gate_results.sql's identical
-- precedent), and `user_id` stores the `principal_iri` URN (e.g.
-- `urn:weave:principal:user:<sub>`), mirroring `recipient_iri` in
-- 0003_notifications.sql.

CREATE TABLE IF NOT EXISTS onboarding_state (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    role_path TEXT NOT NULL DEFAULT 'business'
        CHECK (role_path IN ('business', 'technical', 'compliance', 'admin')),
    path_variant TEXT NOT NULL DEFAULT 'default'
        CHECK (path_variant IN ('default', 'read_only')),
    path_chosen_manually BOOLEAN NOT NULL DEFAULT false,
    -- Loose reference to the platform `workspaces` table (ADR-002: CE owns
    -- the graph substance, onboarding only stores the id) -- no FK, same
    -- pattern as settings.scope_iri. Nullable until first sandbox access
    -- (TASK-004 scope; this task only creates the column).
    sandbox_workspace_id UUID,
    sandbox_batch_semver TEXT,
    sandbox_forked_at TIMESTAMPTZ,
    checklist_dismissed_at TIMESTAMPTZ,
    checklist_completed_at TIMESTAMPTZ,
    whats_new_seen_at TIMESTAMPTZ,
    -- Activation poller bookkeeping (TASK-011 scope; this task only creates
    -- the columns).
    poll_cursor_at TIMESTAMPTZ,
    poll_cursor_version_iri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

-- Activation poller's demo-active-user scan (data-model.md §Index strategy):
-- selects users who have a sandbox but haven't yet hit a given milestone,
-- via an anti-join against `activation`. TASK-011 scope to use; this task
-- only creates the index.
CREATE INDEX IF NOT EXISTS onboarding_state_sandbox_active_idx
    ON onboarding_state (tenant_id) WHERE sandbox_workspace_id IS NOT NULL;

ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON onboarding_state
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS tour_progress (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    tour_id TEXT NOT NULL CHECK (tour_id <> ''),
    last_completed_step INTEGER NOT NULL,
    completed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, tour_id)
);

ALTER TABLE tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tour_progress
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS dismissal (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    kind TEXT NOT NULL CHECK (kind IN ('beacon', 'welcome_modal')),
    ref_id TEXT NOT NULL CHECK (ref_id <> ''),
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, kind, ref_id)
);

-- "Show all hints" (DELETE /api/onboarding/dismissals/beacon) bulk-deletes
-- every `beacon` row for a user -- the composite PK's leading
-- (tenant_id, user_id) columns already serve that scan; no extra index
-- needed (data-model.md §Index strategy names only the PK for this table).

ALTER TABLE dismissal ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dismissal
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS exercise_completion (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    exercise_id TEXT NOT NULL CHECK (exercise_id <> ''),
    verified_signal TEXT NOT NULL
        CHECK (verified_signal IN ('ask', 'write_commit', 'canvas_state', 'nav_signal')),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, exercise_id)
);

ALTER TABLE exercise_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_completion FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON exercise_completion
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS activation (
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    milestone_id TEXT NOT NULL CHECK (milestone_id <> ''),
    -- AC-001-06 / ADR-003: this PK is the exactly-once guarantee -- the
    -- milestone recorder (TASK-011) writes via
    -- `INSERT ... ON CONFLICT DO NOTHING`, never deleted on reset.
    source TEXT NOT NULL CHECK (source IN ('poll', 'event', 'manual')),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, milestone_id)
);

-- Poller's demo-active-user scan (data-model.md §Index strategy): users who
-- have a sandbox but haven't hit a given milestone yet is an anti-join
-- against this table; M1 cohort sizes make the composite PK sufficient, no
-- extra index required here (ponytail: denormalise only if the poller scan
-- is measurably slow at larger cohorts).

ALTER TABLE activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activation
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS outbox (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
    user_id TEXT NOT NULL CHECK (user_id <> ''),
    event_type TEXT NOT NULL CHECK (event_type <> ''),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at TIMESTAMPTZ
);

-- Dispatcher's undispatched-row drain scan (data-model.md §Index strategy;
-- TASK-011 scope to use -- this task only creates the table + index).
CREATE INDEX IF NOT EXISTS outbox_undispatched_idx
    ON outbox (dispatched_at) WHERE dispatched_at IS NULL;

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outbox
    USING (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_state, tour_progress, dismissal,
    exercise_completion, activation, outbox TO weave_app;
