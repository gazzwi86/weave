import { cn } from "@/lib/utils";

export type Severity = "violation" | "warning" | "info" | "critical" | "normal";

export interface SevChipProps {
  severity: Severity;
  className?: string;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  violation: "text-[var(--color-danger)] bg-[var(--color-danger)]/10 before:bg-[var(--color-danger)]",
  critical: "text-[var(--color-danger)] bg-[var(--color-danger)]/10 before:bg-[var(--color-danger)]",
  warning: "text-[var(--color-warn)] bg-[var(--color-warn)]/10 before:bg-[var(--color-warn)]",
  info: "text-[var(--color-text-muted)] bg-[var(--color-overlay)] before:bg-[var(--color-text-subtle)]",
  normal: "text-[var(--color-text-muted)] bg-[var(--color-overlay)] before:bg-[var(--color-text-subtle)]",
};

/** refit-mock.html `.sev`/`.sev-*` -- severity chip, leading dot carries the
 * same meaning as the label text (WCAG 1.4.1: colour is never the only
 * signal here, the word "critical"/"warning"/etc is always present). */
export function SevChip({ severity, className }: SevChipProps) {
  return (
    <span
      className={cn(
        // ponytail: mock's exact fine-grained pixel values have no matching
        // design token -- reusing Badge's established pill padding
        // (space-2/space-1) and space-1 for the dot keeps this token-pure
        // at the nearest scale step.
        "inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)]",
        "px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)]",
        "before:h-[var(--space-1)] before:w-[var(--space-1)] before:rounded-[var(--radius-full)] before:content-['']",
        SEVERITY_STYLE[severity],
        className
      )}
    >
      {severity}
    </span>
  );
}
