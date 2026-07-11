"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { Card as UiCard, CardTitle } from "@/components/ui/card";

import { Card } from "./card";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { type BoardFilter, filterCards, isValidFilter } from "./filters";
import { Legend } from "./legend";
import { TaskTree } from "./task-tree";
import type { BoardCard } from "./types";
import { LANE_ORDER } from "./types";
import { useBoard } from "./use-board";

/** AC-1: the six lane columns, each showing only its own cards. */
function LaneGrid({ cards }: { cards: BoardCard[] }): React.JSX.Element {
  return (
    <div
      data-testid="board-lanes"
      className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-3 lg:grid-cols-6"
    >
      {LANE_ORDER.map((lane) => (
        <div key={lane} data-testid={`lane-${lane}`} className="flex flex-col gap-[var(--space-2)]">
          <h2 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {lane}
          </h2>
          {cards
            .filter((card) => card.lane === lane)
            .map((card) => (
              <Card key={card.id} card={card} />
            ))}
        </div>
      ))}
    </div>
  );
}

/** BE-V1-TASK-017: six-lane board + task tree, FR-015/016/017. */
export default function BoardPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get("filter");
  const filter: BoardFilter = isValidFilter(rawFilter) ? rawFilter : "All";

  const { board, tree, loadError } = useBoard(id);

  function setFilter(next: BoardFilter): void {
    const params = new URLSearchParams(searchParams);
    params.set("filter", next);
    router.replace(`?${params.toString()}`);
  }

  if (loadError) {
    return <p role="alert">Could not load the board.</p>;
  }
  if (!board || !tree) {
    return <p data-testid="board-loading">Loading board…</p>;
  }

  // AC-4/AC-5: invalid filter values resolve to "All" above; a genuinely
  // zero-match filter (valid or not) hits the same empty-state path.
  const visibleCards = filterCards(board.cards, filter);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Board
      </h1>
      <Legend />
      <FilterBar active={filter} onChange={setFilter} />

      {visibleCards.length === 0 ? (
        <EmptyState onReset={() => setFilter("All")} />
      ) : (
        <LaneGrid cards={visibleCards} />
      )}

      <UiCard>
        <CardTitle>Task tree</CardTitle>
        <TaskTree nodes={tree.nodes} />
      </UiCard>
    </main>
  );
}
