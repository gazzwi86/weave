"use client";

import { useEffect, useState } from "react";

export interface ProjectCard {
  project_iri: string;
  name: string;
  created_at: string;
  lifecycle_phase: "Speccing" | "Building" | "Live monitoring" | "Archived";
  owner_iri: string | null;
}

export interface GridFilters {
  search: string;
  lifecyclePhase: string;
}

export const EMPTY_FILTERS: GridFilters = { search: "", lifecyclePhase: "" };

interface GridPage {
  items: ProjectCard[];
  nextCursor: string | null;
}

function toQuery(filters: GridFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.lifecyclePhase) params.set("lifecycle_phase", filters.lifecyclePhase);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export interface ProjectGridState {
  /** null while a fetch (initial or filter-change) is in flight. */
  page: GridPage | null;
  loadError: boolean;
}

/** Fetches the Registry grid page (AC-1), refetching whenever the filter
 * bar changes -- filters are forwarded to the backend's keyset-paginated
 * `GET /api/projects`, never filtered client-side. `page === null` is the
 * loading state (same nullable-until-loaded shape as `useWorkspaceList`). */
export function useProjectGrid(filters: GridFilters): ProjectGridState {
  const [page, setPage] = useState<GridPage | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/build/projects${toQuery(filters)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("grid_load_failed");
        return res.json() as Promise<{ items: ProjectCard[]; next_cursor: string | null }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPage({ items: data.items, nextCursor: data.next_cursor });
        setLoadError(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, [filters.search, filters.lifecyclePhase]);

  return { page, loadError };
}
