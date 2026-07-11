import { useCallback, useEffect, useState } from "react";

export interface Member {
  user_sub: string | null;
  email: string;
  display_name: string;
  role: string;
  status: string;
  invited_at: string;
}

export interface MembersState {
  /** null while first load (active workspace id + members) is in flight. */
  members: Member[] | null;
  loadError: boolean;
  inviting: boolean;
  inviteError: string | null;
  invite: (email: string, role: string) => Promise<boolean>;
  /** Revoke keys members that have signed in (`user_sub`) -- a pending
   * invite has none yet, so its row has no revoke action (see AC-2 test).
   */
  revoke: (userSub: string) => Promise<boolean>;
}

/** Resolves the caller's active workspace id via the tenant-scoped
 * `/api/tenancy/workspaces/active` proxy -- Members is always scoped to
 * whichever workspace the caller last switched into (same source the rest
 * of Settings uses).
 */
async function fetchActiveWorkspaceId(signal: AbortSignal): Promise<string | null> {
  const res = await fetch("/api/tenancy/workspaces/active", { signal });
  if (!res.ok) throw new Error("load_failed");
  const body = (await res.json()) as { workspace_id: string | null };
  return body.workspace_id;
}

/** Drives the Settings -> Members panel: resolves the active workspace,
 * lists its members, and exposes invite/revoke against the
 * `/api/tenancy/workspaces/{id}/members` proxy (mirrors `useWorkspaces`'
 * version-counter reload pattern).
 */
export function useMembers(): MembersState {
  const [workspaceId, setWorkspaceId] = useState<string | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchActiveWorkspaceId(controller.signal)
      .then((id) => {
        if (controller.signal.aborted) return;
        setWorkspaceId(id);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    fetch(`/api/tenancy/workspaces/${workspaceId}/members`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<{ members: Member[] }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setMembers(data.members);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [workspaceId, version]);

  const invite = useCallback(
    async (email: string, role: string): Promise<boolean> => {
      if (!workspaceId) return false;
      setInviting(true);
      setInviteError(null);
      try {
        const res = await fetch(`/api/tenancy/workspaces/${workspaceId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });
        if (res.status === 202) {
          setVersion((v) => v + 1);
          return true;
        }
        if (res.status === 409) {
          setInviteError("Already an active member.");
          return false;
        }
        setInviteError("Unable to send invite.");
        return false;
      } finally {
        setInviting(false);
      }
    },
    [workspaceId]
  );

  const revoke = useCallback(
    async (userSub: string): Promise<boolean> => {
      if (!workspaceId) return false;
      const res = await fetch(`/api/tenancy/workspaces/${workspaceId}/members/${userSub}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        setVersion((v) => v + 1);
        return true;
      }
      return false;
    },
    [workspaceId]
  );

  return {
    members: workspaceId === undefined ? null : members,
    loadError,
    inviting,
    inviteError,
    invite,
    revoke,
  };
}
