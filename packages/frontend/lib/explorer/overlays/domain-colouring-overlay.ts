import type { Overlay } from "../overlay-engine";

export interface DomainColouringConfig {
  /** Bulk-loaded edge label to read domain membership from (config.ts's
   * domainMembershipPredicate) -- never fetched separately. */
  membershipPredicate: string;
  /** Categorical series palette, cycled on overflow (AC-3). */
  palette: string[];
  /** Fallback colour for a node with no domain-membership edge. */
  noneColour: string;
}

// ponytail: RED-step stub -- real body in the next commit.
export function createDomainColouringOverlay(_config: DomainColouringConfig): Overlay {
  throw new Error("not implemented");
}
