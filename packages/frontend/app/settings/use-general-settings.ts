import { useEffect, useState } from "react";

interface WorkspaceListItem {
  id: string;
  display_name: string;
}

export interface GeneralSettingsState {
  /** null while the first load is in flight. */
  workspaceName: string | null;
  loadError: boolean;
}

/** Drives Settings -> General's read-only Name field: joins the workspace
 * list with the active-workspace id (same fallback the backend itself
 * documents -- `GET /workspaces/active` returns null until the caller has
 * ever switched, so the first listed workspace stands in). */
export function useGeneralSettings(): GeneralSettingsState {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/tenancy/workspaces", { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<WorkspaceListItem[]>;
      }),
      fetch("/api/tenancy/workspaces/active", { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<{ workspace_id: string | null }>;
      }),
    ])
      .then(([list, active]) => {
        if (controller.signal.aborted) return;
        setWorkspaces(list);
        setActiveId(active.workspace_id);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const workspaceName =
    workspaces === null ? null : (workspaces.find((w) => w.id === activeId) ?? workspaces[0])?.display_name ?? null;

  return { workspaceName, loadError };
}
