import { useEffect, useState } from "react";

export interface ConsoleSource {
  live_channel: string | null;
  log_location_ref: string | null;
}

export interface TaskDetail {
  brief: Record<string, unknown> | null;
  handoff: Record<string, unknown>[];
  console: ConsoleSource;
  captures_manifest_ref: string | null;
}

export interface TaskDetailState {
  detail: TaskDetail | null;
  loading: boolean;
}

/** BE-V1-TASK-018 AC-2: fetches the task-detail payload once on mount --
 * the Brief/Handoff panes and the Console/Tests tabs' source pointers all
 * come from this one call (`GET /api/build/projects/{id}/tasks/{taskId}`).
 */
export function useTaskDetail(projectId: string, taskId: string): TaskDetailState {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`
    )
      .then((res) => (res.ok ? (res.json() as Promise<TaskDetail>) : null))
      .then((body) => {
        if (cancelled) return;
        setDetail(body);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  return { detail, loading };
}
