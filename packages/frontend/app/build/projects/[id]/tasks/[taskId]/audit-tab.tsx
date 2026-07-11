"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  seq: number;
  ts: string;
  actor_principal_iri: string;
  event_type: string;
}

type AuditState = { entries: AuditEntry[] } | { unavailable: true } | undefined;

function useTaskAudit(projectId: string, taskId: string): AuditState {
  const [state, setState] = useState<AuditState>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/audit`
    )
      .then(
        (
          res: Response
        ): { entries: AuditEntry[] } | { unavailable: true } | Promise<{ entries: AuditEntry[] }> => {
          if (res.status === 503) return { unavailable: true as const };
          if (!res.ok) throw new Error("audit_failed");
          return res.json() as Promise<{ entries: AuditEntry[] }>;
        }
      )
      .then((body) => {
        if (!cancelled) setState(body);
      })
      .catch(() => {
        if (!cancelled) setState({ unavailable: true });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  return state;
}

/** AC-5: PLAT-AUDIT-1 unreachable renders "audit unavailable" -- never a
 * fabricated entry list. */
export function AuditTab({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}): React.JSX.Element {
  const state = useTaskAudit(projectId, taskId);

  if (state === undefined) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }
  if ("unavailable" in state) {
    return (
      <p data-testid="audit-unavailable" className="text-[var(--color-text-muted)]">
        Audit unavailable.
      </p>
    );
  }
  if (state.entries.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No audit entries.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {state.entries.map((entry) => (
        <li
          key={entry.seq}
          className="border-b border-[var(--color-border)] pb-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-default)]"
        >
          {entry.ts} — {entry.event_type} — {entry.actor_principal_iri}
        </li>
      ))}
    </ul>
  );
}
