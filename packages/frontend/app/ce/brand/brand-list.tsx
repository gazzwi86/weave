"use client";

import { Button } from "@/components/ui/button";

import { useBrandList } from "./use-brand-list";
import type { BrandKind, UseBrandListResult } from "./use-brand-list";

function rowLabel(row: UseBrandListResult["rows"][number]): string {
  return "contentType" in row ? row.contentType : row.ruleId;
}

/** Owns the `useBrandList` fetch so the parent page can force a fresh list
 * after a commit just by changing this component's `key` (React remounts it,
 * re-running the hook's effect) -- no extra cache-busting param needed on
 * the hook itself.
 */
export function BrandListSection({
  kind,
  page,
  onPageChange,
}: {
  kind: BrandKind;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const list = useBrandList(kind, page);
  return <BrandList kind={kind} list={list} page={page} onPageChange={onPageChange} />;
}

/** AC-004-03: current standards/voice-rules paginated at 50/page, each row's
 * last-modified PROV-O actor shown next to it (honest "unknown" when this
 * browser session didn't create the item -- see `attribution.ts`).
 */
export function BrandList({
  kind,
  list,
  page,
  onPageChange,
}: {
  kind: BrandKind;
  list: UseBrandListResult;
  page: number;
  onPageChange: (page: number) => void;
}) {
  if (list.error) return <p className="text-[var(--color-danger)]">Could not load {kind}s.</p>;
  if (list.loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  if (list.rows.length === 0) return <p className="text-[var(--color-text-muted)]">No {kind}s yet.</p>;

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <ul data-testid={`${kind}-list`} className="flex flex-col">
        {list.rows.map((row) => {
          const attribution = list.attributionFor(row.iri);
          return (
            <li
              key={row.iri}
              className="flex items-center justify-between gap-[var(--space-3)] border-b border-[var(--color-border)] py-[var(--space-2)]"
            >
              <span className="text-[var(--color-text-default)]">{rowLabel(row)}</span>
              <span className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
                {attribution ? `${attribution.actorIri} · ${new Date(attribution.committedAt).toLocaleString()}` : "unknown actor"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-[var(--space-2)]">
        <Button variant="secondary" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!list.hasMore} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
