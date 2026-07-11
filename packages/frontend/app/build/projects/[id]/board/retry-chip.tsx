import { Badge } from "@/components/ui/badge";

import type { BoardCard } from "./types";

/** AC-2: a failed task's retry chip shows its E6-S3 failure class and
 * per-class ceiling state ("syntax 2/3"); a ceiling-hit task shows its
 * HITL-escalated state -- never silently RUNNING after an agent crash.
 */
export function RetryChip({ card }: { card: BoardCard }): React.JSX.Element | null {
  if (card.failure_class === null) return null;

  return (
    <div className="flex items-center gap-[var(--space-1)]" data-testid="retry-chip">
      <Badge variant="warn">
        {card.failure_class} {card.retry_attempt}/{card.retry_ceiling}
      </Badge>
      {card.hitl_escalated && <Badge variant="danger">HITL escalated</Badge>}
    </div>
  );
}
