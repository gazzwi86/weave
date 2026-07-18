import { KanbanBoardPage, type KanbanBoardLane } from "@/components/templates/KanbanBoardPage";

import { RetryChip } from "./retry-chip";
import type { BoardCard } from "./types";
import { LANE_ORDER } from "./types";

/** No card title field exists on `BoardCard` (schemas/board.py) -- the task
 * id doubles as the title (KanbanCard always renders it a second time, mono,
 * below the title). Adding a real title would need a new fetch this refit
 * doesn't have data-binding license for. */
function toBoardLanes(cards: BoardCard[], projectId: string): KanbanBoardLane[] {
  return LANE_ORDER.map((lane) => ({
    key: lane,
    title: lane,
    cards: cards
      .filter((card) => card.lane === lane)
      .map((card) => ({
        taskId: card.id,
        title: card.id,
        href: `/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(card.id)}`,
        dimmed: card.lane === "Done",
        chips: <RetryChip card={card} />,
      })),
  }));
}

/** refit-mock.html `#sub-bld-kanban` -- adapts `useBoard` data (AC-1/AC-2,
 * unchanged from the pre-refit hand-rolled grid) into the `KanbanBoardPage`
 * template's props. */
export function LaneGrid({ cards, projectId }: { cards: BoardCard[]; projectId: string }): React.JSX.Element {
  return <KanbanBoardPage lanes={toBoardLanes(cards, projectId)} />;
}
