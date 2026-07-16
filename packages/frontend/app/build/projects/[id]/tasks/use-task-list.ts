import { useEffect, useState } from "react";

import { normalizeUrn } from "@/lib/build/normalize-urn";

export interface TaskState {
  id: string;
  status: string;
  blocked_by: string[];
  codify_checkpoint: Record<string, unknown> | null;
}

export interface TaskListState {
  tasks: TaskState[];
  loading: boolean;
}

/** BE-V1-TASK-018: the task-list entry point -- reads the project's
 * state-spine tasks (`GET /api/build/projects/{id}/tasks`, proxying
 * BE-TASK-006's `/api/state/{project_iri}`) once on mount, no polling
 * (task statuses only change on a run, which the operator drives from the
 * Request page, not from here). */
export function useTaskList(projectId: string): TaskListState {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/build/projects/${encodeURIComponent(normalizeUrn(projectId))}/tasks`)
      .then((res) => (res.ok ? (res.json() as Promise<{ tasks: TaskState[] }>) : null))
      .then((body) => {
        if (cancelled) return;
        setTasks(body?.tasks ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { tasks, loading };
}
