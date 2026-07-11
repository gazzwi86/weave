"use client";

import { useEffect, useState } from "react";

import { getAttribution } from "./attribution";
import { paginate, standardsQuery, toStandardRow, toVoiceRuleRow, voiceRulesQuery } from "./queries";
import type { Attribution, BrandStandardRow, VoiceRuleRow } from "./types";

export type BrandKind = "standard" | "voice-rule";

interface SparqlResponseBody {
  rows: Record<string, string | undefined>[];
}

// Flat string rows -- real shape of POST /api/proxy/sparql (see queries.ts's
// SparqlRow docstring), not a raw `{ results: { bindings } }` term wrapper.
async function fetchRows(kind: BrandKind, page: number): Promise<Record<string, string | undefined>[]> {
  const query = kind === "standard" ? standardsQuery(page) : voiceRulesQuery(page);
  const res = await fetch("/api/proxy/sparql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`brand_list_failed_${res.status}`);
  const body = (await res.json()) as SparqlResponseBody;
  return body.rows;
}

export interface UseBrandListResult {
  rows: (BrandStandardRow | VoiceRuleRow)[];
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  /** AC-004-03: per-row PROV attribution -- null when this item wasn't
   * created in this browser session (see attribution.ts's docstring for
   * why that's the honest ceiling, not a bug). */
  attributionFor: (iri: string) => Attribution | null;
}

/** AC-004-03: individuals straight from the draft graph (CE-READ-1 via the
 * existing arbitrary-SELECT proxy), not the CE-BRAND-1 projection -- see
 * the task brief's Design Decision. Re-fetches on every (kind, page)
 * change; no cache, same freshness posture as `use-kind-shape.ts`.
 */
export function useBrandList(kind: BrandKind, page: number): UseBrandListResult {
  const [rows, setRows] = useState<(BrandStandardRow | VoiceRuleRow)[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  // `loading` is derived from comparing the in-flight key to the last
  // *completed* key (set only inside the async .finally, never
  // synchronously in the effect body) -- same "derived, not stored" shape
  // as use-kind-shape.ts, and avoids the react-hooks/set-state-in-effect
  // rule a synchronous `setLoading(true)` at the top of the effect trips.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${kind}:${page}`;

  useEffect(() => {
    let cancelled = false;
    fetchRows(kind, page)
      .then((bindings) => {
        if (cancelled) return;
        const mapped: (BrandStandardRow | VoiceRuleRow)[] =
          kind === "standard" ? bindings.map(toStandardRow) : bindings.map(toVoiceRuleRow);
        const { pageRows, hasMore: more } = paginate(mapped);
        setRows(pageRows);
        setHasMore(more);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, page, requestKey]);

  return { rows, hasMore, loading: loadedKey !== requestKey, error, attributionFor: getAttribution };
}
