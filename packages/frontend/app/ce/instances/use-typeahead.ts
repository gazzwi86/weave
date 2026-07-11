"use client";

import { useEffect, useState } from "react";

import type { EntityPickerOption } from "@/components/ui/entity-picker";

interface TypeaheadApiResponse {
  results?: { iri: string; label: string }[];
}

/** AC-5: backs an `EntityPicker` with CE-READ-1's
 * `GET /api/ontology/entities/typeahead?q=` -- debounced by a plain
 * effect-cleanup cancel (no extra dependency for a single short delay).
 */
export function useTypeahead(query: string): EntityPickerOption[] {
  const [options, setOptions] = useState<EntityPickerOption[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      // Clearing stale options for a too-short query is the effect's job.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/ontology/entities/typeahead?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? (res.json() as Promise<TypeaheadApiResponse>) : null))
        .then((body) => {
          if (!cancelled) setOptions(body?.results ?? []);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return options;
}
