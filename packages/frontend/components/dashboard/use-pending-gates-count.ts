"use client";

import { useEffect, useState } from "react";

// ponytail: G12's pending-gates read is per-project -- there's no
// cross-workspace rollup endpoint yet, so this fans out one fetch per
// project in the caller's workspace and sums client-side. Capped so a
// large workspace can't fire an unbounded burst; a backend rollup
// endpoint (aggregate G12 by workspace) is the real fix if this cap
// ever bites.
const MAX_PROJECTS = 20;

interface ProjectListResponse {
  items: { project_iri: string }[];
}

interface PendingGatesResponse {
  gates: unknown[];
}

async function fetchProjectIris(): Promise<string[]> {
  const response = await fetch("/api/build/projects");
  if (!response.ok) throw new Error("project_list_failed");
  const body = (await response.json()) as ProjectListResponse;
  return body.items.slice(0, MAX_PROJECTS).map((item) => item.project_iri);
}

async function fetchGateCount(projectIri: string): Promise<number> {
  const response = await fetch(`/api/build/projects/${encodeURIComponent(projectIri)}/gates`);
  if (!response.ok) throw new Error("gates_failed");
  const body = (await response.json()) as PendingGatesResponse;
  return body.gates.length;
}

export interface PendingGatesCountState {
  count: number | null;
  loading: boolean;
}

/** H4: dashboard "Needs you" review-gates row. Aggregates G12's
 * per-project pending-gates feed across the workspace's projects
 * (`/api/build/projects`, same list `useCurrentBuildProject` reads).
 * Fails soft at every level -- a project-list failure or an individual
 * project's gates failure both degrade the count rather than the whole
 * row erroring. */
export function usePendingGatesCount(): PendingGatesCountState {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      let total = 0;
      try {
        const projectIris = await fetchProjectIris();
        const results = await Promise.allSettled(projectIris.map(fetchGateCount));
        total = results.reduce((sum, result) => (result.status === "fulfilled" ? sum + result.value : sum), 0);
      } catch {
        total = 0;
      }
      if (!cancelled) {
        setCount(total);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading };
}
