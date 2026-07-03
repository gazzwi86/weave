/** AC-5/6: M1 has no Constitution Engine yet, so the dashboard renders a
 * static empty state -- no metrics fetch, no prompt bar/AI surface. Swap
 * this out (not extend it) once GET /api/dashboard/metrics ships in M2.
 */
export function DashboardPlaceholder() {
  return (
    <section
      data-testid="dashboard-placeholder-grid"
      className="grid w-full max-w-3xl gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)]"
    >
      <h2 className="text-[length:var(--text-h3)] leading-[var(--text-h3-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Your dashboard activates with the Constitution Engine
      </h2>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Once you model your business as a knowledge graph, this space fills with the metrics,
        capabilities, and activity that matter to you.
      </p>
      <footer className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        Constitution Engine — available at M2
      </footer>
    </section>
  );
}
