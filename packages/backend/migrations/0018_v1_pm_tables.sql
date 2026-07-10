-- TASK-010 (build-engine v1, EPIC-002): four new PM tables + generation_runs
-- columns. Structure (PKs/CHECKs/UNIQUEs/index) copied verbatim from
-- v1-delta.md Section 4, EXCEPT `tenant_id`/`project_id` are TEXT, not UUID,
-- and `project_id` is renamed `project_iri` -- see ADR-011 for why the spec's
-- literal UUID types are not implementable against this schema (Cognito
-- `tenant_id` is a string; `projects.project_iri TEXT` is the real PK, there
-- is no `project_id` surrogate; the RLS idiom below already assumes TEXT).
--
-- projects.description / projects.archived_at ALTERs from the same spec
-- block are OUT of scope here: `description` already exists (0009), and the
-- brief names only "four tables + two generation_runs columns".

CREATE TABLE project_contributors (
    tenant_id      TEXT NOT NULL CHECK (tenant_id <> ''),
    project_iri    TEXT NOT NULL,
    principal_iri  TEXT NOT NULL,          -- PLAT-IDENTITY-1 human principal
    role           TEXT NOT NULL CHECK (role IN ('admin','editor')),
    added_by       TEXT NOT NULL,
    added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, project_iri, principal_iri)
);

ALTER TABLE project_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contributors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON project_contributors
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON project_contributors TO weave_app;

CREATE TABLE external_bindings (
    tenant_id      TEXT NOT NULL CHECK (tenant_id <> ''),
    project_iri    TEXT NOT NULL,
    binding_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    system         TEXT NOT NULL CHECK (system IN ('confluence','jira','servicenow')),
    connector_ref  TEXT NOT NULL,          -- PLAT-CONNECTOR-1 connector INSTANCE handle
    space_ref      TEXT NOT NULL,          -- space / board / project key in the target system
    created_by     TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, binding_id),
    UNIQUE (tenant_id, project_iri, system, space_ref)
);

ALTER TABLE external_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON external_bindings
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON external_bindings TO weave_app;

CREATE TABLE cost_events (                  -- ADR-008: event table, not a running total
    tenant_id          TEXT NOT NULL CHECK (tenant_id <> ''),
    cost_event_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    project_iri        TEXT NOT NULL,
    task_id            TEXT,                -- NULL for non-task work (drafting, replans)
    run_id             UUID,                -- NULL for non-run work
    agent_role         TEXT NOT NULL,
    model              TEXT NOT NULL,       -- confirmed Claude IDs only
    tokens_in          BIGINT NOT NULL,
    tokens_out         BIGINT NOT NULL,
    cost_estimate_usd  NUMERIC(12,6) NOT NULL,  -- PLAT-SETTINGS-1 rate card, never hardcoded
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, cost_event_id)
);
CREATE INDEX idx_cost_events_rollup ON cost_events (tenant_id, project_iri, task_id);

ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cost_events
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT ON cost_events TO weave_app;  -- events are append-only, no UPDATE/DELETE

CREATE TABLE project_prompts (               -- FR-065: prompt text + who + resulting run
    tenant_id      TEXT NOT NULL CHECK (tenant_id <> ''),
    prompt_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    project_iri    TEXT NOT NULL,
    principal_iri  TEXT NOT NULL,
    prompt_text    TEXT NOT NULL,
    run_id         UUID,                    -- FK generation_runs; set on enqueue
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, prompt_id)
);

ALTER TABLE project_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_prompts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON project_prompts
    USING (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE ON project_prompts TO weave_app;  -- UPDATE for set_run_id

-- generation_runs: prompt-triggered runs (FR-065) + console log pointer
ALTER TABLE generation_runs ADD COLUMN trigger TEXT NOT NULL DEFAULT 'request'
    CHECK (trigger IN ('request','prompt'));
ALTER TABLE generation_runs ADD COLUMN log_location_ref TEXT;  -- S3 URI, Console tab source
