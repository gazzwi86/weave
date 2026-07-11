"use client";

import Link from "next/link";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";

import { useTaskList } from "./use-task-list";

// GAPS: state-spine task statuses (Ready/Blocked/InProgress/Passed/Failed
// etc, `build/state_spine.py`) have no lifecycle-phase chip precedent like
// `ProjectCard`'s PHASE_VARIANT -- best-effort mapping, unmapped statuses
// fall back to "neutral" (still meaning-bearing via the label, WCAG 1.4.1).
const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  Ready: "info",
  Blocked: "warn",
  InProgress: "info",
  Passed: "success",
  Failed: "danger",
};

/** One kanban card per task -- the E2E entry point into the Task Detail
 * 5-tab panel (BE-V1-TASK-018 AC-2). */
function TaskCard({
  projectId,
  taskId,
  status,
}: {
  projectId: string;
  taskId: string;
  status: string;
}): React.JSX.Element {
  return (
    <Link
      href={`/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`}
      className="block"
      data-testid={`task-card-${taskId}`}
    >
      <Card className="transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-hover)] focus-visible:shadow-[var(--ring-focus)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <CardTitle className="font-[var(--font-mono)] text-[length:var(--text-body)]">
            {taskId}
          </CardTitle>
          <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{status}</Badge>
        </div>
      </Card>
    </Link>
  );
}

/** BE-V1-TASK-018: the task-list entry point (kanban-lite -- a flat card
 * list, not column-per-status; the brief names "kanban card" as the click
 * target, not a full board layout). */
export function TaskListPanel({ projectId }: { projectId: string }): React.JSX.Element {
  const { tasks, loading } = useTaskList(projectId);

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">Loading tasks…</p>;
  }

  if (tasks.length === 0) {
    return (
      <p data-testid="tasks-empty" className="text-[var(--color-text-muted)]">
        No tasks yet — start a run from the Request page.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} projectId={projectId} taskId={task.id} status={task.status} />
      ))}
    </div>
  );
}
