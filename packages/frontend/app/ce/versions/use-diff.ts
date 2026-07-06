"use client";

import { useCallback, useState } from "react";

import type { DiffResult } from "./types";

export interface DiffState {
  diff: DiffResult | null;
  loading: boolean;
  error: boolean;
  notFound: boolean;
  load: (draftVersionIri: string) => void;
}

/** Draft-vs-published diffs always compare against the latest published
 * baseline (the "review changes" reading of a draft) -- there is no
 * baseline yet if nothing has been published (404), handled as notFound
 * rather than error. */
async function fetchDiff(draftVersionIri: string): Promise<{ diff: DiffResult | null; notFound: boolean }> {
  const response = await fetch(
    `/api/proxy/ontology/diff?from=latest&to=${encodeURIComponent(draftVersionIri)}`
  );
  if (response.status === 404) return { diff: null, notFound: true };
  if (!response.ok) throw new Error(`diff_failed_${response.status}`);
  return { diff: (await response.json()) as DiffResult, notFound: false };
}

/** Lazily loads a draft's diff against `latest` on demand (Review changes),
 * rather than fetching it for every row up front. */
export function useDiff(): DiffState {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback((draftVersionIri: string) => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    fetchDiff(draftVersionIri)
      .then((result) => {
        setDiff(result.diff);
        setNotFound(result.notFound);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { diff, loading, error, notFound, load };
}
