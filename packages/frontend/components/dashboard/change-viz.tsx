"use client";

import { useState } from "react";

// AC-6: single shared compatibility matrix -- same JSON file the backend
// resolver loads (`dashboard/compat.py::COMPAT_PATH`), no second hand-copied
// table. resolveJsonModule (tsconfig.json) + the bundler's built-in JSON
// loader resolve this relative import with no workspace-linking needed.
import compatMatrix from "../../../shared/widget-compat.json";
import type { ComponentType, WidgetSpec } from "./types";

const COMPAT_MATRIX = compatMatrix as Record<string, ComponentType[]>;

//: m2-delta.md §2: the closed 9-component catalogue, menu order.
const ALL_COMPONENTS: ComponentType[] = [
  "kpi_card",
  "line_area_chart",
  "bar_chart",
  "ranked_list",
  "activity_feed",
  "pie_donut",
  "heatmap",
  "alert_banner",
  "table",
];

/** One helper for every disabled-option tooltip -- don't scatter reason
 * strings (Implementation Hints). `null` shape (hand-composed specs) means
 * nothing is known to be compatible, so every non-current option is
 * disabled with an explanatory reason.
 */
export function reasonFor(
  shape: string | null | undefined,
  component: ComponentType
): string | null {
  if (!shape) return "no data shape recorded for this widget";
  const compatible = COMPAT_MATRIX[shape] ?? [];
  return compatible.includes(component) ? null : `incompatible with ${shape} data`;
}

/** Persists a pinned widget's new component type; unpinned (just-streamed)
 * widgets have nothing to PATCH (Implementation Hints: "branch on widget_id
 * presence").
 */
async function persistComponentType(
  widgetId: string,
  componentType: ComponentType,
  setPending: (value: boolean) => void
): Promise<void> {
  setPending(true);
  try {
    await fetch(`/api/dashboard/widgets/${widgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: { component_type: componentType } }),
    });
  } finally {
    setPending(false);
  }
}

/** AC-5/AC-6: pure client-side re-render -- `onChange` fires synchronously
 * from held data, no fetch/EventSource anywhere in this handler.
 */
export function ChangeViz({
  spec,
  widgetId,
  onChange,
}: {
  spec: WidgetSpec;
  widgetId?: string;
  onChange: (componentType: ComponentType) => void;
}) {
  const [pending, setPending] = useState(false);

  function handleSelect(componentType: ComponentType): void {
    if (componentType === spec.component_type) return;
    if (reasonFor(spec.data_shape, componentType)) return;

    onChange(componentType);
    if (widgetId) void persistComponentType(widgetId, componentType, setPending);
  }

  return (
    <div data-testid="change-viz-menu">
      <label htmlFor="change-viz-select" className="sr-only">
        Change visualisation
      </label>
      <select
        id="change-viz-select"
        data-testid="change-viz-select"
        value={spec.component_type}
        disabled={pending}
        onChange={(event) => handleSelect(event.target.value as ComponentType)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
      >
        {ALL_COMPONENTS.map((component) => {
          const reason = reasonFor(spec.data_shape, component);
          return (
            <option key={component} value={component} disabled={reason !== null} title={reason ?? undefined}>
              {component}
              {reason ? ` (${reason})` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}
