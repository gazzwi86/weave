"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { type BpmoKind, KindChip } from "./KindChip";
import { EntityRef } from "./EntityRef";

const KNOWN_KINDS = new Set<BpmoKind>([
  "activity",
  "actor",
  "businesscapability",
  "businessdomain",
  "class",
  "concept",
  "dataasset",
  "event",
  "field",
  "goal",
  "policy",
  "process",
  "service",
  "system",
]);

/** Backend `kind` strings aren't guaranteed to be one of the 14 BPMO kinds
 * (grounded instances, not the ontology's own types) -- fall back to
 * "concept" rather than widen `KindChip`'s prop type. */
function toBpmoKind(kind: string): BpmoKind {
  const lower = kind.toLowerCase();
  return KNOWN_KINDS.has(lower as BpmoKind) ? (lower as BpmoKind) : "concept";
}

export interface TypeaheadResult {
  iri: string;
  label: string;
  kind: string;
}

export interface EntityPickerProps {
  id: string;
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  results: TypeaheadResult[];
  selected: TypeaheadResult[];
  onSelect: (entity: TypeaheadResult) => void;
  onRemove: (iri: string) => void;
  className?: string;
}

const FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

/** TASK-024 AC-2/AC-8: grounding-entity typeahead + removable-chip picker.
 * Composes the existing `EntityRef`/`KindChip` atoms rather than
 * hand-rolling entity presentation -- the atoms carry the kind
 * colour+glyph pairing (WCAG 1.4.1) and label-first identity convention.
 */
export function EntityPicker({
  id,
  label,
  query,
  onQueryChange,
  results,
  selected,
  onSelect,
  onRemove,
  className,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedIris = new Set(selected.map((e) => e.iri));

  return (
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <label
        htmlFor={id}
        className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
      >
        {label}
      </label>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-[var(--space-2)]" aria-label={`Selected ${label}`}>
          {selected.map((entity) => (
            <li key={entity.iri}>
              <span className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] border border-[var(--color-border)] p-[var(--space-1)]">
                <EntityRef label={entity.label} id={entity.iri} />
                <button
                  type="button"
                  aria-label={`Remove ${entity.label}`}
                  onClick={() => onRemove(entity.iri)}
                  className="text-[length:var(--text-body)] text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={FIELD_CLASS}
      />
      {open && results.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-2)]"
          aria-label={`${label} suggestions`}
        >
          {results
            .filter((entity) => !selectedIris.has(entity.iri))
            .map((entity) => (
              <li key={entity.iri}>
                <button
                  type="button"
                  onMouseDown={() => onSelect(entity)}
                  className="flex w-full items-center gap-[var(--space-2)] p-[var(--space-1)] text-left focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
                >
                  <KindChip kind={toBpmoKind(entity.kind)} label={entity.kind || "unknown"} />
                  <EntityRef label={entity.label} id={entity.iri} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
