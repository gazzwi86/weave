import { DecisionLogPanel } from "./decision-log-panel";

/** TASK-020 (build-engine EPIC-007): read-only Decision Log view over
 * PLAT-AUDIT-1. Reachable from the left nav (refit-mock.html
 * #sub-bld-decisions), not a settings sub-page -- B4 dropped the stray
 * "Back to settings" link that used to live here.
 */
export default async function ProjectDecisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Decision log
      </h1>
      <DecisionLogPanel projectId={id} />
    </main>
  );
}
