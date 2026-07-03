import { Command } from "cmdk";

import type { SearchResult } from "./use-entity-search";

/** One entity row in the command palette: label + kind (AC-3). */
export function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (iri: string) => void;
}) {
  return (
    <Command.Item
      value={result.iri}
      onSelect={() => onSelect(result.iri)}
      className="flex cursor-pointer items-center gap-[var(--space-2)] rounded-[var(--radius-base)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] aria-selected:bg-[var(--color-hover)]"
    >
      <span>{result.label}</span>
      <span className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        {result.kind}
      </span>
    </Command.Item>
  );
}
