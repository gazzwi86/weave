import { useEffect, useState } from "react";

export interface SearchResult {
  iri: string;
  label: string;
  kind: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export const MIN_QUERY_LENGTH = 2;

/** AC-3: fetches `/api/search` once `query` clears the minimum length,
 * aborting the in-flight request if `query` changes again first. Below the
 * threshold, results are derived (not set) so the effect never calls
 * setState synchronously in its own body -- only from the fetch's resolved
 * callback, which react-hooks/set-state-in-effect allows.
 */
export function useEntitySearch(query: string): SearchResult[] {
  const [fetched, setFetched] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<SearchResponse>) : null))
      .then((data) => setFetched(data?.results ?? []))
      .catch(() => setFetched([]));
    return () => controller.abort();
  }, [query]);

  return query.length < MIN_QUERY_LENGTH ? [] : fetched;
}
