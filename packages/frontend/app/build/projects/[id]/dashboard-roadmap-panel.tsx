import { ExplainBand } from "@/components/ui/explain-band";

/** G10 gap: a Gantt needs a per-epic ordering + status + date range, and
 * none exists -- there's no epics endpoint (G9), and neither the board nor
 * task-tree client carries an epic field to group tasks by, so even a
 * status-only derivation (done/active/up-next, no real dates) isn't
 * possible from what's already fetched. Full pending-state until an epics
 * endpoint ships with at least status; `Gantt` (components/molecules/Gantt)
 * stays unused here rather than rendering fabricated bars.
 */
export function DashboardRoadmapPanel(): React.JSX.Element {
  return (
    <ExplainBand
      tone="accent"
      icon="gauge"
      body="Roadmap — no epic timeline data yet."
    />
  );
}
