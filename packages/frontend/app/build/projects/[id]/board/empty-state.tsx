import { Button } from "@/components/ui/button";

/** AC-4/AC-5: a zero-match filter (or an invalid/unknown filter value)
 * shows this message and offers a reset to "All" -- never a blank board.
 * B3: a board with no tasks at all is not a filter failure -- `hasAnyTasks`
 * distinguishes the designed empty state from the filtered-out one.
 */
export function EmptyState({
  hasAnyTasks,
  onReset,
}: {
  hasAnyTasks: boolean;
  onReset: () => void;
}): React.JSX.Element {
  return (
    <div
      role="status"
      data-testid="board-empty-state"
      className="flex flex-col items-center gap-[var(--space-2)] p-[var(--space-6)] text-center"
    >
      <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">
        {hasAnyTasks ? "No tasks match this filter." : "No tasks yet — they appear when a build run starts."}
      </p>
      {hasAnyTasks && <Button onClick={onReset}>Back to All</Button>}
    </div>
  );
}
