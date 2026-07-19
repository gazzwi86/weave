import { useEffect, useState } from "react";

import { tallyTriples } from "../tally-triples";

export interface TypeCounts {
  /** Instance count per kind id, from the CE-READ-1 SPARQL tally. */
  countsByKind: Record<string, number>;
  /** True only once the tally has loaded successfully -- the Instances
   * column shows the placeholder while loading or on a failed tally
   * rather than a false "0". */
  ready: boolean;
}

/** Per-kind instance counts for the Types page Instances column, from the
 * same CE-READ-1 tally the Overview widget uses (`tally-triples.ts`) -- one
 * mechanism, two consumers (C3). */
export function useTypeCounts(): TypeCounts {
  const [countsByKind, setCountsByKind] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tallyTriples()
      .then((tally) => {
        if (!cancelled) {
          setCountsByKind(tally.countsByKind);
          setReady(true);
        }
      })
      .catch(() => {
        // fail-soft: Instances column stays on the placeholder.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { countsByKind, ready };
}
