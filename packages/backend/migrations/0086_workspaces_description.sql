-- SE1 (docs/design/remediation-2-api-gaps.md): Settings -> General's
-- Workspace description field has no backing column -- add one. Nullable,
-- no default copy (workspaces created before this migration simply have no
-- description until an admin sets one via `PUT /api/tenants/{tenant_id}/
-- workspaces/{workspace_id}`).
ALTER TABLE workspaces ADD COLUMN description TEXT;
