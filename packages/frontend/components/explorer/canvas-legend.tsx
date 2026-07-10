import { useState } from "react";

import type { NodeKind } from "@/lib/explorer/types";

export interface CanvasLegendProps {
  palette: NodeKind[];
  loading: boolean;
}

// D-5: glass surface (graph-canvas overlays are one of the components.md-
// permitted glass surfaces) -- translucent fill + blur + --shadow-overlay,
// docked in the --z-canvas-overlay stacking layer (mini-map/legend/toolbar).
const GLASS_PANEL_CLASS =
  "absolute left-[var(--space-4)] bottom-[var(--space-4)] z-[var(--z-canvas-overlay)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-overlay)]/80 backdrop-blur-md p-[var(--space-3)] shadow-[var(--shadow-overlay)]";

function KindRow({ kind }: { kind: NodeKind }) {
  // D-2: colour is paired with the kind's text label (never colour alone,
  // WCAG 1.4.1) -- same pairing rationale as components/ui/badge.tsx.
  // Shape glyphs (--shape-kind-*) are deferred: no SVG sprite exists
  // anywhere in the codebase yet to resolve them against (escalated,
  // unanswered as of this task; colour+label already clears the WCAG bar).
  return (
    <li className="flex items-center gap-[var(--space-2)]">
      <span className="h-[var(--space-3)] w-[var(--space-3)] rounded-[var(--radius-full)]" style={{ backgroundColor: kind.colour }} />
      <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{kind.label}</span>
    </li>
  );
}

// D-1/D-4: corner-docked bottom-left, collapsible but never fully hidden --
// collapsed state keeps rendering this same toggle affordance to re-open.
export function CanvasLegend({ palette, loading }: CanvasLegendProps) {
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
        <h3 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Legend</h3>
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
            <KindRow key={kind.id} kind={kind} />
          ))}
        </ul>
      )}
    </div>
  );
}
