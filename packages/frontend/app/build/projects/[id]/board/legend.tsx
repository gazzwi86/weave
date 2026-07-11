import { Badge } from "@/components/ui/badge";

import type { Lane } from "./types";

/** AC-6: state is never conveyed by colour alone -- every lane badge always
 * carries a text label (`Badge`'s own contract). This legend spells out
 * every lane once, shared by both the board and the task tree.
 */
export const LANE_VARIANT: Record<Lane, "neutral" | "info" | "warn" | "success"> = {
  Backlog: "neutral",
  Ready: "info",
  "In Progress": "info",
  Review: "warn",
  QA: "warn",
  Done: "success",
};

const LANES: Lane[] = ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"];

export function Legend(): React.JSX.Element {
  return (
    <ul
      aria-label="State legend"
      className="flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--text-caption)]"
    >
      {LANES.map((lane) => (
        <li key={lane}>
          <Badge variant={LANE_VARIANT[lane]}>{lane}</Badge>
        </li>
      ))}
    </ul>
  );
}
