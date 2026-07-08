"use client";

import { useEffect, useState } from "react";

interface WorkspaceEntry {
  id: string;
  slug: string;
  display_name: string;
}

/** IA §3: the workspace switcher living in the tenant-chip slot. Lists the
 * tenant's workspaces, shows the active one, and switches server-side
 * session state (`POST /api/workspaces/{id}/switch`) then reloads so every
 * workspace-scoped surface (graph, query, explorer) re-reads under the new
 * active workspace. Degrades to the plain tenant chip while loading or for
 * members who can't list workspaces. */
export function WorkspaceSwitcher({ tenantId }: { tenantId: string }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/tenancy/workspaces").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/tenancy/workspaces/active").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([list, active]: [WorkspaceEntry[], { workspace_id?: string | null }]) => {
        if (cancelled || !Array.isArray(list)) return;
        setWorkspaces(list);
        setActiveId(active.workspace_id ?? list[0]?.id ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSwitch(workspaceId: string) {
    setSwitching(true);
    const response = await fetch(
      `/api/tenancy/workspaces/${encodeURIComponent(workspaceId)}/switch`,
      { method: "POST" }
    ).catch(() => null);
    if (response?.ok) {
      // Active workspace is server-side session state -- a full reload is
      // the one honest way to re-scope every open surface.
      window.location.reload();
      return;
    }
    setSwitching(false);
  }

  if (workspaces.length === 0) {
    return (
      <span className="ml-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        {tenantId}
      </span>
    );
  }

  return (
    <select
      aria-label="Active workspace"
      disabled={switching}
      value={activeId}
      onChange={(e) => onSwitch(e.target.value)}
      className="ml-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]"
    >
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {tenantId} / {workspace.display_name}
        </option>
      ))}
    </select>
  );
}
