import { useEffect, useState } from "react";

interface WorkspaceListItem {
  id: string;
  display_name: string;
  description?: string | null;
}

/** The two loads Settings -> General needs before it can render: the
 * workspace list and which one is active. Split out of the hook's effect to
 * keep both under the 50-line function budget. */
async function fetchWorkspacesAndActive(
  signal: AbortSignal
): Promise<{ list: WorkspaceListItem[]; activeId: string | null }> {
  const [list, active] = await Promise.all([
    fetch("/api/tenancy/workspaces", { signal }).then((res) => {
      if (!res.ok) throw new Error("load_failed");
      return res.json() as Promise<WorkspaceListItem[]>;
    }),
    fetch("/api/tenancy/workspaces/active", { signal }).then((res) => {
      if (!res.ok) throw new Error("load_failed");
      return res.json() as Promise<{ workspace_id: string | null }>;
    }),
  ]);
  return { list, activeId: active.workspace_id };
}

export interface GeneralSettingsState {
  /** null while the first load is in flight. */
  workspaceName: string | null;
  /** null while loading, or when the active workspace has no description set. */
  description: string | null;
  loadError: boolean;
  /** SE1: true when the last `saveDescription` call failed. */
  saveError: boolean;
  /** PUT /api/tenancy/workspaces/{id} -- updates local state on success. */
  saveDescription: (next: string) => Promise<void>;
}

/** Drives Settings -> General's read-only Name field and editable
 * Description field: joins the workspace list with the active-workspace id
 * (same fallback the backend itself documents -- `GET /workspaces/active`
 * returns null until the caller has ever switched, so the first listed
 * workspace stands in). */
export function useGeneralSettings(): GeneralSettingsState {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkspacesAndActive(controller.signal)
      .then(({ list, activeId: nextActiveId }) => {
        if (controller.signal.aborted) return;
        setWorkspaces(list);
        setActiveId(nextActiveId);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const activeWorkspace = workspaces === null ? null : workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const workspaceName = activeWorkspace?.display_name ?? null;
  const description = activeWorkspace?.description ?? null;

  async function saveDescription(next: string): Promise<void> {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/tenancy/workspaces/${activeWorkspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: next }),
      });
      if (!res.ok) throw new Error("save_failed");
      setSaveError(false);
      setWorkspaces(
        (prev) => prev?.map((w) => (w.id === activeWorkspace.id ? { ...w, description: next } : w)) ?? prev
      );
    } catch {
      setSaveError(true);
    }
  }

  return { workspaceName, description, loadError, saveError, saveDescription };
}
