import { useCallback, useState } from "react";

export interface CompanySwitcherEntry {
  id: string;
  name: string;
}

export interface CompanySwitcherState {
  companies: CompanySwitcherEntry[];
  activeId: string | null;
  loading: boolean;
  /** True when the last list/active fetch failed -- distinct from a real empty list. */
  error: boolean;
  switching: boolean;
  /** Fetches the list + active company. Called when the avatar flyout opens
   * -- not on mount, since AvatarMenu renders on every page and most
   * super-admins never open it (mirrors useNotifications' open-driven
   * refresh, minus the badge that needs eager data). No-ops for a
   * non-operator (`enabled: false`), since the list endpoint is admin-only
   * server-side anyway. */
  refresh: () => void;
  switchTo: (id: string) => Promise<void>;
}

interface WorkspaceListEntry {
  id: string;
  display_name: string;
}

interface ActiveWorkspaceResponse {
  workspace_id: string | null;
}

/** V6: lists the caller's own-tenant workspaces as "companies"
 * (workspace == company per refit-mock.html) and lets a super-admin switch
 * the active one. ponytail: `GET /api/tenancy/workspaces` is tenant-scoped
 * to the caller's own tenant, not the cross-tenant company list the mock's
 * Hammerbarn/Acme/Northwind rows depict -- true cross-tenant switching
 * waits on the operator console's still-unbuilt backend (gap G15). */
export function useCompanySwitcher(enabled: boolean): CompanySwitcherState {
  const [companies, setCompanies] = useState<CompanySwitcherEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(false);
    Promise.all([
      fetch("/api/tenancy/workspaces").then((res) => {
        if (!res.ok) throw new Error("workspaces_failed");
        return res.json() as Promise<WorkspaceListEntry[]>;
      }),
      fetch("/api/tenancy/workspaces/active").then((res) => {
        if (!res.ok) throw new Error("active_failed");
        return res.json() as Promise<ActiveWorkspaceResponse>;
      }),
    ])
      .then(([list, active]) => {
        setCompanies(list.map((workspace) => ({ id: workspace.id, name: workspace.display_name })));
        setActiveId(active.workspace_id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [enabled]);

  const switchTo = useCallback(async (id: string) => {
    setSwitching(true);
    try {
      const res = await fetch(`/api/tenancy/workspaces/${id}/switch`, { method: "POST" });
      if (!res.ok) throw new Error("switch_failed");
      // Full reload -- every tenant-scoped fetch across the shell keys off
      // the server session's active workspace, so a client-side state patch
      // can't refresh all of it.
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }, []);

  return { companies, activeId, loading, error, switching, refresh, switchTo };
}
