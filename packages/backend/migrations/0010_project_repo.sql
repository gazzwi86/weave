-- BE-TASK-010 (build-engine, EPIC-011): repo bootstrap handle columns.
--
-- Once `ensure_project_repo` creates (or reuses) the project's external
-- GitHub/GitLab repo, the handle is persisted here so TASK-008's
-- `git_client.commit_workspace(project.repo, ...)` needs no re-resolution
-- (task brief's implementation hint). All four columns are nullable --
-- unset until a run actually bootstraps the repo (AC-3's idempotency check
-- is "is `repo_provider` set", not a separate boolean flag).
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS repo_provider TEXT CHECK (repo_provider IN ('github', 'gitlab')),
    ADD COLUMN IF NOT EXISTS repo_url TEXT,
    ADD COLUMN IF NOT EXISTS repo_default_branch TEXT,
    ADD COLUMN IF NOT EXISTS repo_id TEXT;
