"use client";

import { useEffect, useState } from "react";

import type { NodeKind, SparqlPage } from "@/lib/explorer/types";

import { fetchVersions } from "./versions/use-versions";
import { publishedEntriesDesc } from "./versions/version-page-helpers";
import type { VersionEntry } from "./versions/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const ONTOLOGY_PREFIX = "https://weave.io/ontology/";
/** Sane cap on CE-READ-1 pages pulled for a stats read (fetch-graph.ts
 * bounds by node count instead; a count-only page needs far less). */
const MAX_PAGES = 10;
/** Widget only has room for a handful of rows -- the Versions page is the
 * full timeline. */
const RECENT_VERSIONS_LIMIT = 3;

export interface OverviewStats {
  kinds: NodeKind[];
  /** Instance count per kind id, from rdf:type triples. */
  countsByKind: Record<string, number>;
  totalInstances: number;
  totalTriples: number;
  /** Latest published ontology version, or null when none/unavailable. */
  publishedSemver: string | null;
  /** Newest-first published versions, capped for the widget -- empty when
   * unavailable (fail-soft, not a page-wide error). */
  recentVersions: VersionEntry[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`overview_fetch_failed_${response.status}`);
  return (await response.json()) as T;
}

/** Pages CE-READ-1 triples, tallying rdf:type instances per BPMO kind. */
async function tallyTriples(): Promise<{
  countsByKind: Record<string, number>;
  totalTriples: number;
}> {
  const countsByKind: Record<string, number> = {};
  let totalTriples = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`/api/proxy/sparql?version=latest&page=${page}`);
    // A workspace with no published version yet 404s on `latest` -- that is
    // an EMPTY model, not a failure (fresh workspace after a switch).
    if (response.status === 404) break;
    if (!response.ok) throw new Error(`overview_fetch_failed_${response.status}`);
    const data = (await response.json()) as SparqlPage;
    totalTriples += data.rows.length;
    for (const row of data.rows) {
      if (row.predicate !== RDF_TYPE || !row.object.startsWith(ONTOLOGY_PREFIX)) continue;
      const kindId = row.object.slice(ONTOLOGY_PREFIX.length);
      countsByKind[kindId] = (countsByKind[kindId] ?? 0) + 1;
    }
    if (!data.has_more_pages) break;
  }
  return { countsByKind, totalTriples };
}

/** Fail-soft: the version widgets are optional, so an unavailable version
 * list degrades to "nothing shown" rather than an overview-wide error. */
async function fetchPublishedVersions(): Promise<VersionEntry[]> {
  try {
    return publishedEntriesDesc(await fetchVersions());
  } catch {
    return [];
  }
}

async function fetchStats(): Promise<OverviewStats> {
  const [{ kinds }, { countsByKind, totalTriples }, published] = await Promise.all([
    fetchJson<{ kinds: NodeKind[] }>("/api/proxy/node-kinds"),
    tallyTriples(),
    fetchPublishedVersions(),
  ]);
  const totalInstances = Object.values(countsByKind).reduce((sum, n) => sum + n, 0);
  return {
    kinds,
    countsByKind,
    totalInstances,
    totalTriples,
    publishedSemver: published[0]?.semver ?? null,
    recentVersions: published.slice(0, RECENT_VERSIONS_LIMIT),
  };
}

/** Fetches the "model at a glance" stats once on mount. */
export function useOverview(): { stats: OverviewStats | null; loadError: boolean } {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loadError };
}
