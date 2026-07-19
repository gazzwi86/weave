"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { Card as UiCard, CardTitle } from "@/components/ui/card";

import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";
import { type BoardFilter, filterCards, isValidFilter } from "./filters";
import { LaneGrid } from "./lane-grid";
import { Legend } from "./legend";
import { TaskTree } from "./task-tree";
import { useBoard } from "./use-board";

/** BE-V1-TASK-017: six-lane board + task tree, FR-015/016/017.
 * refit-mock.html #sub-bld-kanban: lanes render via `LaneGrid`, which is
 * built on the `KanbanLane`/`KanbanCard` design-system molecules. */
export default function BoardPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get("filter");
  const filterIsInvalid = rawFilter !== null && !isValidFilter(rawFilter);
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

  // AC-5: an unknown filter value (e.g. stale URL) hits the same
  // empty-state path as AC-4's zero-match case, never a broken board.
  const visibleCards = filterIsInvalid ? [] : filterCards(board.cards, filter);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Board
      </h1>
      <Legend />
      <FilterBar active={filter} onChange={setFilter} />

      {visibleCards.length === 0 ? (
        <EmptyState hasAnyTasks={board.cards.length > 0} onReset={() => setFilter("All")} />
      ) : (
        <LaneGrid cards={visibleCards} projectId={id} />
      )}

      <UiCard>
        <CardTitle>Task tree</CardTitle>
        <TaskTree nodes={tree.nodes} />
      </UiCard>
    </main>
  );
}
