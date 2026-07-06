import { useEffect, useState } from "react";

import type { KindEntry } from "./chat/types";

/** Full BPMO kind list from the authoritative CE-READ-1 types endpoint —
 * shared by the authoring launcher (ce/page) and the Ontology/Types view. */
export function useKindList(): KindEntry[] {
  const [kinds, setKinds] = useState<KindEntry[]>([]);
  useEffect(() => {
    fetch("/api/ontology/types")
      .then((res) => (res.ok ? (res.json() as Promise<{ kinds: KindEntry[] }>) : null))
      .then((body) => setKinds(body?.kinds ?? []));
  }, []);
  return kinds;
}
