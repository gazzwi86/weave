"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchGlossaryBrowse } from "@/lib/glossary/fetch-glossary-browse";
import type { GlossaryBrowseRow } from "@/lib/glossary/types";

const TIMEOUT_MS = 5000;

export interface GlossaryBrowseState {
  rows: GlossaryBrowseRow[];
  loading: boolean;
  error: boolean;
  page: number;
  nextPage: () => void;
  prevPage: () => void;
  reload: () => void;
}

/** AC-002-03: fetches one 50-row browse page via the CE-READ-1 proxy,
 * ordered by prefLabel with broader/narrower rolled up per term. `reload`
 * lets a successful term create (AC-002-02) refresh the currently viewed
 * page without a full page reload. */
export function useGlossaryBrowse(): GlossaryBrowseState {
  const [rows, setRows] = useState<GlossaryBrowseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Re-arms the loading flag on every page/reload change (not just mount);
    // same accepted pattern -- and same lint exception -- as
    // use-ce-chat.ts's post-mount history hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchGlossaryBrowse(page, TIMEOUT_MS).then((result) => {
      if (cancelled) return;
      if (result.type === "ok") {
        setRows(result.rows);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  const nextPage = useCallback(() => setPage((current) => current + 1), []);
  const prevPage = useCallback(() => setPage((current) => Math.max(1, current - 1)), []);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { rows, loading, error, page, nextPage, prevPage, reload };
}
