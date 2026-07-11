import Link from "next/link";

import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface BarChartSeries {
  /** Series label (e.g. a period like "2026-07"). */
  label: string;
  /** One value per `categories` entry, same order/length. */
  values: number[];
}

export interface BarChartProps {
  categories: string[];
  series: BarChartSeries[];
  /** Per-category drill-in link (AC-3) -- omit to render a plain label. */
  hrefFor?: (category: string) => string;
  className?: string;
}

const SERIES_TONE = ["bg-[var(--color-border)]", "bg-[var(--color-accent-primary)]"];

/** One category's grouped bar segments, one per series, sized against the
 * shared max across the whole chart (so segments are visually comparable). */
function CategoryRow({
  category,
  values,
  max,
  hrefFor,
}: {
  category: string;
  values: number[];
  max: number;
  hrefFor?: (category: string) => string;
}) {
  return (
    <li className="flex items-center gap-[var(--space-3)]">
      <span className="w-28 shrink-0 truncate text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        {hrefFor ? (
          <Link href={hrefFor(category)} className="hover:text-[var(--color-accent-hover)]">
            {category}
          </Link>
        ) : (
          category
        )}
      </span>
      <div className="flex flex-1 flex-col gap-[var(--space-1)]">
        {values.map((value, index) => (
          <span
            key={index}
            data-testid="bar-chart-segment"
            className={cn("h-[var(--space-3)] rounded-[var(--radius-sm)]", SERIES_TONE[index % SERIES_TONE.length])}
            style={{ width: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <span className="w-10 shrink-0 text-right text-[length:var(--text-body-sm)] font-[var(--font-mono)] tabular-nums text-[var(--color-text-default)]">
        {values.at(-1)}
      </span>
    </li>
  );
}

/** Grouped horizontal bar chart -- one row per category, one bar segment
 * per series (e.g. previous vs current period), flat surface (`components.md`
 * "Glass vs flat": charts stay flat, glass is reserved for overlays/canvas). */
export function BarChart({ categories, series, hrefFor, className }: BarChartProps) {
  if (series.length === 0 || categories.length === 0) {
    return <EmptyState message="No data yet -- nothing to compare against." className={className} />;
  }

  const max = Math.max(1, ...series.flatMap((s) => s.values));

  return (
    <ul data-testid="bar-chart" className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      {categories.map((category, categoryIndex) => (
        <CategoryRow
          key={category}
          category={category}
          values={series.map((s) => s.values[categoryIndex] ?? 0)}
          max={max}
          hrefFor={hrefFor}
        />
      ))}
    </ul>
  );
}
