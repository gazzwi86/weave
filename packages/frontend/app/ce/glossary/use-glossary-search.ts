"use client";

import { useCallback, useState } from "react";

import { fetchGlossarySearch } from "@/lib/glossary/fetch-glossary-search";
import type { GlossaryTermRow } from "@/lib/glossary/types";

const TIMEOUT_MS = 5000;

export interface GlossarySearchState {
  query: string;
  setQuery: (value: string) => void;
  results: GlossaryTermRow[];
  searched: boolean;
  loading: boolean;
  error: boolean;
  search: () => Promise<void>;
}

/** AC-002-01/-02: runs the CE-READ-1 tri-field search query on demand
 * (never on every keystroke). `searched` distinguishes "not searched yet"
 * from "searched, zero rows" so the empty-state create affordance only
 * renders after an actual zero-result search. */
export function useGlossarySearch(): GlossarySearchState {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlossaryTermRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const search = useCallback(async () => {
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setError(false);
    const result = await fetchGlossarySearch(term, TIMEOUT_MS);
    if (result.type === "ok") {
      setResults(result.rows);
    } else {
      setResults([]);
      setError(true);
    }
    setSearched(true);
    setLoading(false);
  }, [query]);

  return { query, setQuery, results, searched, loading, error, search };
}
