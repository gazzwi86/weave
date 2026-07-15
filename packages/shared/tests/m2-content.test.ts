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

  // Not 1-per-tour: AC-004-03 scopes the M2 trust-mechanics beacon budget to
  // the one on ge.versions.panel only -- tour.ce.rules-policies has no
  // run-report control to hint at, so it intentionally gets zero beacons
  // (m2-delta.md §3 re-anchoring note in beacons.ts).
  it("provides the M2 beacon set (completeness-map, role-home, trust-mechanics)", () => {
    const m2BeaconIds = BEACONS.filter((b) => b.phase === "m2")
      .map((b) => b.beaconId)
      .sort();
    expect(m2BeaconIds).toEqual(["ge-completeness-map", "ge-trust-mechanics", "plat-role-home"]);
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
