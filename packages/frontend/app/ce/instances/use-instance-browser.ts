"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildBrowseQuery } from "./build-browse-query";
import { useKindList } from "../use-kind-list";
import type { InstanceRow } from "./types";

interface BrowseApiResponse {
  rows?: Record<string, string>[];
  results?: { bindings?: Record<string, { value: string }>[] };
}

function rowsFromBinding(binding: Record<string, { value: string }>): InstanceRow {
  return {
    iri: binding.iri?.value ?? "",
    label: binding.label?.value ?? binding.iri?.value ?? "",
    kindIri: binding.kind?.value ?? "",
  };
}

function toInstanceRows(body: BrowseApiResponse): InstanceRow[] {
  if (body.rows) {
    return body.rows.map((row) => ({ iri: row.iri ?? "", label: row.label ?? row.iri ?? "", kindIri: row.kind ?? "" }));
  }
  return (body.results?.bindings ?? []).map(rowsFromBinding);
}

/** Split out of `useInstanceBrowser` (Law E, function-length budget): owns
 * the browse-query fetch + its loading/error/rows state only.
 */
function useBrowseRows(query: string) {
  const [rows, setRows] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Kicking off the fetch's loading state is the effect's whole job
    // here, same pattern as `use-kind-shape.ts`'s fetch-on-mount hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErrorMessage(undefined);
    fetch(`/api/sparql?${new URLSearchParams({ query, version: "latest" }).toString()}`)
      .then((res) => (res.ok ? (res.json() as Promise<BrowseApiResponse>) : Promise.reject(res)))
      .then((body) => {
        if (cancelled) return;
        setRows(toInstanceRows(body));
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("Could not load instances.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return { rows, loading, errorMessage };
}

/** AC-1/AC-2: fetches the kind catalogue (chip source) and a browse/search
 * page from CE-READ-1 `GET /api/sparql`, re-running whenever the search
 * term, active kind filter, or page changes. No kind filter active by
 * default, per AC-1.
 */
export function useInstanceBrowser() {
  const kinds = useKindList();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeKindFilter, setActiveKindFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => buildBrowseQuery({ kindIri: activeKindFilter, searchTerm, page }),
    [activeKindFilter, searchTerm, page]
  );
  const { rows, loading, errorMessage } = useBrowseRows(query);

  const toggleKindFilter = useCallback((iri: string) => {
    setActiveKindFilter((current) => (current === iri ? null : iri));
    setPage(1);
  }, []);

  const changeSearchTerm = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  return {
    kinds,
    rows,
    loading,
    errorMessage,
    searchTerm,
    setSearchTerm: changeSearchTerm,
    activeKindFilter,
    toggleKindFilter,
    page,
    setPage,
  };
}
