import type { Tour, WelcomeModal } from "../content/schema";

/**
 * AC-003-02: a modal's "Take a tour" CTA must reference a tour that exists
 * for that area. No-tour areas already can't declare a tour CTA (schema's
 * discriminated union only admits "tour" | "explore-freely" | "read-the-guide"),
 * so the remaining failure mode is a dangling `tourId`.
 */
export function checkDeadCtas(modals: WelcomeModal[], tours: Tour[]): string[] {
  const tourIds = new Set(tours.map((t) => t.tourId));
  const errors: string[] = [];

  for (const modal of modals) {
    for (const cta of modal.ctas) {
      if (cta.kind === "tour" && !tourIds.has(cta.tourId)) {
        errors.push(`modal "${modal.modalId}" CTA references missing tour "${cta.tourId}"`);
      }
    }
  }
  return errors;
}
