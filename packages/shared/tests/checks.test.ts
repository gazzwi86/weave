import { describe, expect, it } from "vitest";
import { checkDeadCtas } from "../onboarding/checks/dead-cta";
import { checkCopyBudgets } from "../onboarding/checks/copy-budget";
import { checkExerciseRoleSplit } from "../onboarding/checks/tag-presence";
import { checkKeysAreRegistered } from "../onboarding/checks/key-format";
import type { Tour, WelcomeModal, Beacon, Exercise } from "../onboarding/content/schema";

const baseTour: Tour = {
  tourId: "t1",
  area: "constitution",
  paths: ["business"],
  phase: "m1",
  steps: [{ anchorId: "ce.overview", titleKey: "x.title", bodyKey: "x.body" }],
};

describe("checkDeadCtas (AC-003-02)", () => {
  it("passes when the referenced tour exists", () => {
    const modal: WelcomeModal = {
      modalId: "m1",
      area: "constitution",
      titleKey: "x.t",
      bodyKey: "x.b",
      ctas: [{ kind: "tour", tourId: "t1" }],
    };
    expect(checkDeadCtas([modal], [baseTour])).toEqual([]);
  });

  it("fails on a fixture referencing a tour that doesn't exist (dead CTA)", () => {
    const modal: WelcomeModal = {
      modalId: "m1",
      area: "constitution",
      titleKey: "x.t",
      bodyKey: "x.b",
      ctas: [{ kind: "tour", tourId: "does-not-exist" }],
    };
    const errors = checkDeadCtas([modal], []);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("does-not-exist");
  });
});

describe("checkCopyBudgets (AC-003-03)", () => {
  it("passes copy within budget", () => {
    expect(checkCopyBudgets([baseTour], [])).toEqual([]);
  });

  it("fails a fixture whose resolved en string exceeds the tour word budget", () => {
    const overBudget: Tour = {
      ...baseTour,
      steps: [{ anchorId: "ce.overview", titleKey: "x.title", bodyKey: "onboarding.fixture.over-budget-tour" }],
    };
    const errors = checkCopyBudgets([overBudget], []);
    expect(errors).toHaveLength(1);
  });

  it("fails a fixture whose resolved en string exceeds the beacon word budget", () => {
    const beacon: Beacon = {
      beaconId: "b1",
      anchorId: "ce.overview",
      paths: ["business"],
      phase: "m1",
      bodyKey: "onboarding.fixture.over-budget-beacon",
    };
    const errors = checkCopyBudgets([], [beacon]);
    expect(errors).toHaveLength(1);
  });
});

describe("checkExerciseRoleSplit (AC-003-04, FR-016)", () => {
  it("passes when CE-03 is technical-only and CE-03b includes business", () => {
    const ce03: Exercise = {
      exerciseId: "CE-03",
      paths: ["technical"],
      phase: "m1",
      goalKey: "x",
      stepKeys: ["a", "b", "c"],
      completion: { kind: "write_commit" },
    };
    const ce03b: Exercise = { ...ce03, exerciseId: "CE-03b", paths: ["business"] };
    expect(checkExerciseRoleSplit([ce03, ce03b])).toEqual([]);
  });

  it("fails a fixture where CE-03 is not technical-only", () => {
    const ce03: Exercise = {
      exerciseId: "CE-03",
      paths: ["business", "technical"],
      phase: "m1",
      goalKey: "x",
      stepKeys: ["a", "b", "c"],
      completion: { kind: "write_commit" },
    };
    expect(checkExerciseRoleSplit([ce03])).toHaveLength(1);
  });

  it("fails a fixture where CE-03b omits business", () => {
    const ce03b: Exercise = {
      exerciseId: "CE-03b",
      paths: ["technical"],
      phase: "m1",
      goalKey: "x",
      stepKeys: ["a", "b", "c"],
      completion: { kind: "write_commit" },
    };
    expect(checkExerciseRoleSplit([ce03b])).toHaveLength(1);
  });
});

describe("checkKeysAreRegistered (AC-003-06)", () => {
  it("passes a well-formed, registered key", () => {
    expect(checkKeysAreRegistered(["onboarding.whats-new.launch.title"])).toEqual([]);
  });

  it("fails a fixture that is a literal string instead of a key", () => {
    const errors = checkKeysAreRegistered(["Take a tour of the graph"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("literal");
  });

  it("fails a fixture with a well-formed but unregistered key", () => {
    const errors = checkKeysAreRegistered(["onboarding.fixture.does-not-exist"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("catalogue");
  });
});
