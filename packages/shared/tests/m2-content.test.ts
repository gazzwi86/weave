import { describe, expect, it } from "vitest";
import { runAllContentChecks } from "../onboarding/checks/run-all";
import { TOURS } from "../onboarding/content/tours";
import { BEACONS } from "../onboarding/content/beacons";
import { WELCOME_MODALS } from "../onboarding/content/modals";
import { CHECKLIST_ITEMS } from "../onboarding/content/checklist";
import { TRAINING_ENTRIES } from "../onboarding/content/training";

const M2_TOUR_IDS = ["tour.ge.completeness-map", "tour.plat.role-home", "tour.ge.trust-mechanics", "tour.ce.rules-policies"];

describe("M2 content bundle (AC-001-02/04)", () => {
  it("parses the full M1+M2 content bundle through zod and the CI suite green", () => {
    expect(runAllContentChecks()).toEqual([]);
  });

  it("provides exactly the four M2 tours, each with role-path tags", () => {
    const m2Tours = TOURS.filter((t) => M2_TOUR_IDS.includes(t.tourId));
    expect(m2Tours.map((t) => t.tourId).sort()).toEqual([...M2_TOUR_IDS].sort());
    for (const tour of m2Tours) {
      expect(tour.paths.length).toBeGreaterThan(0);
    }
  });

  it("provides at least one beacon per M2 tour anchor", () => {
    const m2Beacons = BEACONS.filter((b) => b.phase === "m2");
    expect(m2Beacons.length).toBeGreaterThanOrEqual(M2_TOUR_IDS.length);
  });

  it("provides the role-home welcome modal", () => {
    const modal = WELCOME_MODALS.find((m) => m.modalId === "welcome-role-home");
    expect(modal).toBeDefined();
    expect(modal!.ctas.some((c) => c.kind === "tour" && c.tourId === "tour.plat.role-home")).toBe(true);
  });

  it("provides checklist.add-competency-questions tagged Business + Technical, manual auto-complete", () => {
    const item = CHECKLIST_ITEMS.find((i) => i.itemId === "add-competency-questions");
    expect(item).toBeDefined();
    expect(item!.paths.sort()).toEqual(["business", "technical"]);
    expect(item!.autoCompleteOn).toBe("manual");
  });

  it("deep-links to the training-library article, which resolves to a real training entry", () => {
    const item = CHECKLIST_ITEMS.find((i) => i.itemId === "add-competency-questions")!;
    const training = TRAINING_ENTRIES.find((t) => item.deepLink === `/training/${t.trainingId}`);
    expect(training).toBeDefined();
  });
});
