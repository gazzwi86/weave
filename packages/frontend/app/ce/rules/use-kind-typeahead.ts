"use client";

import { useEffect, useState } from "react";

import type { EntityPickerOption } from "@/components/templates/EntityPickerPage";

type BpmoKind = EntityPickerOption["kind"];

const KNOWN_KINDS: ReadonlySet<BpmoKind> = new Set([
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

interface TypeaheadApiEntity {
  iri: string;
  label: string;
  kind: string;
}

interface TypeaheadApiResponse {
  results?: TypeaheadApiEntity[];
}

// ponytail: no established kind->label formatter exists in the codebase
// yet (grepped for kindLabel/KIND_LABEL) -- capitalize-first-letter matches
// EntityPickerModal.stories.tsx's own convention ("process" -> "Process").
function kindLabel(kind: BpmoKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

// Backend's `_local_kind()` (ce_read.py) lowercases the RDF type IRI's last
// segment and can return "" when an entity has no bound type -- fall back to
// "concept" (the generic node glyph) rather than crashing KindChip on an
// unrecognized string.
function toBpmoKind(rawKind: string): BpmoKind {
  return KNOWN_KINDS.has(rawKind as BpmoKind) ? (rawKind as BpmoKind) : "concept";
}

function toOption(entity: TypeaheadApiEntity): EntityPickerOption {
  const kind = toBpmoKind(entity.kind);
  return { id: entity.iri, label: entity.label, kind, kindLabel: kindLabel(kind) };
}

/** Policies-tab attach picker's data source: same `GET
 * /api/ontology/entities/typeahead?q=` + 200ms-debounce shape as
 * `instances/use-typeahead.ts`, but surfaces the backend's `kind` field
 * (already returned, just unused by the simpler single-select hook) so
 * `EntityPickerModal` can render a kind glyph per option (WCAG 1.4.1 --
 * colour is never the only carrier of meaning).
 */
export function useKindTypeahead(query: string): EntityPickerOption[] {
  const [options, setOptions] = useState<EntityPickerOption[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/ontology/entities/typeahead?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? (res.json() as Promise<TypeaheadApiResponse>) : null))
        .then((body) => {
          if (!cancelled) setOptions((body?.results ?? []).map(toOption));
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return options;
}
