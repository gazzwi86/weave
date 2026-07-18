"use client";

import { Button } from "@/components/ui/button";

import { BrandRulesTable } from "./brand-rules-table";
import { StandardsCards } from "./standards-cards";
import type { BrandStandardRow, VoiceRuleRow } from "./types";
import { useBrandList } from "./use-brand-list";
import type { BrandKind, UseBrandListResult } from "./use-brand-list";

/** Owns the `useBrandList` fetch so the parent page can force a fresh list
 * after a commit/edit/delete just by changing this component's `key`
 * (React remounts it, re-running the hook's effect) -- no extra
 * cache-busting param needed on the hook itself.
 */
export function BrandListSection({
  kind,
  page,
  onPageChange,
  onEditStandard,
  onEditVoiceRule,
}: {
  kind: BrandKind;
  page: number;
  onPageChange: (page: number) => void;
  onEditStandard: (row: BrandStandardRow) => void;
  onEditVoiceRule: (row: VoiceRuleRow) => void;
}) {
  const list = useBrandList(kind, page);
  return (
    <BrandList
      kind={kind}
      list={list}
      page={page}
      onPageChange={onPageChange}
      onEditStandard={onEditStandard}
      onEditVoiceRule={onEditVoiceRule}
    />
  );
}

/** AC-004-03: current standards/brand-rules paginated at 50/page -- policy
 * cards for standards (prose content), a structured DataTable for brand
 * rules (rule id/severity/assertion). Each row's last-modified PROV-O
 * actor is shown next to it (honest "unknown" when this browser session
 * didn't create the item -- see `attribution.ts`).
 */
export function BrandList({
  kind,
  list,
  page,
  onPageChange,
  onEditStandard,
  onEditVoiceRule,
}: {
  kind: BrandKind;
  list: UseBrandListResult;
  page: number;
  onPageChange: (page: number) => void;
  onEditStandard: (row: BrandStandardRow) => void;
  onEditVoiceRule: (row: VoiceRuleRow) => void;
}) {
  if (list.error) return <p className="text-[var(--color-danger)]">Could not load {kind}s.</p>;
  if (list.loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {kind === "standard" ? (
        <StandardsCards
          rows={list.rows as BrandStandardRow[]}
          onEdit={onEditStandard}
          attributionFor={list.attributionFor}
        />
      ) : (
        <BrandRulesTable
          rows={list.rows as VoiceRuleRow[]}
          onEdit={onEditVoiceRule}
          attributionFor={list.attributionFor}
        />
      )}
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
