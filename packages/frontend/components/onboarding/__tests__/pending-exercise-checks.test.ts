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
};

describe("pendingExerciseChecks", () => {
  it("returns nothing outside a sandbox (no graph to check)", () => {
    expect(pendingExerciseChecks({ ...base, sandbox_forked_at: null })).toEqual([]);
  });

  it("lists exercise ids for incomplete exercise-backed items", () => {
    // business path: first-query (CE-02) + first-commit (CE-03, CE-03b).
    expect(pendingExerciseChecks(base)).toEqual(expect.arrayContaining(["CE-02", "CE-03", "CE-03b"]));
  });

  it("drops an item once any of its signals is already completed", () => {
    const done = { ...base, exercise_completions: [{ exercise_id: "CE-02", completed_at: "x" }] };
    expect(pendingExerciseChecks(done)).not.toContain("CE-02");
  });
});
