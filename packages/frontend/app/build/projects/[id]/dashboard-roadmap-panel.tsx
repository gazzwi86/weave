"use client";

import { Badge } from "@/components/ui/badge";
import { ExplainBand } from "@/components/ui/explain-band";

import { useEpics } from "./use-epics";

const STATUS_VARIANT = { done: "success", active: "info", upcoming: "neutral" } as const;

/** B2 (docs/design/remediation-2-api-gaps.md): wires to the G9/G10 epic
 * rollup endpoint (`GET /api/projects/{id}/epics`) -- no dates (G10 is
 * still deferred, ordinal + status only), so this renders an ordered list
 * rather than a `Gantt` (components/molecules/Gantt stays unused).
 */
export function DashboardRoadmapPanel({ projectId }: { projectId: string }): React.JSX.Element {
  const rollup = useEpics(projectId);
  const epics = [...(rollup?.epics ?? [])].sort((a, b) => a.ordinal - b.ordinal);

  if (rollup && epics.length === 0) {
    return <ExplainBand tone="accent" icon="gauge" body="Roadmap — no epics yet." />;
  }

  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {epics.map((epic) => (
        <li
          key={epic.epic_id}
          className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--text-body-sm)]"
        >
          <span className="text-[var(--color-text-default)]">{epic.title ?? epic.epic_id}</span>
          <span className="flex items-center gap-[var(--space-2)]">
            <span className="text-[var(--color-text-subtle)]">
              {epic.task_counts.done}/{epic.task_counts.total}
            </span>
            <Badge variant={STATUS_VARIANT[epic.status]}>{epic.status}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
