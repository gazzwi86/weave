import type { BlockersTilePayload, RibbonTilePayload } from "./dashboard-types";

/** No unified "activity feed" endpoint exists -- this merges the two real
 * per-project signals already fetched for the old tile grid: blocked tasks
 * (danger) and recent build/commit runs (accent). Empty when both tiles are
 * empty or still loading; never fabricated narrative text.
 */
export function DashboardActivityPanel({
  blockers,
  ribbon,
}: {
  blockers: BlockersTilePayload | null;
  ribbon: RibbonTilePayload | null;
}): React.JSX.Element {
  const blockedRows = blockers?.items ?? [];
  const runRows = ribbon?.runs ?? [];

  if (blockedRows.length === 0 && runRows.length === 0) {
    return (
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
        No recent activity to show yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {blockedRows.map((item) => (
        <li key={`blocker-${item.task_id}`} className="text-[length:var(--text-body-sm)]">
          <span className="text-[var(--color-danger)]">●</span>{" "}
          <b className="text-[var(--color-text-default)]">{item.task_id}</b> blocked —{" "}
          {item.reason}
        </li>
      ))}
      {runRows.map((run) => (
        <li key={`run-${run.run_id}`} className="text-[length:var(--text-body-sm)]">
          <span className="text-[var(--color-accent-primary)]">●</span>{" "}
          {run.repo_url ? (
            <a href={run.repo_url} className="underline">
              {run.commit_sha}
            </a>
          ) : (
            <b>{run.commit_sha}</b>
          )}{" "}
          on {run.branch}
        </li>
      ))}
    </ul>
  );
}
