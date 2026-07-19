import { describe, expect, it } from "vitest";

import { pendingExerciseChecks } from "../checklist-widget";

const base = {
  role_path: "business" as const,
  checklist_dismissed_at: null,
  checklist_completed_at: null,
  checklist_auto_dismiss_days: 7,
  sandbox_workspace_id: "ws-1",
  sandbox_forked_at: "2026-07-16T10:00:00Z",
  tours: [],
  exercise_completions: [] as { exercise_id: string; completed_at: string }[],
  activations: [],
  // business/default: everything but the technical-only CE-03.
  available_exercises: ["CE-01", "CE-02", "CE-03b", "GE-01", "GE-02"],
};

describe("pendingExerciseChecks", () => {
  it("returns nothing outside a sandbox (no graph to check)", () => {
    expect(pendingExerciseChecks({ ...base, sandbox_forked_at: null })).toEqual([]);
  });

  it("lists exercise ids for incomplete exercise-backed items", () => {
    // business path: first-query (CE-02) + first-commit (CE-03b -- CE-03 is
    // technical-only, excluded via available_exercises below).
    expect(pendingExerciseChecks(base)).toEqual(expect.arrayContaining(["CE-02", "CE-03b"]));
  });

  it("drops an item once any of its signals is already completed", () => {
    const done = { ...base, exercise_completions: [{ exercise_id: "CE-02", completed_at: "x" }] };
    expect(pendingExerciseChecks(done)).not.toContain("CE-02");
  });

  // T8: the checklist client must skip an exercise id gate_exercise (server
  // -side) wouldn't allow -- checking it would only earn an avoidable 403.
  it("excludes an exercise gated out for this role (path_gated) even though the item lists it as a signal", () => {
    expect(pendingExerciseChecks(base)).not.toContain("CE-03");
  });

  it("excludes a write exercise gated out by a read_only sandbox variant (read_only_locked)", () => {
    const readOnly = { ...base, available_exercises: base.available_exercises.filter((id) => id !== "CE-02") };
    expect(pendingExerciseChecks(readOnly)).not.toContain("CE-02");
  });
});
