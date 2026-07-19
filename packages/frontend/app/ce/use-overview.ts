"use client";

import { useEffect, useState } from "react";

import type { NodeKind } from "@/lib/explorer/types";

import { tallyTriples } from "./tally-triples";
import { fetchVersions } from "./versions/use-versions";
import { publishedEntriesDesc } from "./versions/version-page-helpers";
import type { VersionEntry } from "./versions/types";

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
