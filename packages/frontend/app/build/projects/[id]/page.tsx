import { ProjectDashboard } from "./project-dashboard";

/** BE-V1-TASK-019 project dashboard root (FR-013). Reached from the
 * Registry grid via `project-card.tsx`'s href -- mounted here, not just
 * built (Law B/CE-023: a route with no reachable link is not "done").
 */
export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Project dashboard
      </h1>
      <ProjectDashboard projectId={id} />
    </main>
  );
}
