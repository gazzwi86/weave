"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useWorkspaces, type Workspace } from "./use-workspaces";

function WorkspaceList({ workspaces }: { workspaces: Workspace[] }) {
  if (workspaces.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No workspaces yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {workspaces.map((ws) => (
        <li key={ws.id} data-testid="workspace-row" className="flex flex-col">
          <span className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {ws.display_name}
          </span>
          <span className="text-[length:var(--text-small)] text-[var(--color-text-muted)]">
            {ws.slug} · created {new Date(ws.created_at).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CreateWorkspaceForm({
  creating,
  createError,
  onCreate,
}: {
  creating: boolean;
  createError: string | null;
  onCreate: (slug: string, displayName: string) => Promise<boolean>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate(slug, displayName)) {
      setDisplayName("");
      setSlug("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
      <Input
        aria-label="Display name"
        placeholder="display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Input
        aria-label="Slug"
        placeholder="slug (lowercase, digits, hyphens)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      {createError && (
        <p data-testid="create-error" className="text-[var(--color-text-muted)]">
          {createError}
        </p>
      )}
      <Button type="submit" disabled={!displayName || !slug || creating}>
        {creating ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}

/** Admin-only provisioning panel (IA §5): lists the tenant's workspaces and
 * creates new ones via the tenant-scoped `/api/tenancy/workspaces` proxy.
 * The backend enforces the real admin requirement + slug uniqueness. */
export function WorkspacesPanel() {
  const { workspaces, loadError, creating, createError, createWorkspace } = useWorkspaces();

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Workspaces
        </p>
        <CardContent className="flex flex-col gap-[var(--space-2)]">
          {loadError && (
            <p data-testid="workspaces-error" className="text-[var(--color-text-muted)]">
              Unable to load workspaces from the backend.
            </p>
          )}
          {!loadError && workspaces === null && (
            <p className="text-[var(--color-text-muted)]">Loading workspaces…</p>
          )}
          {workspaces !== null && <WorkspaceList workspaces={workspaces} />}
        </CardContent>
      </Card>

      <Card>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Create workspace
        </p>
        <CardContent>
          <CreateWorkspaceForm creating={creating} createError={createError} onCreate={createWorkspace} />
        </CardContent>
      </Card>
    </div>
  );
}
