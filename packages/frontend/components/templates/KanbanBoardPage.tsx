import type { ReactNode } from "react";

import Link from "next/link";

import { KanbanCard } from "@/components/molecules/KanbanCard";
import { KanbanLane } from "@/components/molecules/KanbanLane";

export interface KanbanBoardCard {
  taskId: string;
  title: string;
  href: string;
  chips?: ReactNode;
  dimmed?: boolean;
}

export interface KanbanBoardLane {
  key: string;
  title: string;
  cards: KanbanBoardCard[];
}

/** refit-mock.html `#sub-bld-kanban` -- lane columns of `KanbanCard`s, each
 * card wrapped in a `Link` to its detail page. Data-only props -- the app
 * layer supplies lanes/cards/hrefs from live data (same convention as
 * `TablePage`). `Link` in a dumb component mirrors the one existing
 * precedent (`molecules/BarChart`). */
export function KanbanBoardPage({ lanes }: { lanes: KanbanBoardLane[] }) {
  return (
    <div data-testid="board-lanes" className="flex gap-[var(--space-4)] overflow-x-auto">
      {lanes.map((lane) => (
        <div key={lane.key} data-testid={`lane-${lane.key}`}>
          <KanbanLane title={lane.title} count={lane.cards.length}>
            {lane.cards.map((card) => (
              <Link
                key={card.taskId}
                href={card.href}
                className="block rounded-[var(--radius-base)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
              >
                <KanbanCard taskId={card.taskId} title={card.title} chips={card.chips} dimmed={card.dimmed} />
              </Link>
            ))}
          </KanbanLane>
        </div>
      ))}
    </div>
  );
}
