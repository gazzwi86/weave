import Link from "next/link";

import { TaskListPanel } from "./task-list-panel";

/** BE-V1-TASK-018: the task-list entry point, reachable from project
 * settings' "Tasks" link -- mirrors `decisions/page.tsx`'s shell shape. */
export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Tasks
        </h1>
        <Link
          href={`/build/projects/${encodeURIComponent(id)}/settings`}
          className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] hover:underline"
        >
          Back to settings
        </Link>
      </div>
      <TaskListPanel projectId={id} />
    </main>
  );
}
