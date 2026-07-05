"use client";

import { useEffect, useState } from "react";

import type { KindEntry } from "./types";

export interface UseKindShapeResult {
  shape: KindEntry | null;
  loading: boolean;
}

/** TASK-006 AC-006-07/AC-006-11: fetches CE-READ-1's kind catalogue fresh
 * every time a form opens (i.e. on every mount of the hook) -- no cache, so
 * an ontology update is picked up on the very next open, never a stale form.
 * ponytail: the brief's hint suggests a version-keyed cache; skipped -- the
 * catalogue is a few-KB fetch, so "always fresh" is simpler and correct.
 */
export function useKindShape(kindIri: string | null): UseKindShapeResult {
  const [shape, setShape] = useState<KindEntry | null>(null);

  useEffect(() => {
    if (!kindIri) return undefined;
    let cancelled = false;
    fetch("/api/ontology/types")
      .then((res) => (res.ok ? (res.json() as Promise<{ kinds: KindEntry[] }>) : null))
      .then((body) => {
        if (cancelled) return;
        setShape(body?.kinds.find((kind) => kind.iri === kindIri) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [kindIri]);

  // Derived, not stored -- avoids a second setState call inside the effect.
  return { shape, loading: kindIri !== null && shape === null };
}
