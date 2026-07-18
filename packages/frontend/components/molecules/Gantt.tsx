import { cn } from "@/lib/utils";

export type GanttStatus = "done" | "active" | "future";

export interface GanttRow {
  id: string;
  label: string;
  status: GanttStatus;
  /** Text inside the bar -- carries the status meaning, not colour alone
   * (WCAG 1.4.1). */
  statusLabel: string;
  /** Bar position/width as a 0-100 percentage of the track -- per-instance
   * data, not a design token (mirrors FilterForm's `width` prop). */
  startPct: number;
  widthPct: number;
}

export interface GanttProps {
  /** Six column headers over the track area (refit-mock.html's fixed
   * `--size-gantt-label`-label + 6-column scale). */
  scaleLabels: string[];
  rows: GanttRow[];
  /** "Today" vertical line position, 0-100 percentage of the track. */
  todayPct: number;
  className?: string;
}

const BAR_STATUS_CLASS: Record<GanttStatus, string> = {
  done: "bg-[var(--color-success)] text-[var(--color-bg)]",
  active: "bg-[var(--color-accent-primary)] text-[var(--color-bg)]",
  future: "bg-[var(--color-border-strong)] text-[var(--color-text-muted)]",
};

function GanttScale({ scaleLabels }: { scaleLabels: string[] }) {
  return (
    <div
      className="mb-[var(--space-2)] grid grid-cols-[var(--size-gantt-label)_repeat(6,1fr)] gap-0 border-b border-[var(--color-border)] pb-[var(--space-2)] text-[length:var(--text-caption)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase"
    >
      <span />
      {scaleLabels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

function GanttRowView({ row, todayPct }: { row: GanttRow; todayPct: number }) {
  return (
    <div className="mb-[var(--space-2)] grid grid-cols-[var(--size-gantt-label)_1fr] items-center gap-0">
      <span className="truncate pr-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        {row.label}
      </span>
      <div className="relative h-[var(--space-4)] rounded-[var(--radius-sm)] bg-[var(--color-overlay)]">
        <div
          data-testid={`gantt-bar-${row.id}`}
          className={cn(
            // ponytail: mock's bar label is smaller than any type-scale step
            // (--text-caption is the smallest) -- nearest token wins.
            "absolute top-[var(--space-1)] bottom-[var(--space-1)] flex items-center overflow-hidden rounded-[var(--radius-sm)] px-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] whitespace-nowrap",
            BAR_STATUS_CLASS[row.status]
          )}
          style={{ left: `${row.startPct}%`, width: `${row.widthPct}%` }}
        >
          {row.statusLabel}
        </div>
        <div
          data-testid="gantt-today-line"
          aria-hidden="true"
          className="absolute -top-[var(--space-1)] -bottom-[var(--space-1)] w-0.5 rounded-[var(--radius-sm)] bg-[var(--color-danger)]"
          style={{ left: `${todayPct}%` }}
        />
      </div>
    </div>
  );
}

/** refit-mock.html `.gantt`/`.gantt-scale`/`.gantt-row`/`.gbar`/
 * `.gantt-today` -- fixed label column + 6-column week scale, one
 * track per row with a status-coloured bar and a shared "today" line. */
export function Gantt({ scaleLabels, rows, todayPct, className }: GanttProps) {
  return (
    <div className={cn("mt-[var(--space-1)]", className)}>
      <GanttScale scaleLabels={scaleLabels} />
      {rows.map((row) => (
        <GanttRowView key={row.id} row={row} todayPct={todayPct} />
      ))}
    </div>
  );
}
