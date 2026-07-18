import type { BpmoKind } from "@/components/molecules/KindChip";

import type { NeighbourProps } from "./fetch-node-props";
import { humaniseRelName } from "./humanise-rel-name";

const KNOWN_KINDS: ReadonlySet<string> = new Set<BpmoKind>([
  "activity",
  "actor",
  "businesscapability",
  "businessdomain",
  "class",
  "concept",
  "dataasset",
  "event",
  "field",
  "goal",
  "policy",
  "process",
  "service",
  "system",
]);

/** Normalises a raw CE `bpmo_kind`/`typeLabel` string to the KindChip's
 * closed BpmoKind union -- an unmapped or absent kind (loading/error panel
 * states never carry one) returns null so callers fall back to a plain-text
 * header instead of a miscoloured chip. */
export function toBpmoKind(raw: string | undefined): BpmoKind | null {
  const key = raw?.toLowerCase();
  return key && KNOWN_KINDS.has(key) ? (key as BpmoKind) : null;
}

export interface EdgeRow {
  id: string;
  predicateLabel: string;
  targetLabel: string;
  targetIri: string;
  direction: "outgoing" | "incoming";
}

/** Maps a loaded node's neighbours to clickable edge rows for the
 * inspector's Edges section. The predicate is always humanised (never a
 * raw IRI, mirroring MissingLinks' own rule) -- fed an empty relationship
 * catalogue since the side panel doesn't carry CE's ontology types list,
 * so this falls back to the predicate's local IRI segment. */
export function toEdgeRows(neighbours: NeighbourProps[]): EdgeRow[] {
  return neighbours.map((neighbour, index) => ({
    id: `${neighbour.edgePredicate}-${neighbour.iri}-${index}`,
    predicateLabel: humaniseRelName(neighbour.edgePredicate, []),
    targetLabel: neighbour.label,
    targetIri: neighbour.iri,
    direction: neighbour.edgeDirection,
  }));
}
