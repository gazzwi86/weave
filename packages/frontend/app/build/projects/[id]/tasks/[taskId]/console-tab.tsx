"use client";

import { useEffect, useState } from "react";

import type { ConsoleSource } from "./use-task-detail";

interface ConsoleLogState {
  log: string | null | undefined; // undefined = loading
}

/** AC-4: a finished run reads its S3-persisted log by `log_location_ref`
 * through the console-log content route; `null` renders "log not
 * captured", never a broken page. A still-running task's `live_channel`
 * is disclosed but not tailed in this pass -- ponytail: the backend's SSE
 * endpoint (`/api/requests/{run_id}/stream`) replays drafted-section
 * events keyed by request id, not run id, so there is no existing
 * matching client hook to reuse yet (`use-request-status.ts` polls, it
 * doesn't stream); wire a real EventSource tail once that pairing is
 * fixed upstream.
 */
function useConsoleLog(projectId: string, taskId: string, enabled: boolean): ConsoleLogState {
  const [log, setLog] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(
      `/api/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/console-log`
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ log: string | null }>) : { log: null }))
      .then((body) => {
        if (!cancelled) setLog(body.log);
      })
      .catch(() => {
        if (!cancelled) setLog(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId, enabled]);

  return { log };
}

export function ConsoleTab({
  projectId,
  taskId,
  console: source,
}: {
  projectId: string;
  taskId: string;
  console: ConsoleSource;
}): React.JSX.Element {
  const finished = source.live_channel === null;
  const { log } = useConsoleLog(projectId, taskId, finished);

  if (!finished) {
    return (
      <p data-testid="console-live" className="text-[var(--color-text-muted)]">
        Run in progress — live tail is not available in this view yet.
      </p>
    );
  }
  if (log === undefined) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (log === null) {
    return (
      <p data-testid="console-not-captured" className="text-[var(--color-text-muted)]">
        Log not captured.
      </p>
    );
  }
  return (
    <pre
      data-testid="console-log"
      className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-raised)] p-[var(--space-3)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-default)]"
    >
      {log}
    </pre>
  );
}
