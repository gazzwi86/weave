"use client";

import { useEffect, useState } from "react";

import { paginate } from "../brand/queries";
import { policiesQuery, toPolicyRow, type PolicyRow } from "./policies-query";

interface SparqlResponseBody {
  rows: Record<string, string | undefined>[];
}

async function fetchPolicyRows(page: number): Promise<Record<string, string | undefined>[]> {
  const res = await fetch("/api/proxy/sparql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: policiesQuery(page) }),
  });
  if (!res.ok) throw new Error(`policies_list_failed_${res.status}`);
  const body = (await res.json()) as SparqlResponseBody;
  return body.rows;
}

export interface UsePoliciesResult {
  rows: PolicyRow[];
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}

/** Policies tab's card grid data source -- same "derived loading, no cache"
 * shape as brand/use-brand-list.ts. */
export function usePolicies(page: number): UsePoliciesResult {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPolicyRows(page)
      .then((bindings) => {
        if (cancelled) return;
        const { pageRows, hasMore: more } = paginate(bindings.map(toPolicyRow));
        setRows(pageRows);
        setHasMore(more);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadedPage(page);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return { rows, hasMore, loading: loadedPage !== page, error };
}
