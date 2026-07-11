import { cn } from "@/lib/utils";

export type KpiTileVariant = "default" | "success" | "warn" | "danger";

export interface KpiTileProps {
  label: string;
  /** Formatted value string (e.g. "1,204") -- formatting is the caller's job. */
  value?: string;
  loading?: boolean;
  /** No value and not loading -- e.g. a metric with zero underlying data. */
  empty?: boolean;
  /** Status tint (left accent border) -- meaning still rides on `label`/
   * `value` text, never colour alone (WCAG 1.4.1), same rule as Badge. */
  variant?: KpiTileVariant;
  className?: string;
}

const VARIANT_BORDER: Record<KpiTileVariant, string> = {
  default: "",
  success: "border-l-4 border-l-[var(--color-success)]",
  warn: "border-l-4 border-l-[var(--color-warn)]",
  danger: "border-l-4 border-l-[var(--color-danger)]",
};

function KpiTileBody({ value, loading, empty }: Pick<KpiTileProps, "value" | "loading" | "empty">) {
  if (loading) {
    return (
      <div className="mt-[var(--space-2)] h-[var(--text-h2)] w-1/2 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-raised)]" />
    );
  }
  if (empty) {
    return (
      <p className="mt-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-subtle)]">
        No data yet
      </p>
    );
  }
  return (
    <p className="mt-[var(--space-2)] text-[length:var(--text-h2)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
      {value}
    </p>
  );
}

/** Flat KPI card -- `--color-surface` family, no blur (`components.md`
 * "Glass vs flat": KpiTile stays flat, glass is reserved for overlays). */
export function KpiTile({ label, value, loading, empty, variant = "default", className }: KpiTileProps) {
  return (
    <div
      aria-busy={loading || undefined}
      className={cn(
        "rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        "p-[var(--space-5)]",
        VARIANT_BORDER[variant],
        className
      )}
    >
      <p className="text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-muted)]">
        {label}
      </p>
      <KpiTileBody value={value} loading={loading} empty={empty} />
    </div>
  );
}
