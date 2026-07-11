import { Card as UiCard } from "@/components/ui/card";

import { RetryChip } from "./retry-chip";
import type { BoardCard as BoardCardData } from "./types";

/** AC-1/AC-2: one board card -- task id, status label, retry chip when the
 * task has ever failed.
 */
export function Card({ card }: { card: BoardCardData }): React.JSX.Element {
  return (
    <UiCard data-testid="board-card" className="flex flex-col gap-[var(--space-1)]">
      <p className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">{card.id}</p>
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        {card.status}
      </p>
      <RetryChip card={card} />
    </UiCard>
  );
}
