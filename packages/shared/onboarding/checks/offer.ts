import type { Anchor } from "../anchors";

/**
 * Per-anchor overlay gating (ADR-008, AC-001-05): an overlay (tour, beacon,
 * modal) is offered only once every anchor it targets is `shipped: true`.
 * An anchor missing from the registry entirely also withholds the overlay
 * (fail closed, not open).
 */
export function isOfferable(anchorIds: string[], registry: Record<string, Anchor>): boolean {
  return anchorIds.every((id) => registry[id]?.shipped === true);
}
