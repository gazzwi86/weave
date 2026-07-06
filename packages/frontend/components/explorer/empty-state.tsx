import { Button } from "@/components/ui/button";

/** AC-2: rendered instead of the canvas when CE-READ-1 errors or times out.
 * No canvas div is mounted alongside this, so Cytoscape never initialises
 * (zero partial render). */
export interface EmptyStateProps {
  message: string;
  onRetry: () => void;
}

export function EmptyState({ message, onRetry }: EmptyStateProps) {
  return (
    <div
      data-testid="explorer-empty-state"
      className="flex min-h-[400px] flex-col items-center justify-center gap-[var(--space-4)] p-[var(--space-6)] text-center"
    >
      <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
