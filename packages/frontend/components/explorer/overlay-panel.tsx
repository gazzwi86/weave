import type { OverlayToggle } from "./use-overlay-controls";

export interface OverlayPanelProps {
  toggles: OverlayToggle[];
  onToggleOverlay: (id: string) => void;
}

const HEADING_CLASS = "text-[length:var(--text-caption)] text-[var(--color-text-subtle)]";

// TASK-021 AC-2: same switch pattern as filter-panel.tsx's LayerToggleList
// -- a disabled sibling stays in the tab order (never hidden), so mutual
// exclusion is discoverable by keyboard, not just visually.
function OverlayToggleRow({ toggle, onToggleOverlay }: { toggle: OverlayToggle; onToggleOverlay: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={toggle.active}
        aria-label={toggle.label}
        disabled={toggle.disabled}
        title={toggle.disabled ? "Turn off the active overlay first" : undefined}
        onClick={() => onToggleOverlay(toggle.id)}
        className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] disabled:pointer-events-none disabled:opacity-50"
      >
        {toggle.label}
      </button>
    </li>
  );
}

/** TASK-021: presentation-only overlay toggle list -- every field reads
 * from useOverlayControls' return value and every click calls straight
 * back into it (this component owns no overlay state itself, same split
 * as FilterPanel/useFilterPanel). */
export function OverlayPanel({ toggles, onToggleOverlay }: OverlayPanelProps) {
  return (
    <div data-testid="explorer-overlay-panel">
      <h3 className={HEADING_CLASS}>Overlays</h3>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {toggles.map((toggle) => (
          <OverlayToggleRow key={toggle.id} toggle={toggle} onToggleOverlay={onToggleOverlay} />
        ))}
      </ul>
    </div>
  );
}
