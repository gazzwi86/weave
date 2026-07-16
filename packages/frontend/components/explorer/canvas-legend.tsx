import { useState } from "react";

import type { OverlayLegendModel } from "@/lib/explorer/overlay-engine";
import type { NodeKind } from "@/lib/explorer/types";

export interface CanvasLegendProps {
  palette: NodeKind[];
  loading: boolean;
  /** TASK-021 D-1: active colour overlay's legend, if any -- renders as a
   * second section inside this same glass panel, never a second floating
   * legend. null/undefined when no overlay is active. */
  overlay?: OverlayLegendModel | null;
}

// D-5: glass surface (graph-canvas overlays are one of the components.md-
// permitted glass surfaces) -- translucent fill + blur + --shadow-overlay,
// docked in the --z-canvas-overlay stacking layer (mini-map/legend/toolbar).
const GLASS_PANEL_CLASS =
  "absolute left-[var(--space-4)] bottom-[var(--space-4)] z-[var(--z-canvas-overlay)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-overlay)]/80 backdrop-blur-md p-[var(--space-3)] shadow-[var(--shadow-overlay)]";

// D-2: colour is paired with a text label (never colour alone, WCAG
// 1.4.1) -- shared row shape for both the base kind palette and an
// overlay's legend entries. Shape glyphs (--shape-kind-*) are deferred: no
// SVG sprite exists anywhere in the codebase yet to resolve them against
// (escalated, unanswered as of this task; colour+label already clears the
// WCAG bar).
function LegendSwatchRow({ label, colour }: { label: string; colour: string }) {
  return (
    <li className="flex items-center gap-[var(--space-2)]">
      <span className="h-[var(--space-3)] w-[var(--space-3)] rounded-[var(--radius-full)]" style={{ backgroundColor: colour }} />
      <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{label}</span>
    </li>
  );
}

// TASK-021 D-1: the active colour overlay's entries + free-text note,
// rendered as a second section inside CanvasLegend's own glass panel --
// never a second floating legend. `note` (unmatched count, all-unmatched
// notice, palette-cycle notice) stays its own line, never folded into an
// entry's label (AC-1/AC-6).
function OverlayLegendSection({ overlay }: { overlay: OverlayLegendModel }) {
  return (
    // ONB-V1-TASK-002: tour/beacon anchor for tour.ge.completeness-map step 2 --
    // additive attribute. Renders only while an overlay is active (known limitation
    // for the tour, see the task's escalation note -- AC-002-04's skip-with-warning
    // fallback covers it, no half-rendered overlay).
    <div
      className="mt-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-2)]"
      data-tour-id="ge.overlay.completeness-legend"
    >
      <h3 className={"text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"}>{overlay.title}</h3>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {overlay.entries.map((entry) => (
          <LegendSwatchRow key={entry.label} label={entry.label} colour={entry.colour} />
        ))}
      </ul>
      {overlay.note && (
        <p className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">{overlay.note}</p>
      )}
    </div>
  );
}

// D-1/D-4: corner-docked bottom-left, collapsible but never fully hidden --
// collapsed state keeps rendering this same toggle affordance to re-open.
export function CanvasLegend({ palette, loading, overlay }: CanvasLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Expand legend"
        onClick={() => setCollapsed(false)}
        className={`${GLASS_PANEL_CLASS} text-[length:var(--text-body-sm)] text-[var(--color-text-default)]`}
      >
        Legend
      </button>
    );
  }

  return (
    <div data-testid="explorer-legend" className={GLASS_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h2 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Legend</h2>
        <button
          type="button"
          aria-label="Collapse legend"
          onClick={() => setCollapsed(true)}
          className="text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Collapse
        </button>
      </div>
      {loading ? (
        <p className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">Loading legend…</p>
      ) : (
        <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
          {palette.map((kind) => (
            <LegendSwatchRow key={kind.id} label={kind.label} colour={kind.colour} />
          ))}
        </ul>
      )}
      {overlay && <OverlayLegendSection overlay={overlay} />}
    </div>
  );
}
