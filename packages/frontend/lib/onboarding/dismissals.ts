import { ANCHORS } from "../../../shared/onboarding/anchors";
import type { AreaId } from "../../../shared/onboarding/types";
import type { WelcomeModal } from "../../../shared/onboarding/content/schema";

export type DismissalKind = "beacon" | "welcome_modal";

export interface DismissalRecord {
  kind: DismissalKind;
  ref_id: string;
}

/** AC-008-02/04: first-visit/undismissed detection is "no dismissal row". */
export function isDismissed(dismissals: DismissalRecord[], kind: DismissalKind, refId: string): boolean {
  return dismissals.some((d) => d.kind === kind && d.ref_id === refId);
}

/** AC-008-06: an area is shipped once any of its anchors is (uniform flag-off). */
export function isAreaShipped(area: AreaId): boolean {
  return Object.values(ANCHORS).some((anchor) => anchor.area === area && anchor.shipped);
}

/** AC-008-05: CTA label key per config kind -- dead-CTA-safe by construction. */
export function ctaLabelKeys(modal: WelcomeModal): string[] {
  return modal.ctas.map((cta) => (cta.kind === "tour" ? "onboarding.cta.take-a-tour" : cta.labelKey));
}
