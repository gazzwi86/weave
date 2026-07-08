import { useCallback, useEffect, useState } from "react";

export interface Workspace {
  id: string;
  slug: string;
  display_name: string;
  named_graph_iri: string;
  created_at: string;
}

export interface WorkspacesState {
  /** null while the first load is in flight. */
  workspaces: Workspace[] | null;
  /** True when the last list fetch failed (network/upstream error). */
  loadError: boolean;
  creating: boolean;
  /** User-facing message for the last failed create -- null otherwise. */
  createError: string | null;
  /** Resolves true on 201 (form should clear); the list reloads itself. */
  createWorkspace: (slug: string, displayName: string) => Promise<boolean>;
}

/** Fetches the tenant's workspace list whenever `version` changes -- split
 * out of `useWorkspaces` to keep each hook under the function length budget
 * (same shape as billing's `useUsageFetch`). */
function useWorkspaceList(version: number): {
  workspaces: Workspace[] | null;
  loadError: boolean;
} {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tenancy/workspaces", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<Workspace[]>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setWorkspaces(data);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [version]);

  return { workspaces, loadError };
}

/** Drives the admin workspaces panel: list via the tenant-scoped
 * `/api/tenancy/workspaces` proxy, plus create with 409 slug-taken surfaced
 * as a user-facing message. */
export function useWorkspaces(): WorkspacesState {
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { workspaces, loadError } = useWorkspaceList(version);

  const createWorkspace = useCallback(async (slug: string, displayName: string) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tenancy/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, display_name: displayName }),
      });
      if (res.status === 201) {
        setVersion((v) => v + 1);
        return true;
      }
      setCreateError(
        res.status === 409 ? "That slug is already taken." : "Unable to create the workspace."
      );
      return false;
    } catch {
      setCreateError("Unable to create the workspace.");
      return false;
    } finally {
      setCreating(false);
    }
  }, []);

  return { workspaces, loadError, creating, createError, createWorkspace };
}
