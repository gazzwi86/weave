import { describe, expect, it } from "vitest";

import { deriveChecklist, isChecklistItemOpen, shouldAutoDismiss } from "../onboarding/derive-checklist";
import type { ChecklistItem } from "../onboarding/content/schema";
import type { ChecklistSignals } from "../onboarding/derive-checklist";

const emptySignals: ChecklistSignals = {
  sandboxWorkspaceId: null,
  sandboxForkedAt: null,
  tours: [],
  exerciseCompletions: [],
  activations: [],
};

function item(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    itemId: "x",
    paths: ["business"],
    phase: "m1",
    labelKey: "onboarding.checklist.visit-demo.label",
    whyKey: "onboarding.checklist.visit-demo.why",
    deepLink: "/ce/overview",
    autoCompleteOn: "demo_visit",
    ...overrides,
  };
}

describe("deriveChecklist -- signal derivation matrix (AC-010-02)", () => {
  it("demo_visit: unchecked when sandbox_workspace_id is null", () => {
    const result = deriveChecklist([item({ autoCompleteOn: "demo_visit" })], emptySignals);
    expect(result.items[0]!.checked).toBe(false);
    expect(result.items[0]!.completedAt).toBeNull();
  });

  it("demo_visit: checked with timestamp when sandbox_workspace_id is set", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      sandboxWorkspaceId: "ws-1",
      sandboxForkedAt: "2026-01-01T00:00:00Z",
    };
    const result = deriveChecklist([item({ autoCompleteOn: "demo_visit" })], signals);
    expect(result.items[0]!.checked).toBe(true);
    expect(result.items[0]!.completedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("tour_complete: only ticks when the referenced tour_id is complete", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      tours: [{ tour_id: "ge-canvas", completed_at: "2026-02-01T00:00:00Z" }],
    };
    const other = item({ autoCompleteOn: "tour_complete", signalRefs: ["ce-overview"] });
    const match = item({ autoCompleteOn: "tour_complete", signalRefs: ["ge-canvas"] });

    const result = deriveChecklist([other, match], signals);

    expect(result.items[0]!.checked).toBe(false);
    expect(result.items[1]!.checked).toBe(true);
    expect(result.items[1]!.completedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("tour_complete: not ticked if the tour has progress but no completed_at", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      tours: [{ tour_id: "ge-canvas", completed_at: null }],
    };
    const result = deriveChecklist(
      [item({ autoCompleteOn: "tour_complete", signalRefs: ["ge-canvas"] })],
      signals
    );
    expect(result.items[0]!.checked).toBe(false);
  });

  it("exercise_complete: disambiguates two items sharing the same autoCompleteOn kind", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      exerciseCompletions: [{ exercise_id: "CE-02", completed_at: "2026-03-01T00:00:00Z" }],
    };
    const firstQuery = item({ autoCompleteOn: "exercise_complete", signalRefs: ["CE-02"] });
    const firstCommit = item({
      autoCompleteOn: "exercise_complete",
      signalRefs: ["CE-03", "CE-03b"],
    });

    const result = deriveChecklist([firstQuery, firstCommit], signals);

    expect(result.items[0]!.checked).toBe(true);
    expect(result.items[1]!.checked).toBe(false);
  });

  it("exercise_complete: any signalRef in the list satisfies the item", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      exerciseCompletions: [{ exercise_id: "CE-03b", completed_at: "2026-03-02T00:00:00Z" }],
    };
    const result = deriveChecklist(
      [item({ autoCompleteOn: "exercise_complete", signalRefs: ["CE-03", "CE-03b"] })],
      signals
    );
    expect(result.items[0]!.checked).toBe(true);
  });

  it("activation_milestone: ticks from the activation row's milestone_id", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      activations: [
        { milestone_id: "first_committed_entity", activated_at: "2026-04-01T00:00:00Z", source: "poll" },
      ],
    };
    const result = deriveChecklist(
      [item({ autoCompleteOn: "activation_milestone", signalRefs: ["first_committed_entity"] })],
      signals
    );
    expect(result.items[0]!.checked).toBe(true);
    expect(result.items[0]!.completedAt).toBe("2026-04-01T00:00:00Z");
  });

  it("manual: ticks from a manual-source activation row (self-mark)", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      activations: [{ milestone_id: "invite_admin", activated_at: "2026-05-01T00:00:00Z", source: "manual" }],
    };
    const result = deriveChecklist(
      [item({ autoCompleteOn: "manual", signalRefs: ["invite_admin"] })],
      signals
    );
    expect(result.items[0]!.checked).toBe(true);
  });

  it("locked items never derive from a signal, regardless of match", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      activations: [{ milestone_id: "invite_admin", activated_at: "2026-05-01T00:00:00Z", source: "manual" }],
    };
    const result = deriveChecklist(
      [
        item({
          autoCompleteOn: "manual",
          signalRefs: ["invite_admin"],
          lockedUntilPhase: "post-v1",
        }),
      ],
      signals
    );
    expect(result.items[0]!.locked).toBe(true);
    expect(result.items[0]!.checked).toBe(false);
  });

  it("badge passes through only while the item is unchecked", () => {
    const checked = deriveChecklist(
      [item({ autoCompleteOn: "manual", signalRefs: ["invite_admin"], badge: "pending-platform-signal" })],
      {
        ...emptySignals,
        activations: [{ milestone_id: "invite_admin", activated_at: "2026-05-01T00:00:00Z", source: "manual" }],
      }
    );
    expect(checked.items[0]!.badge).toBeUndefined();

    const unchecked = deriveChecklist(
      [item({ autoCompleteOn: "manual", signalRefs: ["invite_admin"], badge: "pending-platform-signal" })],
      emptySignals
    );
    expect(unchecked.items[0]!.badge).toBe("pending-platform-signal");
  });
});

