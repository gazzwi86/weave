import { cn } from "@/lib/utils";

export interface OverlayKeyRow {
  /** CSS custom property name, e.g. `"--color-danger"`. */
  colorVar: string;
  label: string;
}

export interface OverlaySection {
  id: string;
  label: string;
  rows: OverlayKeyRow[];
}

export interface OverlayKeyProps {
  /** One section per active overlay -- empty when no overlay is toggled on,
   * which renders nothing (mock's `#overlay-key` has no `.show` class then). */
  sections: OverlaySection[];
  className?: string;
}

/** refit-mock.html `.overlay-key`/`.k-row`/`.k-sw` -- glass mini-legend
 * stacked over the canvas, one uppercase section label + swatch rows per
 * active overlay (heat / impact / diff). */
export function OverlayKey({ sections, className }: OverlayKeyProps) {
  if (sections.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)]",
        "p-[var(--space-3)] text-[length:var(--text-caption)] text-[var(--color-text-muted)] shadow-[var(--shadow-overlay)] backdrop-blur-md",
        className
      )}
    >
      {sections.map((section) => (
        <div key={section.id}>
          <div className="py-[var(--space-1)] font-[var(--font-weight-bold)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase">
            {section.label}
          </div>
          {section.rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-center gap-[var(--space-2)] py-[var(--space-1)]">
              <span
                aria-hidden="true"
                className="h-[var(--size-dot)] w-[var(--size-dot)] shrink-0 rounded-[var(--radius-full)]"
                style={{ background: `var(${row.colorVar})` }}
              />
              {row.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
