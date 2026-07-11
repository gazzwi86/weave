-- TASK-024 (build-engine v1, EPIC-001): `projects` gains `repo_name_hint`
-- -- the request-form's kebab-case target repo name, threaded through
-- sign-off auto-create so BE-TASK-010's repo bootstrap names the new
-- external repo from it instead of always slugifying the project's
-- display `name` (design decision B9: never reference an existing repo).
ALTER TABLE projects ADD COLUMN repo_name_hint TEXT;
