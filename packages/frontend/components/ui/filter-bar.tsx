import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SearchInput } from "./search-input";

export interface FilterChip {
  id: string;
  label: string;
  /** CSS colour value for the leading dot; omitted -> label-only chip (the
   * mock's "Relationships"/"+ 6 more" chips have no dot). */
  color?: string;
}

export interface FilterBarProps {
  chips: FilterChip[];
  activeIds: readonly string[];
  onToggle: (id: string) => void;
  /** Omit to render the bar without a leading SearchInput. */
  search?: { value: string; onChange: (value: string) => void; label: string; placeholder?: string };
  /** Right-aligned slot (mock's "Sort: instance count" label, etc). */
  trailing?: ReactNode;
  className?: string;
}

/** refit-mock.html `.filter-bar` -- SearchInput + a toggleable kind-chip
 * row. The mock's `.kchip.off` (opacity:.38) is a separate *excluded*
 * state toggled by its own JS, never the default unselected look (every
 * static `.kchip` instance in the mock markup is plain, undimmed) -- this
 * binary on/not-on component maps not-on to that plain look, not `.off`.
 * `.kchip.on` has no rule of its own there, so its accent-tinted look is
 * inferred from the sibling `.dock-tab.on`/`.toggle-sw.on` convention used
 * elsewhere in the mock. Props are a flat chip list today; a labelled
 * multi-field variant can wrap this later without changing FilterChip/
 * onToggle. */
export function FilterBar({ chips, activeIds, onToggle, search, trailing, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[var(--space-2)]", className)}>
      {search && (
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          label={search.label}
          placeholder={search.placeholder}
        />
      )}
      {chips.map((chip) => {
        const isOn = activeIds.includes(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(chip.id)}
            className={cn(
              "inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] border",
              "px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-medium)]",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-accent-primary)]",
              isOn
                ? "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-soft)] text-[var(--color-on-accent-soft)]"
                : "border-[var(--color-border-strong)] bg-[var(--color-raised)] text-[var(--color-text-muted)]"
            )}
          >
            {chip.color && (
              <span
                className="h-[var(--space-2)] w-[var(--space-2)] rounded-[var(--radius-full)]"
                style={{ background: chip.color }}
              />
            )}
            {chip.label}
          </button>
        );
      })}
      <div className="flex-1" />
      {trailing}
    </div>
  );
}
