import type { CSSProperties, HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EntityRef } from "@/components/molecules/EntityRef";
import { RelativeTime } from "@/components/molecules/RelativeTime";

import type { WidgetOut } from "./types";

function formatStaleTimestamp(fetchedAt: string | null): string {
  if (fetchedAt === null) return "";
  return new Date(fetchedAt).toLocaleString();
}

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

/** ponytail: one generic fallback for the other 7 catalogue types (TASK-012
 * only requires a working kpi_card<->table switch to prove change-viz
 * re-renders held data -- a real per-type renderer for
 * line_area_chart/ranked_list/activity_feed/pie_donut/heatmap/alert_banner
 * is a later task's scope if/when the grid actually needs to render them).
 */
function tableRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>);
  }
  return [[String(value), ""]];
}

function TableValue({ value }: { value: unknown }) {
  const rows = tableRows(value);
  return (
    <table className="w-full text-[length:var(--text-body-sm)]">
      <tbody>
        {rows.map((row, index) => {
          const [key, val] = Array.isArray(row) ? row : [index, row];
          return (
            <tr key={String(key)}>
              <td className="pr-[var(--space-3)] text-[var(--color-text-muted)]">{String(key)}</td>
              <td className="text-[var(--color-text-default)]">{String(val)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface ActivityFeedRow {
  actor: string;
  entity_iri: string;
  label: string;
  href: string;
  version_iri: string | null;
  created_at: string;
}

interface ActivityFeedPayload {
  rows: ActivityFeedRow[];
  truncated?: boolean;
  notice?: string;
}

/** PLAT-V1-TASK-024 AC-1/AC-2/AC-3: recent-edits collaboration feed --
 * `EntityRef`/`RelativeTime` molecules reused verbatim (never a raw IRI or
 * ISO string), draft is an icon+text badge (never colour alone, WCAG 1.4.1),
 * and a 410 re-baseline notice renders as a named-reason tile rather than a
 * silent empty list (`activity_feed.py::merge_newest_first` truncation).
 */
function ActivityFeedValue({ value }: { value: unknown }) {
  const payload = value as ActivityFeedPayload;
  const rows = payload?.rows ?? [];
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {payload?.notice && (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-raised)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {payload.notice}
        </p>
      )}
      <ul className="flex flex-col gap-[var(--space-2)]">
        {rows.map((row) => (
          <li key={`${row.entity_iri}-${row.created_at}`} className="flex items-center justify-between gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{row.actor}</span>
              <a href={row.href}>
                <EntityRef label={row.label} id={row.entity_iri} />
              </a>
              {row.version_iri === null && (
                <Badge variant="info" aria-label="Draft">
                  Draft
                </Badge>
              )}
            </div>
            <RelativeTime iso={row.created_at} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single source of "how does component_type X render this value" -- reused
 * by `WidgetTile` and the change-viz preview in `PromptBar` so switching
 * types never needs a second renderer table.
 */
export function renderWidgetValue(componentType: string, value: unknown) {
  if (componentType === "bar_chart") return <BarChartValue value={value as Record<string, number>} />;
  if (componentType === "table") return <TableValue value={value} />;
  if (componentType === "activity_feed") return <ActivityFeedValue value={value} />;
  return <KpiValue value={value} />;
}

/** AC-3/4/5/7: renders one widget per the honest-state matrix (ADR-013) --
 * `status` drives which body renders; this component never re-derives
 * status/pending from `last_result` itself (status.py's implementation
 * hint), it only inspects the payload shape to pick a renderer once a
 * body is known to be real data.
 */
export interface WidgetTileProps {
  widget: WidgetOut;
  style?: CSSProperties;
  /** AC-1/AC-2/AC-6: pin promotes a suggested tile / audits an explicit
   * pin; unpin removes a `scope=user` widget. Both omitted for read-only
   * (e.g. `tenant_default`) tiles. */
  onPin?: () => void;
  onUnpin?: () => void;
  /** AC-7: keyboard alternative to drag-reorder. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** TASK-015 AC-1: publish a pinned `scope='user'` widget to the tenant
   * library -- omitted for `tenant_default`/read-only tiles. */
  onPublish?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
}

/** Extracted from `WidgetTile` so the button-row conditionals don't push
 * the parent component over the complexity budget. */
function TileControls({
  title,
  onPin,
  onUnpin,
  onMoveUp,
  onMoveDown,
  onPublish,
  showPin,
}: {
  title: string;
  onPin?: () => void;
  onUnpin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPublish?: () => void;
  showPin: boolean;
}) {
  return (
    <div className="flex items-center gap-[var(--space-1)]">
      {onMoveUp && (
        <button type="button" aria-label={`Move ${title} up`} onClick={onMoveUp}>
          ↑
        </button>
      )}
      {onMoveDown && (
        <button type="button" aria-label={`Move ${title} down`} onClick={onMoveDown}>
          ↓
        </button>
      )}
      {onPin && showPin && (
        <button type="button" aria-label={`Pin ${title}`} onClick={onPin}>
          Pin
        </button>
      )}
      {onUnpin && (
        <button type="button" aria-label={`Unpin ${title}`} onClick={onUnpin}>
          Unpin
        </button>
      )}
      {onPublish && (
        <button type="button" aria-label={`Publish ${title} to library`} onClick={onPublish}>
          Publish
        </button>
      )}
    </div>
  );
}

export function WidgetTile({
  widget,
  style,
  onPin,
  onUnpin,
  onMoveUp,
  onMoveDown,
  onPublish,
  dragHandleProps,
}: WidgetTileProps) {
  const contracts = widget.spec.data_source_contracts.join(", ");

  return (
    <Card data-testid={`widget-tile-${widget.id}`} style={style} {...dragHandleProps}>
      <div className="flex items-start justify-between gap-[var(--space-2)]">
        <h3 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {widget.spec.title}
        </h3>
        <TileControls
          title={widget.spec.title}
          onPin={onPin}
          onUnpin={onUnpin}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onPublish={onPublish}
          showPin={widget.suggested}
        />
      </div>
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
          renderWidgetValue(widget.spec.component_type, widget.last_result)}
      </div>
      <footer className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        <span>{contracts}</span>
        {widget.status === "stale" && (
          <Badge variant="warn">{`Stale — last updated ${formatStaleTimestamp(widget.fetched_at)}`}</Badge>
        )}
      </footer>
    </Card>
  );
}
