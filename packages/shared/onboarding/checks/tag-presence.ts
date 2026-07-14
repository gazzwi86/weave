import type { Exercise } from "../content/schema";

/**
 * AC-003-04: phase/role-tag presence is enforced structurally -- `phase` and
 * `paths` are required, non-empty fields on every Tour/Beacon/Exercise/
 * ChecklistItem schema, so a missing tag is already a zod parse failure.
 * This check covers the one rule zod's shape can't express: CE-03 is
 * Technical-only and CE-03b is Business (FR-016).
 */
export function checkExerciseRoleSplit(exercises: Exercise[]): string[] {
  const errors: string[] = [];
  const ce03 = exercises.find((e) => e.exerciseId === "CE-03");
  const ce03b = exercises.find((e) => e.exerciseId === "CE-03b");

  if (ce03 && (ce03.paths.length !== 1 || ce03.paths[0] !== "technical")) {
    errors.push('CE-03 must be Technical-only (FR-016)');
  }
  if (ce03b && !ce03b.paths.includes("business")) {
    errors.push('CE-03b must include the Business path (FR-016)');
  }
  return errors;
}
