import { cn } from "@/lib/utils";

export type Status = "active" | "published" | "draft" | "custom";

export interface StatusPillProps {
  status: Status;
  className?: string;
}

// ponytail: "custom" has no mock definition (refit-mock.html only styles
// active/published/draft) -- defaulting it to the neutral/muted treatment
// used elsewhere for unstyled states. Revisit if a future mock section adds it.
const STATUS_STYLE: Record<Status, string> = {
  active: "text-[var(--color-success)] bg-[var(--color-success)]/10",
  published: "text-[var(--color-success)] bg-[var(--color-success)]/10",
  draft: "text-[var(--color-warn)] bg-[var(--color-warn)]/10",
  custom: "text-[var(--color-text-muted)] bg-[var(--color-overlay)]",
};

/** refit-mock.html `.status-pill`/`.status-*`. */
export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)]",
        "px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-medium)]",
        STATUS_STYLE[status],
        className
      )}
    >
      {status}
    </span>
  );
}
