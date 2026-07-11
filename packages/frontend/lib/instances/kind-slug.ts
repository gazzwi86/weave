import type { BpmoKind } from "@/components/molecules/KindChip";

/** The 14 kind slugs `KindChip` actually renders a colour/glyph pair for --
 * mirrors `KindChip.tsx`'s `BpmoKind` union so an ontology-extension kind
 * that isn't one of the 14 falls back safely instead of crashing.
 */
const KNOWN_KIND_SLUGS = new Set<BpmoKind>([
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

export const FALLBACK_KIND: BpmoKind = "concept";

function localName(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  return iri.slice(Math.max(hashIndex, slashIndex) + 1);
}

/** Deterministic kind-IRI -> `KindChip` slug mapping (AC-1): same kind IRI
 * always resolves to the same chip. A kind outside the shipped 14-kind
 * glyph set (a future client-extension kind) falls back to `concept`
 * rather than throwing -- the chip is still colour+glyph-paired, just not
 * kind-distinguishing for that one extension case.
 */
export function kindIriToSlug(kindIri: string): BpmoKind {
  const slug = localName(kindIri).toLowerCase();
  return KNOWN_KIND_SLUGS.has(slug as BpmoKind) ? (slug as BpmoKind) : FALLBACK_KIND;
}