describe("deriveChecklist -- 100% completion (AC-010-04)", () => {
  it("allComplete is false when any non-locked item is unchecked", () => {
    const result = deriveChecklist(
      [item({ autoCompleteOn: "demo_visit" }), item({ autoCompleteOn: "manual", signalRefs: ["x"] })],
      { ...emptySignals, sandboxWorkspaceId: "ws-1", sandboxForkedAt: "2026-01-01T00:00:00Z" }
    );
    expect(result.allComplete).toBe(false);
  });

  it("allComplete is true once every non-locked item is checked", () => {
    const result = deriveChecklist(
      [item({ autoCompleteOn: "demo_visit" })],
      { ...emptySignals, sandboxWorkspaceId: "ws-1", sandboxForkedAt: "2026-01-01T00:00:00Z" }
    );
    expect(result.allComplete).toBe(true);
  });

  it("a locked item is excluded from the completion gate", () => {
    const result = deriveChecklist(
      [
        item({ autoCompleteOn: "demo_visit" }),
        item({ autoCompleteOn: "manual", lockedUntilPhase: "post-v1" }),
      ],
      { ...emptySignals, sandboxWorkspaceId: "ws-1", sandboxForkedAt: "2026-01-01T00:00:00Z" }
    );
    expect(result.allComplete).toBe(true);
  });

  it("empty item list is vacuously complete", () => {
    expect(deriveChecklist([], emptySignals).allComplete).toBe(true);
  });
});

describe("shouldAutoDismiss -- auto-dismiss window arithmetic (AC-010-04)", () => {
  it("false before the window elapses", () => {
    const completedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-05T00:00:00Z");
    expect(shouldAutoDismiss(completedAt, now, 7)).toBe(false);
  });

  it("true once the window has fully elapsed", () => {
    const completedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-08T00:00:00Z");
    expect(shouldAutoDismiss(completedAt, now, 7)).toBe(true);
  });

  it("respects a tenant-tunable window, not a hard-coded 7", () => {
    const completedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-03T00:00:00Z");
    expect(shouldAutoDismiss(completedAt, now, 2)).toBe(true);
  });
});

describe("isChecklistItemOpen -- competency-question beacon gate (ONB-V1-TASK-003 AC-003-03/04)", () => {
  const competencyItem = item({
    itemId: "add-competency-questions",
    paths: ["business", "technical"],
    phase: "m2",
    autoCompleteOn: "manual",
    signalRefs: ["add_competency_questions"],
    lockedUntilPhase: "m2",
  });

  it("open when the item is unlocked (phase=m2) and not yet signalled", () => {
    expect(isChecklistItemOpen("add-competency-questions", [competencyItem], emptySignals, "business", "m2")).toBe(
      true
    );
  });

  it("not open when locked -- currentPhase not m2", () => {
    expect(isChecklistItemOpen("add-competency-questions", [competencyItem], emptySignals, "business", "m1")).toBe(
      false
    );
  });

  it("not open once signalled complete (self-marked)", () => {
    const signals: ChecklistSignals = {
      ...emptySignals,
      activations: [{ milestone_id: "add_competency_questions", activated_at: "2026-01-01T00:00:00Z", source: "manual" }],
    };
    expect(isChecklistItemOpen("add-competency-questions", [competencyItem], signals, "business", "m2")).toBe(false);
  });

  it("not open for a role path the item isn't offered on", () => {
    expect(isChecklistItemOpen("add-competency-questions", [competencyItem], emptySignals, "compliance", "m2")).toBe(
      false
    );
  });

  it("not open when the item id doesn't exist", () => {
    expect(isChecklistItemOpen("nonexistent-item", [competencyItem], emptySignals, "business", "m2")).toBe(false);
  });
});
