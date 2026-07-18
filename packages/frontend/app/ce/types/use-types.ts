import { useEffect, useState } from "react";

import type { KindEntry, PropertyShape } from "../chat/types";

export interface TypesState {
  kinds: KindEntry[];
  /** Relationship-typed property shapes CE-READ-1 already returns alongside
   * `kinds` in the same response body -- the Types view's "Relationships"
   * filter reads this instead of a second fetch. */
  relationships: PropertyShape[];
  loading: boolean;
  loadError: boolean;
  reload: () => void;
}

/** IRI last segment -- `KindChip` keys its token/glyph lookup on this. */
export function kindId(iri: string): string {
  const segments = iri.split(/[/#]/).filter(Boolean);
  return segments[segments.length - 1] ?? iri;
}

/** Ontology/Types view state: the authoritative CE-READ-1 kind catalogue.
 * `KindChip` derives its colour/glyph purely from the kind name via CSS
 * tokens (`color.md`), so there is no second palette fetch to join. */
export function useTypes(): TypesState {
  const [kinds, setKinds] = useState<KindEntry[]>([]);
  const [relationships, setRelationships] = useState<PropertyShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ontology/types", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("types_failed");
        }
        return res.json() as Promise<{ kinds: KindEntry[]; relationships?: PropertyShape[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setKinds(body.kinds);
          setRelationships(body.relationships ?? []);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = () => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  };

  return { kinds, relationships, loading, loadError, reload };
}
