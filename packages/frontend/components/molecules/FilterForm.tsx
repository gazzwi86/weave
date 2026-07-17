import { cn } from "@/lib/utils";

import { Button } from "../ui/button";

export interface FilterFormFieldOption {
  value: string;
  label: string;
}

export interface FilterFormField {
  id: string;
  label: string;
  type: "text" | "select" | "date";
  value: string;
  onChange: (value: string) => void;
  /** Required when `type` is `"select"`. */
  options?: FilterFormFieldOption[];
  placeholder?: string;
  /** Field column width as a raw CSS length string, or `"1"` for `flex:1`
   * -- mirrors refit-mock.html's per-field inline widths (caller's choice,
   * not a token -- these are one-off layout widths, not design values). */
  width?: string;
}

export interface FilterFormProps {
  fields: FilterFormField[];
  onApply: () => void;
  onReset: () => void;
  className?: string;
}

const FIELD_INPUT_CLASS =
  "h-[var(--space-6)] rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] px-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] focus:border-[var(--color-accent-primary)] focus:shadow-[0_0_0_3px_var(--color-accent-soft)]";

function FilterFormFieldInput({ field }: { field: FilterFormField }) {
  const inputId = `ff-field-${field.id}`;
  if (field.type === "select") {
    return (
      <select
        id={inputId}
        className={FIELD_INPUT_CLASS}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
      >
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      id={inputId}
      type={field.type}
      className={FIELD_INPUT_CLASS}
      value={field.value}
      placeholder={field.placeholder}
      onChange={(event) => field.onChange(event.target.value)}
    />
  );
}

function FilterFormFieldGroup({ field }: { field: FilterFormField }) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-1)]" style={field.width ? { width: field.width } : undefined}>
      <label
        htmlFor={`ff-field-${field.id}`}
        className="text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase"
      >
        {field.label}
      </label>
      <FilterFormFieldInput field={field} />
    </div>
  );
}

/** refit-mock.html `.filter-form`/`.ff-field`/`.ff-actions` -- a labelled
 * multi-field variant sitting alongside `FilterBar` (its docstring already
 * anticipates this wrapper; `FilterChip`/`onToggle` are untouched). */
export function FilterForm({ fields, onApply, onReset, className }: FilterFormProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)]",
        "bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)]",
        className
      )}
    >
      {fields.map((field) => (
        <FilterFormFieldGroup key={field.id} field={field} />
      ))}
      <div className="ml-auto flex items-end gap-[var(--space-2)]">
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
        <Button type="button" variant="primary" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
