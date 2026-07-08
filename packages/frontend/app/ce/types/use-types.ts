import { useEffect, useState } from "react";

import type { KindEntry } from "../chat/types";

export interface TypesState {
  kinds: KindEntry[];
  /** kind id (IRI last segment) → CSS colour token from /api/proxy/node-kinds. */
  colourByKindId: Record<string, string>;
  loading: boolean;
  loadError: boolean;
}

/** IRI last segment — same derivation the node-kinds proxy uses for its
 * `id`, so colours join back to catalogue kinds without a second mapping. */
export function kindId(iri: string): string {
  const segments = iri.split(/[/#]/).filter(Boolean);
  return segments[segments.length - 1] ?? iri;
}

interface NodeKind {
  id: string;
  colour: string;
}

/** Ontology/Types view state: the authoritative CE-READ-1 kind catalogue
 * plus the Explorer palette for colour dots. Palette failure is cosmetic
 * (rows fall back to the grey token); only a catalogue failure is an error.
 */
export function useTypes(): TypesState {
  const [kinds, setKinds] = useState<KindEntry[]>([]);
  const [colourByKindId, setColourByKindId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ontology/types", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("types_failed");
        }
        return res.json() as Promise<{ kinds: KindEntry[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setKinds(body.kinds);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setLoading(false);
        }
      });

    fetch("/api/proxy/node-kinds", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ kinds: NodeKind[] }>) : null))
      .then((body) => {
        if (!controller.signal.aborted && body) {
          setColourByKindId(
            Object.fromEntries(body.kinds.map((kind) => [kind.id, kind.colour]))
          );
        }
      })
      .catch(() => {
        /* palette is decorative — grey fallback covers it */
      });

    return () => controller.abort();
  }, []);

  return { kinds, colourByKindId, loading, loadError };
}
