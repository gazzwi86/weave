import { cn } from "@/lib/utils";

import { Input } from "./input";

export interface EntityPickerOption {
  iri: string;
  label: string;
}

export interface EntityPickerProps {
  id: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  options: EntityPickerOption[];
  selected: EntityPickerOption | null;
  onSelect: (option: EntityPickerOption) => void;
  error?: boolean;
  className?: string;
}

/** AC-5: search-and-select control for an object-typed property (never a
 * free-text box) -- controlled/dumb, no fetch inside; the caller (app
 * layer) owns the typeahead request and passes `options` in. */
export function EntityPicker({
  id,
  searchTerm,
  onSearchChange,
  options,
  selected,
  onSelect,
  error,
  className,
}: EntityPickerProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={options.length > 0}
        error={error}
        value={selected ? selected.label : searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search entities..."
      />
      {options.length > 0 && (
        <ul className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {options.map((option) => (
            <li key={option.iri}>
              <button
                type="button"
                onClick={() => onSelect(option)}
                className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
