"use client";

import { useState } from "react";

import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { Input } from "../ui/input";

export interface Relationship {
  predicate: string;
  target: string;
}

export interface RelationshipsEditorProps {
  rels: Relationship[];
  onAdd: (predicate: string, target: string) => void;
  onRemove: (index: number) => void;
  /** Set when a caller (e.g. EntityEditDrawer) already renders its own
   * "Relationships" section label -- suppresses this component's internal
   * one so the field doesn't show the label twice. */
  hideLabel?: boolean;
}

const PREDICATES = ["related to", "broader", "narrower", "governs", "uses"];

function RelChip({ rel, onRemove }: { rel: Relationship; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] border border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 py-[var(--space-1)] pr-[var(--space-1)] pl-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-default)]">
      {rel.predicate} · {rel.target}
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="flex items-center justify-center p-0 text-[var(--color-accent-primary)]"
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}

/** refit-mock.html `.rel-editor`/`.fchip`/`#drawer-rels` -- chip row of
 * existing relationships plus a predicate-select + entity-text add row.
 * Fully controlled: the caller owns `rels`, this only renders it and
 * reports intent (`onAdd`/`onRemove`). The add-row's own draft
 * predicate/target is local UI state, not lifted -- nothing outside this
 * component needs it mid-typing. */
export function RelationshipsEditor({ rels, onAdd, onRemove, hideLabel }: RelationshipsEditorProps) {
  const [predicate, setPredicate] = useState<string>(PREDICATES[0]!);
  const [target, setTarget] = useState("");

  function handleAdd() {
    if (!target.trim()) return;
    onAdd(predicate, target);
    setTarget("");
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {hideLabel ? null : (
        <label className="text-[length:var(--text-caption)] font-[var(--font-weight-medium)] text-[var(--color-text-muted)]">
          Relationships
        </label>
      )}
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {rels.map((rel, index) => (
          <RelChip key={`${rel.predicate}-${rel.target}-${index}`} rel={rel} onRemove={() => onRemove(index)} />
        ))}
      </div>
      <div className="flex gap-[var(--space-2)]">
        <select
          aria-label="Relationship predicate"
          value={predicate}
          onChange={(event) => setPredicate(event.target.value)}
          className="shrink-0 rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
        >
          {PREDICATES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Input
          placeholder="Type to find an entity or term…"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="flex-1"
        />
        <Button variant="ghost" onClick={handleAdd}>
          <Icon name="plus" size={12} />
          Add
        </Button>
      </div>
      <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Links live in the graph — they appear on the canvas and in queries immediately.
      </span>
    </div>
  );
}
