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
const DEBOUNCE_MS = 250;

export interface EntitySearchState {
  results: SearchResult[];
  /** True when the last settled search failed (network/upstream error) --
   * distinct from a real empty-results response (PR #13 finding 4). */
  error: boolean;
}

/** AC-3: fetches `/api/search` ~DEBOUNCE_MS after `query` settles at/above
 * the minimum length (PR #13 finding 2 -- one fetch per settled search, not
 * one per keystroke), aborting the in-flight request if `query` changes
 * again first. A stale response or the abort of a superseded request can
 * never overwrite fresher results or surface as an error (PR #13 finding 3)
 * -- both are guarded by `controller.signal.aborted`. Below the threshold,
 * results/error are derived (not set) so the effect never calls setState
 * synchronously in its own body -- only from the fetch's resolved callback,
 * which react-hooks/set-state-in-effect allows.
 */
export function useEntitySearch(query: string): EntitySearchState {
  const [fetched, setFetched] = useState<SearchResult[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) {
            throw new Error("search_failed");
          }
          return res.json() as Promise<SearchResponse>;
        })
        .then((data) => {
          if (controller.signal.aborted) {
            return;
          }
          setFetched(data.results);
          setError(false);
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }
          setError(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (query.length < MIN_QUERY_LENGTH) {
    return { results: [], error: false };
  }
  return { results: fetched, error };
}
