import { cn } from "@/lib/utils";

import { Icon } from "./icon";

export interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  pageCount: number;
  /** Precomputed range copy (e.g. "Showing 1–8 of 23") -- Pagination stays
   * presentational, it doesn't own pageSize/total-count math. */
  rangeLabel: string;
  onPageChange: (page: number) => void;
  className?: string;
}

const PAGE_BTN =
  "flex h-[var(--space-5)] min-w-[var(--space-5)] items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] disabled:pointer-events-none disabled:opacity-40";

/** Collapses a long page run to first/last + a window around the current
 * page, "ellipsis" filling any gap -- mirrors refit-mock.html's `.pages`
 * intent (it only ever shows 3 pages, this generalises to N). */
function pageRange(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const kept = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...kept].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let previous: number | undefined;
  for (const p of sorted) {
    if (previous !== undefined && p - previous > 1) out.push("ellipsis");
    out.push(p);
    previous = p;
  }
  return out;
}

interface PageEntryProps {
  entry: number | "ellipsis";
  current: number;
  onPageChange: (page: number) => void;
}

function PageEntry({ entry, current, onPageChange }: PageEntryProps) {
  if (entry === "ellipsis") {
    return (
      <span className="flex h-[var(--space-5)] min-w-[var(--space-5)] items-center justify-center">…</span>
    );
  }
  return (
    <button
      type="button"
      aria-current={entry === current ? "page" : undefined}
      onClick={() => onPageChange(entry)}
      className={cn(
        PAGE_BTN,
        entry === current &&
          "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-soft)] font-[var(--font-weight-semibold)] text-[var(--color-on-accent-soft)]"
      )}
    >
      {entry}
    </button>
  );
}

/** refit-mock.html `.pagination`/`.page-btn`. */
export function Pagination({ page, pageCount, rangeLabel, onPageChange, className }: PaginationProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[var(--space-1)] border-t border-[var(--color-border)]",
        "px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-label)] text-[var(--color-text-subtle)]",
        className
      )}
    >
      <span>{rangeLabel}</span>
      <div className="ml-auto flex gap-[var(--space-1)]">
        <button
          type="button"
          aria-label="Previous"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={PAGE_BTN}
        >
          <Icon name="chevron-left" size={12} />
        </button>
        {pageRange(page, pageCount).map((entry, i) => (
          <PageEntry key={`${entry}-${i}`} entry={entry} current={page} onPageChange={onPageChange} />
        ))}
        <button
          type="button"
          aria-label="Next"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={PAGE_BTN}
        >
          <Icon name="chevron-right" size={12} />
        </button>
      </div>
    </div>
  );
}
