import Link from "next/link";

import { TaskDetailPanel } from "./task-detail-panel";

/** BE-V1-TASK-018 (build-engine EPIC-005): the Task Detail panel --
 * reachable from the project's task list (kanban card). Mirrors
 * `decisions/page.tsx`'s shell shape. */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}): Promise<React.JSX.Element> {
  const { id, taskId } = await params;
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] font-[var(--font-mono)]">
          {taskId}
        </h1>
        <Link
          href={`/build/projects/${encodeURIComponent(id)}/tasks`}
          className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] hover:underline"
        >
          Back to tasks
        </Link>
      </div>
      <TaskDetailPanel projectId={id} taskId={taskId} />
    </main>
  );
}
