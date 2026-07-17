import { cn } from "@/lib/utils";

export interface KpiStripItem {
  value: string;
  label: string;
  /** "ok" tints the value success-green -- meaning still rides on `label`
   * (WCAG 1.4.1), the colour is a bonus, not the only carrier. */
  variant?: "default" | "ok";
}

export interface KpiStripProps {
  items: KpiStripItem[];
  className?: string;
}

/** refit-mock.html `.kpi-strip` -- glass canvas-overlay strip of mono
 * values, dividers between cells (nearest real token to the mock's
 * `--border-soft`, which globals.css doesn't define, is `--color-border`). */
export function KpiStrip({ items, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        "flex rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)]",
        "p-0.5 shadow-[var(--shadow-overlay)] backdrop-blur-md",
        className
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "px-[var(--space-3)] py-[var(--space-2)] text-center",
            index < items.length - 1 && "border-r border-[var(--color-border)]"
          )}
        >
          <div
            className={cn(
              "font-[family-name:var(--font-mono)] text-[length:var(--text-mono)] font-[var(--font-weight-semibold)]",
              item.variant === "ok" ? "text-[var(--color-success)]" : "text-[var(--color-text-default)]"
            )}
          >
            {item.value}
          </div>
          <div className="mt-[var(--space-1)] text-[length:var(--text-caption)] tracking-[var(--text-caption-tracking)] text-[var(--color-text-subtle)] uppercase">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
