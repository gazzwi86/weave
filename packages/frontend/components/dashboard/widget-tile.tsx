import type { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type { WidgetOut } from "./types";

/** True only for CE-METRICS-1's "not ready yet" sentinel (ADR-013,
 * status.py::pending_fields_of) -- never a real 0/empty value.
 */
function isPendingSentinel(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { pending?: unknown }).pending === true;
}

function KpiValue({ value }: { value: unknown }) {
  return (
    <p className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
      {typeof value === "number" ? value : String(value)}
    </p>
  );
}

function BarChartValue({ value }: { value: Record<string, number> }) {
  const entries = Object.entries(value);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {entries.map(([category, count]) => (
        <li key={category} className="flex items-center gap-[var(--space-3)]">
          <span className="w-24 shrink-0 text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            {category}
          </span>
          <span
            className="h-[var(--space-3)] rounded-[var(--radius-sm)] bg-[var(--color-accent-primary)]"
            style={{ width: `${(count / max) * 100}%` }}
          />
          <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
            {count}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** AC-3/4/5/7: renders one widget per the honest-state matrix (ADR-013) --
 * `status` drives which body renders; this component never re-derives
 * status/pending from `last_result` itself (status.py's implementation
 * hint), it only inspects the payload shape to pick a renderer once a
 * body is known to be real data.
 */
export function WidgetTile({
  widget,
  style,
}: {
  widget: WidgetOut;
  style?: CSSProperties;
}) {
  const contract = widget.spec.data_source_contracts[0];

  return (
    <Card data-testid={`widget-tile-${widget.id}`} style={style}>
      <h3 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {widget.spec.title}
      </h3>
      <div className="mt-[var(--space-3)]">
        {widget.status === "unavailable" && (
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Data unavailable
          </p>
        )}
        {widget.status === "pending" && (
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Counts pending
          </p>
        )}
        {widget.status !== "unavailable" &&
          widget.status !== "pending" &&
          !isPendingSentinel(widget.last_result) &&
          (widget.spec.component_type === "bar_chart" ? (
            <BarChartValue value={widget.last_result as Record<string, number>} />
          ) : (
            <KpiValue value={widget.last_result} />
          ))}
      </div>
      <footer className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        <span>{contract}</span>
        {widget.status === "stale" && <Badge variant="warn">Stale</Badge>}
      </footer>
    </Card>
  );
}
