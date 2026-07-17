"use client";

import { cn } from "@/lib/utils";

import { type BpmoKind, KindChip } from "../molecules/KindChip";
import { Button } from "../ui/button";
import { SearchInput } from "../ui/search-input";
import { ModalShell } from "./ModalShell";

export interface EntityPickerOption {
  id: string;
  label: string;
  kind: BpmoKind;
  kindLabel: string;
}

export interface EntityPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  /** Already filtered by the caller against `search.value` -- this
   * component is purely presentational, same convention as FilterBar. */
  options: EntityPickerOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  search: { value: string; onChange: (value: string) => void };
  title?: string;
}

function PickerRow({
  option,
  selected,
  onToggle,
}: {
  option: EntityPickerOption;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onToggle(option.id)}
      className={cn(
        "flex w-full items-center gap-[var(--space-2)] border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]",
        "text-left text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] transition-colors last:border-b-0",
        "hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
        selected && "bg-[var(--color-accent-primary)]/10 text-[var(--color-text-default)]"
      )}
    >
      {option.label}
      <KindChip kind={option.kind} label={option.kindLabel} className="ml-auto" />
    </button>
  );
}

/** refit-mock.html `.modal .picker-list`/`.picker-row` -- ModalShell +
 * SearchInput + a multi-select list, controlled entirely by the caller
 * (options/selectedIds/search.value are all props in, callbacks out). */
export function EntityPickerModal({
  open,
  onClose,
  onConfirm,
  options,
  selectedIds,
  onToggle,
  search,
  title = "Select entities",
}: EntityPickerModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} size="md">
      <h4 className="mb-[var(--space-2)] text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {title}
      </h4>
      <SearchInput value={search.value} onChange={search.onChange} label="Search entities" />
      <div
        role="listbox"
        aria-multiselectable="true"
        className="my-[var(--space-3)] max-h-[var(--size-picker-list-max)] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-border)]"
      >
        {options.map((option) => (
          <PickerRow key={option.id} option={option} selected={selectedIds.includes(option.id)} onToggle={onToggle} />
        ))}
      </div>
      <div className="flex justify-end gap-[var(--space-2)]">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onConfirm(selectedIds)}>
          Confirm
        </Button>
      </div>
    </ModalShell>
  );
}
