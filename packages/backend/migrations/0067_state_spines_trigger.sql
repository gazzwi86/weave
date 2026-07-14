-- BE-V1-TASK-021 (FR-065): `state_spines.trigger` + `prompt_context` --
-- lets a prompt-triggered dark-factory run be told apart from a normal
-- request-triggered one (AC-1), and carries the prompt text through to
-- the PLAN brief-synthesis step (AC-7) without a second run-state table.
ALTER TABLE state_spines ADD COLUMN trigger TEXT NOT NULL DEFAULT 'request'
    CHECK (trigger IN ('request', 'prompt'));
ALTER TABLE state_spines ADD COLUMN prompt_context JSONB;
