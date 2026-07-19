"use client";

import { useCallback, useEffect, useState } from "react";

import type { VersionEntry } from "./types";

interface VersionsResponse {
  versions: VersionEntry[];
}

export type PublishOutcome = "published" | "already_published" | "forbidden" | "not_found" | "unavailable";

export interface VersionsState {
  versions: VersionEntry[];
  loading: boolean;
  error: boolean;
  publish: (versionIri: string) => Promise<PublishOutcome>;
}

/** Shared with `useOverview` -- both consumers must tolerate CE-READ-1's
 * bare-array response as well as the `{ versions }` envelope (see comment
 * below); a single parser keeps that trap fixed in one place. */
export async function fetchVersions(): Promise<VersionEntry[]> {
  const response = await fetch("/api/proxy/ontology/versions?page=1&per_page=50");
  if (!response.ok) throw new Error(`versions_failed_${response.status}`);
  const body = (await response.json()) as VersionsResponse | VersionEntry[];
  // The proxy returns a bare VersionEntry[] (unwrapped for the Explorer
  // VersionsPanel); tolerate the `{ versions }` envelope too. A 200 body
  // with neither shape (e.g. a workspace with no published model) must not
  // set state to undefined -- that crashes every `.map` consumer.
  return Array.isArray(body) ? body : (body?.versions ?? []);
}

/** Maps a publish response status to an outcome the UI can branch on --
 * 405 (already published) is treated the same as success (refetch, no
 * error) since the version already reached the state the click wanted. */
function outcomeFor(status: number): PublishOutcome {
  if (status === 200) return "published";
  if (status === 405) return "already_published";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "unavailable";
}

/** AC: fetches the version list on mount and exposes a `publish` action
 * that POSTs to the publish proxy and refetches the list on success (200)
 * or already-published (405) -- both leave the list stale otherwise. */
export function useVersions(): VersionsState {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchVersions()
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const publish = useCallback(async (versionIri: string): Promise<PublishOutcome> => {
    const response = await fetch(`/api/proxy/ontology/versions/${encodeURIComponent(versionIri)}/publish`, {
      method: "POST",
    });
    const outcome = outcomeFor(response.status);
    if (outcome === "published" || outcome === "already_published") {
      setReloadToken((token) => token + 1);
    }
    return outcome;
  }, []);

  return { versions, loading, error, publish };
}
