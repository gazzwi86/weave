import { ExplainBand } from "@/components/ui/explain-band";
import { Button } from "@/components/ui/button";

import type { BoardCard, BoardResponse } from "./board/types";

/** G12 gap: no dedicated "pending review gates" endpoint exists yet -- the
 * gate band is derived from the board's own Review/QA lane cards (Review
 * first, since that's the lane a human gate blocks on; QA as a fallback).
 * Returns `null` when nothing is waiting, same as when the board hasn't
 * loaded -- there is no reliable signal to show a placeholder for.
 */
export function findPendingGateCard(board: BoardResponse | null): BoardCard | null {
  if (!board) return null;
  return (
    board.cards.find((card) => card.lane === "Review") ??
    board.cards.find((card) => card.lane === "QA") ??
    null
  );
}

export function DashboardGateBand({
  board,
  onReview,
}: {
  board: BoardResponse | null;
  onReview: (taskId: string) => void;
}): React.JSX.Element | null {
  const card = findPendingGateCard(board);
  if (!card) return null;

  return (
    <ExplainBand
      tone="warn"
      icon="bell"
      body={
        <>
          <b className="text-[var(--color-text-default)]">Review gate waiting on you:</b>{" "}
          {card.id} is ready for review before the build can continue.
        </>
      }
      action={
        <Button variant="secondary" onClick={() => onReview(card.id)}>
          Review now
        </Button>
      }
    />
  );
}
