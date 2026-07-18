"use client";

import { useState } from "react";

import type { Relationship } from "@/components/templates/RelationshipsEditorSlot";
import type { GlossaryBrowseRow } from "@/lib/glossary/types";

export interface GlossaryDrawerState {
  open: boolean;
  term: GlossaryBrowseRow | null;
  label: string;
  definition: string;
  rels: Relationship[];
  /** True once the user has actually added/removed a relationship chip --
   * lets the caller gap-toast only when it matters (see `page.tsx`'s
   * `REL_EDIT_GAP_TOAST`), not on every save. */
  relsChanged: boolean;
  /** A failed save's plain-language message, cleared on open/close (see
   * `EntityEditDrawer`'s `error` prop -- AC-002-04). */
  error: string | null;
  openNew: () => void;
  openEdit: (term: GlossaryBrowseRow, labels: Map<string, string>) => void;
  close: () => void;
  setLabel: (value: string) => void;
  setDefinition: (value: string) => void;
  setError: (message: string | null) => void;
  addRel: (predicate: string, target: string) => void;
  removeRel: (index: number) => void;
}

function chipLabel(iri: string, labels: Map<string, string>): string {
  return labels.get(iri) ?? iri.split(/[/#:]/).filter(Boolean).pop() ?? iri;
}

function seedRels(term: GlossaryBrowseRow, labels: Map<string, string>): Relationship[] {
  return [
    ...term.broaderIris.map((iri) => ({ predicate: "broader", target: chipLabel(iri, labels) })),
    ...term.narrowerIris.map((iri) => ({ predicate: "narrower", target: chipLabel(iri, labels) })),
  ];
}

/** Assembles the hook's return value (kept out of `useGlossaryDrawer` for
 * the Law E line budget -- same pattern as `page.tsx`'s `build*` helpers). */
function buildDrawerState(
  state: { open: boolean; term: GlossaryBrowseRow | null; label: string; definition: string; rels: Relationship[]; error: string | null },
  actions: Pick<GlossaryDrawerState, "openNew" | "openEdit" | "close" | "setLabel" | "setDefinition" | "setError" | "addRel" | "removeRel">,
  relsChanged: boolean
): GlossaryDrawerState {
  return { ...state, relsChanged, ...actions };
}

/** Local edit-drawer draft state for the Glossary page. Kept out of
 * `page.tsx` to hold the page component under the Law E function-size
 * budget. Relationship chip add/remove only ever mutates this local draft
 * -- there is no target-IRI resolver for the `RelationshipsEditor`'s
 * free-text entry (it would need a term-search typeahead this refit
 * doesn't build), so persisting an edge is out of scope; `relsChanged`
 * lets `page.tsx` gap-toast that honestly instead of silently dropping
 * the edit. */
export function useGlossaryDrawer(): GlossaryDrawerState {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<GlossaryBrowseRow | null>(null);
  const [label, setLabel] = useState("");
  const [definition, setDefinition] = useState("");
  const [rels, setRels] = useState<Relationship[]>([]);
  const [initialRels, setInitialRels] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setTerm(null);
    setLabel("");
    setDefinition("");
    setRels([]);
    setInitialRels([]);
    setError(null);
    setOpen(true);
  };

  const openEdit = (target: GlossaryBrowseRow, labels: Map<string, string>) => {
    const seeded = seedRels(target, labels);
    setTerm(target);
    setLabel(target.prefLabel);
    setDefinition(target.definition ?? "");
    setRels(seeded);
    setInitialRels(seeded);
    setError(null);
    setOpen(true);
  };

  const close = () => {
    setError(null);
    setOpen(false);
  };
  const addRel = (predicate: string, targetLabel: string) => setRels((prev) => [...prev, { predicate, target: targetLabel }]);
  const removeRel = (index: number) => setRels((prev) => prev.filter((_, i) => i !== index));

  const relsChanged = JSON.stringify(rels) !== JSON.stringify(initialRels);

  return buildDrawerState(
    { open, term, label, definition, rels, error },
    { openNew, openEdit, close, setLabel, setDefinition, setError, addRel, removeRel },
    relsChanged
  );
}
